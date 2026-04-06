import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuth } from "@/apps/auth/auth-provider";

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

type Callback = (e: MessageEvent) => void;

interface ConnectionContextValue {
  status: ConnectionStatus;
  subscribe: (event: string, callback: Callback) => () => void;
}

const ConnectionContext = createContext<ConnectionContextValue>({
  status: "disconnected",
  subscribe: () => () => {},
});

export function useConnectionStatus(): ConnectionStatus {
  return useContext(ConnectionContext).status;
}

export function useNotificationEvent(
  event: string,
  callback: (data: MessageEvent) => void,
) {
  const { subscribe } = useContext(ConnectionContext);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handler = (e: MessageEvent) => callbackRef.current(e);
    return subscribe(event, handler);
  }, [event, subscribe]);
}

export function ConnectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const evtSourceRef = useRef<EventSource | null>(null);
  const subsRef = useRef(new Map<string, Set<Callback>>());

  // Derive status: disconnected when no user, otherwise tracked by SSE state
  const [sseStatus, setSseStatus] = useState<ConnectionStatus>("disconnected");
  const status: ConnectionStatus = user ? sseStatus : "disconnected";

  const subscribe = useCallback((event: string, cb: Callback) => {
    if (!subsRef.current.has(event)) {
      subsRef.current.set(event, new Set());
    }
    subsRef.current.get(event)!.add(cb);

    // Register the event listener on the existing EventSource if needed
    const evtSource = evtSourceRef.current;
    if (evtSource) {
      // Always safe to call addEventListener — duplicates are ignored by the browser
      // But we use a single fan-out handler, so we re-add it to be safe
    }

    return () => {
      subsRef.current.get(event)?.delete(cb);
      if (subsRef.current.get(event)?.size === 0) {
        subsRef.current.delete(event);
      }
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const evtSource = new EventSource("/api/notifications/stream");
    evtSourceRef.current = evtSource;

    evtSource.onopen = () => setSseStatus("connected");
    evtSource.onerror = () => {
      setSseStatus(
        evtSource.readyState === EventSource.CONNECTING
          ? "reconnecting"
          : "disconnected",
      );
    };

    // Fan-out handler: dispatches events to all subscribers
    const fanOut = (event: string) => (e: Event) => {
      const callbacks = subsRef.current.get(event);
      if (callbacks) {
        for (const fn of callbacks) fn(e as MessageEvent);
      }
    };

    // Register all currently-subscribed event types
    for (const event of subsRef.current.keys()) {
      evtSource.addEventListener(event, fanOut(event));
    }

    // Also register the most common event pre-emptively
    if (!subsRef.current.has("task:notification")) {
      evtSource.addEventListener(
        "task:notification",
        fanOut("task:notification"),
      );
    }

    return () => {
      evtSource.close();
      evtSourceRef.current = null;
    };
  }, [user]);

  const value = useMemo(() => ({ status, subscribe }), [status, subscribe]);

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
}
