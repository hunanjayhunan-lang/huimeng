import { Router } from 'express';
import { acceptOrgInvite, changeOrgMemberRole, createAccount, createOrgInvite, createOrganization, deleteSession, getSession, listOrgAudit, listOrgInvites, listOrgMembers, listOrganizations, loginAccount, platformOverview, removeOrgMember, resendOrgInvite, revokeOrgInvite, setOrganizationAdmin, setOrganizationStatus } from '../db.js';
import { permissionList, requirePermission } from '../permissions.js';

const router = Router();
const bearer = req => (req.get('authorization') || '').replace(/^Bearer\s+/i, '') ||
  (req.headers.cookie || '').split('; ').find(value => value.startsWith('huimeng_session='))?.slice('huimeng_session='.length) || '';
const handle = fn => (req, res) => {
  try {
    const result = fn(req.body || {});
    if (result.token) res.cookie('huimeng_session', result.token, { httpOnly: true, sameSite: 'strict', secure: req.secure, maxAge: 30 * 86400000, path: '/api' });
    return res.json(withPermissions(result));
  } catch (error) {
    return res.status(error.message.includes('已注册') ? 409 : error.status || 400).json({ error: error.message });
  }
};
const setSessionCookie = (req, res, token) => res.cookie('huimeng_session', token, { httpOnly: true, sameSite: 'strict', secure: req.secure, maxAge: 30 * 86400000, path: '/api' });
// 给会话补上当前角色的权限清单，前端据此决定按钮显隐
const withPermissions = result => result && ({ ...result, permissions: permissionList(result.role) });

router.post('/auth/register', handle(createAccount));
router.post('/auth/login', handle(loginAccount));
router.post('/auth/accept-invite', (req, res) => {
  try {
    const result = acceptOrgInvite(req.body || {});
    setSessionCookie(req, res, result.token);
    return res.status(201).json(withPermissions(result));
  } catch (error) { return res.status(400).json({ error: error.message }); }
});
router.get('/auth/session', (req, res) => {
  const session = getSession(bearer(req));
  if (!session) return res.status(401).json({ error: '登录已失效' });
  return res.json(withPermissions(session));
});
router.delete('/auth/session', (req, res) => {
  deleteSession(bearer(req));
  res.clearCookie('huimeng_session', { httpOnly: true, sameSite: 'strict', path: '/api' });
  res.status(204).end();
});

router.get('/platform/overview', requirePermission('platform.view'), (req, res) => res.json(platformOverview()));
router.get('/platform/orgs', requirePermission('platform.view'), (req, res) => res.json({ items: listOrganizations() }));
router.post('/platform/orgs', requirePermission('platform.org.manage'), (req, res) => {
  try {
    const result = createOrganization({ ...req.body, actorUserId: req.user.id });
    return res.status(201).json({ ...result, invitePath: `/invite?token=${encodeURIComponent(result.invite.token)}` });
  } catch (error) { return res.status(400).json({ error: error.message }); }
});
router.patch('/platform/orgs/:id/status', requirePermission('platform.org.manage'), (req, res) => {
  try {
    const org = setOrganizationStatus({ orgId: req.params.id, actorUserId: req.user.id, status: req.body?.status });
    return org ? res.json(org) : res.status(404).json({ error: '组织不存在' });
  } catch (error) { return res.status(400).json({ error: error.message }); }
});
router.patch('/platform/orgs/:id/admin', requirePermission('platform.org.manage'), (req, res) => {
  try { return res.json(setOrganizationAdmin({ orgId: req.params.id, actorUserId: req.user.id, email: req.body?.email })); }
  catch (error) { return res.status(400).json({ error: error.message }); }
});

router.get('/org/members', requirePermission('org.member.manage'), (req, res) => res.json({ items: listOrgMembers(req.org.id) }));
router.get('/org/invites', requirePermission('org.member.manage'), (req, res) => res.json({ items: listOrgInvites(req.org.id) }));
router.post('/org/invites', requirePermission('org.member.manage'), (req, res) => {
  try {
    const invite = createOrgInvite({ orgId: req.org.id, actorUserId: req.user.id, email: req.body?.email, role: req.body?.role || 'org.user' });
    res.status(201).json({ ...invite, invitePath: `/invite?token=${encodeURIComponent(invite.token)}` });
  } catch (error) { res.status(400).json({ error: error.message }); }
});
router.post('/org/invites/:id/resend', requirePermission('org.member.manage'), (req, res) => {
  const invite = resendOrgInvite({ orgId: req.org.id, actorUserId: req.user.id, inviteId: req.params.id });
  if (!invite) return res.status(404).json({ error: '邀请不存在' });
  return res.json({ ...invite, invitePath: `/invite?token=${encodeURIComponent(invite.token)}` });
});
router.delete('/org/invites/:id', requirePermission('org.member.manage'), (req, res) => {
  if (!revokeOrgInvite({ orgId: req.org.id, actorUserId: req.user.id, inviteId: req.params.id })) return res.status(404).json({ error: '邀请不存在' });
  return res.status(204).end();
});
router.patch('/org/members/:id', requirePermission('org.member.manage'), (req, res) => {
  try {
    if (!changeOrgMemberRole({ orgId: req.org.id, actorUserId: req.user.id, userId: req.params.id, role: req.body?.role })) return res.status(404).json({ error: '成员不存在' });
    return res.json({ ok: true });
  } catch (error) { return res.status(409).json({ error: error.message }); }
});
router.delete('/org/members/:id', requirePermission('org.member.manage'), (req, res) => {
  try {
    if (!removeOrgMember({ orgId: req.org.id, actorUserId: req.user.id, userId: req.params.id })) return res.status(404).json({ error: '成员不存在' });
    return res.status(204).end();
  } catch (error) { return res.status(409).json({ error: error.message }); }
});
router.get('/org/audit', requirePermission('org.audit.view'), (req, res) => {
  const result = listOrgAudit(req.org.id, {
    limit: Number(req.query.limit) || 50,
    offset: Number(req.query.offset) || 0,
    action: typeof req.query.action === 'string' && req.query.action ? req.query.action : undefined,
    actor: typeof req.query.actor === 'string' && req.query.actor ? req.query.actor : undefined,
    from: req.query.from ? Number(req.query.from) : undefined,
    to: req.query.to ? Number(req.query.to) : undefined,
    q: typeof req.query.q === 'string' && req.query.q ? req.query.q : undefined,
  });
  return res.json(result);
});

router.get('/org/audit/export', requirePermission('org.audit.view'), (req, res) => {
  const rows = listOrgAudit(req.org.id, {
    limit: 5000, offset: 0,
    action: typeof req.query.action === 'string' && req.query.action ? req.query.action : undefined,
    actor: typeof req.query.actor === 'string' && req.query.actor ? req.query.actor : undefined,
    from: req.query.from ? Number(req.query.from) : undefined,
    to: req.query.to ? Number(req.query.to) : undefined,
    q: typeof req.query.q === 'string' && req.query.q ? req.query.q : undefined,
  }).items;
  const cell = value => {
    const text = value == null ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const header = ['时间', '组织', '动作', '对象', '操作人', '详情'];
  const lines = rows.map(row => [
    new Date(row.createdAt).toISOString(), row.orgName || '', row.action || '',
    row.target || '', row.actorEmail || '', row.details ? JSON.stringify(row.details) : '',
  ].map(cell).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="org-audit-${Date.now()}.csv"`);
  return res.send(`\uFEFF${header.join(',')}\n${lines.join('\n')}`);
});

export default router;
