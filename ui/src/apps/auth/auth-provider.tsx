import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { api, ApiError } from "@/lib/api";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.auth
      .session()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await api.auth.login(email, password);
    const session = await api.auth.session();
    setUser(session);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        // Already logged out
      } else {
        throw e;
      }
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
