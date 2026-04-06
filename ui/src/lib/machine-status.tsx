import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";

import { useAuth } from "@/apps/auth/auth-provider";

type Callback = (data: {
  machine_id: string;
  status: string;
  last_seen_at: string;
}) => void;

interface MachineStatusContextValue {
  subscribe: (callback: Callback) => () => void;
}

const MachineStatusContext = createContext<MachineStatusContextValue>({
  subscribe: () => () => {},
});

/**
 * Subscribe to machine:status events from the shared /api/machines/stream SSE connection.
 * The callback receives parsed { machine_id, status, last_seen_at } on each event.
 */
export function useMachineStatusEvent(callback: Callback) {
  const { subscribe } = useContext(MachineStatusContext);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handler: Callback = (data) => callbackRef.current(data);
    return subscribe(handler);
  }, [subscribe]);
}

export function MachineStatusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const subsRef = useRef(new Set<Callback>());

  const subscribe = useCallback((cb: Callback) => {
    subsRef.current.add(cb);
    return () => {
      subsRef.current.delete(cb);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const evtSource = new EventSource("/api/machines/stream");

    evtSource.addEventListener("machine:status", (e) => {
      try {
        const data = JSON.parse(e.data) as {
          machine_id: string;
          status: string;
          last_seen_at: string;
        };
        for (const fn of subsRef.current) fn(data);
      } catch {
        // ignore parse errors
      }
    });

    return () => evtSource.close();
  }, [user]);

  const value = useMemo(() => ({ subscribe }), [subscribe]);

  return (
    <MachineStatusContext.Provider value={value}>
      {children}
    </MachineStatusContext.Provider>
  );
}
