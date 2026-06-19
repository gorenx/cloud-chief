#!/usr/bin/env bash
# 将 ai-gateway-worker/cloudflare-builds.json 同步到 Cloudflare Workers Builds（monorepo 优化）。
#
# 需要：已连接 GitHub 的 Worker，且用户级 API Token 含：
#   - Account > Workers CI > Edit（Dashboard 显示名；API 亦称 Workers CI Write）
#   - Account > Workers Scripts > Read（用于查找 Worker tag）
#
# 注意：必须用「My Profile > API Tokens」创建的用户 Token，账户级 Token 不支持 Builds API。
#
# 用法：
#   CF_WORKER_BUILDER=xxx ./scripts/configure-cloudflare-builds.sh
#   CF_ACCOUNT_ID=xxx CF_WORKER_BUILDER=xxx ./scripts/configure-cloudflare-builds.sh
#
# 也可在 Dashboard 手动配置（Settings > Build > Build watch paths）：
#   Include paths: ai-gateway-worker/*, packages/gateway-core/*
#   Exclude paths: （留空）
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_DIR="$(dirname "$HERE")"
CONFIG_FILE="${CONFIG_FILE:-$WORKER_DIR/cloudflare-builds.json}"
WRANGLER_TOML="$WORKER_DIR/wrangler.toml"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] && [ -z "${CF_WORKER_BUILDER:-}" ]; then
  echo "✘ 请设置 CF_WORKER_BUILDER 或 CLOUDFLARE_API_TOKEN（用户 Token，需 Workers CI Edit + Workers Scripts Read）" >&2
  exit 1
fi

CLOUDFLARE_API_TOKEN="${CF_WORKER_BUILDER:-${CLOUDFLARE_API_TOKEN:-}}"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "✘ 找不到配置文件: $CONFIG_FILE" >&2
  exit 1
fi

if [ -z "${CF_ACCOUNT_ID:-}" ] && [ -f "$WRANGLER_TOML" ]; then
  CF_ACCOUNT_ID="$(grep -E '^\s*CF_ACCOUNT_ID\s*=' "$WRANGLER_TOML" | head -1 | sed -E 's/.*"([^"]*)".*/\1/')"
fi

if [ -z "${CF_ACCOUNT_ID:-}" ]; then
  echo "✘ 请设置 CF_ACCOUNT_ID，或在 wrangler.toml [vars] 中配置 CF_ACCOUNT_ID" >&2
  exit 1
fi

API="https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID"
AUTH=(-H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json")

read_config() {
  python3 - "$CONFIG_FILE" <<'PY'
import json, sys
with open(sys.argv[1]) as f:
    cfg = json.load(f)
for key in (
    "worker_name", "root_directory", "build_command",
    "deploy_command", "preview_deploy_command",
    "path_includes", "path_excludes",
):
    print(f"{key}={json.dumps(cfg[key], ensure_ascii=False)}")
PY
}

eval "$(read_config)"

echo "▶ 查找 Worker: $worker_name"
scripts_json="$(curl -fsS "${AUTH[@]}" "$API/workers/scripts")"
worker_tag="$(printf '%s' "$scripts_json" | python3 -c "
import json, sys, os
data = json.load(sys.stdin)
name = os.environ['WORKER_NAME']
for item in data.get('result', []):
    if item.get('id') == name:
        print(item['tag'])
        break
else:
    sys.exit('Worker not found: ' + name)
" WORKER_NAME="$worker_name")"

echo "▶ Worker tag: $worker_tag"
triggers_json="$(curl -fsS "${AUTH[@]}" "$API/builds/workers/$worker_tag/triggers")"
trigger_count="$(printf '%s' "$triggers_json" | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('result', [])))")"

if [ "$trigger_count" = "0" ]; then
  echo "✘ 未找到 Builds trigger。请先在 Dashboard 连接 GitHub 仓库。" >&2
  exit 1
fi

printf '%s' "$triggers_json" | python3 -c "
import json, os, subprocess, sys

cfg = {
    'root_directory': os.environ['ROOT_DIRECTORY'],
    'build_command': os.environ['BUILD_COMMAND'],
    'deploy_command': os.environ['DEPLOY_COMMAND'],
    'preview_deploy_command': os.environ['PREVIEW_DEPLOY_COMMAND'],
    'path_includes': json.loads(os.environ['PATH_INCLUDES']),
    'path_excludes': json.loads(os.environ['PATH_EXCLUDES']),
}
api = os.environ['API']
token = os.environ['CLOUDFLARE_API_TOKEN']
data = json.load(sys.stdin)

for trigger in data.get('result', []):
    uuid = trigger['trigger_uuid']
    name = trigger.get('trigger_name', uuid)
    branches = trigger.get('branch_includes', [])
    is_preview = '*' in branches and 'main' in trigger.get('branch_excludes', [])
    deploy = cfg['preview_deploy_command'] if is_preview else cfg['deploy_command']
    payload = {
        'root_directory': cfg['root_directory'],
        'build_command': cfg['build_command'],
        'deploy_command': deploy,
        'path_includes': cfg['path_includes'],
        'path_excludes': cfg['path_excludes'],
    }
    body = json.dumps(payload)
    result = subprocess.run(
        [
            'curl', '-fsS', f'{api}/builds/triggers/{uuid}',
            '-H', f'Authorization: Bearer {token}',
            '-H', 'Content-Type: application/json',
            '-X', 'PATCH',
            '--data', body,
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f'✘ 更新 trigger 失败 ({name}): {result.stderr or result.stdout}', file=sys.stderr)
        sys.exit(1)
    print(f'✔ {name}')
    print(f'  root_directory={cfg[\"root_directory\"]}')
    print(f'  build_command={cfg[\"build_command\"]}')
    print(f'  deploy_command={deploy}')
    print(f'  path_includes={cfg[\"path_includes\"]}')
" \
  ROOT_DIRECTORY="$root_directory" \
  BUILD_COMMAND="$build_command" \
  DEPLOY_COMMAND="$deploy_command" \
  PREVIEW_DEPLOY_COMMAND="$preview_deploy_command" \
  PATH_INCLUDES="$path_includes" \
  PATH_EXCLUDES="$path_excludes" \
  API="$API" \
  CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN"

echo "✔ Workers Builds 已同步。ai-gateway-worker/* 与 packages/gateway-core/* 变更会触发构建。"
