import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID, randomBytes, scryptSync, createHash, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';
import { currentOrgId } from './org-context.js';
import { currentRole, currentUserId } from './user-context.js';

mkdirSync(config.dataDir, { recursive: true });
mkdirSync(config.uploadDir, { recursive: true });

const db = new DatabaseSync(join(config.dataDir, 'tasks.db'));

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS orgs (id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS org_members (org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE, user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK(role IN ('org.admin','org.reviewer','org.user')), created_at INTEGER NOT NULL, PRIMARY KEY(org_id,user_id));
  CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS org_invites (id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE, email TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('org.admin','org.reviewer','org.user')), token_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS org_audit_logs (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, actor_user_id TEXT, action TEXT NOT NULL, target TEXT, details TEXT, created_at INTEGER NOT NULL);
  INSERT OR IGNORE INTO orgs(id,name,created_at) VALUES ('bootstrap','默认工作区',${Date.now()});
`);
{
  const columns = db.prepare('PRAGMA table_info(org_invites)').all().map(row => row.name);
  if (!columns.includes('id')) {
    const legacyInvites = db.prepare('SELECT token_hash,org_id,email,role,expires_at FROM org_invites').all();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec('ALTER TABLE org_invites RENAME TO org_invites_legacy');
      db.exec(`CREATE TABLE org_invites (
        id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
        email TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('org.admin','org.user')),
        token_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
      )`);
      const insert = db.prepare('INSERT INTO org_invites VALUES(?,?,?,?,?,?,?)');
      for (const invite of legacyInvites) insert.run(randomUUID(), invite.org_id, invite.email, invite.role, invite.token_hash, invite.expires_at - 7 * 86400000, invite.expires_at);
      db.exec('DROP TABLE org_invites_legacy');
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
}
{
  const membersSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='org_members'").get()?.sql || '';
  if (membersSql && !membersSql.includes('org.reviewer')) {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec('ALTER TABLE org_members RENAME TO org_members_old');
      db.exec("CREATE TABLE org_members (org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE, user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK(role IN ('org.admin','org.reviewer','org.user')), created_at INTEGER NOT NULL, PRIMARY KEY(org_id,user_id))");
      db.exec('INSERT INTO org_members SELECT org_id, user_id, role, created_at FROM org_members_old');
      db.exec('DROP TABLE org_members_old');
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    finally { db.exec('PRAGMA foreign_keys = ON'); }
  }
  const invitesSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='org_invites'").get()?.sql || '';
  if (invitesSql && !invitesSql.includes('org.reviewer')) {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec('ALTER TABLE org_invites RENAME TO org_invites_old');
      db.exec("CREATE TABLE org_invites (id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE, email TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('org.admin','org.reviewer','org.user')), token_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)");
      db.exec('INSERT INTO org_invites SELECT id, org_id, email, role, token_hash, created_at, expires_at FROM org_invites_old');
      db.exec('DROP TABLE org_invites_old');
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    finally { db.exec('PRAGMA foreign_keys = ON'); }
  }
  db.exec(`CREATE TABLE IF NOT EXISTS member_reviews (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    project_name TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'asset',
    submitted_by TEXT,
    submitted_email TEXT NOT NULL,
    summary TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
    reviewer_id TEXT,
    reviewer_email TEXT,
    review_note TEXT,
    created_at INTEGER NOT NULL,
    reviewed_at INTEGER
  )`);
  const columns = db.prepare('PRAGMA table_info(orgs)').all().map(row => row.name);
  if (!columns.includes('status')) db.exec("ALTER TABLE orgs ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
  // 套餐：free / trial / pro / enterprise
  if (!columns.includes('plan')) db.exec("ALTER TABLE orgs ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'");
  // 试用到期时间戳（毫秒），非试用套餐为 NULL
  if (!columns.includes('trial_ends_at')) db.exec('ALTER TABLE orgs ADD COLUMN trial_ends_at INTEGER');
}
{
  const columns = db.prepare('PRAGMA table_info(sessions)').all().map(row => row.name);
  if (!columns.includes('created_at')) db.exec('ALTER TABLE sessions ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0');
}
// 账号状态与最近活跃：用户与权限面板用
for (const definition of [
  "ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'",
  'ALTER TABLE users ADD COLUMN last_login_at INTEGER',
  'ALTER TABLE users ADD COLUMN last_seen_at INTEGER',
]) {
  const table = definition.match(/ALTER TABLE (\w+)/)[1];
  const column = definition.match(/ADD COLUMN (\w+)/)[1];
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name);
  if (!columns.includes(column)) db.exec(definition);
}
db.exec(`CREATE TABLE IF NOT EXISTS file_owners (path TEXT PRIMARY KEY, org_id TEXT NOT NULL, created_by TEXT)`);
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    req_key TEXT NOT NULL,
    prompt TEXT NOT NULL,
    params TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'queued',
    progress INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    run_id TEXT UNIQUE,
    remote_task_id TEXT,
    project_id TEXT,
    result_url TEXT,
    local_path TEXT,
    error TEXT,
    cost_ms INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`);
{
  const columns = db.prepare('PRAGMA table_info(tasks)').all().map(row => row.name);
  if (!columns.includes('project_id')) db.exec('ALTER TABLE tasks ADD COLUMN project_id TEXT');
  if (!columns.includes('created_by')) db.exec('ALTER TABLE tasks ADD COLUMN created_by TEXT');
  // 演示数据标记：poller 不推进这些任务，让它们在演示时一直停留在 queued/running
  if (!columns.includes('demo')) db.exec('ALTER TABLE tasks ADD COLUMN demo INTEGER NOT NULL DEFAULT 0');
}
db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)');
db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at DESC)');

// 通用文档表：剧本 / 项目 / 画布 / 拆解记录 / 智能体消息都放这里，按 kind 区分
db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`);
db.exec('CREATE INDEX IF NOT EXISTS idx_documents_kind ON documents(kind, updated_at DESC)');
// 调用记录：LLM 的 token 用量 + 媒体生成耗时，统一记账
db.exec(`
  CREATE TABLE IF NOT EXISTS ai_calls (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'ark',
    model TEXT NOT NULL DEFAULT '',
    task_id TEXT,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    reasoning_tokens INTEGER NOT NULL DEFAULT 0,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ok',
    error TEXT,
    meta TEXT,
    created_at INTEGER NOT NULL
  )
`);
db.exec('CREATE INDEX IF NOT EXISTS idx_ai_calls_created ON ai_calls(created_at DESC)');
// 迁移：老库补 cost_cny（元）
{
  const columns = db.prepare('PRAGMA table_info(ai_calls)').all().map(row => row.name);
  if (!columns.includes('cost_cny')) db.exec('ALTER TABLE ai_calls ADD COLUMN cost_cny REAL NOT NULL DEFAULT 0');
  // tracing：完整记录每次调用的输入（prompt/messages）、工具调用链、输出
  if (!columns.includes('input_payload')) db.exec('ALTER TABLE ai_calls ADD COLUMN input_payload TEXT');
  if (!columns.includes('output_payload')) db.exec('ALTER TABLE ai_calls ADD COLUMN output_payload TEXT');
  if (!columns.includes('tool_calls')) db.exec('ALTER TABLE ai_calls ADD COLUMN tool_calls TEXT');
  if (!columns.includes('request_id')) db.exec('ALTER TABLE ai_calls ADD COLUMN request_id TEXT');
}

// 任务事件：submit / progress / done / failed / retry，给 tracing 页画时间线
db.exec(`
  CREATE TABLE IF NOT EXISTS task_events (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    event TEXT NOT NULL,
    detail TEXT,
    created_at INTEGER NOT NULL
  )
`);
db.exec('CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id, created_at ASC)');



for (const table of ['tasks', 'documents', 'ai_calls']) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name);
  if (!columns.includes('org_id')) db.exec(`ALTER TABLE ${table} ADD COLUMN org_id TEXT NOT NULL DEFAULT 'bootstrap'`);
}
for (const table of ['documents', 'ai_calls', 'file_owners']) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name);
  if (!columns.includes('created_by')) db.exec(`ALTER TABLE ${table} ADD COLUMN created_by TEXT`);
}
db.exec(`
  CREATE TABLE IF NOT EXISTS org_quota_grants (
    id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    period TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount > 0),
    actor_user_id TEXT, created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS member_quota_allocations (
    org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount >= 0),
    actor_user_id TEXT, updated_at INTEGER NOT NULL, PRIMARY KEY(org_id,user_id,period)
  );
  CREATE TABLE IF NOT EXISTS quota_task_usage (
    task_id TEXT PRIMARY KEY, org_id TEXT NOT NULL, user_id TEXT NOT NULL,
    period TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount > 0),
    status TEXT NOT NULL CHECK(status IN ('reserved','settled','released')),
    created_at INTEGER NOT NULL, settled_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_quota_usage_org_period ON quota_task_usage(org_id,period,status);
`);
// 迁移：额度记录补真实成本（元），用于“积分 ↔ 花费”对照
{
  const columns = db.prepare('PRAGMA table_info(quota_task_usage)').all().map(row => row.name);
  if (!columns.includes('cost_cny')) db.exec('ALTER TABLE quota_task_usage ADD COLUMN cost_cny REAL NOT NULL DEFAULT 0');
}
{
  const columns = db.prepare('PRAGMA table_info(task_events)').all().map(row => row.name);
  if (!columns.includes('org_id')) db.exec("ALTER TABLE task_events ADD COLUMN org_id TEXT NOT NULL DEFAULT 'bootstrap'");
}

const toTask = row => (row ? { ...row, params: JSON.parse(row.params || '{}') } : null);
const scoped = () => currentOrgId();

const insertStmt = db.prepare(`
  INSERT INTO tasks (id, type, req_key, prompt, params, status, progress, attempts, run_id, project_id, created_at, updated_at, org_id, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
// demo 任务不入轮询：在 SQL 层就排掉，否则常驻的 demo 行会把 LIMIT 名额占满，新任务永远推不到
const activeStmt = db.prepare("SELECT * FROM tasks WHERE status IN ('queued', 'running') AND demo = 0 ORDER BY created_at ASC LIMIT 20");

const WRITABLE = new Set([
  'status', 'progress', 'attempts', 'remote_task_id', 'result_url',
  'local_path', 'error', 'cost_ms', 'created_at',
]);

const quotaPeriod = () => new Date().toISOString().slice(0, 7);
const userOnly = () => currentRole() === 'org.user' && currentUserId();

/**
 * 生成任务的预占积分。
 *
 * 只用于“启动前拦住不够分的人”，不是最终账单。
 * 真正的结算金额在 poller 拿到真实成本后写回（见 settleTaskQuota）。
 */
const TASK_QUOTA_RESERVE = { image: 1, video: 8 };
const taskQuotaAmount = type => TASK_QUOTA_RESERVE[type] ?? 1;

/**
 * LLM 调用（拆分镜 / 拆解 / 对话）的积分换算。
 *
 * 积分只是“配额单位”，不跟钱直接等价；这里用 token 数折算，
 * 让用完度的体验跟实际消耗大致同向。
 * 1000 tokens = 1 积分，首尾向上取整。
 */
const LLM_TOKENS_PER_QUOTA = 1000;
const llmQuotaAmount = totalTokens => Math.max(1, Math.ceil(Number(totalTokens || 0) / LLM_TOKENS_PER_QUOTA));

const insufficientQuota = message => Object.assign(new Error(message), { status: 402 });

/** 读某成员当前周期的额度状态 */
function memberQuotaState(orgId, userId, period) {
  return db.prepare(`SELECT COALESCE(a.amount,0) AS allocation,
    COALESCE(SUM(CASE WHEN q.status='settled' THEN q.amount ELSE 0 END),0) AS used,
    COALESCE(SUM(CASE WHEN q.status='reserved' THEN q.amount ELSE 0 END),0) AS reserved
    FROM org_members m LEFT JOIN member_quota_allocations a ON a.org_id=m.org_id AND a.user_id=m.user_id AND a.period=?
    LEFT JOIN quota_task_usage q ON q.org_id=m.org_id AND q.user_id=m.user_id AND q.period=?
    WHERE m.org_id=? AND m.user_id=? GROUP BY m.user_id`).get(period, period, orgId, userId);
}

/** 读某组织当前周期的总额度状态 */
function orgQuotaState(orgId, period) {
  const granted = db.prepare('SELECT COALESCE(SUM(amount),0) AS n FROM org_quota_grants WHERE org_id=? AND period=?').get(orgId, period).n;
  const total = db.prepare(`SELECT
    COALESCE(SUM(CASE WHEN status='settled' THEN amount ELSE 0 END),0) AS used,
    COALESCE(SUM(CASE WHEN status='reserved' THEN amount ELSE 0 END),0) AS reserved
    FROM quota_task_usage WHERE org_id=? AND period=?`).get(orgId, period);
  return { granted, used: total.used, reserved: total.reserved };
}

/** 校验并预占：钱不够就抛 402，不会留下半条记录 */
function guardQuota(orgId, userId, period, amount) {
  const org = orgQuotaState(orgId, period);
  const member = memberQuotaState(orgId, userId, period);
  if (!member) throw insufficientQuota('当前账号不属于此组织');
  if (org.granted - org.used - org.reserved < amount) throw insufficientQuota('组织可用积分不足，请联系组织管理员');
  if (member.allocation - member.used - member.reserved < amount) throw insufficientQuota('个人积分不足，请联系组织管理员分配积分');
}

function reserveTaskQuota(taskId, orgId, userId, type) {
  const period = quotaPeriod();
  const amount = taskQuotaAmount(type);
  const previous = db.prepare('SELECT status FROM quota_task_usage WHERE task_id=?').get(taskId);
  if (previous?.status === 'reserved' || previous?.status === 'settled') return;
  guardQuota(orgId, userId, period, amount);
  const now = Date.now();
  if (previous) db.prepare("UPDATE quota_task_usage SET period=?,amount=?,status='reserved',created_at=?,settled_at=NULL,cost_cny=0 WHERE task_id=?").run(period, amount, now, taskId);
  else db.prepare("INSERT INTO quota_task_usage(task_id,org_id,user_id,period,amount,status,created_at) VALUES(?,?,?,?,?,'reserved',?)").run(taskId, orgId, userId, period, amount, now);
}

/**
 * 生成任务结算：按真实成本换算成整数积分，多退少补。
 *
 * 积分与钱的换算固定为「1 积分 = ¥0.12」（与一张 Seedream 图同价），
 * 所以图片任务正好扣 1 分，视频/LLM 按实际成本自动拉开差距。
 * 结算金额不低于预占值的一半，避免极端汇率下把已用额度扣成 0。
 */
const CNY_PER_QUOTA = Number(config.creditCny || 0.12);
const cnyToQuota = cny => Math.max(1, Math.ceil((Number(cny) || 0) / CNY_PER_QUOTA));

export function settleTaskQuota(taskId, costCny) {
  const row = db.prepare("SELECT amount,status FROM quota_task_usage WHERE task_id=? AND status='reserved'").get(taskId);
  if (!row) return;
  // 图片是固定单价，直接用预占值；视频/其他按真实成本换算
  const cost = Number(costCny) || 0;
  const settled = cost > 0 ? cnyToQuota(cost) : row.amount;
  db.prepare("UPDATE quota_task_usage SET status='settled',amount=?,cost_cny=?,settled_at=? WHERE task_id=? AND status='reserved'")
    .run(settled, cost, Date.now(), taskId);
}

/** 失败/取消：把预占还回去 */
function updateTaskQuota(taskId, status) {
  if (['failed', 'cancelled', 'canceled'].includes(status)) {
    db.prepare("UPDATE quota_task_usage SET status='released',settled_at=NULL WHERE task_id=? AND status='reserved'").run(taskId);
  }
}

/**
 * LLM 调用计积分。
 *
 * 这些调用不在 tasks 表里，所以用 ai_calls.id 复用 quota_task_usage 的 task_id 字段。
 * 失败不扣分。
 */
export function chargeLlmQuota({ callId, totalTokens, costCny }) {
  const orgId = scoped();
  const userId = currentUserId();
  if (!orgId || !userId || !callId) return null;
  const amount = llmQuotaAmount(totalTokens);
  const period = quotaPeriod();
  try {
    guardQuota(orgId, userId, period, amount);
  } catch {
    // 额度不足不阻断 LLM 调用本身，只记录不扣分，避免对话直接 402
    return null;
  }
  db.prepare(`INSERT INTO quota_task_usage(task_id,org_id,user_id,period,amount,status,created_at,settled_at,cost_cny)
    VALUES(?,?,?,?,?,'settled',?,?,?)
    ON CONFLICT(task_id) DO NOTHING`)
    .run(callId, orgId, userId, period, amount, Date.now(), Date.now(), Number(costCny) || 0);
  return { amount, costCny: Number(costCny) || 0 };
}

export function createTask({ type, reqKey, prompt, params, runId, projectId, userId }) {
  const now = Date.now();
  const id = randomUUID();
  const orgId = scoped() || 'bootstrap';
  db.exec('BEGIN IMMEDIATE');
  try {
    reserveTaskQuota(id, orgId, userId, type);
    insertStmt.run(id, type, reqKey, prompt, JSON.stringify(params || {}), 'queued', 0, 0, runId ? `${orgId}:${userId || 'system'}:${runId}` : null, projectId || null, now, now, orgId, userId);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return getTask(id);
}

export function getTask(id) {
  const ownerClause = userOnly() ? ' AND created_by = ?' : '';
  const args = [id, scoped(), scoped()];
  if (userOnly()) args.push(currentUserId());
  return toTask(db.prepare(`SELECT * FROM tasks WHERE id = ? AND (? IS NULL OR org_id = ?)${ownerClause}`).get(...args));
}
export function getTaskByRunId(runId) {
  if (!runId) return null;
  const ownerClause = userOnly() ? ' AND created_by = ?' : '';
  const orgId = scoped() || 'bootstrap';
  const args = [`${orgId}:${currentUserId() || 'system'}:${runId}`, scoped(), scoped()];
  if (userOnly()) args.push(currentUserId());
  const current = db.prepare(`SELECT * FROM tasks WHERE run_id = ? AND (? IS NULL OR org_id = ?)${ownerClause}`).get(...args);
  if (current) return toTask(current);
  const legacyArgs = [`${orgId}:${runId}`, scoped(), scoped()];
  if (userOnly()) legacyArgs.push(currentUserId());
  return toTask(db.prepare(`SELECT * FROM tasks WHERE run_id = ? AND (? IS NULL OR org_id = ?)${ownerClause}`).get(...legacyArgs));
}
export const activeTasks = () => activeStmt.all().map(toTask);

export function updateTask(id, patch, actorUserId = null) {
  const fields = Object.keys(patch).filter(key => WRITABLE.has(key));
  if (!fields.length) return getTask(id);
  const current = getTask(id);
  if (!current) return null;
  db.exec('BEGIN IMMEDIATE');
  try {
    if (patch.status === 'queued' && ['failed', 'cancelled', 'canceled'].includes(current.status)) {
      const quotaUserId = current.created_by || actorUserId;
      reserveTaskQuota(id, current.org_id, quotaUserId, current.type);
      if (!current.created_by && actorUserId) db.prepare('UPDATE tasks SET created_by=? WHERE id=?').run(actorUserId, id);
    }
  const sql = `UPDATE tasks SET ${fields.map(field => `${field} = ?`).join(', ')}, updated_at = ? WHERE id = ?`;
    db.prepare(sql.replace('WHERE id = ?', 'WHERE id = ? AND (? IS NULL OR org_id = ?)')).run(...fields.map(field => patch[field]), Date.now(), id, scoped(), scoped());
    if (patch.status) updateTaskQuota(id, patch.status);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return getTask(id);
}

export function removeTask(id) {
  db.prepare("UPDATE quota_task_usage SET status='released' WHERE task_id=? AND status='reserved'").run(id);
  db.prepare('DELETE FROM tasks WHERE id = ? AND (? IS NULL OR org_id = ?)').run(id, scoped(), scoped());
}

export function listTasks({ status, projectId, limit = 20, offset = 0 } = {}) {
  const clauses = [];
  if (scoped()) clauses.push('org_id = ?');
  if (status) clauses.push('status = ?');
  if (projectId) clauses.push('project_id = ?');
  if (userOnly()) clauses.push('created_by = ?');
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const values = [];
  if (scoped()) values.push(scoped());
  if (status) values.push(status);
  if (projectId) values.push(projectId);
  if (userOnly()) values.push(currentUserId());
  const rows = db.prepare(`SELECT * FROM tasks ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...values, limit, offset);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM tasks ${where}`).get(...values);
  return { items: rows.map(toTask), total: total.n };
}

export function stats(sinceTs = 0) {
  const row = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN status IN ('queued', 'running') THEN 1 ELSE 0 END) AS active
    FROM tasks WHERE created_at >= ? AND (? IS NULL OR org_id = ?) AND (? IS NULL OR created_by = ?)
  `).get(sinceTs, scoped(), scoped(), userOnly() ? currentUserId() : null, userOnly() ? currentUserId() : null);
  return { total: row.total || 0, done: row.done || 0, failed: row.failed || 0, active: row.active || 0 };
}

export function tracingDailySeries(fromTs) {
  const taskRows = db.prepare(`SELECT strftime('%Y-%m-%d', created_at/1000, 'unixepoch', 'localtime') AS day,
    COUNT(*) AS tasks, SUM(status='done') AS done, SUM(status='failed') AS failed
    FROM tasks WHERE created_at>=? AND (? IS NULL OR org_id=?) AND (? IS NULL OR created_by=?) GROUP BY day`)
    .all(fromTs, scoped(), scoped(), userOnly()?currentUserId():null, userOnly()?currentUserId():null);
  const callRows = db.prepare(`SELECT strftime('%Y-%m-%d', created_at/1000, 'unixepoch', 'localtime') AS day,
    COUNT(*) AS calls, SUM(total_tokens) AS tokens, SUM(cost_cny) AS cost, AVG(latency_ms) AS latency
    FROM ai_calls WHERE created_at>=? AND (? IS NULL OR org_id=?) AND (? IS NULL OR created_by=?) GROUP BY day`)
    .all(fromTs, scoped(), scoped(), userOnly()?currentUserId():null, userOnly()?currentUserId():null);
  const series = new Map();
  for (const row of taskRows) series.set(row.day, { day:row.day,tasks:row.tasks||0,done:row.done||0,failed:row.failed||0,calls:0,tokens:0,cost:0,latency:0 });
  for (const row of callRows) series.set(row.day, { ...(series.get(row.day)||{day:row.day,tasks:0,done:0,failed:0}),calls:row.calls||0,tokens:row.tokens||0,cost:Number(row.cost||0),latency:Math.round(row.latency||0) });
  return [...series.values()].sort((a,b)=>a.day.localeCompare(b.day));
}

/* ===== 通用文档（kind: scripts / projects / canvases / breakdowns / messages） ===== */

const docToObject = row => (row ? { id: row.id, kind: row.kind, ...JSON.parse(row.data || '{}'), createdAt: row.created_at, updatedAt: row.updated_at } : null);

const docGet = id => {
  const ownerClause = userOnly() ? ' AND created_by = ?' : '';
  const args = [id, scoped(), scoped()];
  if (userOnly()) args.push(currentUserId());
  return db.prepare(`SELECT * FROM documents WHERE id = ? AND (? IS NULL OR org_id = ?)${ownerClause}`).get(...args);
};

export function createDocument(kind, data = {}) {
  const id = randomUUID();
  const now = Date.now();
  db.prepare('INSERT INTO documents (id, kind, data, created_at, updated_at, org_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, kind, JSON.stringify(data), now, now, scoped() || 'bootstrap', currentUserId());
  return docToObject(docGet(id));
}

export function getDocument(id) {
  return docToObject(docGet(id));
}

export function patchDocument(id, patch = {}) {
  const current = docToObject(docGet(id));
  if (!current) return null;
  const { id: _ignored, kind, createdAt, updatedAt, ...rest } = current;
  const next = { ...rest, ...patch };
  db.prepare('UPDATE documents SET data = ?, updated_at = ? WHERE id = ? AND (? IS NULL OR org_id = ?)').run(JSON.stringify(next), Date.now(), id, scoped(), scoped());
  return getDocument(id);
}

export function removeDocument(id) {
  const ownerClause = userOnly() ? ' AND created_by = ?' : '';
  const args = [id, scoped(), scoped()];
  if (userOnly()) args.push(currentUserId());
  db.prepare(`DELETE FROM documents WHERE id = ? AND (? IS NULL OR org_id = ?)${ownerClause}`).run(...args);
}

export function listDocuments(kind, limit = 100) {
  const ownerClause = userOnly() ? ' AND created_by = ?' : '';
  const args = [kind, scoped(), scoped()];
  if (userOnly()) args.push(currentUserId());
  args.push(limit);
  return db.prepare(`SELECT * FROM documents WHERE kind = ? AND (? IS NULL OR org_id = ?)${ownerClause} ORDER BY updated_at DESC LIMIT ?`)
    .all(...args)
    .map(docToObject);
}

export function countDocuments(kind) {
  const row = db.prepare('SELECT COUNT(*) AS n FROM documents WHERE kind = ? AND (? IS NULL OR org_id = ?) AND (? IS NULL OR created_by = ?)').get(kind, scoped(), scoped(), userOnly() ? currentUserId() : null, userOnly() ? currentUserId() : null);
  return row.n || 0;
}

// 按天聚合：生产报表用
export function dailyTaskSeries(days = 30) {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (days - 1));
  const fromTs = from.getTime();

  const rows = db.prepare(`
    SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch', 'localtime') AS day,
           COUNT(*) AS total,
           SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
    FROM tasks
    WHERE created_at >= ? AND (? IS NULL OR org_id = ?) AND (? IS NULL OR created_by = ?)
    GROUP BY day
    ORDER BY day ASC
  `).all(fromTs, scoped(), scoped(), userOnly() ? currentUserId() : null, userOnly() ? currentUserId() : null);

  const scripts = db.prepare(`
    SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch', 'localtime') AS day, COUNT(*) AS total
    FROM documents WHERE kind = 'scripts' AND created_at >= ? AND (? IS NULL OR org_id = ?) AND (? IS NULL OR created_by = ?)
    GROUP BY day
  `).all(fromTs, scoped(), scoped(), userOnly() ? currentUserId() : null, userOnly() ? currentUserId() : null);

  const series = [];
  for (let i = 0; i < days; i += 1) {
    const date = new Date(fromTs + i * 86400000);
    const key = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
    const task = rows.find(row => row.day === key);
    const script = scripts.find(row => row.day === key);
    series.push({
      date: key,
      tasks: task?.total || 0,
      done: task?.done || 0,
      failed: task?.failed || 0,
      scripts: script?.total || 0,
    });
  }
  return series;
}

/* ===== 调用记账 / 任务事件（tracing） ===== */

const callInsert = db.prepare(`
  INSERT INTO ai_calls (id, kind, provider, model, task_id, prompt_tokens, completion_tokens, total_tokens, reasoning_tokens, latency_ms, status, error, meta, created_at, cost_cny, org_id, created_by, input_payload, output_payload, tool_calls, request_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const eventInsert = db.prepare('INSERT INTO task_events (id, task_id, event, detail, created_at, org_id) VALUES (?, ?, ?, ?, ?, ?)');
const taskOwner = taskId => taskId ? db.prepare('SELECT org_id, created_by FROM tasks WHERE id = ?').get(taskId) : null;
const taskOrg = taskId => scoped() || taskOwner(taskId)?.org_id || 'bootstrap';

export function recordAiCall({
  kind,
  provider = 'ark',
  model = '',
  taskId = null,
  promptTokens = 0,
  completionTokens = 0,
  totalTokens = 0,
  reasoningTokens = 0,
  latencyMs = 0,
  status = 'ok',
  error = null,
  meta = null,
  costCny = 0,
  input = null,
  output = null,
  toolCalls = null,
  requestId = null,
}) {
  const id = randomUUID();
  callInsert.run(
    id, kind, provider, model, taskId,
    promptTokens || 0, completionTokens || 0, totalTokens || 0, reasoningTokens || 0,
    latencyMs || 0, status, error, meta ? JSON.stringify(meta) : null, Date.now(), costCny || 0, taskOrg(taskId), currentUserId() || taskOwner(taskId)?.created_by || null,
    input ? JSON.stringify(input) : null, output ? JSON.stringify(output) : null,
    toolCalls ? JSON.stringify(toolCalls) : null, requestId,
  );
  return id;
}

export function recordTaskEvent(taskId, event, detail = null) {
  eventInsert.run(randomUUID(), taskId, event, detail ? JSON.stringify(detail) : null, Date.now(), taskOrg(taskId));
}

export function listTaskEvents(taskId) {
  return db.prepare('SELECT * FROM task_events WHERE task_id = ? AND (? IS NULL OR org_id = ?) ORDER BY created_at ASC')
    .all(taskId, scoped(), scoped())
    .map(row => ({ id: row.id, event: row.event, detail: row.detail ? JSON.parse(row.detail) : null, at: row.created_at }));
}

export function listAiCalls({ limit = 60, kind, model } = {}) {
  const where = [];
  const args = [];
  if (scoped()) { where.push('org_id = ?'); args.push(scoped()); }
  if (userOnly()) { where.push('created_by = ?'); args.push(currentUserId()); }
  if (kind) { where.push('kind = ?'); args.push(kind); }
  if (model) { where.push('model = ?'); args.push(model); }
  const sql = `SELECT * FROM ai_calls ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT ?`;
  return db.prepare(sql).all(...args, limit).map(row => ({
    id: row.id,
    kind: row.kind,
    provider: row.provider,
    model: row.model,
    taskId: row.task_id,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    totalTokens: row.total_tokens,
    reasoningTokens: row.reasoning_tokens,
    latencyMs: row.latency_ms,
    costCny: row.cost_cny || 0,
    status: row.status,
    error: row.error,
    createdAt: row.created_at,
    requestId: row.request_id || null,
    input: row.input_payload ? safeParse(row.input_payload) : null,
    output: row.output_payload ? safeParse(row.output_payload) : null,
    toolCalls: row.tool_calls ? safeParse(row.tool_calls) : null,
  }));
}

const safeParse = value => {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return value; }
};

export function aiUsageSummary(fromTs) {
  const totals = db.prepare(`
    SELECT COUNT(*) AS calls,
           SUM(prompt_tokens) AS prompt_tokens,
           SUM(completion_tokens) AS completion_tokens,
           SUM(total_tokens) AS total_tokens,
           SUM(reasoning_tokens) AS reasoning_tokens,
           AVG(latency_ms) AS avg_latency,
           SUM(cost_cny) AS cost,
           SUM(CASE WHEN status != 'ok' THEN 1 ELSE 0 END) AS errors
    FROM ai_calls WHERE created_at >= ?
      AND (? IS NULL OR org_id = ?) AND (? IS NULL OR created_by = ?)
  `).get(fromTs, scoped(), scoped(), userOnly() ? currentUserId() : null, userOnly() ? currentUserId() : null);

  const byModel = db.prepare(`
    SELECT model, COUNT(*) AS calls, SUM(total_tokens) AS tokens, AVG(latency_ms) AS avg_latency, SUM(cost_cny) AS cost
    FROM ai_calls WHERE created_at >= ? AND (? IS NULL OR org_id = ?) AND (? IS NULL OR created_by = ?)
    GROUP BY model ORDER BY tokens DESC
  `).all(fromTs, scoped(), scoped(), userOnly() ? currentUserId() : null, userOnly() ? currentUserId() : null);

  const byKind = db.prepare(`
    SELECT kind, COUNT(*) AS calls, SUM(total_tokens) AS tokens, AVG(latency_ms) AS avg_latency, SUM(cost_cny) AS cost
    FROM ai_calls WHERE created_at >= ? AND (? IS NULL OR org_id = ?) AND (? IS NULL OR created_by = ?)
    GROUP BY kind ORDER BY calls DESC
  `).all(fromTs, scoped(), scoped(), userOnly() ? currentUserId() : null, userOnly() ? currentUserId() : null);

  return {
    totals: {
      calls: totals.calls || 0,
      promptTokens: totals.prompt_tokens || 0,
      completionTokens: totals.completion_tokens || 0,
      totalTokens: totals.total_tokens || 0,
      reasoningTokens: totals.reasoning_tokens || 0,
      avgLatency: Math.round(totals.avg_latency || 0),
      cost: Number((totals.cost || 0).toFixed(4)),
      errors: totals.errors || 0,
    },
    byModel: byModel.map(row => ({ ...row, cost: Number((row.cost || 0).toFixed(4)) })),
    byKind: byKind.map(row => ({ ...row, cost: Number((row.cost || 0).toFixed(4)) })),
  };
}

export function recentTaskTraces(limit = 20, cursor = null) {
  return db.prepare(`
    SELECT t.*,o.name AS org_name,u.email AS created_by_email,d.data AS project_data,
           (SELECT COUNT(*) FROM task_events e WHERE e.task_id = t.id) AS event_count,
           (SELECT event FROM task_events e WHERE e.task_id = t.id ORDER BY created_at DESC LIMIT 1) AS last_event
    FROM tasks t LEFT JOIN orgs o ON o.id=t.org_id LEFT JOIN users u ON u.id=t.created_by
      LEFT JOIN documents d ON d.id=t.project_id AND d.kind='projects'
    WHERE (? IS NULL OR t.org_id = ?) AND (? IS NULL OR t.created_by = ?)
      AND (? IS NULL OR t.created_at < ? OR (t.created_at = ? AND t.id < ?))
    ORDER BY t.created_at DESC,t.id DESC LIMIT ?
  `).all(scoped(), scoped(), userOnly() ? currentUserId() : null, userOnly() ? currentUserId() : null,
    cursor?.at ?? null, cursor?.at ?? null, cursor?.at ?? null, cursor?.id ?? null, limit).map(task => ({
    id: task.id,
    type: task.type,
    status: task.status,
    progress: task.progress,
    model: task.req_key,
    prompt: task.prompt,
    costMs: task.cost_ms,
    attempts: task.attempts,
    remoteTaskId: task.remote_task_id,
    resultUrl: task.result_url,
    error: task.error,
    eventCount: task.event_count,
    lastEvent: task.last_event,
    createdAt: task.created_at,
    organization: task.org_name,
    createdBy: task.created_by_email,
    projectId: task.project_id || null,
    projectName: (() => {
      if (!task.project_data) return null;
      try { return JSON.parse(task.project_data).name || null; } catch { return null; }
    })(),
  }));
}
// 同一条任务是否已经记过一次成功的媒体成本（重试续传时避免重复记账）
export function hasMediaCall(taskId) {
  const row = db.prepare("SELECT COUNT(*) AS n FROM ai_calls WHERE task_id = ? AND kind IN ('image', 'video') AND status = 'ok' AND (? IS NULL OR org_id = ?)").get(taskId, scoped(), scoped());
  return (row.n || 0) > 0;
}

const passwordKey = (password, salt) => scryptSync(password, salt, 64).toString('hex');
const tokenDigest = token => createHash('sha256').update(token).digest('hex');
const withSavepoint = fn => {
  db.exec('SAVEPOINT org_operation');
  try {
    const result = fn();
    db.exec('RELEASE org_operation');
    return result;
  } catch (error) {
    db.exec('ROLLBACK TO org_operation');
    db.exec('RELEASE org_operation');
    throw error;
  }
};

export function createAccount({ email, password, orgName }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const name = String(orgName || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('请输入有效邮箱');
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) throw new Error('密码长度须为 10 至 128 位');
  if (!name || name.length > 80) throw new Error('组织名称须为 1 至 80 个字符');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(normalizedEmail)) throw new Error('邮箱已注册');
  const id = randomUUID();
  const orgId = randomUUID();
  const now = Date.now();
  const salt = randomBytes(16).toString('hex');
  const token = randomBytes(32).toString('base64url');
  db.exec('BEGIN');
  try {
    db.prepare('INSERT INTO users VALUES (?, ?, ?, ?)').run(id, normalizedEmail, `${salt}:${passwordKey(password, salt)}`, now);
    db.prepare("INSERT INTO orgs(id,name,status,created_at) VALUES(?,?,'active',?)").run(orgId, name, now);
    db.prepare("INSERT INTO org_members VALUES (?, ?, 'org.admin', ?)").run(orgId, id, now);
    db.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES (?, ?, ?, ?)').run(tokenDigest(token), id, now, now + 30 * 86400000);
    if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 1) {
      for (const table of ['tasks', 'documents', 'ai_calls', 'task_events', 'file_owners']) {
        db.prepare(`UPDATE ${table} SET org_id = ? WHERE org_id = 'bootstrap'`).run(orgId);
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return { token, user: { id, email: normalizedEmail }, role: config.superadminEmails.includes(normalizedEmail) ? 'superadmin' : 'org.admin', org: { id: orgId, name, role: 'org.admin' } };
}

export function loginAccount({ email, password }) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim().toLowerCase());
  if (!user || typeof password !== 'string') throw new Error('邮箱或密码错误');
  const [salt, expected] = user.password_hash.split(':');
  const actual = Buffer.from(passwordKey(password, salt), 'hex');
  if (!timingSafeEqual(actual, Buffer.from(expected, 'hex'))) throw new Error('邮箱或密码错误');
  if (user.status === 'disabled') throw new Error('该账号已被停用，请联系平台管理员');
  const membership = db.prepare('SELECT o.id, o.name, o.status, o.plan, o.trial_ends_at, m.role FROM org_members m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = ?').get(user.id);
  if (!membership) throw new Error('账号没有所属组织');
  const orgStatus = effectiveOrgStatus(membership);
  const isPlatformAdmin = config.superadminEmails.includes(user.email);
  // 归档/停用/试用到期的组织，成员不能登录（superadmin 代管不受限）
  if (!isPlatformAdmin && ['suspended', 'expired', 'archived'].includes(orgStatus)) {
    const reason = { suspended: '该组织已暂停使用', expired: '该组织试用已到期', archived: '该组织已归档' }[orgStatus];
    throw new Error(`${reason}，请联系平台管理员`);
  }
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  db.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES (?, ?, ?, ?)').run(tokenDigest(token), user.id, now, now + 30 * 86400000);
  db.prepare('UPDATE users SET last_login_at=?, last_seen_at=? WHERE id=?').run(now, now, user.id);
  return { token, user: { id: user.id, email: user.email }, role: isPlatformAdmin ? 'superadmin' : membership.role, org: { id: membership.id, name: membership.name, status: orgStatus, plan: membership.plan, trialEndsAt: membership.trial_ends_at || null, role: membership.role } };
}

export function getSession(token) {
  if (!token) return null;
  const row = db.prepare(`SELECT u.id, u.email, u.status AS user_status, o.id AS org_id, o.name AS org_name, o.status AS org_status, o.plan AS org_plan, o.trial_ends_at AS org_trial_ends_at, m.role
    FROM sessions s JOIN users u ON u.id = s.user_id
    JOIN org_members m ON m.user_id = u.id JOIN orgs o ON o.id = m.org_id
    WHERE s.token_hash = ? AND s.expires_at > ?`).get(tokenDigest(token), Date.now());
  if (!row || row.user_status === 'disabled') return null;
  const orgStatus = effectiveOrgStatus({ status: row.org_status, plan: row.org_plan, trial_ends_at: row.org_trial_ends_at });
  return { user: { id: row.id, email: row.email }, role: config.superadminEmails.includes(row.email) ? 'superadmin' : row.role, org: { id: row.org_id, name: row.org_name, status: orgStatus, plan: row.org_plan, trialEndsAt: row.org_trial_ends_at || null, role: row.role } };
}

export function platformOverview() {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const period = quotaPeriod();
  const organizations = db.prepare(`SELECT o.id, o.name, o.status, o.created_at, o.plan, o.trial_ends_at,
    (SELECT COUNT(*) FROM org_members m WHERE m.org_id = o.id) AS member_count,
    (SELECT u.email FROM org_members m JOIN users u ON u.id = m.user_id WHERE m.org_id = o.id AND m.role = 'org.admin' LIMIT 1) AS admin_email,
    (SELECT COUNT(*) FROM documents d WHERE d.org_id = o.id AND d.kind = 'projects') AS project_count,
    (SELECT COUNT(*) FROM tasks t WHERE t.org_id = o.id) AS task_count,
    (SELECT COALESCE(SUM(a.total_tokens), 0) FROM ai_calls a WHERE a.org_id = o.id AND a.created_at >= ?) AS month_tokens,
    (SELECT COALESCE(SUM(g.amount), 0) FROM org_quota_grants g WHERE g.org_id=o.id AND g.period=?) AS quota_granted,
    (SELECT COALESCE(SUM(q.amount), 0) FROM quota_task_usage q WHERE q.org_id=o.id AND q.period=? AND q.status='settled') AS quota_used,
    (SELECT COALESCE(SUM(q.amount), 0) FROM quota_task_usage q WHERE q.org_id=o.id AND q.period=? AND q.status='reserved') AS quota_reserved,
    (SELECT COALESCE(SUM(q.cost_cny), 0) FROM quota_task_usage q WHERE q.org_id=o.id AND q.period=? AND q.status='settled') AS month_cost_cny
    FROM orgs o WHERE o.id != 'bootstrap' ORDER BY o.created_at DESC`).all(monthStart.getTime(), period, period, period, period);
  const totals = db.prepare(`SELECT
    (SELECT COUNT(*) FROM orgs WHERE id != 'bootstrap') AS organizations,
    (SELECT COUNT(*) FROM users) AS users,
    (SELECT COUNT(*) FROM documents WHERE kind = 'projects') AS projects,
    (SELECT COUNT(*) FROM tasks) AS tasks,
    (SELECT SUM(CASE WHEN status IN ('queued','running') THEN 1 ELSE 0 END) FROM tasks) AS active_tasks,
    (SELECT SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) FROM tasks) AS failed_tasks,
    (SELECT COALESCE(SUM(total_tokens), 0) FROM ai_calls WHERE created_at >= ?) AS month_tokens,
    (SELECT COALESCE(SUM(amount),0) FROM org_quota_grants WHERE period=?) AS quota_granted,
    (SELECT COALESCE(SUM(amount),0) FROM quota_task_usage WHERE period=? AND status='settled') AS quota_used`).get(monthStart.getTime(), period, period);
  for (const org of organizations) {
    org.quota_remaining = Math.max(0, org.quota_granted - org.quota_used - org.quota_reserved);
    // 用现算的有效状态覆盖库里的值，保证 trial 到期立即体现
    org.stored_status = org.status;
    org.status = effectiveOrgStatus(org);
  }
  const auditLogs = db.prepare(`SELECT l.id, l.action, l.target, l.details, l.created_at, u.email AS actor_email,
      o.name AS org_name, o.id AS org_id
    FROM org_audit_logs l
      LEFT JOIN users u ON u.id = l.actor_user_id
      LEFT JOIN orgs o ON o.id = l.org_id
    ORDER BY l.created_at DESC LIMIT 200`).all();
  return {
    totals: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, value || 0])),
    organizations,
    auditLogs,
    trendWeek: platformTrend('week'),
    trendMonth: platformTrend('month'),
  };
}

/* 平台趋势：按周(7天)或按月(30天)返回每日新增量与累计存量 */
export function platformTrend(range = 'week') {
  const days = range === 'month' ? 30 : 7;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const fromTs = start.getTime();
  const dayOf = `strftime('%Y-%m-%d', created_at / 1000, 'unixepoch', 'localtime')`;
  const byDay = sql => new Map(db.prepare(sql).all(fromTs).map(row => [row.day, row.total]));

  const newUsers = byDay(`SELECT ${dayOf} AS day, COUNT(*) AS total FROM users WHERE created_at >= ? GROUP BY day`);
  const newOrgs = byDay(`SELECT ${dayOf} AS day, COUNT(*) AS total FROM orgs WHERE id != 'bootstrap' AND created_at >= ? GROUP BY day`);
  const newTasks = byDay(`SELECT ${dayOf} AS day, COUNT(*) AS total FROM tasks WHERE created_at >= ? GROUP BY day`);
  const tokens = byDay(`SELECT ${dayOf} AS day, COALESCE(SUM(total_tokens), 0) AS total FROM ai_calls WHERE created_at >= ? GROUP BY day`);

  // 区间开始前的存量作为累计曲线起点
  let userStock = db.prepare('SELECT COUNT(*) AS n FROM users WHERE created_at < ?').get(fromTs).n || 0;
  let orgStock = db.prepare(`SELECT COUNT(*) AS n FROM orgs WHERE id != 'bootstrap' AND created_at < ?`).get(fromTs).n || 0;

  const series = [];
  for (let i = 0; i < days; i += 1) {
    const date = new Date(fromTs + i * 86400000);
    const key = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
    const addOrgs = newOrgs.get(key) || 0;
    const addUsers = newUsers.get(key) || 0;
    userStock += addUsers;
    orgStock += addOrgs;
    series.push({
      date: key,
      newOrgs: addOrgs,
      newUsers: addUsers,
      orgs: orgStock,
      users: userStock,
      tasks: newTasks.get(key) || 0,
      tokens: tokens.get(key) || 0,
    });
  }
  return series;
}

/**
 * 运营看板（superadmin）。全部基于现有真实数据，不造假：
 * - 活性：近 N 天有任务/创作行为的组织与用户
 * - 留存：周/月活跃留存曲线
 * - 套餐：分布与 trial→paid 转化
 * - 消耗：按天真实成本 trend
 */
export function platformMetrics({ days = 30 } = {}) {
  const span = Math.max(7, Math.min(180, Number(days) || 30));
  const now = Date.now();
  const from = now - span * 86400000;
  const dayOf = "strftime('%Y-%m-%d', created_at/1000, 'unixepoch', 'localtime')";

  const liveOrgs = db.prepare('SELECT COUNT(*) AS n FROM orgs WHERE id != ? AND status = ?').get('bootstrap', 'active').n || 0;
  const allOrgs = db.prepare('SELECT COUNT(*) AS n FROM orgs WHERE id != ?').get('bootstrap').n || 0;

  // 活跃组织：期间内产生过任务或创作文档
  const activeOrgRow = db.prepare(`SELECT COUNT(DISTINCT org_id) AS n FROM (
    SELECT org_id FROM tasks WHERE created_at >= ?
    UNION SELECT org_id FROM documents WHERE created_at >= ?
  ) WHERE org_id != ?`).get(from, from, 'bootstrap');
  const activeOrgs = activeOrgRow.n || 0;

  // 活跃用户：期间内有任务或登录过
  const activeUsers = db.prepare(`SELECT COUNT(DISTINCT user_id) AS n FROM (
    SELECT created_by AS user_id FROM tasks WHERE created_at >= ? AND created_by IS NOT NULL
    UNION SELECT user_id FROM sessions WHERE created_at >= ?
  )`).get(from, from).n || 0;
  const totalUsers = db.prepare('SELECT COUNT(*) AS n FROM users').get().n || 0;

  // 套餐分布
  const planRows = db.prepare('SELECT plan, COUNT(*) AS n FROM orgs WHERE id != ? GROUP BY plan').all('bootstrap');
  const planMap = Object.fromEntries(planRows.map(row => [row.plan, row.n]));
  const plans = ORG_PLANS.map(plan => ({ plan, count: planMap[plan] || 0 }));
  const paid = (planMap.pro || 0) + (planMap.enterprise || 0);
  const payingOrgs = paid;
  // 转化率：付费组织 / 非免费组织（排除 free 与 bootstrap）
  const monetizable = allOrgs - (planMap.free || 0);
  const conversion = monetizable > 0 ? paid / monetizable : 0;
  const arpu = payingOrgs > 0
    ? Number((db.prepare(`SELECT COALESCE(SUM(cost_cny),0) AS c FROM ai_calls WHERE created_at >= ?`).get(from).c / payingOrgs).toFixed(2))
    : 0;

  // 每日：活跃组织、任务量、成本
  const taskDaily = new Map(db.prepare(`SELECT ${dayOf} AS day, COUNT(*) AS tasks, COUNT(DISTINCT org_id) AS orgs
    FROM tasks WHERE created_at >= ? GROUP BY day`).all(from).map(row => [row.day, row]));
  const costDaily = new Map(db.prepare(`SELECT ${dayOf} AS day, COALESCE(SUM(cost_cny),0) AS cost
    FROM ai_calls WHERE created_at >= ? GROUP BY day`).all(from).map(row => [row.day, Number(row.cost)]));
  const series = [];
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i <= span; i += 1) {
    const date = new Date(start.getTime() + i * 86400000);
    const key = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
    const task = taskDaily.get(key);
    series.push({
      date: key,
      tasks: task?.tasks || 0,
      activeOrgs: task?.orgs || 0,
      cost: Number((costDaily.get(key) || 0).toFixed(2)),
    });
  }

  // 周活跃留存：最近 8 周，每周有行为的组织数
  const weekly = [];
  for (let w = 7; w >= 0; w -= 1) {
    const end = now - w * 7 * 86400000;
    const begin = end - 7 * 86400000;
    const orgs = db.prepare(`SELECT COUNT(DISTINCT org_id) AS n FROM tasks WHERE created_at >= ? AND created_at < ?`).get(begin, end).n || 0;
    const tasks = db.prepare('SELECT COUNT(*) AS n FROM tasks WHERE created_at >= ? AND created_at < ?').get(begin, end).n || 0;
    weekly.push({ week: `W-${w}`, orgs, tasks });
  }

  return {
    days: span,
    orgs: { total: allOrgs, active: liveOrgs, activeInRange: activeOrgs, activeRate: allOrgs > 0 ? activeOrgs / allOrgs : 0 },
    users: { total: totalUsers, activeInRange: activeUsers, activeRate: totalUsers > 0 ? activeUsers / totalUsers : 0 },
    plans,
    conversion,
    payingOrgs,
    arpu,
    series,
    weekly,
  };
}
export function deleteSession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenDigest(token));
}

export function listOrgMembers(orgId) {
  return db.prepare(`SELECT u.id,u.email,m.role,m.created_at AS createdAt FROM org_members m
    JOIN users u ON u.id=m.user_id WHERE m.org_id=? ORDER BY m.created_at`).all(orgId);
}

export function listOrganizations() {
  return db.prepare(`SELECT o.id, o.name, o.status, o.created_at AS createdAt, COUNT(m.user_id) AS memberCount,
    (SELECT u.email FROM org_members x JOIN users u ON u.id=x.user_id WHERE x.org_id=o.id AND x.role='org.admin' LIMIT 1) AS adminEmail
    FROM orgs o LEFT JOIN org_members m ON m.org_id=o.id
    WHERE o.id!='bootstrap' GROUP BY o.id ORDER BY o.created_at DESC`).all();
}

export function createOrganization({ name, adminEmail, actorUserId }) {
  const orgName = String(name || '').trim();
  if (!orgName || orgName.length > 80) throw new Error('组织名称须为 1 至 80 个字符');
  const id = randomUUID();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare("INSERT INTO orgs(id,name,status,created_at) VALUES(?,?,'active',?)").run(id, orgName, Date.now());
    const invite = createOrgInvite({ orgId: id, actorUserId, email: adminEmail, role: 'org.admin' });
    db.exec('COMMIT');
    return { id, name: orgName, status: 'active', invite };
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export const ORG_STATUSES = ['active', 'suspended', 'expired', 'archived'];
/** 这些状态下组织被冻结：成员不能登录也不能调业务接口（superadmin 除外） */
export const LOCKED_ORG_STATUSES = ['suspended', 'expired', 'archived'];

/**
 * 计算组织的「有效状态」。
 *
 * 库里存的是 status 字段，但 trial 到期属于「时间驱动的状态」：
 * 不依赖定时任务把库改掉，而是每次读的时候按 trial_ends_at 现算，
 * 这样即使清理任务没跑，到期组织也不会漏网。
 *
 * 只对 plan='trial' 生效；管理员手动归档/停用优先。
 */
export function effectiveOrgStatus({ status, plan, trial_ends_at: trialEndsAt }) {
  if (status !== 'active') return status;
  if (plan === 'trial' && trialEndsAt && Number(trialEndsAt) <= Date.now()) return 'expired';
  return 'active';
}

/**
 * 把已到期但库里还是 active 的 trial 组织落库成 expired，并记审计。
 * 幂等，可以反复调；由 poller 定时触发。
 */
export function expireDueTrials() {
  const due = db.prepare("SELECT id, name, plan, status, trial_ends_at FROM orgs WHERE id != 'bootstrap' AND status = 'active' AND plan = 'trial' AND trial_ends_at IS NOT NULL AND trial_ends_at <= ?")
    .all(Date.now());
  if (!due.length) return [];
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const org of due) {
      db.prepare("UPDATE orgs SET status='expired' WHERE id=?").run(org.id);
      recordOrgAudit({ orgId: org.id, actorUserId: null, action: 'organization.trial_expired', target: org.name, details: { trialEndsAt: org.trial_ends_at } });
    }
    db.exec('COMMIT');
    return due.map(org => org.id);
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function setOrganizationStatus({ orgId, actorUserId, status }) {
  if (!ORG_STATUSES.includes(status)) throw new Error(`组织状态无效（可选：${ORG_STATUSES.join(' / ')}）`);
  const org = db.prepare("SELECT name,status,plan,trial_ends_at FROM orgs WHERE id=? AND id!='bootstrap'").get(orgId);
  if (!org) return null;
  const from = effectiveOrgStatus(org);
  db.prepare('UPDATE orgs SET status=? WHERE id=?').run(status, orgId);
  // 归档/停用立即剔除全部成员会话，避免已登录的人继续操作；
  // 但 superadmin 保留会话，否则 "代管者刚好属于该组织" 时将无法恢复
  if (LOCKED_ORG_STATUSES.includes(status)) {
    const superadminEmails = config.superadminEmails;
    const keepClause = superadminEmails.length ? ` AND user_id NOT IN (SELECT id FROM users WHERE lower(email) IN (${superadminEmails.map(() => '?').join(',')}))` : '';
    db.prepare(`DELETE FROM sessions WHERE user_id IN (SELECT user_id FROM org_members WHERE org_id=?${keepClause})`).run(orgId, ...(superadminEmails.length ? superadminEmails : []));
  }
  if (from !== status) recordOrgAudit({ orgId, actorUserId, action: 'organization.status_changed', target: org.name, details: { from, to: status } });
  return { id: orgId, name: org.name, status, previousStatus: from };
}

export function setOrganizationAdmin({ orgId, actorUserId, email }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const member = db.prepare(`SELECT u.id FROM users u JOIN org_members m ON m.user_id=u.id
    WHERE m.org_id=? AND lower(u.email)=?`).get(orgId, normalizedEmail);
  if (!member) throw new Error('该邮箱不是组织成员');
  if (!changeOrgMemberRole({ orgId, actorUserId, userId: member.id, role: 'org.admin' })) throw new Error('成员不存在');
  return { email: normalizedEmail, role: 'org.admin' };
}

export const organizationExists = id => Boolean(db.prepare('SELECT 1 FROM orgs WHERE id=?').get(id));

export function listOrgInvites(orgId) {
  return db.prepare(`SELECT id,email,role,created_at AS createdAt,expires_at AS expiresAt FROM org_invites
    WHERE org_id=? AND expires_at>? ORDER BY created_at DESC`).all(orgId, Date.now());
}

export function createOrgInvite({ orgId, actorUserId, email, role }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) throw new Error('请输入有效邮箱');
  if (!['org.admin', 'org.reviewer', 'org.user'].includes(role)) throw new Error('成员角色无效');
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(normalizedEmail)) throw new Error('该邮箱已注册，MVP 暂不支持跨组织加入');
  return withSavepoint(() => {
    const id = randomUUID();
    const token = randomBytes(32).toString('base64url');
    const now = Date.now();
    const expiresAt = now + 7 * 86400000;
    db.prepare('DELETE FROM org_invites WHERE org_id=? AND email=?').run(orgId, normalizedEmail);
    db.prepare('INSERT INTO org_invites VALUES(?,?,?,?,?,?,?)').run(id, orgId, normalizedEmail, role, tokenDigest(token), now, expiresAt);
    recordOrgAudit({ orgId, actorUserId, action: 'invite.created', target: normalizedEmail, details: { role } });
    return { id, token, email: normalizedEmail, role, expiresAt };
  });
}

export function resendOrgInvite({ orgId, actorUserId, inviteId }) {
  const invite = db.prepare('SELECT * FROM org_invites WHERE id=? AND org_id=?').get(inviteId, orgId);
  if (!invite) return null;
  return withSavepoint(() => {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + 7 * 86400000;
    db.prepare('UPDATE org_invites SET token_hash=?,created_at=?,expires_at=? WHERE id=? AND org_id=?').run(tokenDigest(token), Date.now(), expiresAt, inviteId, orgId);
    recordOrgAudit({ orgId, actorUserId, action: 'invite.resent', target: invite.email });
    return { id: invite.id, token, email: invite.email, role: invite.role, expiresAt };
  });
}

export function revokeOrgInvite({ orgId, actorUserId, inviteId }) {
  const invite = db.prepare('SELECT email FROM org_invites WHERE id=? AND org_id=?').get(inviteId, orgId);
  if (!invite) return false;
  return withSavepoint(() => {
    db.prepare('DELETE FROM org_invites WHERE id=? AND org_id=?').run(inviteId, orgId);
    recordOrgAudit({ orgId, actorUserId, action: 'invite.revoked', target: invite.email });
    return true;
  });
}

export function acceptOrgInvite({ token, email, password }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('请输入有效邮箱');
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) throw new Error('密码长度须为 10 至 128 位');
  const invite = db.prepare('SELECT * FROM org_invites WHERE token_hash=? AND email=? AND expires_at>?').get(tokenDigest(token || ''), normalizedEmail, Date.now());
  if (!invite) throw new Error('邀请链接已失效或邮箱不匹配');
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(normalizedEmail)) throw new Error('该账号已注册，MVP 暂不支持跨组织加入');
  const id = randomUUID();
  const sessionToken = randomBytes(32).toString('base64url');
  const now = Date.now();
  const salt = randomBytes(16).toString('hex');
  db.exec('BEGIN');
  try {
    db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(id, normalizedEmail, `${salt}:${passwordKey(password, salt)}`, now);
    db.prepare('INSERT INTO org_members VALUES(?,?,?,?)').run(invite.org_id, id, invite.role, now);
    db.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)').run(tokenDigest(sessionToken), id, now, now + 30 * 86400000);
    db.prepare('DELETE FROM org_invites WHERE id=?').run(invite.id);
    db.prepare('INSERT INTO org_audit_logs VALUES(?,?,?,?,?,?,?)').run(randomUUID(), invite.org_id, id, 'invite.accepted', normalizedEmail, null, now);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  const org = db.prepare('SELECT id,name FROM orgs WHERE id=?').get(invite.org_id);
  return { token: sessionToken, user: { id, email: normalizedEmail }, role: invite.role, org: { ...org, role: invite.role } };
}

export function changeOrgMemberRole({ orgId, actorUserId, userId, role }) {
  if (!['org.admin', 'org.reviewer', 'org.user'].includes(role)) throw new Error('成员角色无效');
  db.exec('BEGIN IMMEDIATE');
  try {
    const current = db.prepare('SELECT u.email,m.role FROM org_members m JOIN users u ON u.id=m.user_id WHERE m.org_id=? AND m.user_id=?').get(orgId, userId);
    if (!current) { db.exec('COMMIT'); return false; }
    if (current.role === 'org.admin' && role !== 'org.admin' && db.prepare("SELECT COUNT(*) AS n FROM org_members WHERE org_id=? AND role='org.admin'").get(orgId).n < 2) throw new Error('组织至少需要一名管理员');
    db.prepare('UPDATE org_members SET role=? WHERE org_id=? AND user_id=?').run(role, orgId, userId);
    recordOrgAudit({ orgId, actorUserId, action: 'member.role_changed', target: current.email, details: { from: current.role, to: role } });
    db.exec('COMMIT');
    return true;
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function removeOrgMember({ orgId, actorUserId, userId }) {
  if (userId === actorUserId) throw new Error('不能移除自己');
  db.exec('BEGIN IMMEDIATE');
  try {
    const current = db.prepare('SELECT u.email,m.role FROM org_members m JOIN users u ON u.id=m.user_id WHERE m.org_id=? AND m.user_id=?').get(orgId, userId);
    if (!current) { db.exec('COMMIT'); return false; }
    if (current.role === 'org.admin' && db.prepare("SELECT COUNT(*) AS n FROM org_members WHERE org_id=? AND role='org.admin'").get(orgId).n < 2) throw new Error('组织至少需要一名管理员');
    db.prepare('DELETE FROM org_members WHERE org_id=? AND user_id=?').run(orgId, userId);
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(userId);
    recordOrgAudit({ orgId, actorUserId, action: 'member.removed', target: current.email, details: { role: current.role } });
    db.exec('COMMIT');
    return true;
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function recordOrgAudit({ orgId, actorUserId = null, action, target = null, details = null }) {
  db.prepare('INSERT INTO org_audit_logs VALUES(?,?,?,?,?,?,?)').run(randomUUID(), orgId, actorUserId, action, target, details ? JSON.stringify(details) : null, Date.now());
}

/**
 * 已支持的审计动作（前端筛选下拉用）。列在这里的才能被筛选，
 * 未列出的动作仍会在列表里出现，可用 q 模糊搜。
 */
export const ORG_AUDIT_ACTIONS = [
  'organization.status_changed', 'organization.trial_expired', 'organization.renamed',
  'org.plan.changed', 'member.role_changed', 'member.removed',
  'invite.created', 'invite.resent', 'invite.revoked', 'invite.accepted',
  'quota.org.granted', 'quota.member.allocated',
  'user.disabled', 'user.enabled', 'user.sessions_revoked',
  'review.submitted', 'review.approved', 'review.rejected',
];

/**
 * 组织审计查询：支持按动作 / 操作人 / 时间范围 / 关键字筛选，offset 分页。
 * 返回 items + total + 可用动作列表，前端可直接渲染筛选器。
 * allOrgs=true 时跨组织查询（superadmin）。
 */
export function listOrgAudit(orgId, {
  limit = 50, offset = 0, action, actor, from, to, q, allOrgs = false,
} = {}) {
  const clauses = [];
  const values = [];
  if (!allOrgs) { clauses.push('a.org_id = ?'); values.push(orgId); }
  if (action) { clauses.push('a.action = ?'); values.push(action); }
  if (actor) { clauses.push('lower(u.email) LIKE ?'); values.push(`%${String(actor).toLowerCase()}%`); }
  if (Number.isFinite(from)) { clauses.push('a.created_at >= ?'); values.push(from); }
  if (Number.isFinite(to)) { clauses.push('a.created_at <= ?'); values.push(to); }
  if (q) {
    clauses.push('(lower(a.target) LIKE ? OR lower(a.action) LIKE ? OR lower(u.email) LIKE ?)');
    const like = `%${String(q).toLowerCase()}%`;
    values.push(like, like, like);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const size = Math.max(1, Math.min(200, Number(limit) || 50));
  const skip = Math.max(0, Number(offset) || 0);
  const items = db.prepare(`SELECT a.id,a.action,a.target,a.details,a.created_at AS createdAt,
      u.email AS actorEmail,o.name AS orgName
    FROM org_audit_logs a
    LEFT JOIN users u ON u.id=a.actor_user_id
    LEFT JOIN orgs o ON o.id=a.org_id
    ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`)
    .all(...values, size, skip)
    .map(row => ({ ...row, details: row.details ? JSON.parse(row.details) : null }));
  const total = db.prepare(`SELECT COUNT(*) AS n FROM org_audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id ${where}`)
    .get(...values).n || 0;
  return { items, total, limit: size, offset: skip, actions: ORG_AUDIT_ACTIONS };
}

/** 审计留存清理：删除超过保留期的记录；返回删除条数 */
export function purgeExpiredAudit(retentionDays = 180) {
  const days = Number(retentionDays);
  if (!Number.isFinite(days) || days <= 0) return 0;
  const cutoff = Date.now() - days * 86400000;
  const result = db.prepare('DELETE FROM org_audit_logs WHERE created_at < ?').run(cutoff);
  return Number(result.changes || 0);
}

/** 审计导出：不导全文，只导可对账字段；上限 5000 条防内存爆 */
export function exportOrgAudit(orgId, { action, actor, from, to, q, allOrgs = false } = {}) {
  return listOrgAudit(orgId, { limit: 5000, offset: 0, action, actor, from, to, q, allOrgs }).items;
}

export function getOrgQuota(orgId) {
  const period = quotaPeriod();
  const grants = db.prepare('SELECT COALESCE(SUM(amount),0) AS amount FROM org_quota_grants WHERE org_id=? AND period=?').get(orgId, period).amount;
  const usageRows = db.prepare(`SELECT user_id,
    COALESCE(SUM(CASE WHEN status='settled' THEN amount ELSE 0 END),0) AS used,
    COALESCE(SUM(CASE WHEN status='reserved' THEN amount ELSE 0 END),0) AS reserved,
    COALESCE(SUM(CASE WHEN status='settled' THEN cost_cny ELSE 0 END),0) AS cost
    FROM quota_task_usage WHERE org_id=? AND period=? GROUP BY user_id`).all(orgId, period);
  const usageByUser = new Map(usageRows.map(row => [row.user_id, row]));
  const members = db.prepare(`SELECT u.id,u.email,m.role,COALESCE(a.amount,0) AS allocation
    FROM org_members m JOIN users u ON u.id=m.user_id
    LEFT JOIN member_quota_allocations a ON a.org_id=m.org_id AND a.user_id=m.user_id AND a.period=?
    WHERE m.org_id=? ORDER BY m.created_at`).all(period, orgId).map(member => {
    const usage = usageByUser.get(member.id) || { used: 0, reserved: 0, cost: 0 };
    return {
      ...member,
      used: usage.used,
      reserved: usage.reserved,
      costCny: Number((usage.cost || 0).toFixed(4)),
      available: Math.max(0, member.allocation - usage.used - usage.reserved),
    };
  });
  const used = usageRows.reduce((sum, row) => sum + row.used, 0);
  const reserved = usageRows.reduce((sum, row) => sum + row.reserved, 0);
  const costCny = Number(usageRows.reduce((sum, row) => sum + (row.cost || 0), 0).toFixed(4));
  const remaining = Math.max(0, grants - used - reserved);
  const memberAvailable = members.reduce((sum, member) => sum + member.available, 0);
  return { period, granted: grants, used, reserved, remaining, costCny, unallocated: Math.max(0, remaining - memberAvailable), members };
}

export function getMemberQuota(orgId, userId) {
  const summary = getOrgQuota(orgId);
  const member = summary.members.find(item => item.id === userId);
  if (!member) return null;
  return { period: summary.period, allocation: member.allocation, used: member.used, reserved: member.reserved, available: member.available };
}

export const ORG_PLANS = ['free', 'trial', 'pro', 'enterprise'];

export function setOrgPlan({ orgId, plan, actorUserId }) {
  if (!ORG_PLANS.includes(plan)) throw new Error(`套餐必须是 ${ORG_PLANS.join(' / ')} 之一`);
  const org = db.prepare("SELECT id, plan, status, trial_ends_at FROM orgs WHERE id=? AND id!='bootstrap'").get(orgId);
  if (!org) return null;
  // 新开的 trial 从当前时间重新计时 30 天；非 trial 清空到期时间
  const trialEndsAt = plan === 'trial' ? Date.now() + 30 * 86400000 : null;
  // 升级/转正式套餐时，把因试用到期而冻结的组织自动解冻（仅 expired，不动 suspended/archived）
  const unfreeze = plan !== 'trial' && effectiveOrgStatus(org) === 'expired';
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE orgs SET plan=?, trial_ends_at=? WHERE id=?').run(plan, trialEndsAt, orgId);
    if (unfreeze) {
      db.prepare("UPDATE orgs SET status='active' WHERE id=?").run(orgId);
      recordOrgAudit({ orgId, actorUserId, action: 'organization.status_changed', target: orgId, details: { from: 'expired', to: 'active', reason: `套餐改为 ${plan}` } });
    }
    recordOrgAudit({ orgId, actorUserId, action: 'org.plan.changed', target: orgId, details: { from: org.plan, to: plan } });
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return db.prepare('SELECT id, plan, trial_ends_at FROM orgs WHERE id=?').get(orgId);
}

export function grantOrgQuota({ orgId, amount, actorUserId }) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1000000000) throw new Error('额度必须是 1 至 1,000,000,000 之间的整数点数');
  if (!db.prepare("SELECT 1 FROM orgs WHERE id=? AND id!='bootstrap'").get(orgId)) return null;
  const period = quotaPeriod();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO org_quota_grants(id,org_id,period,amount,actor_user_id,created_at) VALUES(?,?,?,?,?,?)').run(randomUUID(), orgId, period, amount, actorUserId, Date.now());
    recordOrgAudit({ orgId, actorUserId, action: 'quota.org.granted', target: orgId, details: { period, amount } });
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return getOrgQuota(orgId);
}

export function setMemberQuota({ orgId, userId, amount, actorUserId }) {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1000000000) throw new Error('成员额度须为 0 至 1,000,000,000 之间的整数点数');
  const period = quotaPeriod();
  db.exec('BEGIN IMMEDIATE');
  try {
    const summary = getOrgQuota(orgId);
    const member = summary.members.find(item => item.id === userId);
    if (!member) throw new Error('成员不存在');
    const othersAvailable = summary.members.filter(item => item.id !== userId).reduce((sum, item) => sum + item.available, 0);
    const minimum = member.used + member.reserved;
    const maximum = minimum + summary.remaining - othersAvailable;
    if (amount < minimum) throw new Error(`额度不能低于已用和预占额度（${minimum} 点）`);
    if (amount > maximum) throw new Error(`组织当前最多可分配 ${maximum} 点`);
    db.prepare(`INSERT INTO member_quota_allocations(org_id,user_id,period,amount,actor_user_id,updated_at) VALUES(?,?,?,?,?,?)
      ON CONFLICT(org_id,user_id,period) DO UPDATE SET amount=excluded.amount,actor_user_id=excluded.actor_user_id,updated_at=excluded.updated_at`)
      .run(orgId, userId, period, amount, actorUserId, Date.now());
    recordOrgAudit({ orgId, actorUserId, action: 'quota.member.allocated', target: member.email, details: { period, from: member.allocation, to: amount } });
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return getOrgQuota(orgId);
}

/**
 * 批量分配成员额度：一次事务写入，任一失败全部回滚。
 * items: [{ userId, amount }]
 */
export function setMemberQuotaBatch({ orgId, items, actorUserId }) {
  if (!Array.isArray(items) || !items.length) throw new Error('请至少选择一个成员');
  const period = quotaPeriod();
  db.exec('BEGIN IMMEDIATE');
  try {
    const summary = getOrgQuota(orgId);
    // 候选上限动态变化：按顺序模拟分配，避免「合计超出剩余额度」却只部分成功
    let remaining = summary.remaining;
    const planned = summary.members.map(item => ({ ...item }));
    const results = [];
    for (const entry of items) {
      const amount = Number(entry?.amount);
      if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1000000000) throw new Error(`成员 ${entry?.userId || ''} 的额度无效`);
      const member = planned.find(item => item.id === entry.userId);
      if (!member) throw new Error(`成员不存在：${entry.userId}`);
      const othersAvailable = planned.filter(item => item.id !== member.id).reduce((sum, item) => sum + item.available, 0);
      const minimum = member.used + member.reserved;
      const maximum = Math.max(minimum, minimum + remaining - othersAvailable);
      if (amount < minimum) throw new Error(`${member.email} 的额度不能低于已用和预占（${minimum} 点）`);
      if (amount > maximum) throw new Error(`${member.email} 最多可分配 ${maximum} 点`);
      // 释放该成员原先占用的可用额，再计新的
      remaining += member.available;
      member.allocation = amount;
      member.available = Math.max(0, amount - member.used - member.reserved);
      remaining -= member.available;
      results.push({ member, from: summary.members.find(item => item.id === member.id).allocation, to: amount });
    }
    const stmt = db.prepare(`INSERT INTO member_quota_allocations(org_id,user_id,period,amount,actor_user_id,updated_at) VALUES(?,?,?,?,?,?)
      ON CONFLICT(org_id,user_id,period) DO UPDATE SET amount=excluded.amount,actor_user_id=excluded.actor_user_id,updated_at=excluded.updated_at`);
    for (const { member, from, to } of results) {
      stmt.run(orgId, member.id, period, to, actorUserId, Date.now());
      recordOrgAudit({ orgId, actorUserId, action: 'quota.member.allocated', target: member.email, details: { period, from, to, batch: true } });
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return getOrgQuota(orgId);
}

/** 清零成员本月额度分配（仍保留已用/预占，不能清到低于已用） */
export function clearMemberQuota({ orgId, userId, actorUserId }) {
  const summary = getOrgQuota(orgId);
  const member = summary.members.find(item => item.id === userId);
  if (!member) throw new Error('成员不存在');
  if (member.used + member.reserved > 0) {
    throw new Error(`该成员本月已用 ${member.used} 点、预占 ${member.reserved} 点，不能直接清零`);
  }
  return setMemberQuota({ orgId, userId, amount: 0, actorUserId });
}

/**
 * 回收组织本月额度：写入一条负数不了——额度表 amount 有 CHECK(amount>0)，
 * 所以回收用「撤销划拨记录」实现：删除最近一条划拨，相当于减少总额。
 * 不能低于已用+预占。
 */
export function revokeOrgQuota({ orgId, amount, actorUserId }) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('回收额度必须是正整数点数');
  const period = quotaPeriod();
  db.exec('BEGIN IMMEDIATE');
  try {
    const state = orgQuotaState(orgId, period);
    const available = state.granted - state.used - state.reserved;
    if (amount > available) throw new Error(`组织当前最多可回收 ${Math.max(0, available)} 点（已用与预占不可回收）`);
    // 从最新划拨记录往前扣，必要时拆分一条记录
    let left = amount;
    const grants = db.prepare('SELECT id,amount FROM org_quota_grants WHERE org_id=? AND period=? ORDER BY created_at DESC').all(orgId, period);
    for (const grant of grants) {
      if (left <= 0) break;
      if (grant.amount <= left) {
        db.prepare('DELETE FROM org_quota_grants WHERE id=?').run(grant.id);
        left -= grant.amount;
      } else {
        db.prepare('UPDATE org_quota_grants SET amount=amount-? WHERE id=?').run(left, grant.id);
        left = 0;
      }
    }
    recordOrgAudit({ orgId, actorUserId, action: 'quota.org.revoked', target: orgId, details: { period, amount } });
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return getOrgQuota(orgId);
}

/* ===== 额度对账明细 / 导出 / 预警 ===== */

/** 额度使用明细：可选按 org / user / period / status 筛选，offset 分页 */
export function listQuotaUsage({
  orgId, userId, period, status, limit = 50, offset = 0, allOrgs = false,
} = {}) {
  const clauses = [];
  const values = [];
  if (!allOrgs) { clauses.push('q.org_id = ?'); values.push(orgId); }
  if (userId) { clauses.push('q.user_id = ?'); values.push(userId); }
  if (period) { clauses.push('q.period = ?'); values.push(period); }
  if (status) { clauses.push('q.status = ?'); values.push(status); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const size = Math.max(1, Math.min(500, Number(limit) || 50));
  const skip = Math.max(0, Number(offset) || 0);
  const rows = db.prepare(`SELECT q.task_id AS taskId,q.org_id AS orgId,o.name AS orgName,
      q.user_id AS userId,u.email AS userEmail,q.period,q.amount,q.status,q.cost_cny AS costCny,
      q.created_at AS createdAt,q.settled_at AS settledAt
    FROM quota_task_usage q
    LEFT JOIN users u ON u.id=q.user_id
    LEFT JOIN orgs o ON o.id=q.org_id
    ${where} ORDER BY q.created_at DESC LIMIT ? OFFSET ?`).all(...values, size, skip);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM quota_task_usage q ${where}`).get(...values).n || 0;
  return { items: rows.map(row => ({ ...row, costCny: Number(Number(row.costCny || 0).toFixed(4)) })), total, limit: size, offset: skip };
}

/** 额度预警：按剩余比例算出预警级别（warn ≤ 15%，critical ≤ 5%，empty 0） */
export function quotaAlerts(orgId, thresholds = { warn: 0.15, critical: 0.05 }) {
  const summary = getOrgQuota(orgId);
  const ratio = summary.granted > 0 ? summary.remaining / summary.granted : (summary.used + summary.reserved > 0 ? 0 : 1);
  let level = 'ok';
  if (summary.remaining <= 0 && (summary.used + summary.reserved) > 0) level = 'empty';
  else if (ratio <= thresholds.critical) level = 'critical';
  else if (ratio <= thresholds.warn) level = 'warn';
  const memberAlerts = summary.members
    .filter(member => member.allocation > 0)
    .map(member => {
      const memberRatio = member.allocation > 0 ? member.available / member.allocation : 1;
      let memberLevel = 'ok';
      if (member.available <= 0) memberLevel = 'empty';
      else if (memberRatio <= thresholds.critical) memberLevel = 'critical';
      else if (memberRatio <= thresholds.warn) memberLevel = 'warn';
      return { email: member.email, allocation: member.allocation, available: member.available, ratio: memberRatio, level: memberLevel };
    })
    .filter(item => item.level !== 'ok');
  return {
    period: summary.period,
    granted: summary.granted,
    used: summary.used,
    reserved: summary.reserved,
    remaining: summary.remaining,
    ratio,
    level,
    thresholds,
    members: memberAlerts,
  };
}

/** 平台级额度预警汇总：返回所有低于阈值的组织 */
export function platformQuotaAlerts(thresholds = { warn: 0.15, critical: 0.05 }) {
  const orgs = db.prepare("SELECT id,name,status FROM orgs WHERE id!='bootstrap'").all();
  const alerts = orgs.map(org => ({ ...org, ...quotaAlerts(org.id, thresholds) }))
    .filter(item => item.level !== 'ok')
    .sort((a, b) => a.ratio - b.ratio);
  return alerts;
}

/* ===== 平台用户目录（superadmin） ===== */

const isSuperadminEmail = email => config.superadminEmails.includes(String(email || '').toLowerCase());

const platformUserRow = row => ({
  id: row.id,
  email: row.email,
  role: isSuperadminEmail(row.email) ? 'superadmin' : row.role,
  orgRole: row.role,
  orgId: row.org_id,
  orgName: row.org_name,
  orgStatus: row.org_status,
  status: row.status === 'disabled' ? 'disabled' : 'active',
  lastLoginAt: row.last_login_at || null,
  lastSeenAt: row.last_seen_at || null,
  createdAt: row.created_at,
  taskCount: row.task_count || 0,
});

/**
 * 跨组织用户列表。role 可以是 superadmin / org.admin / org.reviewer / org.user。
 * 服务端真分页：role 过滤也下推 SQL（全量后再 JS 过滤会导致分页数量对不上）。
 */
export function listPlatformUsers({ role, status, orgId, query, limit = 50, offset = 0 } = {}) {
  const clauses = [];
  const values = [];
  if (orgId) { clauses.push('o.id = ?'); values.push(orgId); }
  if (status === 'active') clauses.push("u.status != 'disabled'");
  if (status === 'disabled') clauses.push("u.status = 'disabled'");
  if (query) {
    clauses.push('(lower(u.email) LIKE ? OR lower(o.name) LIKE ?)');
    const like = `%${String(query).toLowerCase()}%`;
    values.push(like, like);
  }
  // superadmin 由环境变量决定，不在库里：用邮箱白名单下推，避免取全表再筛
  if (role === 'superadmin') {
    const emails = config.superadminEmails;
    if (!emails.length) {
      const size = Math.max(1, Math.min(500, Number(limit) || 50));
      return { items: [], total: 0, limit: size, offset: Math.max(0, Number(offset) || 0) };
    }
    clauses.push(`lower(u.email) IN (${emails.map(() => '?').join(',')})`);
    values.push(...emails);
  } else if (role) {
    clauses.push('m.role = ?');
    values.push(role);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const size = Math.max(1, Math.min(500, Number(limit) || 50));
  const skip = Math.max(0, Number(offset) || 0);
  const rows = db.prepare(`SELECT u.id,u.email,u.status,u.created_at,u.last_login_at,u.last_seen_at,
    m.role,o.id AS org_id,o.name AS org_name,o.status AS org_status,
    (SELECT COUNT(*) FROM tasks t WHERE t.created_by=u.id) AS task_count
    FROM users u JOIN org_members m ON m.user_id=u.id JOIN orgs o ON o.id=m.org_id
    ${where} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`).all(...values, size, skip);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM users u JOIN org_members m ON m.user_id=u.id JOIN orgs o ON o.id=m.org_id ${where}`)
    .get(...values).n || 0;
  return { items: rows.map(platformUserRow), total, limit: size, offset: skip };
}

export function platformUserTotals() {
  const row = db.prepare(`SELECT
    (SELECT COUNT(*) FROM users) AS users,
    (SELECT COUNT(*) FROM users WHERE status='disabled') AS disabled,
    (SELECT COUNT(*) FROM org_members WHERE role='org.admin') AS org_admins,
    (SELECT COUNT(*) FROM orgs WHERE id!='bootstrap') AS organizations`).get();
  const emails = config.superadminEmails;
  const superadmins = emails.length
    ? db.prepare(`SELECT COUNT(*) AS n FROM users WHERE lower(email) IN (${emails.map(() => '?').join(',')})`).get(...emails).n || 0
    : 0;
  return {
    users: row.users || 0,
    disabled: row.disabled || 0,
    orgAdmins: row.org_admins || 0,
    superadmins,
    organizations: row.organizations || 0,
  };
}

export function setPlatformUserStatus({ userId, status, actorUserId }) {
  if (!['active', 'disabled'].includes(status)) throw new Error('账号状态无效');
  const user = db.prepare('SELECT u.id,u.email,m.org_id,m.role FROM users u LEFT JOIN org_members m ON m.user_id=u.id WHERE u.id=?').get(userId);
  if (!user) return null;
  if (isSuperadminEmail(user.email) && status === 'disabled') throw new Error('平台管理员账号不能在面板停用，请先从 SUPERADMIN_EMAILS 移除');
  db.prepare('UPDATE users SET status=? WHERE id=?').run(status, userId);
  // 停用后立即撤销所有会话
  if (status === 'disabled') db.prepare('DELETE FROM sessions WHERE user_id=?').run(userId);
  if (user.org_id) {
    recordOrgAudit({ orgId: user.org_id, actorUserId, action: status === 'disabled' ? 'user.disabled' : 'user.enabled', target: user.email });
  }
  return { id: user.id, email: user.email, status };
}

/** 强制某用户的全部会话失效 */
export function revokeUserSessions({ userId, actorUserId = null }) {
  const user = db.prepare('SELECT u.id,u.email,m.org_id FROM users u LEFT JOIN org_members m ON m.user_id=u.id WHERE u.id=?').get(userId);
  if (!user) return null;
  const result = db.prepare('DELETE FROM sessions WHERE user_id=?').run(userId);
  if (user.org_id) recordOrgAudit({ orgId: user.org_id, actorUserId, action: 'user.sessions_revoked', target: user.email });
  return { id: user.id, email: user.email, sessions: Number(result.changes || 0) };
}

/* ===== 组织设置（org.admin） ===== */

export function getOrganizationProfile(orgId) {
  const org = db.prepare("SELECT id,name,status,created_at FROM orgs WHERE id=? AND id!='bootstrap'").get(orgId);
  if (!org) return null;
  const memberCount = db.prepare('SELECT COUNT(*) AS n FROM org_members WHERE org_id=?').get(orgId).n || 0;
  const admin = db.prepare("SELECT u.email FROM org_members m JOIN users u ON u.id=m.user_id WHERE m.org_id=? AND m.role='org.admin' ORDER BY m.created_at LIMIT 1").get(orgId);
  return { id: org.id, name: org.name, status: org.status, createdAt: org.created_at, memberCount, adminEmail: admin?.email || null };
}

export function renameOrganization({ orgId, name, actorUserId }) {
  const orgName = String(name || '').trim();
  if (!orgName || orgName.length > 80) throw new Error('组织名称须为 1 至 80 个字符');
  const org = db.prepare("SELECT name FROM orgs WHERE id=? AND id!='bootstrap'").get(orgId);
  if (!org) return null;
  if (org.name === orgName) return getOrganizationProfile(orgId);
  db.prepare('UPDATE orgs SET name=? WHERE id=?').run(orgName, orgId);
  recordOrgAudit({ orgId, actorUserId, action: 'organization.renamed', target: orgName, details: { from: org.name, to: orgName } });
  return getOrganizationProfile(orgId);
}

/** Org 级用量与任务汇总（管理面板“用量与任务”） */
export function orgUsageSummary(days = 30) {
  const from = Date.now() - Math.max(1, Math.min(90, Number(days) || 30)) * 86400000;
  const orgId = currentOrgId();
  const admin = currentRole() !== 'org.user';
  const ownerClause = admin ? '' : ' AND created_by = ?';
  const ownerArg = admin ? [] : [currentUserId()];
  const taskRow = db.prepare(`SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) AS done,
    SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
    SUM(CASE WHEN status IN ('queued','running') THEN 1 ELSE 0 END) AS running
    FROM tasks WHERE org_id=? AND created_at>=?${ownerClause}`).get(orgId, from, ...ownerArg);
  const callRow = db.prepare(`SELECT
    COUNT(*) AS calls,
    COALESCE(SUM(total_tokens),0) AS tokens,
    COALESCE(SUM(cost_cny),0) AS cost
    FROM ai_calls WHERE org_id=? AND created_at>=?${ownerClause}`).get(orgId, from, ...ownerArg);
  const recent = db.prepare(`SELECT t.id,t.type,t.status,t.prompt,t.created_at,t.cost_ms,u.email AS user_email
    FROM tasks t LEFT JOIN users u ON u.id=t.created_by
    WHERE t.org_id=? AND t.created_at>=?${admin ? '' : ' AND t.created_by=?'}
    ORDER BY t.created_at DESC LIMIT 12`).all(orgId, from, ...ownerArg);
  return {
    days: Number(days) || 30,
    tasks: {
      total: taskRow.total || 0,
      done: taskRow.done || 0,
      failed: taskRow.failed || 0,
      running: taskRow.running || 0,
    },
    calls: {
      calls: callRow.calls || 0,
      tokens: callRow.tokens || 0,
      cost: Number((callRow.cost || 0).toFixed(4)),
    },
    recent: recent.map(row => ({
      id: row.id,
      type: row.type,
      status: row.status,
      prompt: row.prompt,
      costMs: row.cost_ms,
      createdAt: row.created_at,
      userEmail: row.user_email,
    })),
  };
}

export function registerFile(path, orgId = scoped() || 'bootstrap') {
  db.prepare('INSERT OR REPLACE INTO file_owners(path, org_id, created_by) VALUES (?, ?, ?)').run(path, orgId, currentUserId());
}

export function registerTaskFile(taskId, path) {
  const row = db.prepare('SELECT org_id FROM tasks WHERE id = ?').get(taskId);
  if (row && path) db.prepare('INSERT OR REPLACE INTO file_owners(path, org_id, created_by) VALUES (?, ?, ?)').run(path, row.org_id, row.created_by);
}

export function canAccessFile(path, orgId, userId = currentUserId(), role = currentRole()) {
  const ownerFilter = role === 'org.user' ? ' AND created_by = ?' : '';
  const args = [path, orgId];
  if (role === 'org.user') args.push(userId);
  args.push(path, orgId);
  if (role === 'org.user') args.push(userId);
  return Boolean(db.prepare(`SELECT 1 FROM file_owners WHERE path = ? AND org_id = ?${ownerFilter}
    UNION SELECT 1 FROM tasks WHERE local_path = ? AND org_id = ?${ownerFilter} LIMIT 1`).get(...args));
}

/* ===== 成员提交内容审核队列 ===== */

function seedReviewsForOrg(orgId) {
  if (!orgId) return;
  const count = db.prepare('SELECT COUNT(*) AS n FROM member_reviews WHERE org_id=?').get(orgId).n;
  if (count > 0) return;
  const member = db.prepare(`
    SELECT u.id, u.email FROM org_members m JOIN users u ON u.id = m.user_id
    WHERE m.org_id=? AND m.role='org.user' ORDER BY m.created_at LIMIT 1
  `).get(orgId);
  const submitterId = member?.id || null;
  const submitterEmail = member?.email || 'member@huimeng.demo';
  const now = Date.now();
  const samples = [
    ['《雨巷迷踪》第1季', '林知夏 · 雨夜定妆三视图', 'asset', '已完成暗调光影重绘，锁定金丝边眼镜与风衣细节，申请入库。', 'pending', now - 25 * 60000],
    ['《雨巷迷踪》第1季', 'EP01 镜头 03 · 怀表特写成片', 'video', '5s 高清视频已生成（Seedance 1.5 Pro），冷暖对比与雨滴反射已校准。', 'pending', now - 90 * 60000],
    ['《济世堂秘闻》先导片', '药铺内景 · 烛火氛围图', 'asset', '古风木质药柜与青烟光束构图，等待审核确认风格一致性。', 'pending', now - 3 * 3600000],
    ['《长夜将明》第1季', 'EP01 分镜剧本 · 停电的夜', 'script', '完成 3 场 14 镜拆解与动捕动作标记，提交审核锁版。', 'approved', now - 24 * 3600000],
  ];
  const stmt = db.prepare(`INSERT INTO member_reviews
    (id, org_id, project_name, title, category, submitted_by, submitted_email, summary, status, reviewer_id, reviewer_email, review_note, created_at, reviewed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const [projectName, title, category, summary, status, createdAt] of samples) {
    stmt.run(
      randomUUID(), orgId, projectName, title, category, submitterId, submitterEmail, summary, status,
      null, status === 'approved' ? 'system@huimeng.demo' : null,
      status === 'approved' ? '分镜结构清晰，准予进入资产阶段' : null,
      createdAt, status === 'approved' ? createdAt + 1800000 : null
    );
  }
}

export function listMemberReviews({ orgId, status = 'all', allOrgs = false } = {}) {
  if (!allOrgs && orgId) seedReviewsForOrg(orgId);
  const where = [];
  const args = [];
  if (!allOrgs && orgId) {
    where.push('r.org_id = ?');
    args.push(orgId);
  }
  if (status && status !== 'all') {
    where.push('r.status = ?');
    args.push(status);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const items = db.prepare(`
    SELECT r.*, o.name AS org_name
    FROM member_reviews r
    LEFT JOIN orgs o ON o.id = r.org_id
    ${clause}
    ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.created_at DESC
    LIMIT 100
  `).all(...args);
  const countClause = !allOrgs && orgId ? 'WHERE org_id = ?' : '';
  const countArgs = !allOrgs && orgId ? [orgId] : [];
  const counts = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) AS rejected
    FROM member_reviews ${countClause}
  `).get(...countArgs);
  return { items, counts };
}

export function createMemberReview({ orgId, projectName, title, category = 'asset', summary = '', actorUserId, actorEmail }) {
  const cleanTitle = String(title || '').trim();
  if (!cleanTitle) throw new Error('请填写审核标题');
  const id = randomUUID();
  const now = Date.now();
  db.prepare(`INSERT INTO member_reviews
    (id, org_id, project_name, title, category, submitted_by, submitted_email, summary, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`)
    .run(id, orgId, String(projectName || '未命名项目').trim(), cleanTitle, category, actorUserId || null, actorEmail || '', String(summary || '').trim(), now);
  recordOrgAudit({ orgId, actorUserId, action: 'review.submitted', target: cleanTitle, details: { category } });
  return db.prepare('SELECT * FROM member_reviews WHERE id=?').get(id);
}

export function decideMemberReview({ id, orgId, allOrgs = false, action, note = '', actorUserId, actorEmail }) {
  if (!['approve', 'reject'].includes(action)) throw new Error('审核动作无效');
  const row = allOrgs
    ? db.prepare('SELECT * FROM member_reviews WHERE id=?').get(id)
    : db.prepare('SELECT * FROM member_reviews WHERE id=? AND org_id=?').get(id, orgId);
  if (!row) return null;
  const nextStatus = action === 'approve' ? 'approved' : 'rejected';
  const now = Date.now();
  db.prepare(`UPDATE member_reviews
    SET status=?, reviewer_id=?, reviewer_email=?, review_note=?, reviewed_at=?
    WHERE id=?`)
    .run(nextStatus, actorUserId || null, actorEmail || '', String(note || '').trim() || null, now, id);
  recordOrgAudit({
    orgId: row.org_id,
    actorUserId,
    action: action === 'approve' ? 'review.approved' : 'review.rejected',
    target: row.title,
    details: { note: String(note || '').trim() || undefined },
  });
  return db.prepare('SELECT r.*, o.name AS org_name FROM member_reviews r LEFT JOIN orgs o ON o.id = r.org_id WHERE r.id=?').get(id);
}
