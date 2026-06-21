import { Hono } from "hono";
import { env } from "../env";
import { proxyUpstreamChat } from "../sse-proxy";
import { buildWorkerDebugInfo } from "../worker-debug";
import { formatWorkerFetchError } from "../worker-connect-error";
import { resolveWorkerChatAuth } from "../worker-chat-auth";
import { getWorkerRuntimeConfig } from "../worker-runtime";
import { formatWorkerProxyResponse } from "../worker-proxy-response";
import {
  resolveWorkerHttpPath,
  parseWorkerHttpMethod,
  workerPathNeedsAuth,
} from "../worker-path";

// Playground Worker 调试：浏览器 -> Admin -> Worker（Supabase JWT）-> AI Gateway。
export const workerChat = new Hono();

type WorkerChatPayload = {
  model?: string;
  messages?: unknown;
  input?: unknown;
  access_token?: string;
  email?: string;
  password?: string;
  endpoint?: string;
  use_worker_config?: boolean;
  worker_target?: string;
  worker_dir?: string;
};

type WorkerProxyPayload = WorkerChatPayload & {
  method?: string;
  path?: string;
  body?: unknown;
};

workerChat.get("/health", async (c) => {
  const auth = await resolveWorkerChatAuth(
    { worker_dir: c.req.query("dir") ?? undefined, worker_target: c.req.query("target") },
    { requireToken: false },
  );
  if (!auth.ok) {
    return c.json({ ok: false, error: auth.error, target: c.req.query("target") }, 400);
  }
  try {
    const r = await fetch(`${auth.base}/health`, { signal: AbortSignal.timeout(5000) });
    const text = await r.text();
    return c.json({
      ok: r.ok,
      status: r.status,
      body: text.trim(),
      worker_url: auth.base,
      target: auth.target,
    });
  } catch (e) {
    return c.json(
      { ok: false, error: formatWorkerFetchError(e, auth.base), worker_url: auth.base, target: auth.target },
      502,
    );
  }
});

workerChat.post("/proxy", async (c) => {
  const payload = (await c.req.json().catch(() => ({}))) as WorkerProxyPayload;
  const pathInput = typeof payload.path === "string" ? payload.path : "";

  const auth = await resolveWorkerChatAuth(payload, { requireToken: false });
  if (!auth.ok) return c.json({ error: auth.error }, auth.status ?? 400);

  const resolved = resolveWorkerHttpPath(auth.base, pathInput);
  if ("error" in resolved) return c.json({ error: resolved.error }, 400);
  const path = resolved.path;

  let accessToken = "";
  if (workerPathNeedsAuth(path)) {
    const authWithToken = await resolveWorkerChatAuth(payload);
    if (!authWithToken.ok) return c.json({ error: authWithToken.error }, authWithToken.status ?? 400);
    accessToken = authWithToken.accessToken;
  }

  const method = parseWorkerHttpMethod(payload.method);
  if (!method) return c.json({ error: "不支持的 HTTP 方法" }, 400);

  const url = `${auth.base}${path}`;
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let bodyStr: string | undefined;
  if (method !== "GET" && method !== "DELETE") {
    if (typeof payload.body === "string") {
      bodyStr = payload.body;
    } else if (payload.body !== undefined && payload.body !== null) {
      bodyStr = JSON.stringify(payload.body);
    } else {
      bodyStr = "";
    }
    if (bodyStr) headers["Content-Type"] = "application/json";
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method,
      headers,
      body: method === "GET" || method === "DELETE" ? undefined : bodyStr,
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    return c.json({ error: formatWorkerFetchError(e, url), upstream_url: url }, 502);
  }

  const formatted = await formatWorkerProxyResponse(upstream);
  return c.json({
    ...formatted,
    worker_url: auth.base,
    upstream_url: url,
    method,
    path,
  });
});

workerChat.post("/", async (c) => {
  const payload = (await c.req.json().catch(() => ({}))) as WorkerChatPayload;

  const auth = await resolveWorkerChatAuth(payload);
  if (!auth.ok) return c.json({ error: auth.error }, auth.status ?? 400);

  const runtime = await getWorkerRuntimeConfig({
    dir: typeof payload.worker_dir === "string" ? payload.worker_dir : undefined,
  });
  const vars = runtime.vars;

  const endpoint =
    payload.endpoint === "chat" ? "chat/completions" : "responses";
  const url = `${auth.base}/v1/${endpoint}`;
  const useWorkerConfig = payload.use_worker_config === true;
  const model = useWorkerConfig
    ? vars.DEFAULT_MODEL || env.MODEL
    : payload.model || vars.DEFAULT_MODEL || env.MODEL;
  const messages = payload.messages || payload.input || [];

  const upstreamBody =
    endpoint === "responses"
      ? JSON.stringify({ model, input: messages, stream: true })
      : JSON.stringify({ model, messages, stream: true });

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.accessToken}`,
      },
      body: upstreamBody,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    return c.json({ error: formatWorkerFetchError(e, url) }, 502);
  }

  return proxyUpstreamChat(c, upstream);
});

workerChat.get("/info", async (c) => {
  const dir = c.req.query("dir") ?? undefined;
  const runtime = await getWorkerRuntimeConfig({ dir });
  return c.json(buildWorkerDebugInfo(runtime));
});
