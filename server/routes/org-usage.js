import { Router } from 'express';
import { createMemberReview, decideMemberReview, listMemberReviews, orgUsageSummary } from '../db.js';
import { requirePermission } from '../permissions.js';

const router = Router();

/** 组织用量与任务汇总：给「用量与任务」面板用 */
router.get('/org/usage', requirePermission('org.audit.view'), (req, res) => {
  const days = Math.max(1, Math.min(90, Number(req.query.days) || 30));
  return res.json(orgUsageSummary(days));
});

/** 获取成员提交审核列表：审核员、组织管理员、平台管理员 */
router.get('/org/reviews', requirePermission('review.view'), (req, res) => {
  const status = String(req.query.status || 'all');
  const allOrgs = req.role === 'superadmin' && !req.query.orgId;
  return res.json(listMemberReviews({ orgId: req.query.orgId || req.org?.id, status, allOrgs }));
});

/** 成员提交内容进入审核队列 */
router.post('/org/reviews', requirePermission('review.submit'), (req, res) => {
  if (!req.user?.id || !req.org?.id) return res.status(401).json({ error: '请先登录' });
  try {
    const item = createMemberReview({
      orgId: req.org.id,
      projectName: req.body?.projectName,
      title: req.body?.title,
      category: req.body?.category || 'asset',
      summary: req.body?.summary || '',
      actorUserId: req.user.id,
      actorEmail: req.user.email,
    });
    return res.status(201).json(item);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

/** 审核通过或驳回 */
router.post('/org/reviews/:id/decision', requirePermission('review.decide'), (req, res) => {
  try {
    const updated = decideMemberReview({
      id: req.params.id,
      orgId: req.org?.id,
      allOrgs: req.role === 'superadmin',
      action: req.body?.action,
      note: req.body?.note || '',
      // 审核通过时同时分配积分，值由前端对话框必填。
      quota: req.body?.quota,
      actorUserId: req.user?.id,
      actorEmail: req.user?.email,
    });
    if (!updated) return res.status(404).json({ error: '审核记录不存在' });
    return res.json(updated);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

export default router;
