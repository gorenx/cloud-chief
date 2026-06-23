/** 从 wrangler [vars] 推断 Worker 在调试页需要哪些控件 */
export interface WorkerCapabilities {
  /** 配置了 CF_GATEWAY_ID（经 AI Gateway 转发） */
  uses_gateway: boolean;
  /** 配置了 DEFAULT_MODEL / FREE_MODEL / PLUS_MODEL */
  uses_model: boolean;
  /** 支持聊天式调试（网关 + 模型代理 Worker） */
  supports_chat: boolean;
}

export function detectWorkerCapabilities(vars: Record<string, string>): WorkerCapabilities {
  const uses_gateway = Boolean(vars.CF_GATEWAY_ID?.trim());
  const uses_model = Boolean(
    vars.DEFAULT_MODEL?.trim() || vars.FREE_MODEL?.trim() || vars.PLUS_MODEL?.trim(),
  );
  return {
    uses_gateway,
    uses_model,
    supports_chat: uses_gateway && uses_model,
  };
}

/** 自动模式下是否应展示网关 / 模型控件 */
export function autoShowGatewayModelControls(caps: WorkerCapabilities): boolean {
  return caps.uses_gateway || caps.uses_model;
}

export function inferWorkerEndpoints(caps: WorkerCapabilities): string[] {
  const endpoints = ["/health"];
  if (caps.supports_chat) {
    endpoints.push("/v1/responses", "/v1/chat/completions");
  }
  return endpoints;
}
