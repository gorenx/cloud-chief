import { Hono } from "hono";
import { env } from "../env";
import { fetchSupabaseAccessToken } from "../supabase-auth";
import { proxyUpstreamChat } from "../sse-proxy";
import { buildWorkerDebugInfo } from "../worker-debug";
import { getWorkerRuntimeConfig } from "../worker-runtime";

// Playground Worker 调试：浏览器 -> Admin -> Worker（Supabase JWT）-> AI Gateway。
export const workerChat = new Hono();

workerChat.get("/health", async (c) => {
  const runtime = await getWorkerRuntimeConfig();
  const base = runtime.url.replace(/\/$/, "");
  try {
    const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) });
    const text = await r.text();
    return c.json({ ok: r.ok, status: r.status, body: text.trim(), worker_url: base });
  } catch (e) {
    return c.json({ ok: false, error: (e as Error).message, worker_url: base }, 502);
  }
});

workerChat.post("/", async (c) => {
  const payload = (await c.req.json().catch(() => ({}))) as {
    model?: string;
    messages?: unknown;
    input?: unknown;
    access_token?: string;
    endpoint?: string;
    use_worker_config?: boolean;
  };

  const runtime = await getWorkerRuntimeConfig();
  const vars = runtime.vars;
  const supabaseUrl = vars.SUPABASE_URL;
  if (!supabaseUrl) {
    return c.json(
      { error: "Worker 未配置 SUPABASE_URL（CF 部署 vars 或 wrangler.toml）" },
      400,
    );
  }

  let accessToken =
    typeof payload.access_token === "string" && payload.access_token.trim()
      ? payload.access_token.trim()
      : "";

  if (!accessToken) {
    const auth = await fetchSupabaseAccessToken(supabaseUrl);
    if ("error" in auth) return c.json({ error: auth.error }, 400);
    accessToken = auth.access_token;
  }

  const endpoint =
    payload.endpoint === "chat" ? "chat/completions" : "responses";
  const base = runtime.url.replace(/\/$/, "");
  const url = `${base}/v1/${endpoint}`;
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
        Authorization: `Bearer ${accessToken}`,
      },
      body: upstreamBody,
    });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }

  return proxyUpstreamChat(c, upstream);
});

workerChat.get("/info", async (c) => {
  const runtime = await getWorkerRuntimeConfig();
  return c.json(buildWorkerDebugInfo(runtime));
});
