# 调试页面 Features

> Bridge: 用户故事 → 功能 → 模块 → 测试  
> Related requirements: [req.md](./req.md)

## Feature List

| Feature ID | Feature | Source | Owner | Status |
| --- | --- | --- | --- | --- |
| F-DBG06 | 三 Tab 壳层（聊天 / Gateway / Worker） | US-DBG01–03 | `Playground.tsx` | **Planned** |
| F-DBG07 | 聊天 Tab + Gateway/Worker 小切换（持久化） | US-DBG01 | `PlaygroundChatTab.tsx`（待建） | **Planned** |
| F-DBG01 | 对话式请求控制台 | US-DBG01 | `usePlaygroundChat.ts` | Implemented → 迁入聊天 Tab |
| F-DBG02 | Gateway Tab 直连调试 | US-DBG02 | `routes/chat.ts`, 侧栏 | Partial → 迁入 Gateway Tab |
| F-DBG03 | Worker Tab HTTP/代理调试 | US-DBG03 | `routes/worker-chat.ts` | Partial → 迁入 Worker Tab |
| F-DBG04 | 路由检视侧栏（按 Tab 分化） | US-DBG04 | `PlaygroundRoutingSidebar.tsx` | Partial |
| F-DBG05 | Worker 项目选择 | US-DBG03 | `PlaygroundWorkerSelect`, `worker-dir.ts` | Implemented |

## 三 Tab 行为矩阵（目标态）

| | **聊天 Tab** | **Gateway Tab** | **Worker Tab** |
| --- | --- | --- | --- |
| **主区域** | 对话控制台 | HTTP/聊天请求 | HTTP 请求（聊天为模板） |
| **路径切换** | 内嵌 **Gateway \| Worker** 小切换 | 固定 Gateway | 固定 Worker |
| **持久化** | `admin-playground-chat-path` | 当前 Tab | 当前 Tab + `worker_dir` |
| **API** | `/api/chat` 或 `/api/worker-chat` | `/api/chat` | `/api/worker-chat` |
| **顶栏控件** | 精简 | 网关、模型 | 项目、目标、配置来源、dev |
| **侧栏** | 精简摘要 | 完整 CF/BYOK | Supabase、Worker 路由 |

## F-DBG07: 聊天 Tab Gateway/Worker 小切换（已确认）

**Source Requirement**: US-DBG01

**Behavior**:

- 位于聊天 Tab 工具栏，**SegmentedControl 或等效小控件**，选项 **Gateway** / **Worker**
- 切换后：更新 `buildChatRequest` 目标（`/api/chat` vs `/api/worker-chat`）、hint 文案、所需精简字段
- **localStorage** 键建议：`admin-playground-chat-path`，值 `gateway` | `worker`；页面加载时读取，非法则默认 `gateway`
- **不**出现在 Gateway Tab / Worker Tab 顶栏（避免与 Tab 职责重复）

**Boundary Conditions**:

- 选 Worker 但未配置 Supabase/令牌时，发送失败并展示现有错误文案
- 小切换不改变 Gateway/Worker Tab 的独立状态

**Test Expectations**:

- 切换后持久化；刷新恢复
- Gateway 选中 → `buildChatRequest` 走 chat；Worker 选中 → worker-chat

---

## F-DBG06: 三 Tab 壳层

**Behavior**:

- 页内 Tab：`聊天` | `Gateway` | `Worker`（i18n 键待增）
- 切换 Tab 不销毁另两 Tab 的表单状态（React state 或 lazy mount）
- 可选：localStorage 记住上次 Tab `admin-playground-active-tab`

**Dependencies**:

```text
F-DBG06
 ├── F-DBG07 (聊天 Tab + 小切换)
 ├── F-DBG02 (Gateway Tab)
 └── F-DBG03 (Worker Tab)
       └── F-DBG05
            └── F-DBG04 (侧栏按 Tab 配置)
```

## 现网 vs 目标态

| 现网 | 目标态 |
| --- | --- |
| 单页 + 顶栏「直连 Gateway \| 经 Worker」 | 三 Tab；小切换**仅**在聊天 Tab |
| 共用侧栏 | Tab 专属侧栏深度不同 |
| Worker 项目选择仅在 Worker 模式 | Gateway Tab 无项目；Worker Tab + 聊天 Tab(Worker) 需要 |

## Open Questions

- Worker Tab HTTP 面板是否纳入首期 — 见 req.md
- 聊天 Tab 选 Worker 时的控件精简程度 — 见 req.md
