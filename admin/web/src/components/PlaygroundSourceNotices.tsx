import { SourceBadge } from "./SourceBadge";
import type { FieldMetaEntry } from "@/types";

/** 坑 2：聊天代理固定 .env，BYOK 只对 invoke_url 直连有效 */
export function ChatAuthPathNotice({
  chatAuthMeta,
  hasByok,
}: {
  chatAuthMeta?: FieldMetaEntry;
  hasByok: boolean;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div>
        <div className="flex flex-wrap items-center gap-1.5 text-[var(--color-text)]">
          <span className="font-medium">本页聊天</span>
          {chatAuthMeta && <SourceBadge meta={chatAuthMeta} />}
        </div>
        <p className="mt-1 text-[var(--color-muted)]">
          <code className="mono">POST /api/chat</code> 的上游 Authorization 固定读{" "}
          <code className="mono">DASHSCOPE_API_KEY</code>，不经 BYOK。
        </p>
      </div>
      <div className="border-t border-[var(--color-border)] pt-2">
        <p className="font-medium text-[var(--color-text)]">invoke_url 直连</p>
        <p className="mt-1 text-[var(--color-muted)]">
          自行请求下方 invoke_url 时，上游密钥走网关 BYOK
          {hasByok ? "（当前网关已配置）" : "（当前网关未配置）"} 或 admin/.env{" "}
          <code className="mono">DASHSCOPE_API_KEY</code>。
        </p>
        {hasByok && (
          <p className="mt-1.5 text-amber-200">
            ⚠ 侧栏 BYOK 列表仅供 invoke_url 直连参考；本页发送聊天不会使用这些密钥。
          </p>
        )}
      </div>
    </div>
  );
}
