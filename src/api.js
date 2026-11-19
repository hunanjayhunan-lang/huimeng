// 前端统一走 /api（vite 已代理到 http://127.0.0.1:3001）
const BASE = '/api';

const token = () => {
  try {
    return localStorage.getItem('huimeng_token') || '';
  } catch {
    return '';
  }
};

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const auth = token();
  if (auth) headers.Authorization = `Bearer ${auth}`;

  let response;
  try {
    response = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error('连不上后台，确认已经执行 pnpm server');
  }

  if (response.status === 204) return null;

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`后台返回了非 JSON 内容（HTTP ${response.status}）`);
    }
  }
  if (!response.ok) throw new Error(data?.error || `请求失败（HTTP ${response.status}）`);
  return data;
}

export const api = {
  register: (email, password, orgName) => request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, orgName }) }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  session: () => request('/auth/session'),
  platformOverview: () => request('/platform/overview'),
  grantOrgQuota: (id, amount) => request(`/platform/orgs/${encodeURIComponent(id)}/quota`, { method: 'POST', body: JSON.stringify({ amount }) }),
  logout: () => request('/auth/session', { method: 'DELETE' }),
  platformOrganizations: () => request('/platform/orgs'),
  // 平台用户目录（superadmin）
  platformUsers: ({ role, status, orgId, q } = {}) => {
    const query = new URLSearchParams();
    if (role) query.set('role', role);
    if (status) query.set('status', status);
    if (orgId) query.set('orgId', orgId);
    if (q) query.set('q', q);
    return request(`/platform/users${query.size ? `?${query}` : ''}`);
  },
  setPlatformUserStatus: (id, status) => request(`/platform/users/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  revokePlatformUserSessions: id => request(`/platform/users/${encodeURIComponent(id)}/revoke-sessions`, { method: 'POST' }),
  // 组织设置（org.admin）
  orgProfile: () => request('/org/profile'),
  renameOrg: name => request('/org/profile', { method: 'PATCH', body: JSON.stringify({ name }) }),
  orgOptions: () => request('/org/options'),
  orgUsage: (days = 30) => request(`/org/usage?days=${days}`),
  createPlatformOrg: (name, adminEmail) => request('/platform/orgs', { method: 'POST', body: JSON.stringify({ name, adminEmail }) }),
  setPlatformOrgStatus: (id, status) => request(`/platform/orgs/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  setPlatformOrgPlan: (id, plan) => request(`/platform/orgs/${encodeURIComponent(id)}/plan`, { method: 'PATCH', body: JSON.stringify({ plan }) }),
  setPlatformOrgAdmin: (id, email) => request(`/platform/orgs/${encodeURIComponent(id)}/admin`, { method: 'PATCH', body: JSON.stringify({ email }) }),
  acceptInvite: (token, email, password) => request('/auth/accept-invite', { method: 'POST', body: JSON.stringify({ token, email, password }) }),
  orgMembers: () => request('/org/members'),
  orgInvites: () => request('/org/invites'),
  inviteMember: (email, role) => request('/org/invites', { method: 'POST', body: JSON.stringify({ email, role }) }),
  resendInvite: id => request(`/org/invites/${encodeURIComponent(id)}/resend`, { method: 'POST' }),
  revokeInvite: id => request(`/org/invites/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  setMemberRole: (id, role) => request(`/org/members/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  removeMember: id => request(`/org/members/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  orgAudit: (limit = 100) => request(`/org/audit?limit=${limit}`),
  orgQuota: () => request('/org/quota'),
  setMemberQuota: (id, amount) => request(`/org/members/${encodeURIComponent(id)}/quota`, { method: 'PUT', body: JSON.stringify({ amount }) }),
  health: () => request('/health'),
  config: () => request('/config'),
  stats: () => request('/stats'),
  createTask: body => request('/tasks', { method: 'POST', body: JSON.stringify(body) }),
  listTasks: ({ status, projectId, limit = 50, offset = 0 } = {}) => {
    const query = new URLSearchParams({ limit, offset });
    if (status) query.set('status', status);
    if (projectId) query.set('projectId', projectId);
    return request(`/tasks?${query.toString()}`);
  },
  getTask: id => request(`/tasks/${id}`),
  retryTask: id => request(`/tasks/${id}/retry`, { method: 'POST' }),
  deleteTask: id => request(`/tasks/${id}`, { method: 'DELETE' }),

  // 通用文档：scripts / projects / canvases / breakdowns
  list: (kind, limit = 100, projectId) => request(`/documents/${kind}?limit=${limit}${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ''}`),
  create: (kind, body) => request(`/documents/${kind}`, { method: 'POST', body: JSON.stringify(body) }),
  patch: (kind, id, body) => request(`/documents/${kind}/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (kind, id) => request(`/documents/${kind}/${id}`, { method: 'DELETE' }),

  // 剧本
  listScripts: projectId => request(`/scripts${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`),
  createScript: body => request('/scripts', { method: 'POST', body: JSON.stringify(body) }),

  // 智能体
  listMessages: skill => request(`/agent/messages?skill=${encodeURIComponent(skill)}`),
  sendMessage: (skill, text) => request('/agent/messages', { method: 'POST', body: JSON.stringify({ skill, text }) }),

  // 生产报表
  report: (days = 30) => request(`/report?days=${days}`),
  // AI：剧本拆分镜 / 拆解分析
  splitScript: id => request(`/scripts/${id}/split`, { method: 'POST' }),
  analyzeBreakdown: id => request(`/breakdowns/${id}/analyze`, { method: 'POST' }),
  // 调用追踪 / Tracing
  tracingSummary: (days = 7, orgId) => request(`/tracing/summary?days=${days}${orgId ? `&orgId=${encodeURIComponent(orgId)}` : ''}`),
  tracingCalls: (limit = 60, orgId) => request(`/tracing/calls?limit=${limit}${orgId ? `&orgId=${encodeURIComponent(orgId)}` : ''}`),
  tracingTasks: (limit = 20, orgId, cursor) => request(`/tracing/tasks?limit=${limit}${orgId ? `&orgId=${encodeURIComponent(orgId)}` : ''}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`),
  tracingTask: (id, orgId) => request(`/tracing/tasks/${id}${orgId ? `?orgId=${encodeURIComponent(orgId)}` : ''}`),

  // 画布流水线：剧本拆解（含时间戳/角色）+ 多段拼接
  pipelineSplit: body => request('/pipeline/split', { method: 'POST', body: JSON.stringify(body) }),
  pipelineConcat: body => request('/pipeline/concat', { method: 'POST', body: JSON.stringify(body) }),

  // 分发：抖音 → 小红书草稿（半自动，人工确认发布）
  distributeList: (status = '') => request(`/distribute/drafts${status ? `?status=${status}` : ''}`),
  distributeCreate: body => request('/distribute/drafts', { method: 'POST', body: JSON.stringify(body) }),
  distributeRewrite: id => request(`/distribute/drafts/${id}/rewrite`, { method: 'POST' }),
  distributePatch: (id, body) => request(`/distribute/drafts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  distributeRemove: id => request(`/distribute/drafts/${id}`, { method: 'DELETE' }),
  distributeUpload: async file => {
    const headers = { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) };
    const auth = token();
    if (auth) headers.Authorization = `Bearer ${auth}`;
    const response = await fetch('/api/distribute/upload', { method: 'POST', body: file, headers });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) throw new Error(data?.error || `上传失败（HTTP ${response.status}）`);
    return data;
  },
};

export const setToken = value => {
  try {
    if (value) localStorage.setItem('huimeng_token', value);
    else localStorage.removeItem('huimeng_token');
  } catch {
    /* 隐私模式下忽略 */
  }
};

export default api;
