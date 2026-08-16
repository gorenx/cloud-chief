# Data sources and authority

English | [简体中文](data-sources.zh-CN.md)

This document identifies who owns each value. See [local storage and synchronization](local-storage-sync.md) for persistence mechanics.

| Domain | Authority | Local representation |
| --- | --- | --- |
| Admin defaults and preferences | SQLite, initially seeded from `admin/.env` | `app_config` and related Admin tables |
| Gateways, custom providers, BYOK keys | Cloudflare API | Refreshable snapshots and sync metadata |
| D1 databases and deployed Workers | Cloudflare API | Refreshable snapshots |
| Worker projects, vars, and local secrets | `wrangler.toml` and `.dev.vars` | Project index and redacted metadata |
| Supabase organizations and projects | Supabase Management API | OAuth state and refreshable project snapshots |
| Built-in model metadata | `src/model-catalog.ts` | Loaded in process; currently Qwen-focused and not supplied by Cloudflare |
| Playground request result | Selected upstream at request time | Transient response and operational logs |

Environment values are startup seeds or process credentials, not a second mutable database. A refresh replaces remote snapshots but must not overwrite file-authoritative Worker configuration or Admin-owned preferences.

Secret values are redacted: SQLite may retain a secret name, hash, or last-known status, but not a retrievable plaintext copy.
