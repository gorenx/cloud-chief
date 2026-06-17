import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AdminTokenProvider } from "@/contexts/AdminTokenContext";
import { AppShell } from "@/layouts/AppShell";
import { DashboardPage } from "@/pages/Dashboard";
import { PlaygroundPage } from "@/pages/Playground";
import { GatewaysPage } from "@/pages/Gateways";
import { ProvidersPage } from "@/pages/Providers";
import { KeysPage } from "@/pages/Keys";
import { WorkerPage } from "@/pages/Worker";
import { SettingsPage } from "@/pages/Settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminTokenProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="playground" element={<PlaygroundPage />} />
              <Route path="gateways" element={<GatewaysPage />} />
              <Route path="providers" element={<ProvidersPage />} />
              <Route path="keys" element={<KeysPage />} />
              <Route path="worker" element={<WorkerPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster theme="dark" position="bottom-right" richColors />
      </AdminTokenProvider>
    </QueryClientProvider>
  );
}
