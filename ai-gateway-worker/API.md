# ai-gateway-proxy API

English | [简体中文](API.zh-CN.md)

## Authentication

`POST /v1/*` requires `Authorization: Bearer <user_access_token>`. `GET /health` is public. The Worker validates issuer, audience, signature, expiry, and subject before applying allow-list, rate-limit, entitlement, and quota policy.

## Endpoints

### `GET /health`

Returns process health without contacting the model provider.

### `POST /v1/chat/completions`

Accepts an OpenAI-compatible Chat Completions body. The Worker overrides the model according to the authoritative tier and forwards either JSON or SSE from the upstream service.

### `POST /v1/responses`

Accepts an OpenAI-compatible Responses body. The Worker overrides the model and forwards non-streaming JSON or streaming SSE without buffering the full response.

## Response metadata

Successful model responses expose `X-Gateway-Tier`, `X-Gateway-Used`, and `X-Gateway-Quota` when available. CORS exposes these headers to browser clients.

## Error model

Errors returned before upstream streaming use JSON:

```json
{ "error": "description" }
```

Typical statuses are `400` for invalid input, `401` for invalid authentication, `403` for policy denial, `429` for burst or daily quota, `502` for an upstream failure, and `500` for an unexpected Worker failure. Upstream bodies may be forwarded when doing so is safe and useful.

See the [integration guide](../doc/ai-gateway-worker.md) for client and SSE handling examples.
