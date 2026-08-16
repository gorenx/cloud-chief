# Admin documentation

English | [简体中文](README.zh-CN.md)

The Admin application is a local or private-network operations console. It combines a Hono API, a React SPA, local SQLite state, Cloudflare and Supabase APIs, and local Wrangler projects.

## Documents

| Document | Scope |
| --- | --- |
| [Architecture](architecture.md) | Runtime layers, trust boundaries, and dependencies |
| [Information architecture](information-architecture.md) | Navigation, pages, and user workflows |
| [Data sources](data-sources.md) | Authority and refresh source for each data domain |
| [Local storage and synchronization](local-storage-sync.md) | SQLite schema, snapshots, conflict rules, and refresh flow |
| [API reference](api.md) | Public, management, Worker, and Supabase endpoints |

Quick start and deployment instructions remain in [`../README.md`](../README.md). This directory owns design and behavioral reference material, avoiding copies of setup instructions.
