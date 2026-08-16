# ai-gateway-proxy integration guide

English | [简体中文](ai-gateway-worker.zh-CN.md)

Use this Worker from applications instead of exposing gateway or model-provider credentials.

The integration contract is OpenAI-compatible Chat Completions or Responses. Examples in the Chinese companion use the repository's current Qwen/DashScope adapter; they demonstrate one adapter and do not define the system's provider boundary.

## Request path

```text
client bearer JWT -> ai-gateway-proxy -> entitlement and quota -> AI gateway -> model provider
```

## Example

```js
const response = await fetch(`${workerUrl}/v1/responses`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${accessToken}`,
    "x-device-id": deviceId,
  },
  body: JSON.stringify({
    input: "Hello",
    stream: true,
  }),
});

if (!response.ok) throw new Error(await response.text());
```

The requested model is advisory: the Worker selects the allowed model for the resolved free or Plus tier. For streaming requests, consume the response body as SSE and handle the upstream terminal event; do not assume that every successful stream ends with a JSON body.

## Middleware order

For `/v1/*`, CORS and request metadata wrap authentication, allow-list policy, burst limiting, entitlement lookup, daily quota enforcement, request normalization, and upstream forwarding. Failures before forwarding use the JSON error contract in the [API reference](../ai-gateway-worker/API.md).

For local end-to-end verification, run `ai-gateway-worker/scripts/e2e.sh` after configuring `.dev.vars` and starting the Worker.
