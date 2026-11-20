/**
 * 操作级权限。
 *
 * 角色只回答「你是哪种身份」，权限回答「这个动作你能不能做」。
 * 路由里不要再散写 `req.role !== 'org.admin'`，统一走 `requirePermission(action)`。
 *
 * 权限矩阵按「组织内是否越权」划分：
 * - 平台级动作（platform.*）：只有 superadmin。
 * - 组织管理动作（org.*）：org.admin 在自己 Org 内可做；superadmin 代管时也可做（走各自的组织上下文）。
 * - 审核动作（review.*）：org.reviewer / org.admin / superadmin。
 * - 本人动作（self.*）：任何已登录成员。
 */
import { config } from './config.js';

/** 各角色拥有的权限集合 */
export const ROLE_PERMISSIONS = {
  superadmin: [
    // 平台级
    'platform.view', 'platform.org.manage', 'platform.org.delete',
    'platform.quota.grant', 'platform.plan.manage', 'platform.user.manage',
    'platform.admin.manage', 'platform.billing.view', 'platform.metrics.view',
    // 组织级（代管）
    'org.member.manage', 'org.quota.allocate', 'org.settings.edit',
    'org.tracing.view', 'org.audit.view', 'org.project.view.all',
    // 审核
    'review.submit', 'review.decide', 'review.view',
  ],
  'org.admin': [
    'org.member.manage', 'org.quota.allocate', 'org.settings.edit',
    'org.tracing.view', 'org.audit.view', 'org.project.view.all',
    'review.submit', 'review.decide', 'review.view',
    'self.create', // 创作/出片
  ],
  'org.reviewer': [
    // 审核员：只看审核台，不管理成员/额度/设置，不参与创作出片
    'review.submit', 'review.decide', 'review.view',
  ],
  'org.user': [
    'review.submit',
    'self.create',
  ],
};

/** 判断某角色是否拥有某权限 */
export function hasPermission(role, action) {
  if (!role || !action) return false;
  return Boolean(ROLE_PERMISSIONS[role]?.includes(action));
}

/**
 * Express 中间件工厂。
 * 用法：router.get('/path', requirePermission('org.audit.view'), handler)
 */
export function requirePermission(action) {
  return (req, res, next) => {
    if (hasPermission(req.role, action)) return next();
    return res.status(403).json({ error: `权限不足：需要 ${action}` });
  };
}

/** 当前会话的有效权限清单，前端用来决定按钮显隐 */
export function permissionList(role) {
  return ROLE_PERMISSIONS[role] ? [...ROLE_PERMISSIONS[role]] : [];
}

export const isSuperadminEmail = email => config.superadminEmails.includes(String(email || '').toLowerCase());

export default { ROLE_PERMISSIONS, hasPermission, requirePermission, permissionList, isSuperadminEmail };
