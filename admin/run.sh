#!/usr/bin/env bash
# admin 一键脚本：安装依赖、开发、构建、生产启动
# 已安装 pnpm 时优先使用，否则回退 npm。
#
# 用法：
#   ./run.sh          # 开发模式（默认）
#   ./run.sh dev      # 同上：安装依赖 + Hono :8787 + Vite :5173
#   ./run.sh install  # 安装依赖（admin + web）
#   ./run.sh build    # 构建 web/dist
#   ./run.sh start    # 生产模式：构建后由 Hono :8787 托管 SPA + API
#   ./run.sh test     # 运行 vitest

set -euo pipefail

ADMIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$ADMIN_DIR/.." && pwd)"
PM="$ADMIN_DIR/scripts/pm.sh"

info() { echo "==> $*"; }
ok() { echo "✅ $*"; }
warn() { echo "⚠️  $*" >&2; }
die() { echo "❌ $*" >&2; exit 1; }

pm_name() {
  if command -v pnpm >/dev/null 2>&1; then echo "pnpm"; else echo "npm"; fi
}

need_node() {
  command -v node >/dev/null 2>&1 || die "需要 Node.js 18+（https://nodejs.org）"
  command -v npm >/dev/null 2>&1 || die "需要 npm（随 Node.js 安装）"
}

load_env() {
  if [ -f "$ADMIN_DIR/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$ADMIN_DIR/.env"
    set +a
  else
    die "未找到 admin/.env，请先执行: cp $ADMIN_DIR/.env.example $ADMIN_DIR/.env"
  fi

  : "${CF_ACCOUNT_ID:?请在 admin/.env 中设置 CF_ACCOUNT_ID}"

  if [ -z "${ADMIN_TOKEN:-}" ]; then
    warn "未设置 ADMIN_TOKEN，/admin/* 管理接口将全部拒绝（可在设置页保存令牌前先配置 .env）"
  fi
}

deps_installed() {
  [ -d "$ADMIN_DIR/node_modules" ] && [ -d "$ADMIN_DIR/web/node_modules" ]
}

cmd_install() {
  info "安装依赖 ($(pm_name))"
  bash "$PM" install
  ok "依赖安装完成"
}

ensure_deps() {
  if deps_installed; then
    info "依赖已存在，跳过安装（强制重装请运行: ./run.sh install）"
  else
    cmd_install
  fi
}

cmd_build() {
  ensure_deps
  info "构建前端 + 类型检查 ($(pm_name))"
  cd "$ADMIN_DIR"
  bash "$PM" run build
  ok "构建完成 → admin/web/dist"
}

cmd_dev() {
  need_node
  load_env
  ensure_deps

  local port="${PORT:-8787}"
  ok "开发模式启动中（$(pm_name)）"
  echo "   API   : http://127.0.0.1:${port}"
  echo "   前端  : http://localhost:5173/login  （Vite 开发；勿直接打开 :8787）"
  echo "   默认账号: admin / 123456"
  echo ""

  cd "$ADMIN_DIR"
  exec bash "$PM" run dev
}

cmd_start() {
  need_node
  load_env
  ensure_deps

  if [ ! -f "$ADMIN_DIR/web/dist/index.html" ]; then
    cmd_build
  fi

  local bind="${ADMIN_BIND:-127.0.0.1}"
  local port="${PORT:-8787}"
  local host="$bind"
  if [ "$bind" = "0.0.0.0" ]; then host="localhost"; fi

  ok "生产模式启动中（$(pm_name)）"
  echo "   访问  : http://${host}:${port}"
  echo "   健康检查: http://${host}:${port}/health"
  if [ "$bind" != "127.0.0.1" ]; then
    warn "绑定地址为 ${bind}，请确保 ADMIN_TOKEN 足够强并已配置 TLS"
  fi
  echo ""

  cd "$ADMIN_DIR"
  exec bash "$PM" start
}

cmd_test() {
  need_node
  ensure_deps
  cd "$ADMIN_DIR"
  exec bash "$PM" test
}

usage() {
  cat <<EOF
用法: $(basename "$0") [命令]

命令:
  dev      开发模式（默认）：并行启动 Hono + Vite
  install  安装依赖（admin + web）
  build    构建前端产物到 web/dist
  start    生产模式：构建后启动 Hono（托管 SPA）
  test     运行后端测试

包管理器: 已安装 pnpm 时优先 pnpm，否则使用 npm

示例:
  ./run.sh
  ./run.sh start
EOF
}

main() {
  local cmd="${1:-dev}"
  case "$cmd" in
    dev) cmd_dev ;;
    install) need_node && cmd_install ;;
    build) need_node && cmd_build ;;
    start|prod) cmd_start ;;
    test) cmd_test ;;
    -h|--help|help) usage ;;
    *) die "未知命令: $cmd（运行 ./run.sh --help 查看帮助）" ;;
  esac
}

main "$@"
