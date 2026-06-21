import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useT } from "@/contexts/LocaleContext";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { WorkerHttpRoutePicker } from "@/components/WorkerHttpRoutePicker";
import { usePlaygroundWorkerHttp } from "@/hooks/usePlaygroundWorkerHttp";
import type { WorkerTarget } from "@/lib/playground-session";
import {
  formatResponseBody,
  persistActiveWorkerRouteId,
  persistCustomWorkerRoutes,
  readActiveWorkerRouteId,
  readWorkerHttpRoutes,
  resolveWorkerHttpPath,
  type WorkerHttpMethod,
  type WorkerHttpRoute,
} from "@/lib/worker-http-routes";
import { cn } from "@/lib/utils";

const METHODS: WorkerHttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export function PlaygroundWorkerHttpConsole({
  workerDir,
  workerTarget,
  workerAccessToken,
  workerTestEmail,
  workerTestPassword,
  effectiveWorkerUrl,
  onRequestChange,
}: {
  workerDir: string;
  workerTarget: WorkerTarget;
  workerAccessToken: string;
  workerTestEmail: string;
  workerTestPassword: string;
  effectiveWorkerUrl: string;
  onRequestChange?: (method: WorkerHttpMethod, path: string) => void;
}) {
  const t = useT();
  const { sending, result, send } = usePlaygroundWorkerHttp();
  const workerBase = effectiveWorkerUrl.replace(/\/$/, "");
  const [routes, setRoutes] = useState<WorkerHttpRoute[]>(() => readWorkerHttpRoutes());
  const initialRoute =
    routes.find((r) => r.id === readActiveWorkerRouteId()) ?? routes[0];
  const [activeId, setActiveId] = useState(initialRoute?.id ?? "");
  const [method, setMethod] = useState<WorkerHttpMethod>(initialRoute?.method ?? "POST");
  const [path, setPath] = useState(initialRoute?.path ?? "/v1/responses");
  const [body, setBody] = useState(initialRoute?.body ?? "");
  const [pathError, setPathError] = useState<string | null>(null);

  const resolvedPath = useMemo(() => {
    const r = resolveWorkerHttpPath(workerBase, path);
    return "error" in r ? null : r.path;
  }, [workerBase, path]);

  const applyRoute = useCallback((route: (typeof routes)[number]) => {
    setMethod(route.method);
    setPath(route.path);
    setBody(route.body);
    setPathError(null);
  }, []);

  useEffect(() => {
    if (!resolvedPath) return;
    onRequestChange?.(method, resolvedPath);
  }, [method, resolvedPath, onRequestChange]);

  function handlePresetChange(id: string, routeList: WorkerHttpRoute[] = routes) {
    setActiveId(id);
    persistActiveWorkerRouteId(id);
    const route = routeList.find((r) => r.id === id);
    if (route) applyRoute(route);
  }

  function handleDeleteRoute(id: string) {
    const route = routes.find((r) => r.id === id);
    if (!route || route.builtin) return;
    const next = routes.filter((r) => r.id !== id);
    setRoutes(next);
    persistCustomWorkerRoutes(next);
    if (activeId === id) {
      const fallback = next[0];
      if (fallback) handlePresetChange(fallback.id, next);
    }
  }

  function handleSaveRoute() {
    const resolved = resolveWorkerHttpPath(workerBase, path);
    if ("error" in resolved) {
      setPathError(resolved.error);
      return;
    }
    setPathError(null);

    const activeRoute = routes.find((r) => r.id === activeId);
    if (activeRoute && !activeRoute.builtin) {
      const next = routes.map((r) =>
        r.id === activeRoute.id
          ? { ...r, method, path: resolved.path, body, label: resolved.path }
          : r,
      );
      setRoutes(next);
      persistCustomWorkerRoutes(next);
      return;
    }

    const existing = routes.find(
      (r) => !r.builtin && r.method === method && r.path === resolved.path,
    );
    if (existing) {
      const next = routes.map((r) =>
        r.id === existing.id ? { ...r, body, label: resolved.path } : r,
      );
      setRoutes(next);
      persistCustomWorkerRoutes(next);
      handlePresetChange(existing.id, next);
      return;
    }

    const route: WorkerHttpRoute = {
      id: `custom-${Date.now()}`,
      label: resolved.path,
      method,
      path: resolved.path,
      body,
    };
    const next = [...routes, route];
    setRoutes(next);
    persistCustomWorkerRoutes(next);
    handlePresetChange(route.id, next);
  }

  function handleSend() {
    const resolved = resolveWorkerHttpPath(workerBase, path);
    if ("error" in resolved) {
      setPathError(resolved.error);
      return;
    }
    setPathError(null);
    void send({
      method,
      path: resolved.path,
      body,
      workerDir,
      workerTarget,
      workerAccessToken,
      workerTestEmail,
      workerTestPassword,
    });
  }

  const showBody = method !== "GET" && method !== "DELETE";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-2 border-b border-[var(--color-border-subtle)] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]/40 px-3 py-2">
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]/75">
            {t("playground.httpHostLabel")}
          </span>
          <code className="mono min-w-0 flex-1 truncate text-xs text-[var(--color-ice)]/90">{workerBase}</code>
        </div>

        <div className="flex min-w-0 items-stretch overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]/60 focus-within:border-[var(--color-accent)]">
          <Select
            value={method}
            onChange={(e) => setMethod(e.target.value as WorkerHttpMethod)}
            className="w-[5.5rem] shrink-0 rounded-none border-0 border-r border-[var(--color-border-subtle)] bg-transparent font-mono text-xs font-semibold text-[var(--color-accent)] focus:ring-0"
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
          <WorkerHttpRoutePicker
            routes={routes}
            activeId={activeId}
            onSelect={handlePresetChange}
            onDelete={handleDeleteRoute}
            title={t("playground.httpPathLabel")}
            className="w-[min(40%,10rem)]"
          />
          <input
            value={path}
            onChange={(e) => {
              setPath(e.target.value);
              setPathError(null);
            }}
            placeholder="/v1/responses"
            spellCheck={false}
            aria-label={t("playground.httpPathLabel")}
            className="min-w-0 flex-1 bg-transparent px-2.5 py-2 font-mono text-sm text-[var(--color-ice)] outline-none"
          />
          <button
            type="button"
            onClick={handleSaveRoute}
            title={t("playground.httpSaveRoute")}
            aria-label={t("playground.httpSaveRoute")}
            className="flex shrink-0 items-center justify-center self-stretch border-l border-[var(--color-border-subtle)] px-2.5 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-panel-elevated)] hover:text-[var(--color-text)]"
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
          <Button
            disabled={sending}
            onClick={handleSend}
            className="flex shrink-0 self-stretch rounded-none border-0 border-l border-[var(--color-border-subtle)] px-4 shadow-none hover:shadow-none"
          >
            {sending ? t("playground.thinking") : t("playground.send")}
          </Button>
        </div>
        {pathError && <p className="text-xs text-[var(--color-err)]">{pathError}</p>}
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] lg:grid-cols-2 lg:grid-rows-[auto_minmax(0,1fr)]">
        <div className="shrink-0 border-b border-[var(--color-border-subtle)] px-4 py-2 sm:px-5 lg:col-start-1 lg:row-start-1">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-muted)]/75">
            {t("playground.httpRequestBody")}
          </span>
        </div>

        <div className="flex min-h-0 flex-col lg:col-start-1 lg:row-start-2">
          {showBody ? (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              spellCheck={false}
              className="min-h-0 flex-1 resize-none bg-[var(--color-bg)]/40 p-4 font-mono text-xs leading-relaxed text-[var(--color-text)] outline-none sm:p-5"
            />
          ) : (
            <p className="p-4 text-sm text-[var(--color-muted)] sm:p-5">
              {t("playground.httpNoBody")}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-b border-[var(--color-border-subtle)] px-4 py-2 sm:px-5 lg:col-start-2 lg:row-start-1 lg:border-l lg:border-t-0">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-muted)]/75">
            {t("playground.httpResponse")}
          </span>
          {result && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold",
                result.ok
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-[var(--color-err)]/15 text-[var(--color-err)]",
              )}
            >
              {result.status || "—"}
            </span>
          )}
        </div>

        <div className="min-h-0 overflow-auto border-t border-[var(--color-border-subtle)] p-4 sm:p-5 lg:col-start-2 lg:row-start-2 lg:border-l lg:border-t-0">
          {!result ? (
            <p className="text-sm text-[var(--color-muted)]">{t("playground.httpResponseHint")}</p>
          ) : result.error && !result.body ? (
            <p className="text-sm text-[var(--color-err)]">{result.error}</p>
          ) : (
            <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-[var(--color-text)]">
              {formatResponseBody(result.body)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
