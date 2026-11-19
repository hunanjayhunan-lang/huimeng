import { Router } from 'express';
import {
  getOrganizationProfile,
  listPlatformUsers,
  listOrganizations,
  platformUserTotals,
  renameOrganization,
  revokeUserSessions,
  setPlatformUserStatus,
} from '../db.js';

const router = Router();

const requireSuperadmin = (req, res, next) => {
  if (req.role !== 'superadmin') return res.status(403).json({ error: '需要平台管理员权限' });
  next();
};
const requireOrgAdmin = (req, res, next) => {
  if (!['org.admin', 'superadmin'].includes(req.role)) return res.status(403).json({ error: '需要组织管理员权限' });
  next();
};

/* ===== 平台用户目录（superadmin） ===== */

router.get('/platform/users', requireSuperadmin, (req, res) => {
  const items = listPlatformUsers({
    role: typeof req.query.role === 'string' && req.query.role ? req.query.role : undefined,
    status: typeof req.query.status === 'string' && req.query.status ? req.query.status : undefined,
    orgId: typeof req.query.orgId === 'string' && req.query.orgId ? req.query.orgId : undefined,
    query: typeof req.query.q === 'string' ? req.query.q : undefined,
    limit: Number(req.query.limit) || 500,
  });
  return res.json({ items, totals: platformUserTotals() });
});

router.patch('/platform/users/:id/status', requireSuperadmin, (req, res) => {
  try {
    const user = setPlatformUserStatus({ userId: req.params.id, status: req.body?.status, actorUserId: req.user.id });
    return user ? res.json(user) : res.status(404).json({ error: '账号不存在' });
  } catch (error) { return res.status(400).json({ error: error.message }); }
});

router.post('/platform/users/:id/revoke-sessions', requireSuperadmin, (req, res) => {
  const result = revokeUserSessions({ userId: req.params.id, actorUserId: req.user.id });
  return result ? res.json(result) : res.status(404).json({ error: '账号不存在' });
});

/* ===== 组织设置（org.admin） ===== */

router.get('/org/profile', requireOrgAdmin, (req, res) => {
  const profile = getOrganizationProfile(req.org.id);
  return profile ? res.json(profile) : res.status(404).json({ error: '组织不存在' });
});

router.patch('/org/profile', requireOrgAdmin, (req, res) => {
  try {
    const profile = renameOrganization({ orgId: req.org.id, name: req.body?.name, actorUserId: req.user.id });
    return profile ? res.json(profile) : res.status(404).json({ error: '组织不存在' });
  } catch (error) { return res.status(400).json({ error: error.message }); }
});

/** 组织下拉选项：superadmin 看全部，org.admin 只看自己 */
router.get('/org/options', (req, res) => {
  if (req.role === 'superadmin') {
    return res.json({ items: listOrganizations().map(org => ({ id: org.id, name: org.name, status: org.status })) });
  }
  return res.json({ items: [{ id: req.org.id, name: req.org.name, status: req.org.status }] });
});

export default router;
