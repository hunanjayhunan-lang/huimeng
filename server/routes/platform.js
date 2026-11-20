import { Router } from 'express';
import { grantOrgQuota, platformMetrics, platformOverview, setOrgPlan, setOrganizationStatus } from '../db.js';
import { requirePermission } from '../permissions.js';

const router = Router();

router.get('/platform/overview', requirePermission('platform.view'), (req, res) => res.json(platformOverview()));

/** 运营看板：活跃度 / 留存 / 套餐转化 / 消耗趋势（全部真数据） */
router.get('/platform/metrics', requirePermission('platform.metrics.view'), (req, res) => {
  return res.json(platformMetrics({ days: Number(req.query.days) || 30 }));
});

router.post('/platform/orgs/:orgId/quota', requirePermission('platform.quota.grant'), (req, res) => {
  try {
    const quota = grantOrgQuota({ orgId: req.params.orgId, amount: req.body?.amount, actorUserId: req.user.id });
    if (!quota) return res.status(404).json({ error: '组织不存在' });
    return res.status(201).json(quota);
  } catch (error) { return res.status(400).json({ error: error.message }); }
});

router.patch('/platform/orgs/:orgId/plan', requirePermission('platform.plan.manage'), (req, res) => {
  try {
    const org = setOrgPlan({ orgId: req.params.orgId, plan: req.body?.plan, actorUserId: req.user.id });
    if (!org) return res.status(404).json({ error: '组织不存在' });
    return res.json(org);
  } catch (error) { return res.status(400).json({ error: error.message }); }
});

/**
 * 归档 Org（软删除）：不物理删数据，只把 status 设为 archived。
 * 归档后成员会话全部剔除、不能登录、业务接口一律 403；
 * 数据（项目/剧本/任务/文件）全部保留，便于恢复与事后取证。
 */
router.delete('/platform/orgs/:orgId', requirePermission('platform.org.delete'), (req, res) => {
  try {
    const org = setOrganizationStatus({ orgId: req.params.orgId, actorUserId: req.user.id, status: 'archived' });
    if (!org) return res.status(404).json({ error: '组织不存在' });
    return res.json({ ...org, note: '已归档：数据保留，可通过 PATCH status=active 恢复' });
  } catch (error) { return res.status(400).json({ error: error.message }); }
});

/** 恢复已归档/停用的组织 */
router.post('/platform/orgs/:orgId/restore', requirePermission('platform.org.delete'), (req, res) => {
  try {
    const org = setOrganizationStatus({ orgId: req.params.orgId, actorUserId: req.user.id, status: 'active' });
    if (!org) return res.status(404).json({ error: '组织不存在' });
    return res.json(org);
  } catch (error) { return res.status(400).json({ error: error.message }); }
});

export default router;
