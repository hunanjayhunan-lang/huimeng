# AI绘梦 · 后端服务

后台：异步生成任务、即梦适配层，以及 Org 身份基础（Node 22.5+，使用内置 `node:sqlite`）。

## 快速开始

```bash
pnpm install            # 已装过可跳过
cp server/.env.example server/.env

# 终端 1：后端（默认 3001，provider=mock）
pnpm server

# 终端 2：前端（5173，/api 已代理到 3001）
pnpm dev
```

验证：

```bash
curl http://127.0.0.1:3001/api/health
# {"ok":true,"provider":"mock","version":"1.0.0","uptime":3.2}
```

## 目录

```
server/
  index.js               # Express 启动、中间件、路由挂载
  config.js              # 环境变量（Node 原生 loadEnvFile，不引 dotenv）
  db.js                  # node:sqlite + tasks 表与查询
  poller.js              # 后台轮询：推进进度、调上游、落盘、重试、超时
  providers/
    index.js             # 按 JIMENG_PROVIDER 选实现
    mock.js              # 本地占位图（无需凭证，跑通链路）
    jimeng.js            # 火山引擎即梦：SigV4 签名 + 提交/查询/下载
  routes/tasks.js        # 任务 API
  data/tasks.db          # 运行时生成，已 gitignore
  uploads/               # 产物流水，已 gitignore
```

## 接口

统一前缀 `/api`。除健康检查、注册和登录外，所有接口都要求登录会话；业务查询由服务端会话确定 Org，并按 `org_id` 隔离。登录响应提供 Bearer token，浏览器也会收到 HttpOnly 会话 Cookie。
设置 `SUPERADMIN_EMAILS`（逗号分隔）可将指定登录邮箱标记为平台管理员。

### 权限与组织状态

- 权限矩阵集中在 `server/permissions.js`，路由用 `requirePermission(action)` 校验；会话接口额外返回 `permissions` 数组。
- 组织状态：`active` / `suspended` / `expired` / `archived`。trial 到期会自动变为 `expired`（`effectiveOrgStatus` 现算 + `expireDueTrials` 定时落库）。
- 非 `active` 组织的成员不能登录、业务接口一律 403；归档/停用会删除该组织全部会话（superadmin 会话保留，保证可恢复）。
- 归档 = 软删除：数据全部保留，`POST /platform/orgs/:id/restore` 可恢复；套餐从 trial 升级到付费会自动解冻 `expired` 组织。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 健康检查（含当前 provider） |
| POST | `/auth/register` | 注册账号并创建 Org（邮箱、密码、组织名） |
| POST | `/auth/login` | 登录并返回 Bearer 会话令牌 |
| GET | `/auth/session` | 查询当前会话 |
| DELETE | `/auth/session` | 注销当前会话 |
| POST | `/auth/accept-invite` | 接受 Org 邀请并创建账号（邀请令牌、邮箱、密码） |
| GET | `/org/members` | 列出当前 Org 成员（管理员） |
| PATCH | `/org/members/:id` | 调整成员角色（管理员） |
| DELETE | `/org/members/:id` | 移除成员并立即撤销其会话（管理员） |
| GET/POST | `/org/invites` | 查看或创建 7 天邀请链接（管理员） |
| POST | `/org/invites/:id/resend` | 重新生成邀请链接（管理员） |
| DELETE | `/org/invites/:id` | 撤回邀请（管理员） |
| GET | `/org/audit` | 查看 Org 管理操作记录（管理员）；支持 `action` / `actor` / `from` / `to` / `q` / `limit` / `offset` |
| GET | `/org/audit/export` | 导出 Org 审计 CSV（相同筛选参数，上限 5000 条） |
| GET | `/platform/audit` | 跨组织审计查询（superadmin）；同样支持筛选与分页 |
| GET | `/platform/audit/export` | 导出平台审计 CSV（superadmin） |
| GET | `/org/quota` | 管理员查看 Org 与成员积分（含 `alerts` 预警）；普通成员查看本人积分（含 `costCny` 实际花费） |
| GET | `/org/quota/alerts` | 额度预警，`?warn=&critical=` 可调阈值（管理员） |
| GET | `/org/quota/usage` | 额度使用明细，`?userId=&period=&status=&limit=&offset=`（管理员） |
| GET | `/org/quota/export` | 导出额度明细 CSV（管理员） |
| PUT | `/org/members/:id/quota` | 设置成员本月积分上限（管理员） |
| PUT | `/org/quota/members` | 批量分配成员积分，`{ items: [{userId,amount}] }`，原子事务（管理员） |
| POST | `/org/members/:id/quota/clear` | 清零成员额度（有已用/预占时拒）（管理员） |
| POST | `/org/quota/revoke` | 回收组织额度，`{ amount }`（不能回收已用/预占）（管理员） |
| GET | `/org/profile` | 组织基本信息（管理员） |
| PATCH | `/org/profile` | 修改组织名称，写审计（管理员） |
| GET | `/org/options` | 组织下拉选项；superadmin 看全部，org.admin 只看自己 |
| GET | `/org/usage` | 组织用量与任务汇总，`?days=30`（管理员看全组织、成员只看本人） |
| GET | `/platform/overview` | 平台统计与组织管理审计（superadmin） |
| GET | `/platform/orgs` | 列出组织、成员数和管理员（superadmin） |
| GET | `/platform/users` | 跨组织用户目录，`?role=&status=&orgId=&q=&limit=&offset=`（服务端真分页，返回 `total`）（superadmin） |
| PATCH | `/platform/users/:id/status` | 启用 / 停用账号，停用会立即撤销全部会话（superadmin） |
| POST | `/platform/users/:id/revoke-sessions` | 强制指定账号下线（superadmin） |
| POST | `/platform/orgs/:id/quota` | 按自然月给 Org 划拨额度点（superadmin） |
| POST | `/platform/orgs` | 创建 Org 并为管理员邮箱生成邀请（superadmin） |
| PATCH | `/platform/orgs/:id/status` | 设置 Org 状态：`active` / `suspended` / `expired` / `archived`（superadmin） |
| DELETE | `/platform/orgs/:id` | 归档 Org（软删除，数据保留，可恢复）（superadmin） |
| POST | `/platform/orgs/:id/restore` | 恢复已归档/停用的 Org 为 `active`（superadmin） |
| PATCH | `/platform/orgs/:id/admin` | 将现有 Org 成员设为管理员（superadmin） |
| GET | `/config` | 当前 provider、req_key、轮询间隔、超时 |
| GET | `/stats` | 任务总数 / 成功 / 失败 / 进行中 |
| POST | `/tasks` | 创建任务，`202` 立即返回本地 id（异步提交上游） |
| GET | `/tasks` | 列表：`?status=done&limit=20&offset=0` |
| GET | `/tasks/:id` | 单个任务，前端轮询用 |
| POST | `/tasks/:id/retry` | 失败任务重试（重置超时计时） |
| DELETE | `/tasks/:id` | 删任务 + 删本地产物 |
| GET | `/files/:name` | 产物静态访问，给 `<img src>` 直接用 |

首次创建账号会接管已有的 bootstrap 数据；后续新 Org 不会继承其他 Org 的任务、文档、用量或文件。Org 内普通成员只能读取和操作自己创建的项目、剧本、画布、资产、拆解、对话、分发草稿、任务及文件；`org.admin` 可查看本 Org 全部记录。历史上没有创建者信息的记录仅对 Org 管理员可见。

额度使用内部积分：图片任务预占 1 积分、视频任务预占 8 积分；任务完成后按真实成本重新结算（`CREDIT_CNY` 默认 ¥0.12/积分，即一张 Seedream 图），失败或取消时退还预占。额度按 UTC 自然月重置，不结转。

LLM 调用（拆分镜 / 拆解 / 智能体对话）同样消耗积分：每 1000 tokens 计 1 积分，记在同一个 `quota_task_usage` 表里（`task_id` 存 `ai_calls.id`），因此额度面板的“已用积分”和调用追踪的“花费”能对上。

业务数据（剧本 / 项目 / 画布 / 拆解 / 智能体消息）统一存在 `documents` 表，按 `kind` 区分：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/documents/:kind` | 列表（kind: scripts / projects / canvases / breakdowns / messages） |
| POST | `/documents/:kind` | 新建，body 原样存入 JSON |
| PATCH | `/documents/:kind/:id` | 合并更新 |
| DELETE | `/documents/:kind/:id` | 删除 |
| GET/POST | `/scripts` | 剧本专用：POST 自动算字数、分镜数、摘要 |
| GET/POST | `/agent/messages` | 智能体对话：POST 存用户消息 + 生成一条固定口吻回复 |
| GET | `/report?days=30` | 生产报表：按天聚合任务与剧本，含 totals |

### 创建任务

```bash
curl -X POST http://127.0.0.1:3001/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "image",
    "prompt": "雨夜旧城巷口，暖黄路灯，女主握伞回头，35mm 胶片颗粒",
    "params": { "width": 1024, "height": 1024, "seed": 42 },
    "runId": "ep01-shot03-v1"
  }'
```

返回（节选）：

```json
{
  "id": "bddd07d1-b4ef-49c6-8096-b1a4c9353709",
  "status": "queued",
  "progress": 0,
  "reqKey": "jimeng_t2i_v40",
  "createdAt": 1794972480624
}
```

`runId` 是可选的幂等键：相同 `runId` 重复提交会返回同一条任务，不会重复调上游、不会重复计费。

### 轮询

```bash
curl http://127.0.0.1:3001/api/tasks/bddd07d1-...
```

状态流转：`queued → running → done | failed`，`progress` 0–100；完成时 `resultUrl` 指向 `/api/files/xxx.svg`（真实接入后是 png / mp4）。

## 切到即梦真接口

1. 火山引擎控制台开通「智能视觉 / 即梦AI」，拿到 **AccessKey / SecretKey**。
2. 填 `server/.env`：

```ini
JIMENG_PROVIDER=jimeng
VOLC_ACCESS_KEY=你的AK
VOLC_SECRET_KEY=你的SK
JIMENG_REQ_KEY_IMAGE=jimeng_t2i_v40
JIMENG_REQ_KEY_VIDEO=你的视频能力 req_key
```

3. 重启 `pnpm server`，`/api/health` 里 `provider` 变成 `jimeng`。
4. 提交一条任务，看日志里 `CVSync2AsyncSubmitTask` 是否拿到 `task_id`，再轮询到 `done`。

**接口形状**（已按此实现，见 `server/providers/jimeng.js`）：

- 域名 `visual.volcengineapi.com`，`Region=cn-north-1`、`Service=cv`、`Version=2022-08-31`
- 鉴权是 **AWS SigV4**（AK/SK 签名），不是 Bearer
- 提交 `Action=CVSync2AsyncSubmitTask`，body 带 `req_key` / `prompt` / `return_url`
- 查询 `Action=CVSync2AsyncGetResult`，body 带 `req_key` + `task_id`
- 状态：`in_queue` / `generating` / `done`，`not_found`、`expired` 视为失败
- 产物链接 **24 小时过期**，任务 12 小时过期 → 所以 `done` 时立刻下载落盘到 `uploads/`

> 注意：真接口这段我只做了实现与静态核对，**没有凭证所以没跑通过**。拿到 AK/SK 后按上面第 4 步验证一次即可。

## 工程点（面试可讲）

- **异步任务模型**：创建接口不阻塞，后台 poller 统一推进；前端只认 `status/progress`。
- **Provider 抽象**：`mock` / `jimeng` 两套实现同一个 `submit/poll` 接口，没有凭证也能演示完整链路。
- **产物落盘**：上游链接会过期，`done` 时立刻下载，前端只访问 `/api/files/*`。
- **幂等**：`runId` 唯一索引，重复提交返回原任务。
- **重试与超时**：上游异常累计 3 次标记 `failed`；超过 15 分钟未完成直接 `failed`（防止任务永久挂起）。
- **密钥只在后端**：`.env` 不入库、不进前端；业务 API 使用用户会话鉴权。
- **可观测**：每个请求有 `X-Request-Id` 与耗时日志，任务表有 `attempts / error / cost_ms`。
- **限流**：内存版 120 次/分钟，单机够用。


## 接入火山方舟（豆包 / Seedream / Seedance）

方舟是 **API Key + Bearer**，和即梦的 AK/SK 签名不是一套，`.env` 里配这些：

```ini
MEDIA_PROVIDER=ark        # 图片/视频走 Seedream / Seedance
LLM_PROVIDER=ark          # 文本走豆包
ARK_API_KEY=你的方舟 Key
ARK_MODEL=doubao-seed-2-1-pro-260915
ARK_IMAGE_MODEL=doubao-seedream-5-5-261028
ARK_VIDEO_MODEL=doubao-seedance-1-0-pro-250528
```

改完 **重启后端**（`pnpm server`）。没填 Key 时会自动回退 mock，不会白屏：

- `MEDIA_PROVIDER=ark` 但缺 Key → 任务仍出占位图，启动日志有告警
- `LLM_PROVIDER=ark` 但缺 Key → 智能体回模板回复、拆分镜 503（前端静默忽略）

模型 ID 以控制台实际开通的为准，也可以填推理接入点 `ep-xxxx`。

新增的 AI 接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/ai/chat` | 通用对话（`{ messages }` → `{ text, usage }`） |
| POST | `/scripts/:id/split` | 剧本 → 分镜 JSON，写回 `scripts.shots / scenes` |
| POST | `/breakdowns/:id/analyze` | 拆解记录 → 爆款公式 + 要点，写回 `insights` |

## 计费（tracing 页的「预估花费」）

`llm.js` 与 `poller.js` 会按方舟刊例价把每次调用的费用算进 `ai_calls.cost_cny`，价格在 `.env` 里改：

```ini
ARK_PRICE_LLM_INPUT=0.8     # 元/百万 tokens（Doubao-Seed-2.1-lite）
ARK_PRICE_LLM_OUTPUT=2.7
ARK_PRICE_IMAGE=0.12        # 元/张（Seedream-5.0-flash）
ARK_PRICE_VIDEO=46          # 元/百万 tokens（Seedance-2.5-flash，不含视频输入；含视频输入为 28）
```

计算方式：

- 文本：(prompt_tokens × 输入单价 + completion_tokens × 输出单价) / 1e6，深度思考的 reasoning tokens 计入输出
- 图片：张数 × 0.12
- 视频：上游返回的 `usage.total_tokens` × 46 / 1e6（5 秒 720p 实测约 108,900 tokens ≈ 5.01 元）

注意：定价上线前的历史调用 `cost_cny = 0`，所以页面显示 ¥0.00。

### 防重复计费

- **图片是同步接口**：生成请求一旦发出就可能已计费，所以图片任务失败**不自动重试**（避免重复出图）
- **下载失败不再触发生成**：产物下载在 provider 内部重试 3 次；仍失败则返回 `noRetry`，任务直接判失败并提示「已阻止自动重试」
- **视频重试只续传**：已经有 `remote_task_id` 的失败任务，手动重试会保留上游 ID，只重新查询/下载，不会重新提交生成
- **成本按任务去重**：同一条任务重复续传完成时只记一次媒体成本（`hasMediaCall` 判重）

### 图生视频（画布 → Seedance）

画布把上游图片节点的 `resultUrl`（`/api/files/xxx.jpeg`）放进任务参数 `image_urls`。后端在提交 Seedance 时：

- 本地文件读出来转成 `data:image/jpeg;base64,...`，拼进 `content: [{type:'text'}, {type:'image_url'}]`，**不依赖公网可访问地址**
- 最多取前 2 张参考图
- **有首帧图时不能传 `ratio`**：方舟会直接 400（"output ratio follows the first-frame image"），所以代码在有图时自动跳过 ratio，成片比例跟随图片

## 画布流水线（剧本 → 成片）

| 接口 | 作用 |
| --- | --- |
| `POST /api/pipeline/split` | 剧本拆解：调豆包输出 `characters[]` + `shots[]`（带 start/end 时间戳，3–6 镜、单镜 3–10s），剧本与画风作为 system 背景 |
| `POST /api/pipeline/concat` | 多段拼接：ffmpeg concat（优先 `-c copy`，编码不一致时自动重编码） |

依赖 `@ffmpeg-installer/ffmpeg`（自带二进制），`/api/config` 的 `capabilities.ffmpeg` 会告诉前端是否可用。

画布里的执行顺序：

1. **全局配置** → 剧本 + 画风（作为下游 system 背景）
2. **剧本拆解** → 真实 LLM 调用，结果自动同步到下游定妆/分镜节点（跨层 BFS）
3. **定妆锚点** → 按 `characters` 逐个调 Seedream，本场两个主角 = 两次调用
4. **分镜批量** → 每镜一次 Seedream，产出关键帧
5. **视频生成** → 每镜一段 Seedance（首帧 = 分镜图），时长取镜头 duration
6. **成片合成** → ffmpeg 拼接所有片段

### 定妆照 → 分镜参考图（角色一致性）

`runPortraits` 产出的定妆照会作为参考图传给 Seedream：

- 画面里点了名的角色优先匹配；都没点名时把两张定妆照都带上（最多 2 张）
- 后端把 `/api/files/*` 转成 data URL，单张走 `image`，两张走 `images`
- 参考图 → 分镜关键帧 → Seedance 首帧，角色形象在整条链路上保持一致
## 已知限制 / 下一步

- ~~没有用户体系，任务不隔离~~ — 已实现：Org 多租户 + `org.admin` / `org.user` 角色 + superadmin，`tasks` / `documents` / `ai_calls` / `file_owners` 全部按 `org_id` 隔离，普通成员额外按 `created_by` 隔离。
- 单进程内存轮询，重启后 `queued/running` 会继续被轮询，但并发没有上限；要用在生产得换 BullMQ / 定时任务 + 并发闸门。
- 产物存本地磁盘，没接 OSS；没有清理策略（可以按 `created_at` 定期删）。
- 还没有回调（`callback_url`）模式，只有轮询；公网可访问时可以二选一。
- 前端已接：「首页」「工作台」「创作」「成片」「剧本」「画布」「项目」「拆解」「智能体」「数据」「分发」「调用追踪」以及**两个管理面板全部 tab**。「资产」页仍是前端演示数据（后端已允许 `documents/assets`，页面尚未接入）。
- 成员内容审核（`member_reviews` 表、`org.reviewer` 角色、`listMemberReviews` / `createMemberReview` / `decideMemberReview`）在 `db.js` 已有数据层与审计，但**没有对应路由和前端入口**，尚未接线。
- 平台管理员名单由 `SUPERADMIN_EMAILS` 环境变量控制，面板上不能授予/撤销（避免自我提权）；面板里也不能停用 superadmin 账号。
- 账号停用会立即删除该用户全部会话，但“重置密码”尚未实现（需要发信渠道）。
