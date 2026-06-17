import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

const STORAGE_KEY = "admin_token";

interface AdminTokenContextValue {
  token: string;
  setToken: (t: string) => void;
  saveToken: (t: string) => void;
}

const AdminTokenContext = createContext<AdminTokenContextValue | null>(null);

export function AdminTokenProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY) ?? "");

  const saveToken = useCallback((t: string) => {
    setToken(t);
    localStorage.setItem(STORAGE_KEY, t);
  }, []);

  return (
    <AdminTokenContext.Provider value={{ token, setToken, saveToken }}>
      {children}
    </AdminTokenContext.Provider>
  );
}

export function useAdminToken() {
  const ctx = useContext(AdminTokenContext);
  if (!ctx) throw new Error("useAdminToken must be used within AdminTokenProvider");
  return ctx;
}
