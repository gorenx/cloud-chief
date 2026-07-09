import { baseURL, appName } from "./config";
import { sessionFromRequest } from "./auth";
import { html } from "./http";
import type { AppContext } from "./types";

export function signInPage(c: AppContext): Response {
  const next = escapeHtml(callbackURL(c));
  const name = escapeHtml(appName(c.env));
  const body = `
    <h1>${name}</h1>
    <p>使用邮箱密码登录。登录后可继续 OAuth 授权流程，或访问受保护 API。</p>
    <form id="form">
      <label>
        邮箱
        <input name="email" type="email" autocomplete="email" required />
      </label>
      <label>
        密码
        <input name="password" type="password" autocomplete="current-password" minlength="8" required />
      </label>
      <div class="row">
        <button type="submit">登录</button>
        <a class="button" href="/sign-up?next=${encodeURIComponent(next)}">注册</a>
      </div>
      <p id="message" class="muted"></p>
    </form>
    <script>
      const form = document.getElementById("form");
      const message = document.getElementById("message");
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        message.className = "muted";
        message.textContent = "登录中...";
        const fd = new FormData(form);
        const res = await fetch("/api/auth/sign-in/email", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            email: String(fd.get("email") || ""),
            password: String(fd.get("password") || ""),
            callbackURL: ${JSON.stringify(next)}
          })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          message.className = "error";
          message.textContent = data.message || data.error || "登录失败";
          return;
        }
        location.href = ${JSON.stringify(next)};
      });
    </script>`;
  return html(pageShell(`${name} 登录`, body));
}

export function signUpPage(c: AppContext): Response {
  const next = escapeHtml(callbackURL(c));
  const name = escapeHtml(appName(c.env));
  const body = `
    <h1>创建账号</h1>
    <form id="form">
      <label>
        昵称
        <input name="name" autocomplete="name" required />
      </label>
      <label>
        邮箱
        <input name="email" type="email" autocomplete="email" required />
      </label>
      <label>
        密码
        <input name="password" type="password" autocomplete="new-password" minlength="8" required />
      </label>
      <div class="row">
        <button type="submit">注册并登录</button>
        <a class="button" href="/sign-in?next=${encodeURIComponent(next)}">已有账号</a>
      </div>
      <p id="message" class="muted"></p>
    </form>
    <script>
      const form = document.getElementById("form");
      const message = document.getElementById("message");
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        message.className = "muted";
        message.textContent = "注册中...";
        const fd = new FormData(form);
        const res = await fetch("/api/auth/sign-up/email", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: String(fd.get("name") || ""),
            email: String(fd.get("email") || ""),
            password: String(fd.get("password") || ""),
            callbackURL: ${JSON.stringify(next)}
          })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          message.className = "error";
          message.textContent = data.message || data.error || "注册失败";
          return;
        }
        location.href = ${JSON.stringify(next)};
      });
    </script>`;
  return html(pageShell(`${name} 注册`, body));
}

export async function consentPage(c: AppContext): Promise<Response> {
  const session = await sessionFromRequest(c);
  if (!session) {
    const next = `${new URL(c.req.url).pathname}${new URL(c.req.url).search}`;
    return Response.redirect(
      `${baseURL(c.env, c.req.raw)}/sign-in?next=${encodeURIComponent(next)}`,
      302,
    );
  }

  const url = new URL(c.req.url);
  const clientId = url.searchParams.get("client_id") ?? "";
  const scope = url.searchParams.get("scope") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const body = `
    <h1>授权访问</h1>
    <p><strong>${escapeHtml(clientId || "OAuth client")}</strong> 请求访问你的账号。</p>
    <p class="muted">当前用户：<code>${escapeHtml(session.user.email || session.user.id)}</code></p>
    <p class="muted">Scopes：<code>${escapeHtml(scope || "openid profile email")}</code></p>
    <form id="allow">
      <div class="row">
        <button type="submit">允许</button>
        <a class="button" href="/">取消</a>
      </div>
      <p id="message" class="muted"></p>
    </form>
    <script>
      const message = document.getElementById("message");
      document.getElementById("allow").addEventListener("submit", async (event) => {
        event.preventDefault();
        message.textContent = "提交授权...";
        const res = await fetch("/api/auth/oauth2/consent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            accept: true,
            client_id: ${JSON.stringify(clientId)},
            scope: ${JSON.stringify(scope)},
            state: ${JSON.stringify(state)}
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          message.className = "error";
          message.textContent = data.message || data.error || "授权失败";
          return;
        }
        location.href = data.redirectURI || data.redirectUrl || data.url || "/";
      });
    </script>`;
  return html(pageShell("OAuth 授权", body));
}

function callbackURL(c: AppContext): string {
  const next = new URL(c.req.url).searchParams.get("next");
  return next && next.startsWith("/") ? next : "/";
}

function pageShell(title: string, body: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0f172a; color: #e5e7eb; }
    main { width: min(100% - 32px, 420px); border: 1px solid #334155; border-radius: 10px; padding: 24px; background: #111827; box-shadow: 0 18px 60px rgb(0 0 0 / 0.35); }
    h1 { margin: 0 0 16px; font-size: 22px; }
    p { color: #94a3b8; line-height: 1.55; }
    label { display: grid; gap: 6px; margin: 12px 0; color: #cbd5e1; font-size: 14px; }
    input { box-sizing: border-box; width: 100%; border: 1px solid #475569; border-radius: 8px; padding: 10px 12px; background: #020617; color: #e5e7eb; font: inherit; }
    button, a.button { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; border: 0; border-radius: 8px; padding: 0 14px; background: #38bdf8; color: #082f49; font-weight: 700; text-decoration: none; cursor: pointer; }
    .row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; }
    .muted { color: #94a3b8; font-size: 13px; }
    .error { color: #fca5a5; }
    .ok { color: #86efac; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  </style>
</head>
<body>
  <main>${body}</main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
