#!/usr/bin/env bash
# 包管理器适配：已安装 pnpm 时优先使用，否则回退 npm。
#
# 用法：
#   scripts/pm.sh install
#   scripts/pm.sh web dev|build|typecheck
#   scripts/pm.sh run build|dev|typecheck
#   scripts/pm.sh start|test

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

use_pnpm() {
  command -v pnpm >/dev/null 2>&1
}

pm_label() {
  if use_pnpm; then echo "pnpm"; else echo "npm"; fi
}

cmd_install() {
  cd "$ROOT"
  if use_pnpm; then
    pnpm install
  else
    npm install
    npm install --prefix web
  fi
}

cmd_web() {
  local script="${1:?缺少 web 子命令}"
  if use_pnpm; then
    pnpm --dir "$ROOT/web" "$script"
  else
    npm run "$script" --prefix "$ROOT/web"
  fi
}

cmd_run() {
  local script="${1:?缺少脚本名}"
  cd "$ROOT"
  if use_pnpm; then
    pnpm run "$script"
  else
    npm run "$script"
  fi
}

cmd_lifecycle() {
  local script="$1"
  cd "$ROOT"
  if use_pnpm; then
    pnpm "$script"
  else
    npm run "$script"
  fi
}

main() {
  local action="${1:-}"
  case "$action" in
    install) cmd_install ;;
    web) shift; cmd_web "$@" ;;
    run) shift; cmd_run "$@" ;;
    start|test) cmd_lifecycle "$action" ;;
    -h|--help|help)
      cat <<EOF
用法: $(basename "$0") <命令>

  install           安装依赖（pnpm workspace 或 npm 分别安装 web）
  web <script>      在 web/ 执行脚本（dev、build、typecheck）
  run <script>      在 admin/ 执行 npm/pnpm 脚本（build、dev…）
  start | test      生命周期脚本

当前将使用: $(pm_label)
EOF
      ;;
    *) echo "未知命令: $action" >&2; exit 1 ;;
  esac
}

main "$@"
