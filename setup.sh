#!/usr/bin/env bash
# 在 Cloudflare AI Gateway 上创建/启用一个自定义提供商，指向阿里云 MaaS (qwen) 端点。
# 依赖：curl、python3（用于解析 JSON）。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/scripts/load-admin-env.sh"
load_admin_env "$SCRIPT_DIR" || exit 1

# 以下可在命令行覆盖（默认与 worker/wrangler.toml 常见配置一致）
: "${CF_GATEWAY_ID:=qwen-gw}"
: "${PROVIDER_SLUG:=qwen-beijing-maas}"
: "${PROVIDER_BASE_URL:=https://ws-3mll18ey04t6yc61.cn-beijing.maas.aliyuncs.com}"
: "${PROVIDER_PATH:=/compatible-mode/v1/responses}"

: "${CF_ACCOUNT_ID:?请在 admin/.env 中设置 CF_ACCOUNT_ID}"
: "${CF_API_TOKEN:?请在 admin/.env 中设置 CF_API_TOKEN}"

API="https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}"
AUTH=(-H "Authorization: Bearer ${CF_API_TOKEN}" -H "Content-Type: application/json")

# 从 JSON 中取字段：json_get '<json>' 'key.path'
json_get() {
  python3 -c 'import sys,json
data=json.load(sys.stdin)
keys=sys.argv[1].split(".")
for k in keys:
    if isinstance(data,list):
        data=data[int(k)]
    else:
        data=data.get(k) if isinstance(data,dict) else None
    if data is None:
        break
print(data if data is not None else "")' "$1"
}

# 若提供了 CF_AIG_TOKEN，则保留网关层鉴权(authentication=true)；否则关闭（上游已用 DashScope Key 鉴权）。
if [ -n "${CF_AIG_TOKEN:-}" ]; then AUTH_FLAG=true; else AUTH_FLAG=false; fi
echo "==> 1/3 确保网关存在: ${CF_GATEWAY_ID:=default}（authentication=${AUTH_FLAG}）"
GW_BODY="{\"cache_ttl\":0,\"collect_logs\":true,\"cache_invalidate_on_update\":false,\"authentication\":${AUTH_FLAG},\"rate_limiting_interval\":0,\"rate_limiting_limit\":0,\"rate_limiting_technique\":\"sliding\"}"

GW_RESP="$(curl -s "${API}/ai-gateway/gateways/${CF_GATEWAY_ID}" "${AUTH[@]}" || true)"
if [ "$(printf '%s' "$GW_RESP" | json_get success)" != "True" ]; then
  echo "    网关不存在，创建中 ..."
  CREATE_BODY="$(python3 -c 'import json,sys;b=json.loads(sys.argv[2]);b["id"]=sys.argv[1];print(json.dumps(b))' "$CF_GATEWAY_ID" "$GW_BODY")"
  curl -s -X POST "${API}/ai-gateway/gateways" "${AUTH[@]}" -d "$CREATE_BODY" >/dev/null || true
fi
# 统一用 PUT 把网关设置应用到位（含 authentication 开关）
PUT_RESP="$(curl -s -X PUT "${API}/ai-gateway/gateways/${CF_GATEWAY_ID}" "${AUTH[@]}" -d "$GW_BODY")"
if [ "$(printf '%s' "$PUT_RESP" | json_get success)" = "True" ]; then
  echo "    ✅ 网关就绪（authentication=$(printf '%s' "$PUT_RESP" | json_get result.authentication)）"
else
  echo "    ⚠️  网关设置返回："
  printf '%s\n' "$PUT_RESP"
fi

echo "==> 2/3 查询是否已存在 slug='${PROVIDER_SLUG}' 的自定义提供商"
LIST_RESP="$(curl -s "${API}/ai-gateway/custom-providers?search=${PROVIDER_SLUG}" "${AUTH[@]}")"
EXISTING_ID="$(printf '%s' "$LIST_RESP" | python3 -c 'import sys,json
d=json.load(sys.stdin)
slug=sys.argv[1]
for p in d.get("result") or []:
    if p.get("slug")==slug:
        print(p.get("id")); break' "$PROVIDER_SLUG")"

PAYLOAD="$(python3 -c 'import json,sys
print(json.dumps({
  "name": sys.argv[1],
  "slug": sys.argv[2],
  "base_url": sys.argv[3],
  "description": "Aliyun MaaS qwen via OpenAI-compatible endpoint",
  "enable": True
}))' "Qwen MaaS (${PROVIDER_SLUG})" "$PROVIDER_SLUG" "$PROVIDER_BASE_URL")"

if [ -n "$EXISTING_ID" ]; then
  echo "==> 3/3 已存在 (id=${EXISTING_ID})，执行更新 (PATCH)"
  RESP="$(curl -s -X PATCH "${API}/ai-gateway/custom-providers/${EXISTING_ID}" "${AUTH[@]}" -d "$PAYLOAD")"
else
  echo "==> 3/3 不存在，执行创建 (POST)"
  RESP="$(curl -s -X POST "${API}/ai-gateway/custom-providers" "${AUTH[@]}" -d "$PAYLOAD")"
fi

if [ "$(printf '%s' "$RESP" | json_get success)" = "True" ]; then
  PID="$(printf '%s' "$RESP" | json_get result.id)"
  echo ""
  echo "✅ 配置成功！"
  echo "   provider id : ${PID}"
  echo "   slug        : ${PROVIDER_SLUG}  (调用时需写成 custom-${PROVIDER_SLUG})"
  echo "   base_url    : ${PROVIDER_BASE_URL}"
  echo ""
  echo "   网关调用地址（提供商专用端点）："
  echo "   https://gateway.ai.cloudflare.com/v1/${CF_ACCOUNT_ID}/${CF_GATEWAY_ID}/custom-${PROVIDER_SLUG}${PROVIDER_PATH:-/compatible-mode/v1/chat/completions}"
  echo ""
  echo "   运行 ./test.sh 进行验证，或 node server.js 启动 Web 界面。"
else
  echo "❌ 失败，返回内容："
  printf '%s\n' "$RESP"
  exit 1
fi
