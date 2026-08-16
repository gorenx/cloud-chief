# Information architecture and interactions

English | [简体中文](information-architecture.zh-CN.md)

## Navigation

| Page | Primary responsibility |
| --- | --- |
| Overview | Account, routing, synchronization, and Worker summaries |
| Playground | Direct-Gateway or Worker-backed chat diagnostics |
| Gateways | Gateway lifecycle, authentication, and resolved route context |
| Providers | Custom provider lifecycle |
| Keys | Gateway-scoped BYOK provider credentials |
| Worker | Local project configuration, secrets, development process, and deployment |
| Settings | Admin token and local operational preferences |

## Main workflows

### First-time configuration

1. Configure `admin/.env` and enter `ADMIN_TOKEN` in Settings.
2. Refresh Cloudflare state and create or select a gateway and provider.
3. Configure BYOK credentials or the direct-playground provider key.
4. Optionally connect Supabase and configure a Worker project.
5. Verify direct-Gateway traffic, then verify the production-like Worker path.

### Diagnose routing or authentication

Use the Playground path selector to isolate the boundary. Direct mode tests Admin -> Gateway -> provider. Worker mode additionally tests the user JWT, entitlement, quota, and Worker configuration. Gateway pages own resource changes; the Playground only exercises and explains the resolved route.

Changing a default model updates Admin-owned configuration. It does not mutate the provider catalog or Worker tier policy automatically.
