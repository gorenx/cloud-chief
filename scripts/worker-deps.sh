#!/usr/bin/env bash
# 安装 worker 及其 file: 链接的 @cloud-chief/gateway-core 依赖。
#
# 在 worker 目录（ai-gateway-worker / worker-revenuecat）下执行：
#   bash ../scripts/worker-deps.sh        # 本地 postinstall：仅装 gateway-core
#   bash ../scripts/worker-deps.sh ci     # Cloudflare Builds：npm ci 两处
set -euo pipefail

WORKER_DIR="$(pwd)"
GATEWAY_CORE="$WORKER_DIR/../packages/gateway-core"

if [ ! -f "$WORKER_DIR/package.json" ]; then
  echo "✘ 请在 worker 根目录运行（当前: $WORKER_DIR）" >&2
  exit 1
fi
if [ ! -f "$GATEWAY_CORE/package.json" ]; then
  echo "✘ 找不到 gateway-core: $GATEWAY_CORE" >&2
  exit 1
fi

if [[ "${npm_config_user_agent:-}" == *"pnpm"* && "${1:-}" != "ci" ]]; then
  echo "✓ pnpm workspace install detected; gateway-core is linked by the root workspace"
  exit 0
fi

if [ "${1:-}" = "ci" ]; then
  npm ci --ignore-scripts
  npm ci --prefix "$GATEWAY_CORE"
else
  npm install --prefix "$GATEWAY_CORE" --ignore-scripts
fi
