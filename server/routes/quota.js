import { Router } from 'express';
import {
  clearMemberQuota,
  getMemberQuota,
  getOrgQuota,
  listQuotaUsage,
  quotaAlerts,
  revokeOrgQuota,
  setMemberQuota,
  setMemberQuotaBatch,
} from '../db.js';
import { hasPermission, requirePermission } from '../permissions.js';

const router = Router();

router.get('/org/quota', (req, res) => {
  if (hasPermission(req.role, 'org.quota.allocate')) {
    return res.json({ ...getOrgQuota(req.org.id), alerts: quotaAlerts(req.org.id) });
  }
  const quota = getMemberQuota(req.org.id, req.user.id);
  return quota ? res.json(quota) : res.status(404).json({ error: '成员不存在' });
});

/** 额度预警：组织 + 成员两级阈值 */
router.get('/org/quota/alerts', requirePermission('org.quota.allocate'), (req, res) => {
  const warn = Number(req.query.warn);
  const critical = Number(req.query.critical);
  const thresholds = {
    warn: Number.isFinite(warn) && warn > 0 && warn <= 1 ? warn : 0.15,
    critical: Number.isFinite(critical) && critical > 0 && critical <= 1 ? critical : 0.05,
  };
  return res.json(quotaAlerts(req.org.id, thresholds));
});

/** 额度使用明细：对账用 */
router.get('/org/quota/usage', requirePermission('org.quota.allocate'), (req, res) => {
  return res.json(listQuotaUsage({
    orgId: req.org.id,
    userId: typeof req.query.userId === 'string' && req.query.userId ? req.query.userId : undefined,
    period: typeof req.query.period === 'string' && req.query.period ? req.query.period : undefined,
    status: typeof req.query.status === 'string' && req.query.status ? req.query.status : undefined,
    limit: Number(req.query.limit) || 50,
    offset: Number(req.query.offset) || 0,
  }));
});

/** 额度明细导出 CSV */
router.get('/org/quota/export', requirePermission('org.quota.allocate'), (req, res) => {
  const { items } = listQuotaUsage({
    orgId: req.org.id,
    userId: typeof req.query.userId === 'string' && req.query.userId ? req.query.userId : undefined,
    period: typeof req.query.period === 'string' && req.query.period ? req.query.period : undefined,
    status: typeof req.query.status === 'string' && req.query.status ? req.query.status : undefined,
    limit: 5000,
    offset: 0,
  });
  const cell = value => {
    const text = value == null ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const header = ['结算时间', '成员', '期间', '积分', '状态', '实际成本(元)', '任务ID'];
  const lines = items.map(row => [
    row.settledAt || row.createdAt ? new Date(row.settledAt || row.createdAt).toISOString() : '',
    row.userEmail || '', row.period || '', row.amount ?? '', row.status || '',
    row.costCny ?? '', row.taskId || '',
  ].map(cell).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="quota-usage-${Date.now()}.csv"`);
  return res.send(`\uFEFF${header.join(',')}\n${lines.join('\n')}`);
});

router.put('/org/members/:userId/quota', requirePermission('org.quota.allocate'), (req, res) => {
  try {
    const quota = setMemberQuota({ orgId: req.org.id, userId: req.params.userId, amount: req.body?.amount, actorUserId: req.user.id });
    return res.json(quota);
  } catch (error) { return res.status(error.message === '成员不存在' ? 404 : 400).json({ error: error.message }); }
});

/** 批量分配：{ items: [{ userId, amount }] } */
router.put('/org/quota/members', requirePermission('org.quota.allocate'), (req, res) => {
  try {
    return res.json(setMemberQuotaBatch({ orgId: req.org.id, items: req.body?.items, actorUserId: req.user.id }));
  } catch (error) { return res.status(400).json({ error: error.message }); }
});

/** 清零单个成员额度 */
router.post('/org/members/:userId/quota/clear', requirePermission('org.quota.allocate'), (req, res) => {
  try {
    return res.json(clearMemberQuota({ orgId: req.org.id, userId: req.params.userId, actorUserId: req.user.id }));
  } catch (error) { return res.status(400).json({ error: error.message }); }
});

/** 回收组织额度（不能回收已用/预占部分） */
router.post('/org/quota/revoke', requirePermission('org.quota.allocate'), (req, res) => {
  try {
    return res.json(revokeOrgQuota({ orgId: req.org.id, amount: req.body?.amount, actorUserId: req.user.id }));
  } catch (error) { return res.status(400).json({ error: error.message }); }
});

export default router;
