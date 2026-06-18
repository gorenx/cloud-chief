/** Worker CI 卡片相关工具（鉴权错误检测等） */

/** 与后端 cf-builds.isBuilderTokenInvalidMessage 保持一致 */
export function isBuilderTokenInvalidMessage(error?: string): boolean {
  if (!error) return false;
  return (
    /invalid token/i.test(error) ||
    /authentication error/i.test(error) ||
    /鉴权失败/i.test(error) ||
    /只接受用户级/i.test(error) ||
    /unauthorized/i.test(error)
  );
}

export function shouldShowBuilderReconfigure(
  status: { token_configured: boolean; token_invalid?: boolean; ok: boolean; error?: string },
): boolean {
  return (
    !status.token_configured ||
    Boolean(status.token_invalid) ||
    (status.token_configured && !status.ok && isBuilderTokenInvalidMessage(status.error))
  );
}
