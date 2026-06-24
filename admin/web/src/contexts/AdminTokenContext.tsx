import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchAuthMe, login as apiLogin, logout as apiLogout } from "@/lib/api";

const LEGACY_TOKEN_KEY = "admin_token";

export type AuthUser = { id: number; username: string };

interface AuthContextValue {
  /** 兼容旧逻辑：session 登录时为 "session"，legacy token 时为真实 token */
  token: string;
  user: AuthUser | null;
  loading: boolean;
  legacyToken: string;
  setLegacyToken: (t: string) => void;
  saveLegacyToken: (t: string) => void;
  login: (username: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AdminTokenProvider({ children }: { children: ReactNode }) {
  const [legacyToken, setLegacyToken] = useState(() => localStorage.getItem(LEGACY_TOKEN_KEY) ?? "");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const r = await fetchAuthMe();
    if (r.ok && r.data.authenticated && r.data.user) {
      setUser(r.data.user);
    } else {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void refreshSession().finally(() => setLoading(false));
  }, [refreshSession]);

  const saveLegacyToken = useCallback((t: string) => {
    setLegacyToken(t);
    localStorage.setItem(LEGACY_TOKEN_KEY, t);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const r = await apiLogin(username, password);
    if (!r.ok) return { ok: false as const, error: r.error };
    setUser(r.data.user);
    setLegacyToken("");
    try {
      localStorage.removeItem(LEGACY_TOKEN_KEY);
    } catch {
      /* ignore */
    }
    return { ok: true as const };
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setLegacyToken("");
    try {
      localStorage.removeItem(LEGACY_TOKEN_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const token = useMemo(
    () => (user ? "session" : legacyToken),
    [legacyToken, user],
  );

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      legacyToken,
      setLegacyToken,
      saveLegacyToken,
      login,
      logout,
      refreshSession,
    }),
    [token, user, loading, legacyToken, saveLegacyToken, login, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAdminToken() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAdminToken must be used within AdminTokenProvider");
  return ctx;
}

export function useAuth() {
  return useAdminToken();
}
