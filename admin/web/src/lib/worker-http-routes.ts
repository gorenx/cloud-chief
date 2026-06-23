import type { WorkerCapabilities } from "./playground-session";

export {
  buildWorkerUpstreamUrl,
  resolveWorkerHttpPath,
} from "@admin/worker-path";

export type WorkerHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type WorkerHttpRoute = {
  id: string;
  label: string;
  method: WorkerHttpMethod;
  path: string;
  body: string;
  builtin?: boolean;
};

export const WORKER_HTTP_ROUTES_KEY = "admin-playground-worker-http-routes";
export const WORKER_HTTP_ACTIVE_KEY = "admin-playground-worker-http-active";
export const WORKER_CONSOLE_MODE_KEY = "admin-playground-worker-console-mode";

export type WorkerConsoleMode = "chat" | "api";

const CHAT_ROUTES: WorkerHttpRoute[] = [
  {
    id: "responses",
    label: "POST /v1/responses",
    method: "POST",
    path: "/v1/responses",
    body: JSON.stringify(
      {
        model: "qwen-plus",
        input: [{ role: "user", content: "你好" }],
        stream: true,
      },
      null,
      2,
    ),
    builtin: true,
  },
  {
    id: "chat-completions",
    label: "POST /v1/chat/completions",
    method: "POST",
    path: "/v1/chat/completions",
    body: JSON.stringify(
      {
        model: "qwen-plus",
        messages: [{ role: "user", content: "你好" }],
        stream: true,
      },
      null,
      2,
    ),
    builtin: true,
  },
];

const HEALTH_ROUTE: WorkerHttpRoute = {
  id: "health",
  label: "GET /health",
  method: "GET",
  path: "/health",
  body: "",
  builtin: true,
};

export function defaultRoutesForCapabilities(
  caps: Pick<WorkerCapabilities, "supports_chat"> = { supports_chat: true },
): WorkerHttpRoute[] {
  const routes = [HEALTH_ROUTE];
  if (caps.supports_chat) routes.push(...CHAT_ROUTES);
  return routes;
}

function mergeRoutes(custom: WorkerHttpRoute[], caps: Pick<WorkerCapabilities, "supports_chat">): WorkerHttpRoute[] {
  const builtins = defaultRoutesForCapabilities(caps).map((r) => ({ ...r }));
  const customOnly = custom.filter((r) => !r.builtin && !builtins.some((b) => b.id === r.id));
  return [...builtins, ...customOnly];
}

export function readWorkerHttpRoutes(
  caps: Pick<WorkerCapabilities, "supports_chat"> = { supports_chat: true },
): WorkerHttpRoute[] {
  try {
    const raw = localStorage.getItem(WORKER_HTTP_ROUTES_KEY);
    if (!raw) return defaultRoutesForCapabilities(caps);
    const custom = JSON.parse(raw) as WorkerHttpRoute[];
    if (!Array.isArray(custom)) return defaultRoutesForCapabilities(caps);
    return mergeRoutes(custom, caps);
  } catch {
    return defaultRoutesForCapabilities(caps);
  }
}

export function persistCustomWorkerRoutes(routes: WorkerHttpRoute[]) {
  const custom = routes.filter((r) => !r.builtin);
  try {
    localStorage.setItem(WORKER_HTTP_ROUTES_KEY, JSON.stringify(custom));
  } catch {
    /* ignore */
  }
}

export function readActiveWorkerRouteId(
  caps: Pick<WorkerCapabilities, "supports_chat"> = { supports_chat: true },
): string {
  const defaults = defaultRoutesForCapabilities(caps);
  try {
    return localStorage.getItem(WORKER_HTTP_ACTIVE_KEY) ?? defaults[0]!.id;
  } catch {
    return defaults[0]!.id;
  }
}

export function persistActiveWorkerRouteId(id: string) {
  try {
    localStorage.setItem(WORKER_HTTP_ACTIVE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function createWorkerRoute(label: string): WorkerHttpRoute {
  return {
    id: `custom-${Date.now()}`,
    label: label.trim() || "自定义路由",
    method: "POST",
    path: "/v1/",
    body: "{\n  \n}",
  };
}

export function formatResponseBody(body: unknown): string {
  if (typeof body === "string") return body;
  try {
    return JSON.stringify(body, null, 2);
  } catch {
    return String(body);
  }
}

export function readWorkerConsoleMode(): WorkerConsoleMode {
  try {
    const v = localStorage.getItem(WORKER_CONSOLE_MODE_KEY);
    if (v === "chat" || v === "api") return v;
  } catch {
    /* ignore */
  }
  return "chat";
}

export function persistWorkerConsoleMode(mode: WorkerConsoleMode) {
  try {
    localStorage.setItem(WORKER_CONSOLE_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}
