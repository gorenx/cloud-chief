import { useCallback, useState } from "react";
import type { WorkerTarget } from "@/lib/playground-session";
import type { WorkerHttpMethod } from "@/lib/worker-http-routes";

export type WorkerProxyResult = {
  ok: boolean;
  status: number;
  content_type?: string;
  body: unknown;
  worker_url?: string;
  upstream_url?: string;
  method?: string;
  path?: string;
  error?: string;
};

export function usePlaygroundWorkerHttp() {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<WorkerProxyResult | null>(null);

  const send = useCallback(
    async (params: {
      method: WorkerHttpMethod;
      path: string;
      body: string;
      workerDir?: string;
      workerTarget: WorkerTarget;
      workerBase?: string;
      workerAccessToken: string;
      workerTestEmail?: string;
      workerTestPassword?: string;
    }) => {
      setSending(true);
      setResult(null);

      let parsedBody: unknown = undefined;
      const trimmedBody = params.body.trim();
      if (trimmedBody && params.method !== "GET" && params.method !== "DELETE") {
        try {
          parsedBody = JSON.parse(trimmedBody);
        } catch {
          setResult({
            ok: false,
            status: 0,
            body: null,
            error: "请求体不是合法 JSON",
          });
          setSending(false);
          return;
        }
      }

      try {
        const resp = await fetch("/api/worker-chat/proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            method: params.method,
            path: params.path,
            body: parsedBody,
            worker_dir: params.workerDir || undefined,
            worker_target: params.workerTarget,
            worker_base: params.workerBase?.trim() || undefined,
            access_token: params.workerAccessToken.trim() || undefined,
            email: params.workerTestEmail?.trim() || undefined,
            password: params.workerTestPassword || undefined,
          }),
        });

        const json = (await resp.json()) as WorkerProxyResult & { error?: string };
        if (!resp.ok && json.error) {
          setResult({
            ok: false,
            status: resp.status,
            body: json,
            error: typeof json.error === "string" ? json.error : undefined,
          });
        } else {
          setResult(json);
        }
      } catch (e) {
        setResult({
          ok: false,
          status: 0,
          body: null,
          error: (e as Error).message,
        });
      } finally {
        setSending(false);
      }
    },
    [],
  );

  return { sending, result, send, clearResult: () => setResult(null) };
}
