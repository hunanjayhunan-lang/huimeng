import { Router } from 'express';
import { orgUsageSummary } from '../db.js';

const router = Router();

/** 组织用量与任务汇总：给「用量与任务」面板用 */
router.get('/org/usage', (req, res) => {
  const days = Math.max(1, Math.min(90, Number(req.query.days) || 30));
  return res.json(orgUsageSummary(days));
});

export default router;
