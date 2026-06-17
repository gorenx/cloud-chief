# shellcheck shell=bash
# 供仓库根 CLI 脚本 source：加载 admin/.env（与 Admin 服务同一配置源）
load_admin_env() {
  local repo_root="${1:?repo root required}"
  local admin_env="$repo_root/admin/.env"
  if [ -f "$admin_env" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$admin_env"
    set +a
  else
    echo "❌ 未找到 admin/.env，请先执行: cp admin/.env.example admin/.env" >&2
    return 1
  fi
}
