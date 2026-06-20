# 调试页面 Requirements

> Purpose: 描述调试页用户目标与验收标准，不涉及实现细节。  
> Domain ID: **D-DBG**  
> Related features: [features.md](./features.md)

## User Goal

运维/开发在**同一调试页面**内，通过 **三个 Tab** 分别聚焦：

1. **聊天** — 快速对话式验证（可选 Gateway / Worker 后端）
2. **Gateway** — 直连 AI Gateway 的 HTTP 路径与路由检视
3. **Worker** — 经边缘 Worker 的 HTTP 请求与环境检视（不限于聊天形态）

从而区分问题出在对话链路、Gateway 直连，还是 Worker 代理层。

## 信息架构（已确认）

```
调试页面
├── Tab：聊天
│   ├── 小切换：Gateway | Worker（localStorage 记住上次选择）
│   ├── 精简控件：网关、模型；（Worker 时还需项目/鉴权，见 features）
│   ├── 对话式请求控制台（SSE）
│   └── 精简侧栏或折叠检视
├── Tab：Gateway
│   ├── 控件：网关、模型
│   ├── HTTP/聊天请求区 → POST /api/chat
│   └── 侧栏：CF 路由、BYOK、invoke_url
└── Tab：Worker
    ├── 控件：Worker 项目、本地/线上、配置来源、健康检查
    ├── HTTP 请求区（聊天为默认模板，本质为 Worker HTTP 调试）
    └── 侧栏：Supabase、Worker 路由、vars 对照
```

**已确认决策（2025-06）**

- 采用 **三 Tab**，不再用页级「直连 Gateway | 经 Worker」分段控件
- **聊天 Tab** 内保留 **Gateway / Worker 小切换**，**默认记住上次选择**（localStorage）
- **Gateway Tab** 保留直连 `POST /api/chat`
- **Worker Tab** 定位为 **HTTP 请求调试**，聊天 UI 仅为便捷模板之一

## Scope

- 路由 `/playground`，导航名「调试页面」
- 三 Tab 切换及 Tab 内专属控件、请求区、侧栏
- Gateway 直连：`POST /api/chat`
- Worker 代理：`POST /api/worker-chat`（含 `worker_dir`、`worker_target` 等）
- `GET /config?worker_dir=` 按所选 Worker 项目加载运行时

## Out Of Scope

- 网关/提供商/BYOK CRUD（独立管理页）
- Worker 部署与 secret 全生命周期（Worker 部署页）
- 通用 REST 客户端（任意 method/url）

## User Stories

### US-DBG01: 聊天 Tab — 快速对话验证

**Story**: 作为开发，我希望在「聊天」Tab 用最少控件发消息并看流式回复，并可切换 Gateway/Worker 后端。

**Acceptance Criteria**:

- [ ] Tab「聊天」：对话输入 + SSE 回复 + 错误展示
- [ ] Tab 内 **Gateway / Worker 小切换**；选择写入 localStorage，刷新后恢复
- [ ] Gateway 选中：走 `/api/chat`；精简展示网关、模型
- [ ] Worker 选中：走 `/api/worker-chat`；展示必要 Worker 鉴权/项目（粒度见 F-DBG07）
- [ ] 空会话 hint 随小切换变化

**Priority**: P0  
**Status**: **Planned**（三 Tab 重构）

---

### US-DBG02: Gateway Tab — 直连调试

**Story**: 作为运维，我希望在「Gateway」Tab 专注直连网关路径，查看完整 CF 路由与 BYOK 上下文。

**Acceptance Criteria**:

- [ ] 仅 Gateway Tab 展示完整 Gateway 侧栏（invoke、BYOK、context）
- [ ] 请求固定 `POST /api/chat`
- [ ] 可选择网关、模型
- [ ] 说明本路径使用 `DASHSCOPE_API_KEY`，与 BYOK invoke 直连不同

**Priority**: P0  
**Status**: **Planned**

---

### US-DBG03: Worker Tab — HTTP / Worker 环境调试

**Story**: 作为开发，我希望在「Worker」Tab 对所选 Worker 发 HTTP 类请求并检视运行环境，验证 JWT → Worker → Gateway 链路。

**Acceptance Criteria**:

- [ ] Worker 项目选择（需 ADMIN_TOKEN 列表）
- [ ] 本地/线上目标、Worker 配置/调试界面来源、健康检查、启动本地 dev
- [ ] 请求经 `POST /api/worker-chat`（Admin 代持 JWT）
- [ ] 侧栏：Supabase 向导、Worker 路由、vars 对照
- [ ] 主区域为 **HTTP 请求调试**（聊天为默认 body 模板；高级形态见 Open Questions）

**Priority**: P0  
**Status**: **Planned**

---

### US-DBG04: 路由与鉴权检视

**Story**: 作为运维，我希望在当前 Tab 下看到匹配的路由链与数据来源标签。

**Acceptance Criteria**:

- [ ] 侧栏内容随 Tab（及聊天 Tab 内小切换）变化
- [ ] 可收起/展开
- [ ] 数据来源标签：env / cf / wrangler / derived

**Priority**: P1  
**Status**: Partial（现网有侧栏；需按 Tab 拆分）

---

### US-DBG05: 本地 Worker 一键启动

**Story**: 作为开发，在 Worker Tab（及聊天 Tab 选 Worker 时）可一键启动本地 `wrangler dev`。

**Acceptance Criteria**:

- [ ] `POST /admin/worker/dev/start?dir=`，对当前 Worker 项目生效
- [ ] 需 ADMIN_TOKEN

**Priority**: P1  
**Status**: Implemented（需迁入对应 Tab）

## Non-Functional Requirements

- Tab 与小切换选择均宜 localStorage 持久化
- 无 ADMIN_TOKEN：Gateway 直连与读 `/config` 可用；Worker 列表等需令牌
- `worker_dir` 限制在 `WORKER_ROOT` 白名单内

## Open Questions

- **Worker Tab 请求区形态**：阶段 1 沿用聊天 UI，还是直接做 HTTP 面板（URL/endpoint/body）— **待确认**
- **聊天 Tab 选 Worker 时**：展示完整 Worker 控件还是精简 + 「在 Worker Tab 配置」链接 — **待确认**

## Assumptions

- 三个 Tab 是**并列调试视角**，不是 wizard 步骤
- 聊天 Tab 的小切换仅影响**聊天 Tab 内**的请求路径，不改变 Gateway/Worker Tab 的专属布局
