import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "dialga-unread";

interface UnreadContextValue {
  markAsRead: (threadId: string) => void;
  isUnread: (threadId: string, updatedAt: string) => boolean;
  getUnreadCount: (
    threads: Array<{ id: string; updated_at: string }>,
  ) => number;
}

const UnreadContext = createContext<UnreadContextValue | null>(null);

function loadReadMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function saveReadMap(map: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function UnreadProvider({ children }: { children: ReactNode }) {
  const [readMap, setReadMap] = useState<Record<string, string>>(loadReadMap);

  // Cross-tab sync via storage event
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setReadMap(loadReadMap());
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const markAsRead = useCallback((threadId: string) => {
    setReadMap((prev) => {
      const next = { ...prev, [threadId]: new Date().toISOString() };
      saveReadMap(next);
      return next;
    });
  }, []);

  const isUnread = useCallback(
    (threadId: string, updatedAt: string) => {
      const lastRead = readMap[threadId];
      if (!lastRead) return true;
      return new Date(updatedAt).getTime() > new Date(lastRead).getTime();
    },
    [readMap],
  );

  const getUnreadCount = useCallback(
    (threads: Array<{ id: string; updated_at: string }>) => {
      return threads.filter((t) => isUnread(t.id, t.updated_at)).length;
    },
    [isUnread],
  );

  const value = useMemo(
    () => ({ markAsRead, isUnread, getUnreadCount }),
    [markAsRead, isUnread, getUnreadCount],
  );

  return (
    <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>
  );
}

export function useUnread() {
  const ctx = useContext(UnreadContext);
  if (!ctx) throw new Error("useUnread must be used within UnreadProvider");
  return ctx;
}
