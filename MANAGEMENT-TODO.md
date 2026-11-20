# 管理面补齐 TODO（2–8）

> 审核相关（内容审核台接线、假 seed 数据）由其他 agent 负责，本清单不包含。

状态图例：`[ ]` 未开始 · `[~]` 进行中 · `[x]` 已完成

---

## 2. 组织生命周期状态机

- [x] 2.1 扩展 `orgs.status` 枚举：`active / suspended / expired / archived`（迁移兼容旧库）
  - `ORG_STATUSES` / `LOCKED_ORG_STATUSES` 常量；`setOrganizationStatus` 已支持四态
- [x] 2.2 trial 到期自动降级：`trial_ends_at` 到期后查询/中间件判定为过期，强制执行
  - [x] 两层保障：`effectiveOrgStatus()` 每次读现算（不依赖定时任务）+ `expireDueTrials()` 定时落库
  - [x] 登录时拦截：`suspended / expired / archived` 组织成员不能登录（superadmin 除外）
  - [x] 请求中间件拦截：冻结组织的业务接口一律 403，带 `orgStatus` 字段
  - [x] 后台扫描：`poller.js` 每 5 分钟调 `expireDueTrials()`，写审计 `organization.trial_expired`
- [x] 2.3 平台侧「删除 Org」：软删除 → `archived`，提供恢复
  - `DELETE /platform/orgs/:id` 归档（数据全保留）+ `POST /platform/orgs/:id/restore` 恢复
- [x] 2.4 Org 停用/归档后的数据策略：成员会话撤销、只读、文件保留期，写入文档
  - 归档/停用：删除该组织全部会话（superadmin 保留，否则代管者无法恢复）
  - 数据（项目/剧本/任务/文件）全部保留，不做物理删除
- [x] 2.5 状态变更统一走 `setOrganizationStatus`，补审计与前端状态展示
  - 前端 `SuperadminPage` 新增 `ORG_STATUS_META`，统一展示四态
  - 套餐从 trial 升级到付费时自动解冻 `expired` 组织

## 3. 权限粒度（操作级）

- [x] 3.1 抽出 `requirePermission(action)` 中间件，替代散落的 `req.role !== ...` 粗判
  - 实现：`server/permissions.js`，`ROLE_PERMISSIONS` 矩阵 + `hasPermission` / `requirePermission` / `permissionList`
  - 已替换全部路由：auth / platform / platform-users / quota / tracing / org-usage
- [x] 3.2 定义权限矩阵（PM × action）：`org.manage` / `quota.grant` / `quota.allocate` / `member.manage` / `tracing.view` / `audit.view` / `settings.edit`
  - 实际权限名：`platform.view` / `platform.org.manage` / `platform.quota.grant` / `platform.plan.manage` / `platform.user.manage` / `platform.admin.manage` / `platform.billing.view` / `platform.metrics.view` / `org.member.manage` / `org.quota.allocate` / `org.settings.edit` / `org.tracing.view` / `org.audit.view` / `org.project.view.all` / `review.submit` / `review.decide` / `review.view` / `self.create`
  - 会话接口（login / register / accept-invite / session）已返回 `permissions` 数组
- [x] 3.3 明确 `org.reviewer` 的可见与可操作范围（不能出片、只看审核与相关项目）
  - 实测：reviewer 只能访问 `review.*`，成员管理/追踪/组织设置全部 403
- [ ] 3.4 superadmin 自助化：面板授予/撤销平台管理员（落库而非 env），带二次确认与审计
  - [ ] `platform_admins` 表或 `users.is_superadmin` 标记
  - [ ] `SUPERADMIN_EMAILS` 保留为初始引导，运行期以库为准

## 4. 额度管理动作

- [x] 4.1 额度回收/清零：`POST /platform/orgs/:id/quota/revoke`、成员额度清零
  - 组织侧：`POST /org/quota/revoke`（从最新划拨记录往前扣，不能动已用/预占）
  - 成员侧：`POST /org/members/:userId/quota/clear`（有已用/预占则拒）
- [x] 4.2 批量分配：一次给多个成员分配
  - `PUT /org/quota/members`，单事务原子写入，任一失败全部回滚（已实测）
- [ ] 4.3 跨月结转策略：`carryover` 开关 + 上期结余转本期实现
- [x] 4.4 额度预警真逻辑：阈值（默认 15%/5%）→ 生成通知/告警记录，替换写死 feed
  - `quotaAlerts()` / `platformQuotaAlerts()`，分级 ok/warn/critical/empty
  - `GET /org/quota/alerts`；`GET /org/quota` 也已附带 alerts
  - 前端 `buildAlerts` 改为真分级并**删除两条假演示消息**
- [x] 4.5 账单/明细导出：CSV 导出（组织、成员、期间、用量、成本）
  - `GET /org/quota/export`，UTF-8 BOM，上限 5000
- [x] 4.6 对账明细查询接口（分页 + 筛选：org/member/period/status）
  - `listQuotaUsage()` 与 `GET /org/quota/usage`；前端积分分配页新增「对账明细」页签
  - 前端还补了：预警横幅、批量分配、清零按钮、回收额度

## 5. 审计可查询

- [x] 5.1 审计查询接口加筛选：`action` / `actor` / `from` / `to` / `orgId`
  - `listOrgAudit()` 重写，支持 action / actor / 时间范围 / q 关键字；`allOrgs` 支持跨组织
  - 新增 `GET /platform/audit`（superadmin 跨组织）
- [x] 5.2 审计分页（cursor 或 offset），替代硬取 200 条
  - offset 分页，返回 `items / total / limit / offset / actions`（可用动作列表供筛选器）
- [x] 5.3 审计导出 CSV
  - `GET /org/audit/export`、`GET /platform/audit/export`，UTF-8 BOM + 字段转义，上限 5000 条
- [x] 5.4 留存策略：保留天数配置 + 清理任务（或标记归档）
  - `AUDIT_RETENTION_DAYS`（默认 180）→ `purgeExpiredAudit()`，poller 每日执行一次

## 6. 人口管理工具（组织/用户）

- [x] 6.1 `listPlatformUsers` 真分页（offset/limit + total），后端分页而非前端全取
  - 已改为 SQL 下推分页，role 筛选也下推（superadmin 用邮箱白名单 IN 查询），total 与分页一致
  - `platformUserTotals()` 不再取全表算 superadmin，改为 COUNT 查询
  - 前端 `api.platformUsers` / `api.orgAudit` 改接新签名；AdminPage 审计页已接筛选+分页+导出
- [ ] 6.2 组织列表分页 + 搜索
- [ ] 6.3 批量操作：批量停用/启用、批量改状态
- [ ] 6.4 CSV 导入（批量建用户/邀请）与导出

## 7. 通知中心

- [x] 7.4 前端铃铛接入真实未读数与列表（替换当前静态铃铛）

### 7.x 按 demo 定位的实现方式

**不做后端**：通知中心定位为“能点开查看消息”即可，不需要持久化、API 或未读同步。

- 新建 `src/components/AdminNotice.jsx` + `AdminNotice.css`：铃铛 + 下拉面板 + 已读/未读状态（前端 state）
- 5 条演示通知，点击条目会标记已读并跳到对应 tab；目标 tab 在当前面板不存在时不跳转
- 已接到 `AdminWorkspace` 顶栏（工作台与两个管理面板共用该骨架）
- 曾经做过的后端部分（`notifications` 表、路由、poller 事件源）**已全部回退删除**

## 8. 运营看板

**不做**：与「平台概览」信息重叠，按需求直接移除。

- 前端 `OperationsBoard` 组件、`/admin/metrics` tab 与路由、`api.platformMetrics` 已删除
- 后端 `platformMetrics()` 与 `GET /platform/metrics` 已删除

---

## 建议执行顺序

1. **3.1 / 3.2 权限中间件**（其他管理功能的地基，先抽象好）
2. **2.x 生命周期状态机**（trial 到期是真业务风险）
3. **5.x 审计筛选分页 + 6.1 用户真分页**（可用性最痛）
4. **4.x 额度动作与预警**（对账与运营刚需）
5. **7.x 通知中心**（依赖前面的事件源）
6. **8.x 运营看板**（最后做，依赖前面的数据）
