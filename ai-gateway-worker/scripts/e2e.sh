#!/usr/bin/env bash
# 端到端测试：Supabase 账密 → 换 access_token → 打本地/线上 worker。
#
# 用法：
#   ./scripts/e2e.sh                  # 默认打本地 http://127.0.0.1:8788
#   WORKER_URL=https://你的worker.workers.dev ./scripts/e2e.sh
#   ENDPOINT=chat PROMPT="你好" ./scripts/e2e.sh
#
# 凭据只从环境变量读取，避免在仓库文件中保存测试账号或密钥：
#   EMAIL / PASSWORD / ANON_KEY
# SUPABASE_URL 默认从 wrangler.toml 读取。
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_DIR="$(dirname "$HERE")"

EMAIL="${EMAIL:-}"
PASSWORD="${PASSWORD:-}"
ANON_KEY="${ANON_KEY:-}"
SUPABASE_URL="${SUPABASE_URL:-$(grep -E '^\s*SUPABASE_URL' "$WORKER_DIR/wrangler.toml" | head -1 | sed -E 's/.*"([^"]*)".*/\1/')}"
WORKER_URL="${WORKER_URL:-http://127.0.0.1:8788}"
ENDPOINT="${ENDPOINT:-responses}"   # responses | chat
MODEL="${MODEL:-qwen3-max}"
PROMPT="${PROMPT:-用一句话自我介绍}"

if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ] || [ -z "$ANON_KEY" ]; then
  echo "✘ 缺少凭据：请设置 EMAIL/PASSWORD/ANON_KEY 环境变量" >&2
  exit 1
fi
if [ -z "$SUPABASE_URL" ]; then
  echo "✘ 无法确定 SUPABASE_URL（wrangler.toml 未找到，可用环境变量指定）" >&2
  exit 1
fi

echo "▶ 登录 $SUPABASE_URL (${EMAIL})"
LOGIN="$(curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"
TOKEN="$(printf '%s' "$LOGIN" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')"
if [ -z "$TOKEN" ]; then
  echo "✘ 登录失败：$LOGIN" >&2
  exit 1
fi
echo "✔ 已获取 access_token（${#TOKEN} 字符）"

echo
echo "▶ GET $WORKER_URL/health"
curl -s -m 5 "$WORKER_URL/health" || { echo "✘ /health 无响应，worker 是否在运行？" >&2; exit 1; }
echo

# 两种上游 API 的请求体不同
if [ "$ENDPOINT" = "chat" ]; then
  PAYLOAD="$(printf '{"model":"%s","messages":[{"role":"user","content":"%s"}],"stream":false}' "$MODEL" "$PROMPT")"
else
  PAYLOAD="$(printf '{"model":"%s","input":[{"role":"user","content":"%s"}],"stream":false}' "$MODEL" "$PROMPT")"
fi

echo
echo "▶ POST $WORKER_URL/v1/$ENDPOINT"
HTTP_CODE="$(curl -s -m 60 -o /tmp/e2e_resp.json -w "%{http_code}" \
  -X POST "$WORKER_URL/v1/$ENDPOINT" \
  -H "authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d "$PAYLOAD")"
echo "HTTP $HTTP_CODE"
head -c 1200 /tmp/e2e_resp.json; echo
[ "$HTTP_CODE" = "200" ] && echo "✔ 端到端通过" || { echo "✘ 端到端失败"; exit 1; }
