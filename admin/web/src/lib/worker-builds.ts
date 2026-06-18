import type { ReactNode } from "react";

/** Worker CI 卡片按钮与标题说明（供 Hint 组件使用） */
export const WORKER_CI_HINTS = {
  section:
    "推送 worker/ 目录变更到 GitHub 后，Cloudflare Workers Builds 会自动构建并部署。本页用于查看状态、同步 monorepo 配置，以及在需要时手动重跑构建。",
  reconfigureToken:
    "更换 CF_WORKER_BUILDER 用户 API Token（Workers 构建配置 Edit + Workers Scripts Read），用于查询 Builds 状态、同步配置与手动触发构建。与 wrangler 部署用的 CLOUDFLARE_API_TOKEN 分开。",
  refresh: "从 Cloudflare Builds API 重新拉取 GitHub 连接、trigger 配置与最近构建记录。",
  connectGithub:
    "首次须在 Cloudflare Dashboard 完成 GitHub OAuth 与仓库绑定；Admin 无法代替该步骤。连接后 push 到匹配分支且变更在 watch paths 内时会自动部署。",
  syncMonorepo:
    "将 worker/cloudflare-builds.json（root 目录、build/deploy 命令、watch paths）同步到 Cloudflare。只改云端配置，不会产生新 commit，也不会自动触发构建。",
  triggerBuild:
    "手动用 GitHub 上 main 分支最新 commit 再跑一轮构建与部署。日常修改 worker/ 后 push 即可自动部署，一般无需点此按钮；适用于配置同步后立刻验证、或上次构建失败重试。",
} satisfies Record<string, ReactNode>;

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
