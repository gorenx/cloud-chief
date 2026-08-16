# Admin 文档

[English](README.md) | 简体中文

Admin 是本地/内网运维控制台，由 Hono API、React SPA、本地 SQLite、Cloudflare/Supabase API 和本地 Wrangler 项目共同组成。

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [技术架构](architecture.zh-CN.md) | 运行分层、信任边界和外部依赖 |
| [信息架构](information-architecture.zh-CN.md) | 导航、页面和用户流程 |
| [数据来源](data-sources.zh-CN.md) | 各数据域的权威来源和刷新来源 |
| [本地存储与同步](local-storage-sync.zh-CN.md) | SQLite、快照、冲突规则和刷新流程 |
| [API 参考](api.zh-CN.md) | 公开、管理、Worker 和 Supabase 端点 |

快速启动和部署说明只保留在 [`../README.zh-CN.md`](../README.zh-CN.md)；本目录只负责设计与行为参考，避免重复维护操作步骤。
