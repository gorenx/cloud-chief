#!/usr/bin/env bash
# 通过 Cloudflare AI Gateway 调用 qwen-max，验证链路是否通畅。

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/scripts/load-admin-env.sh"
load_admin_env "$SCRIPT_DIR" || exit 1

: "${CF_GATEWAY_ID:=qwen-gw}"
: "${PROVIDER_SLUG:=qwen-beijing-maas}"
: "${PROVIDER_PATH:=/compatible-mode/v1/chat/completions}"
MODEL="${MODEL:-qwen-max}"

: "${CF_ACCOUNT_ID:?请在 admin/.env 设置 CF_ACCOUNT_ID}"
: "${DASHSCOPE_API_KEY:?请在 admin/.env 设置 DASHSCOPE_API_KEY}"

URL="https://gateway.ai.cloudflare.com/v1/${CF_ACCOUNT_ID}/${CF_GATEWAY_ID}/custom-${PROVIDER_SLUG}${PROVIDER_PATH}"
PROMPT="${1:-你好，请用一句话介绍你自己。}"

echo "请求地址: $URL"
echo "模型     : $MODEL"
echo "----------------------------------------"

HEADERS=(-H "Authorization: Bearer ${DASHSCOPE_API_KEY}" -H "Content-Type: application/json")
if [ -n "${CF_AIG_TOKEN:-}" ]; then
  HEADERS+=(-H "cf-aig-authorization: Bearer ${CF_AIG_TOKEN}")
fi

RESP="$(curl -s "$URL" "${HEADERS[@]}" -d "$(python3 -c 'import json,sys
print(json.dumps({"model":sys.argv[1],"input":sys.argv[2]}))' "$MODEL" "$PROMPT")")"

# 解析 Responses API：output[] 中 type=message 的 content[].text
printf '%s' "$RESP" | python3 -c 'import sys,json
try:
    d=json.load(sys.stdin)
except Exception:
    print(sys.stdin.read()); sys.exit()
if d.get("error"):
    print("❌ 错误:", d["error"].get("message") if isinstance(d["error"],dict) else d["error"]); sys.exit()
parts=[]
for o in d.get("output",[]):
    if o.get("type")=="message":
        for c in o.get("content",[]):
            if c.get("text"): parts.append(c["text"])
if parts:
    print("".join(parts))
else:
    print("⚠️ 未取到内容，原始返回：")
    print(json.dumps(d, ensure_ascii=False, indent=2))'
