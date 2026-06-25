import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AdminTokenProvider } from "@/contexts/AdminTokenContext";
import { LocaleProvider } from "@/contexts/LocaleContext";
import { AppShell } from "@/layouts/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { DashboardPage } from "@/pages/Dashboard";
import { PlaygroundPage } from "@/pages/Playground";
import { GatewaysPage } from "@/pages/Gateways";
import { ProvidersPage } from "@/pages/Providers";
import { KeysPage } from "@/pages/Keys";
import { WorkerPage } from "@/pages/Worker";
import { SupabasePage } from "@/pages/Supabase";
import { SettingsPage } from "@/pages/Settings";
import { AppConfigPage } from "@/pages/AppConfig";
import { LoginPage } from "@/pages/Login";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <AdminTokenProvider>
          <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="playground" element={<PlaygroundPage />} />
                <Route path="gateways" element={<GatewaysPage />} />
                <Route path="providers" element={<ProvidersPage />} />
                <Route path="keys" element={<KeysPage />} />
                <Route path="worker" element={<WorkerPage />} />
                <Route path="supabase" element={<SupabasePage />} />
                <Route path="app-config" element={<AppConfigPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster theme="dark" position="bottom-right" richColors />
      </AdminTokenProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
}
