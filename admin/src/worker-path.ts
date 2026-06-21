const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

function parseBaseUrl(base: string): URL | null {
  try {
    return new URL(base.includes("://") ? base : `http://${base}`);
  } catch {
    return null;
  }
}

function finalizeWorkerPath(path: string): { path: string } | { error: string } {
  if (path.includes("..") || path.includes("\\") || path.includes("://")) {
    return { error: "无效路径" };
  }
  const qIdx = path.indexOf("?");
  const hIdx = path.indexOf("#");
  const cut = Math.min(qIdx === -1 ? path.length : qIdx, hIdx === -1 ? path.length : hIdx);
  const pathOnly = path.slice(0, cut) || "/";
  const suffix = path.slice(cut);
  const normalized = pathOnly.replace(/\/+$/, "") || "/";
  if (!/^\/[a-zA-Z0-9/._-]*$/.test(normalized)) {
    return { error: "无效路径" };
  }
  return { path: normalized + suffix };
}

/** 将用户输入（相对 path、完整 URL、或 host+path）解析为 Worker 根下的相对路径。 */
export function resolveWorkerHttpPath(
  workerBase: string,
  input: string,
): { path: string } | { error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { error: "路径不能为空" };

  const baseClean = workerBase.replace(/\/$/, "");
  const baseUrl = parseBaseUrl(baseClean);
  if (!baseUrl) return { error: "Worker 地址无效" };

  if (/^https?:\/\//i.test(trimmed)) {
    let u: URL;
    try {
      u = new URL(trimmed);
    } catch {
      return { error: "无效 URL" };
    }
    if (u.origin !== baseUrl.origin) {
      return { error: "URL 必须指向当前 Worker" };
    }
    let path = u.pathname + u.search + u.hash;
    const basePath = baseUrl.pathname.replace(/\/$/, "");
    if (basePath && basePath !== "/" && path.startsWith(basePath)) {
      path = path.slice(basePath.length) || "/";
    }
    return finalizeWorkerPath(path);
  }

  const baseHost = baseClean.replace(/^https?:\/\//i, "");
  if (trimmed.startsWith(`${baseHost}/`) || trimmed === baseHost) {
    const rest = trimmed.slice(baseHost.length) || "/";
    return finalizeWorkerPath(rest.startsWith("/") ? rest : `/${rest}`);
  }
  if (trimmed.startsWith(`${baseClean}/`) || trimmed === baseClean) {
    const rest = trimmed.slice(baseClean.length) || "/";
    return finalizeWorkerPath(rest.startsWith("/") ? rest : `/${rest}`);
  }

  const relative = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return finalizeWorkerPath(relative);
}

export function normalizeWorkerPath(path: string): string | null {
  const trimmed = path.trim();
  if (!trimmed) return null;
  const relative = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const result = finalizeWorkerPath(relative);
  if ("error" in result) return null;
  return result.path;
}

export function parseWorkerHttpMethod(method: unknown): string | null {
  if (typeof method !== "string") return "POST";
  const upper = method.trim().toUpperCase();
  return ALLOWED_METHODS.has(upper) ? upper : null;
}

export function workerPathNeedsAuth(path: string): boolean {
  const pathOnly = path.split(/[?#]/)[0];
  return pathOnly !== "/health";
}

export function buildWorkerUpstreamUrl(base: string, path: string): string {
  const resolved = resolveWorkerHttpPath(base, path);
  if ("error" in resolved) {
    const fallback = path.startsWith("/") ? path : `/${path}`;
    return `${base.replace(/\/$/, "")}${fallback}`;
  }
  return `${base.replace(/\/$/, "")}${resolved.path}`;
}
