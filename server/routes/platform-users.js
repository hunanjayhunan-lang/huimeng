import { Router } from 'express';
import {
  getOrganizationProfile,
  listOrgAudit,
  listPlatformUsers,
  listOrganizations,
  platformUserTotals,
  renameOrganization,
  revokeUserSessions,
  setPlatformUserStatus,
} from '../db.js';
import { requirePermission } from '../permissions.js';

const router = Router();

const csvCell = value => {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const toCsv = rows => {
  const header = ['时间', '组织', '动作', '对象', '操作人', '详情'];
  const lines = rows.map(row => [
    new Date(row.createdAt).toISOString(),
    row.orgName || '',
    row.action || '',
    row.target || '',
    row.actorEmail || '',
    row.details ? JSON.stringify(row.details) : '',
  ].map(csvCell).join(','));
  // BOM 让 Excel 正确识别 UTF-8
  return `\uFEFF${header.join(',')}\n${lines.join('\n')}`;
};
const sendCsv = (res, filename, csv) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
};
const auditFilters = req => ({
  action: typeof req.query.action === 'string' && req.query.action ? req.query.action : undefined,
  actor: typeof req.query.actor === 'string' && req.query.actor ? req.query.actor : undefined,
  from: req.query.from ? Number(req.query.from) : undefined,
  to: req.query.to ? Number(req.query.to) : undefined,
  q: typeof req.query.q === 'string' && req.query.q ? req.query.q : undefined,
});

/* ===== 平台用户目录（superadmin） ===== */

router.get('/platform/users', requirePermission('platform.user.manage'), (req, res) => {
  const result = listPlatformUsers({
    role: typeof req.query.role === 'string' && req.query.role ? req.query.role : undefined,
    status: typeof req.query.status === 'string' && req.query.status ? req.query.status : undefined,
    orgId: typeof req.query.orgId === 'string' && req.query.orgId ? req.query.orgId : undefined,
    query: typeof req.query.q === 'string' ? req.query.q : undefined,
    limit: Number(req.query.limit) || 50,
    offset: Number(req.query.offset) || 0,
  });
  return res.json({ ...result, totals: platformUserTotals() });
});

router.patch('/platform/users/:id/status', requirePermission('platform.user.manage'), (req, res) => {
  try {
    const user = setPlatformUserStatus({ userId: req.params.id, status: req.body?.status, actorUserId: req.user.id });
    return user ? res.json(user) : res.status(404).json({ error: '账号不存在' });
  } catch (error) { return res.status(400).json({ error: error.message }); }
});

router.post('/platform/users/:id/revoke-sessions', requirePermission('platform.user.manage'), (req, res) => {
  const result = revokeUserSessions({ userId: req.params.id, actorUserId: req.user.id });
  return result ? res.json(result) : res.status(404).json({ error: '账号不存在' });
});

/* ===== 平台级审计（跨组织，superadmin） ===== */

router.get('/platform/audit', requirePermission('platform.view'), (req, res) => {
  const result = listOrgAudit(req.query.orgId || null, {
    limit: Number(req.query.limit) || 50,
    offset: Number(req.query.offset) || 0,
    allOrgs: !req.query.orgId,
    ...auditFilters(req),
  });
  return res.json(result);
});

router.get('/platform/audit/export', requirePermission('platform.view'), (req, res) => {
  const rows = listOrgAudit(req.query.orgId || null, {
    limit: 5000, offset: 0, allOrgs: !req.query.orgId, ...auditFilters(req),
  }).items;
  return sendCsv(res, `platform-audit-${Date.now()}.csv`, toCsv(rows));
});

/* ===== 组织设置（org.admin） ===== */

router.get('/org/profile', requirePermission('org.settings.edit'), (req, res) => {
  const profile = getOrganizationProfile(req.org.id);
  return profile ? res.json(profile) : res.status(404).json({ error: '组织不存在' });
});

router.patch('/org/profile', requirePermission('org.settings.edit'), (req, res) => {
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
