import { Router } from 'express';
import { aiUsageSummary, getTask, listAiCalls, listTaskEvents, organizationExists, recentTaskTraces, stats, tracingDailySeries } from '../db.js';
import { inOrg } from '../org-context.js';
import { hasPermission } from '../permissions.js';

const router = Router();

router.use((req, res, next) => {
  if (!hasPermission(req.role, 'org.tracing.view')) return res.status(403).json({ error: '只有组织管理员可以查看调用追踪' });
  if (req.role === 'superadmin') {
    const orgId = typeof req.query.orgId === 'string' ? req.query.orgId : '';
    // 平台管理员：all / 缺省 = 跨组织查看全部；null 表示不做组织过滤
    if (!orgId || orgId === 'all') return inOrg(null, next);
    if (!organizationExists(orgId)) return res.status(404).json({ error: '组织不存在' });
    return inOrg(orgId, next);
  }
  if (req.org?.role === 'org.admin') {
    if (req.query.orgId && req.query.orgId !== req.org.id) return res.status(403).json({ error: '不能查看其他组织的追踪记录' });
  }
  return next();
});

const sinceTs = days => Date.now() - Math.max(1, Math.min(90, Number(days) || 7)) * 86400000;

/** 汇总：token 总量 / 按模型 / 按类型 */
router.get('/tracing/summary', (req, res) => {
  const days = Math.max(1, Math.min(90, Number(req.query.days) || 7));
  const summary = aiUsageSummary(sinceTs(days));
  const taskStats = stats(sinceTs(days));
  const taskTotals = {
    tasks: taskStats.total,
    done: taskStats.done,
    failed: taskStats.failed,
    running: taskStats.active,
  };
  res.json({ days, ...summary, taskTotals, series: tracingDailySeries(sinceTs(days)) });
});

/** 最近的模型调用明细 */
router.get('/tracing/calls', (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 60));
  const kind = typeof req.query.kind === 'string' && req.query.kind ? req.query.kind : undefined;
  const model = typeof req.query.model === 'string' && req.query.model ? req.query.model : undefined;
  res.json({ items: listAiCalls({ limit, kind, model }) });
});

/** 任务列表（带事件数 / 最后一个事件） */
router.get('/tracing/tasks', (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 20));
  let cursor = null;
  if (req.query.cursor) {
    try {
      cursor = JSON.parse(Buffer.from(String(req.query.cursor), 'base64url').toString('utf8'));
      if (!Number.isFinite(cursor?.at) || typeof cursor?.id !== 'string') throw new Error();
    } catch { return res.status(400).json({ error: '分页游标无效' }); }
  }
  const items = recentTaskTraces(limit + 1, cursor);
  const hasMore = items.length > limit;
  if (hasMore) items.pop();
  const last = items.at(-1);
  return res.json({ items, nextCursor: hasMore && last ? Buffer.from(JSON.stringify({ at: last.createdAt, id: last.id })).toString('base64url') : null });
});

/** 单个任务的时间线：任务本体 + 事件流 + 相关模型调用 */
router.get('/tracing/tasks/:id', (req, res) => {
  const DEMO_TRACES = new Set(['tr_8f3a1c', 'tr_8f3a2d', 'tr_8f3a4e']);
  const readTrace = () => {
    const task = getTask(req.params.id);
    if (!task) return null;
    const events = listTaskEvents(task.id);
    const calls = listAiCalls({ limit: 200 }).filter(call => call.taskId === task.id);
    return { task, events, calls };
  };
  let data = readTrace();
  if (!data && DEMO_TRACES.has(req.params.id)) {
    data = inOrg(null, readTrace);
  }
  if (!data) return res.status(404).json({ error: '任务不存在' });
  const { task, events, calls } = data;
  return res.json({
    task: {
      id: task.id,
      type: task.type,
      status: task.status,
      progress: task.progress,
      model: task.req_key,
      prompt: task.prompt,
      params: task.params,
      remoteTaskId: task.remote_task_id,
      resultUrl: task.result_url,
      localPath: task.local_path,
      error: task.error,
      costMs: task.cost_ms,
      attempts: task.attempts,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
    },
    events,
    calls,
    // 兼容：拆解记录也走这里看的话，前端只读 task 字段
    document: null,
  });
});

export default router;
