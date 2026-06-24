/** 纯字符串拼接，供服务端与 Vite 前端共用（勿引入 env / fs） */
export function gatewayUrlWithAccount(
  accountId: string,
  gw: string,
  slug: string,
  p: string,
): string {
  return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gw}/custom-${slug}${p}`;
}
