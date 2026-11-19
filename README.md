# AI绘梦 · 漫剧短剧创作平台

前端 Vite + React 原型（10 个功能页）+ 一个极简后端（异步生成任务，接火山引擎即梦）。

## 启动

需要 Node 22.5+（后端用了内置 `node:sqlite`）。

```bash
pnpm install
cp server/.env.example server/.env

pnpm server   # 终端 1：后端 http://127.0.0.1:3001
pnpm dev      # 终端 2：前端 http://127.0.0.1:5173
```

前端 dev server 已把 `/api` 代理到 3001，不用配 CORS。

## 页面

首页 / 创作 / 成片 / 智能体 / 画布 / 剧本 / 拆解 / 资产 / 项目 / 数据。

其中 **成片** 已经接真实后端：新建生成任务 → 后台轮询 → 卡片显示进度 → 完成后预览、下载、复制提示词、失败重试、删除。

## 页面与路由

每个 tab 都有独立 URL，用 `history.pushState` 实现（无路由库）：刷新保持当前页、前进后退可用、未知路径自动归一到 `/app/dashboard`。

工作台页面统一挂在 `/app` 下；`/admin`（平台/组织管理）、`/login`、`/invite` 不属于工作台，保持独立。

| URL | 页面 |
| --- | --- |
| `/app/dashboard` | 首页 |
| `/app/create` | 创作 |
| `/app/videos` | 成片（详情为 `/app/videos#video=<任务id>`） |
| `/app/agents` | 智能体 |
| `/app/canvas` | 画布 |
| `/app/scripts` | 剧本 |
| `/app/breakdown` | 拆解 |
| `/app/assets` | 资产 |
| `/app/projects` | 项目 |
| `/app/data` | 数据 |
| `/app/distribute` | 分发 |
| `/admin` | 平台 / 组织管理 |

### 管理面板

平台管理员与组织管理员共用同一套工作区骨架（`src/components/AdminWorkspace.jsx`）：左侧可折叠侧栏 + 顶栏工具条 + 内容区，靠 `session.role` 决定渲染哪个面板和哪些 tab。每个 tab 都有独立 URL，刷新与前进后退均可用。

| URL | 面板 | Tab |
| --- | --- | --- |
| `/admin/overview` | 平台管理员 | 平台概览 |
| `/admin/organizations` | 平台管理员 | 组织管理（详情页 `/platform/organizations/:id`） |
| `/admin/users` | 平台管理员 | 用户与权限 |
| `/admin/usage` | 平台管理员 | 平台用量 |
| `/admin/tracing` | 平台管理员 | 调用追踪 |
| `/admin/audit` | 平台管理员 | 操作审计 |
| `/admin/org/overview` | 组织管理员 | 概览 |
| `/admin/org/members` | 组织管理员 | 成员管理 |
| `/admin/org/quota` | 组织管理员 | 额度分配 |
| `/admin/org/projects` | 组织管理员 | 项目管理 |
| `/admin/org/usage` | 组织管理员 | 用量与任务 |
| `/admin/org/tracing` | 组织管理员 | 调用追踪 |
| `/admin/org/audit` | 组织管理员 | 审计记录 |
| `/admin/org/settings` | 组织管理员 | 组织设置 |

两个面板的 tab 全部接真实接口，没有前端演示数据。

标题会同步成「页面名 · AI绘梦」。部署到静态服务器时记得配置 SPA fallback（`try_files $uri /index.html`），否则直接访问 `/app/data` 会 404。

## 页面与后端

| 页面 | 数据来源 |
| --- | --- |
| 创作 | 真实：上传 / 粘贴剧本 → `/api/scripts`，列表来自后端 |
| 剧本 | 真实：同一份剧本库，支持上传、粘贴、删除 |
| 成片 | 真实：生成任务 `/api/tasks`，轮询进度、产物、重试、删除 |
| 智能体 | 真实：对话存 `/api/agent/messages`，回复由后端生成 |
| 画布 | 真实：画布与节点存 `/api/documents/canvases`，拖动后 500ms 落库 |
| 拆解 | 真实：记录存后端，进度完成后回写 |
| 项目 | 真实：项目与三步状态存 `/api/documents/projects` |
| 数据 | 真实：`/api/report` 按天聚合任务与剧本 |
| 资产 / 首页 | 仍是前端演示数据（资产需要图片上传与存储，暂未接） |

## 配色与顶栏

- 四套配色：**新国风雅金 / 夜幕黑紫 / 极光淡紫 / 青绿山水**。左下角调色盘展开选择，或直接点四个色点；选择存在 `localStorage`，刷新保持。实现见 [src/theme.css](src/theme.css)（`html[data-theme]` + CSS 变量）。
- 顶栏全部可点：成片 / 分镜出片 / 新建画布 跳转；❀ 灵感特权、算力（实时读 `/api/stats`）、铃铛通知（未读数、点条目跳转）、头像菜单；点浮层外部或 Esc 关闭。实现见 [src/components/TopbarActions.jsx](src/components/TopbarActions.jsx)。

## 后端

接口、目录结构、切即梦真接口的步骤都在 [server/README.md](server/README.md)。

要点：

- 默认 `JIMENG_PROVIDER=mock`，不需要任何凭证即可跑通「提交 → 轮询 → 产物落盘」全链路。
- 拿到火山引擎 AK/SK 后改 `server/.env` 三行切到真接口。
- 即梦是 **提交 + 查询** 的异步接口（SigV4 签名），产物链接 24 小时过期，所以后端会下载落盘到 `server/uploads/`。

## 演示边界

- 数据存在本地 SQLite（`server/data/tasks.db`），清掉即重置。
- 只有「成片」接了后端；其余页面的数据仍是前端演示数据（真实生成任务的入口在成片页）。
- 即梦真接口代码已实现但**未用真实凭证验证过**，首次接入时看日志确认拿到 `task_id` 即可。
