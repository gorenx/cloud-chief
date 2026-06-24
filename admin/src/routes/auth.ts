import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { SESSION_COOKIE } from "../auth";
import { authenticateUser } from "../db/users";
import { createSession, deleteSession, resolveSessionUser } from "../db/sessions";
import { isDbEncryptionEnabled } from "../db/crypto";
import { resolveDbPath } from "../db/connection";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

function sessionCookieOpts(maxAgeSec: number) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "Lax" as const,
    maxAge: maxAgeSec,
  };
}

export const authRoutes = new Hono();

authRoutes.get("/me", (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ authenticated: false });
  const user = resolveSessionUser(token);
  if (!user) return c.json({ authenticated: false });
  return c.json({ authenticated: true, user: { id: user.id, username: user.username } });
});

authRoutes.get("/status", (c) => {
  return c.json({
    login_enabled: true,
    db_encrypt: isDbEncryptionEnabled(),
    db_path: resolveDbPath(),
  });
});

authRoutes.post("/login", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "username and password required" }, 400);

  const user = authenticateUser(parsed.data.username, parsed.data.password);
  if (!user) return c.json({ error: "invalid credentials" }, 401);

  const { token, expiresAt } = createSession(user.id);
  const maxAgeSec = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  setCookie(c, SESSION_COOKIE, token, sessionCookieOpts(maxAgeSec));

  return c.json({
    ok: true,
    user: { id: user.id, username: user.username },
  });
});

authRoutes.post("/logout", (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) deleteSession(token);
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});
