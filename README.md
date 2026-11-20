# AI绘梦 · 漫剧短剧创作平台

面向个人创作者与企业的智能化 AIGC 内容生产平台（漫剧 / 短剧方向）。
一套 Vue 无、**Vite + React** 前端原型（10+ 功能页）+ 极简 Node 后端（异步生成任务，接火山引擎即梦 / 方舟）。

> 架构构想见 [ARCHITECTURE.md](ARCHITECTURE.md)；后端接口、目录结构与切真实凭证的步骤见 [server/README.md](server/README.md)。

---

## 快速开始

需要 **Node 22.5+**（后端用了内置 `node:sqlite`）。

```bash
pnpm install
cp server/.env.example server/.env

pnpm server   # 终端 1：后端 http://127.0.0.1:3001
pnpm dev      # 终端 2：前端 http://127.0.0.1:5173
```

前端 dev server 已把 `/api` 代理到 `3001`，无需配置 CORS。

默认 `MEDIA_PROVIDER=mock`、`LLM_PROVIDER=mock`，**不需要任何凭证**即可跑通「提交 → 轮询 → 产物落盘」全链路。

> Windows 下也可直接双击 `start-backend.cmd` 启动后端。

---

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Vite + React + Lucide 图标 + `@xyflow/react`（画布节点） |
| 后端 | Node（内置 `node:sqlite`）+ Express 5 |
| 存储 | 本地 SQLite（`server/data/`）+ 本地文件（`server/uploads/`） |
| AI 提供方 | mock / 火山方舟（ark）/ 即梦（jimeng） |
| 包管理 | pnpm |

---

## 页面与路由

每个 tab 都有独立 URL，用 `history.pushState` 实现（**无路由库**）：刷新保持当前页、前进后退可用、未知路径自动归一到 `/app/dashboard`。

工作台页面统一挂在 `/app` 下；`/admin`（平台 / 组织管理）、`/login`、`/invite` 不属于工作台，保持独立。

| URL | 页面 |
| --- | --- |
| `/app/dashboard` | 首页 |
| `/app/create` | 创作 |
| `/app/videos` | 成片（详情 `/app/videos#video=<任务id>`） |
| `/app/agents` | 智能体 |
| `/app/canvas` | 画布 |
| `/app/scripts` | 剧本 |
| `/app/breakdown` | 拆解 |
| `/app/assets` | 资产 |
| `/app/projects` | 项目 |
| `/app/data` | 数据 |
| `/app/distribute` | 分发 |
| `/app/tracing` | 调用追踪 |
| `/app/workspace` | 项目工作台（详情 `/app/workspace/projects/<id>`） |
| `/admin` | 平台 / 组织管理 |
| `/login` | 登录 |
| `/invite` | 邀请 |

### 管理面板

平台管理员与组织管理员共用同一套工作区骨架（`src/components/AdminWorkspace.jsx`）：左侧可折叠侧栏 + 顶栏工具条 + 内容区，靠 `session.role` 决定渲染哪个面板与哪些 tab。每个 tab 都有独立 URL，刷新与前进后退均可用。

**平台管理员（superadmin）**

| URL | Tab |
| --- | --- |
| `/admin/overview` | 平台概览 |
| `/admin/organizations` | 组织管理（详情 `/platform/organizations/:id`） |
| `/admin/users` | 用户与权限 |
| `/admin/usage` | 平台用量 |
| `/admin/tracing` | 调用追踪 |
| `/admin/audit` | 操作审计 |
| `/admin/reviews` | 内容审核 |
| `/admin/douyin` | 抖音运营 |

**组织管理员**

| URL | Tab |
| --- | --- |
| `/admin/org/overview` | 概览 |
| `/admin/org/members` | 成员管理 |
| `/admin/org/quota` | 额度分配 |
| `/admin/org/projects` | 项目管理 |
| `/admin/org/usage` | 用量与任务 |
| `/admin/org/tracing` | 调用追踪 |
| `/admin/org/audit` | 审计记录 |
| `/admin/org/reviews` | 内容审核 |
| `/admin/org/settings` | 组织设置 |
| `/admin/org/douyin` | 抖音运营 |

两个面板的 tab 全部接真实接口，没有前端演示数据。

标题会同步成「页面名 · AI绘梦」。部署到静态服务器时记得配置 SPA fallback（`try_files $uri /index.html`），否则直接访问 `/app/data` 会 404。

---

## 页面与后端数据

| 页面 | 数据来源 |
| --- | --- |
| 首页 | 真实：`/api/stats` 与任务 / 项目数据 |
| 工作台 | 真实：项目工作台，读写项目、剧本、分镜、画布文档 |
| 创作 | 真实：上传 / 粘贴剧本 → `/api/scripts`，列表来自后端 |
| 剧本 | 真实：同一份剧本库，支持上传、粘贴、删除 |
| 成片 | 真实：生成任务 `/api/tasks`，轮询进度、产物、重试、删除 |
| 智能体 | 真实：对话存 `/api/agent/messages`，回复由后端生成 |
| 画布 | 真实：画布与节点存 `/api/documents/canvases`，拖动后 500ms 落库 |
| 拆解 | 真实：记录存后端，进度完成后回写 |
| 项目 | 真实：项目与三步状态存 `/api/documents/projects` |
| 数据 | 真实：`/api/report` 按天聚合任务与剧本 |
| 分发 | 真实：草稿存 `/api/distribute/*`，文案由后端生成 |
| 追踪 | 真实：`/api/tracing/*` 汇总调用与任务时间线 |
| 资产 | 仍是前端演示数据（后端已允许 `documents/assets`，但页面尚未接入，需要图片上传与存储） |

---

## 配色与顶栏

- **四套配色**：新国风雅金 / 夜幕黑紫 / 极光淡紫 / 青绿山水。左下角调色盘展开选择，或直接点四个色点；选择存在 `localStorage`，刷新保持。实现见 [src/theme.css](src/theme.css)（`html[data-theme]` + CSS 变量）。
- **顶栏全部可点**：成片 / 分镜出片 / 新建画布 跳转；❀ 灵感特权、算力（实时读 `/api/stats`）、铃铛通知（未读数、点条目跳转）、头像菜单；点浮层外部或 Esc 关闭。实现见 [src/components/TopbarActions.jsx](src/components/TopbarActions.jsx)。

---

## 后端

接口、目录结构、切即梦真接口的步骤都在 [server/README.md](server/README.md)。要点：

- **媒体生成三种 Provider**（`MEDIA_PROVIDER`）：
  - `mock`：本地生成占位图 / 占位视频，零凭证跑通全链路；
  - `ark`：火山方舟，API Key + Bearer，走 Seedream（图）/ Seedance（视频）；
  - `jimeng`：即梦（火山智能视觉），AK/SK 签名（SigV4）。
- **文本模型两种 Provider**（`LLM_PROVIDER`）：`mock`（模板回复）/ `ark`（豆包）。
- 即梦是 **提交 + 查询** 的异步接口，产物链接 24 小时过期，因此后端会下载落盘到 `server/uploads/`。
- 任务由 `poller.js` 后台轮询，支持超时、最大重试（`MAX_ATTEMPTS`）、撤销与幂等重放。
- 积分定价：`CREDIT_CNY=0.12` 将真实成本折合成消耗积分（一张 Seedream 图 ≈ 1 积分）。

切换真实凭证：修改 `server/.env` 中对应 `*_PROVIDER` 与 Key，重启后端即可。

---

## 目录结构

```
├── src/                  前端源码
│   ├── pages/           各功能页（含工作台、管理面板）
│   ├── components/      AdminWorkspace、TopbarActions 等
│   ├── api.js           前端 API 封装
│   └── theme.css        四套配色 CSS 变量
├── server/               后端源码
│   ├── routes/          auth / tasks / documents / tracing / distribute / ...
│   ├── providers/       mock / ark / jimeng / llm
│   ├── db.js            SQLite 数据层
│   ├── poller.js        异步任务轮询
│   ├── permissions.js   RBAC 权限
│   └── index.js         Express 入口
├── ARCHITECTURE.md       架构构想
└── README.md
```

---

## 已知边界

- 数据存在本地 SQLite（`server/data/tasks.db`）与本地 `server/uploads/`，清掉即重置；生产环境需换共享数据库、持久任务队列与对象存储。
- 「资产」页仍是前端演示数据；其余页面与两个管理面板均已接真实后端。
- 即梦真接口代码已实现但**未用真实凭证验证过**，首次接入时看日志确认拿到 `task_id` 即可。
- 账号停用会立即撤销全部会话，但「重置密码」尚未实现（需要发信渠道）；邀请链接需管理员复制后手动发送，未接自动邮件。
- 会员内容审核（`member_reviews` 表、`org.reviewer` 角色）在后端已有数据层与审计，前端审核页已就位，如需启用请确认对应路由已接线。
