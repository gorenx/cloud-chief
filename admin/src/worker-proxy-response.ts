/** 将 Worker 上游响应整理为调试面板 JSON */
export async function formatWorkerProxyResponse(upstream: Response) {
  const contentType = upstream.headers.get("content-type") ?? "";
  const text = await upstream.text();

  let body: unknown = text;
  if (contentType.includes("json") && text.trim()) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return {
    ok: upstream.ok,
    status: upstream.status,
    content_type: contentType,
    body,
  };
}
