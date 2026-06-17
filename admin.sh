#!/usr/bin/env bash
# 从仓库根目录一键启动 admin 配置后台
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$ROOT/admin/run.sh" "$@"
