import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowRight, BarChart3, Building2, Check, CheckCircle2, ChevronDown, Clock3, Cpu, Gauge,
  HardDrive, Mail, Plus, Search, Settings, ShieldCheck, Users, Video, Wallet, X,
} from 'lucide-react';
import { api } from '../api.js';
import AdminWorkspace, { EmptyState, ErrorBanner, PanelHeading, Toast, useToast } from '../components/AdminWorkspace.jsx';
import DouyinOpsPanel from '../components/DouyinOpsPanel.jsx';
import MemberReviewPanel from '../components/MemberReviewPanel.jsx';
import TracingPage from './TracingPage.jsx';
import './AdminPage.css';

const TABS = [
  { key: 'overview', label: '概览', icon: Activity },
  { key: 'reviews', label: '内容审核', icon: CheckCircle2 },
  { key: 'members', label: '成员管理', icon: Users },
  { key: 'quota', label: '积分分配', icon: Wallet },
  { key: 'projects', label: '项目管理', icon: Video },
  { key: 'douyin', label: '抖音运营', icon: BarChart3 },
  { key: 'usage', label: '用量与任务', icon: HardDrive },
  { key: 'tracing', label: '调用追踪', icon: Cpu },
  { key: 'audit', label: '审计记录', icon: ShieldCheck },
  { key: 'settings', label: '组织设置', icon: Settings },
];
const TAB_PATHS = {
  overview: '/admin/org/overview',
  reviews: '/admin/org/reviews',
  members: '/admin/org/members',
  quota: '/admin/org/quota',
  projects: '/admin/org/projects',
  douyin: '/admin/org/douyin',
  usage: '/admin/org/usage',
  tracing: '/admin/org/tracing',
  audit: '/admin/org/audit',
  settings: '/admin/org/settings',
};
const PATH_TABS = Object.fromEntries(Object.entries(TAB_PATHS).map(([key, path]) => [path, key]));

const avatarColors = ['teal', 'rose', 'blue', 'gold'];
const count = value => Number(value || 0).toLocaleString('zh-CN');
const ROLE_NAME = { 'org.admin': '组织管理员', 'org.reviewer': '审核员', 'org.user': '组织成员' };
const projectProgress = project => Math.round(((project.stages || []).filter(Boolean).length / 3) * 100);
const projectStatus = project => (project.status === 'review' ? '待审核' : projectProgress(project) === 100 ? '已完成' : '进行中');
const projectUpdated = project => new Date(project.updatedAt || project.createdAt || Date.now()).toLocaleString('zh-CN');
const stamp = value => (value ? new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

const tabFromPath = () => {
  const path = window.location.pathname.replace(/\/+$/, '');
  return PATH_TABS[path] || 'overview';
};

export default function AdminPage({ org, user, role = 'org.admin', onLogout, onNavigate }) {
  const isReviewer = role === 'org.reviewer';
  const [tab, setTab] = useState(() => (isReviewer ? 'reviews' : tabFromPath()));
  const [toast, showToast] = useToast();
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);
  const [memberCount, setMemberCount] = useState(null);

  const changeTab = useCallback(next => {
    setTab(next);
    const path = TAB_PATHS[next];
    if (window.location.pathname !== path) window.history.pushState({ tab: '管理' }, '', path);
  }, []);

  useEffect(() => {
    const onPop = () => setTab(isReviewer ? 'reviews' : tabFromPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [isReviewer]);

  const loadProfile = useCallback(async () => {
    if (isReviewer) return;
    try {
      const [data, members] = await Promise.all([api.orgProfile(), api.orgMembers()]);
      setProfile(data);
      setMemberCount(members.items.length);
      setError('');
    } catch (err) { setError(err.message); }
  }, [isReviewer]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const visibleTabs = isReviewer ? TABS.filter(item => item.key === 'reviews') : TABS;
  const tabsWithBadge = visibleTabs.map(item => (item.key === 'members' && memberCount != null ? { ...item, badge: memberCount } : item));

  return (
    <AdminWorkspace
      workspaceIcon={Building2}
      workspaceTitle={profile?.name || org?.name || '组织'}
      workspaceSubtitle={isReviewer ? '内容审核台' : '组织工作空间'}
      tabs={tabsWithBadge}
      activeTab={tab}
      onTabChange={changeTab}
      breadcrumbParent={profile?.name || org?.name || (isReviewer ? '内容审核' : '组织管理')}
      user={user}
      org={org}
      role={role}
      onLogout={onLogout}
      onNavigate={onNavigate}
      statusText={profile?.status === 'suspended' ? '组织已停用' : '组织运行正常'}
      statusOk={profile?.status !== 'suspended'}
      searchPlaceholder={isReviewer ? '搜索审核内容…' : '搜索成员、项目或审计记录…'}
    >
      <ErrorBanner message={error} onRetry={loadProfile} />

      {!isReviewer && tab === 'overview' && <Overview profile={profile} memberCount={memberCount} onNavigate={changeTab} onToast={showToast} />}
      {tab === 'reviews' && <MemberReviewPanel onNotify={showToast} onOpenCanvas={url => onNavigate?.(url)} />}
      {!isReviewer && tab === 'members' && <Members onToast={showToast} onChanged={loadProfile} />}
      {!isReviewer && tab === 'quota' && <Quota onToast={showToast} />}
      {!isReviewer && tab === 'projects' && <Projects onToast={showToast} />}
      {!isReviewer && tab === 'douyin' && <DouyinOpsPanel onNotify={showToast} />}
      {!isReviewer && tab === 'usage' && <Usage />}
      {!isReviewer && tab === 'tracing' && <TracingPage />}
      {!isReviewer && tab === 'audit' && <Audit />}
      {!isReviewer && tab === 'settings' && <SettingsTab profile={profile} onToast={showToast} onSaved={loadProfile} />}

      <Toast message={toast} />
    </AdminWorkspace>
  );
}

/* ---------- 概览 ---------- */

function Overview({ profile, memberCount, onNavigate, onToast }) {
  const [quota, setQuota] = useState(null);
  const [usage, setUsage] = useState(null);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    api.orgQuota().then(setQuota).catch(err => onToast(err.message));
    api.orgUsage(30).then(setUsage).catch(err => onToast(err.message));
    api.list('projects').then(data => setProjects(data.items || [])).catch(err => onToast(err.message));
  }, [onToast]);

  const successRate = usage?.tasks?.total ? Math.round((usage.tasks.done / usage.tasks.total) * 100) : 0;
  const adminCount = quota?.members?.filter(member => member.role === 'org.admin').length ?? 0;
  const activeProjects = projects.filter(project => projectStatus(project) === '进行中').length;

  return (
    <>
      <PanelHeading title="组织概览" description="查看组织近期协作与资源情况">
        <span className="org-switch-chip">
          <span className="org-avatar">{profile?.name?.[0] || '组'}</span>
          <span><b>{profile?.name || '组织'}</b><small>{profile?.status === 'suspended' ? '已停用' : '组织工作空间'}</small></span>
          <ChevronDown size={16} />
        </span>
      </PanelHeading>

      <div className="admin-metrics">
        <Metric icon={Users} label="组织成员" value={`${count(memberCount ?? quota?.members?.length ?? 0)} 人`} note={adminCount ? `包含 ${adminCount} 位管理员` : '暂无管理员'} />
        <Metric icon={Video} label="进行中项目" value={`${count(activeProjects)} 个`} note={`共 ${projects.length} 个项目`} />
        <Metric icon={Gauge} label="本月可用积分" value={`${count(quota?.remaining)} 积分`} note={`已授予 ${count(quota?.granted)} 积分`} />
        <Metric icon={Activity} label="近 30 天任务" value={`${count(usage?.tasks?.total)} 个`} note={`成功率 ${successRate}%`} />
      </div>

      <div className="admin-columns">
        <article className="admin-card">
          <div className="admin-card-head">
            <div><h3>最近项目</h3><p>组织内近期更新的项目</p></div>
            <button type="button" className="admin-link" onClick={() => onNavigate('projects')}>查看全部 →</button>
          </div>
          {projects.slice(0, 3).map(project => (
            <div className="project-row" key={project.id}>
              <div className="project-cover"><Video size={18} /></div>
              <div className="project-info"><b>{project.name || '未命名项目'}</b><small>更新于 {projectUpdated(project)}</small></div>
              <span className={`status-pill ${projectStatus(project) === '已完成' ? 'done' : ''}`}>{projectStatus(project)}</span>
            </div>
          ))}
          {!projects.length && <EmptyState title="还没有项目" description="在创作工作台新建一个项目就会出现在这里。" />}
        </article>

        <article className="admin-card">
          <div className="admin-card-head">
            <div><h3>额度概览</h3><p>本月组织积分使用情况</p></div>
            <button type="button" className="admin-link" onClick={() => onNavigate('quota')}>分配积分 →</button>
          </div>
          <QuotaGauge quota={quota} />
        </article>
      </div>

      <article className="admin-card platform-activity-card">
        <div className="admin-card-head">
          <div><h3>最近生成任务</h3><p>近 30 天组织内的任务记录</p></div>
          <button type="button" className="admin-link" onClick={() => onNavigate('usage')}>查看用量 <ArrowRight size={14} /></button>
        </div>
        {(usage?.recent || []).slice(0, 5).map(task => (
          <div className="platform-activity admin-task-row" key={task.id}>
            <span>{stamp(task.createdAt)}</span>
            <b>{task.type === 'video' ? '视频' : '图片'}</b>
            <small title={task.prompt}>{task.userEmail || '系统'} · {(task.prompt || '').slice(0, 42) || '（无提示词）'}</small>
            <em className={`task-state ${task.status === 'done' ? 'success' : task.status === 'failed' ? 'failed' : ''}`}>
              {task.status === 'done' ? '已完成' : task.status === 'failed' ? '失败' : '进行中'}
            </em>
          </div>
        ))}
        {!usage?.recent?.length && <EmptyState title="暂无任务记录" description="在成片或画布发起一次生成试试。" />}
      </article>

      <div className="admin-note">
        <ShieldCheck size={18} />
        <span><b>组织数据仅对本组织成员开放</b><small>项目、素材和生成记录归属于 {profile?.name || '本组织'}。</small></span>
        <button type="button" onClick={() => onNavigate('settings')}>组织设置 <ChevronDown size={15} /></button>
      </div>
    </>
  );
}

function Metric({ icon: Icon, label, value, note }) {
  return (
    <article className="admin-metric">
      <div className="admin-metric-top">
        <span className="admin-metric-icon"><Icon size={18} /></span>
        <span className="admin-metric-label">{label}</span>
      </div>
      <strong>{value}</strong>
      {note && <div className="admin-metric-note">{note}</div>}
    </article>
  );
}

function QuotaGauge({ quota }) {
  const granted = Number(quota?.granted) || 0;
  const used = Number(quota?.used) || 0;
  const reserved = Number(quota?.reserved) || 0;
  const remaining = Math.max(0, Number(quota?.remaining) || 0);
  const percent = granted ? Math.min(100, Math.round(((used + reserved) / granted) * 100)) : 0;
  return (
    <div className="org-quota-chart-wrap">
      <div
        className="org-quota-chart"
        style={{ '--quota-used': `${granted ? Math.round((used / granted) * 100) : 0}%`, '--quota-reserved': `${granted ? Math.round((reserved / granted) * 100) : 0}%` }}
        role="img"
        aria-label={`额度已使用 ${used}，预占 ${reserved}，剩余 ${remaining}`}
      >
        <div><b>{percent}%</b><small>使用率</small></div>
      </div>
      <div className="org-quota-legend">
        <span><i />已使用 <b>{count(used)}</b></span>
        <span><i />预占 <b>{count(reserved)}</b></span>
        <span><i />剩余 <b>{count(remaining)}</b></span>
        <strong>总额度 {count(granted)}</strong>
      </div>
    </div>
  );
}

/* ---------- 成员管理 ---------- */

function Members({ onToast, onChanged }) {
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('全部角色');
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('org.user');
  const [inviteUrl, setInviteUrl] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [memberData, inviteData] = await Promise.all([api.orgMembers(), api.orgInvites()]);
      setMembers(memberData.items || []);
      setInvites(inviteData.items || []);
    } catch (err) { onToast(err.message); }
    finally { setLoading(false); }
  }, [onToast]);

  useEffect(() => { refresh(); }, [refresh]);

  const roleMap = { 组织管理员: 'org.admin', 审核员: 'org.reviewer', 组织成员: 'org.user' };
  const roleFilter = member => role === '全部角色' || member.role === roleMap[role];
  const matches = value => value.email.toLowerCase().includes(query.toLowerCase()) && roleFilter(value);
  const filtered = members.filter(matches);
  const filteredInvites = invites.filter(matches);

  const invite = async () => {
    if (!email.trim()) return onToast('请输入邮箱地址');
    try {
      const result = await api.inviteMember(email.trim(), inviteRole);
      setInviteUrl(`${window.location.origin}${result.invitePath}`);
      setEmail('');
      await refresh();
      onChanged?.();
    } catch (err) { onToast(err.message); }
  };

  const changeRole = async (member, nextRole) => {
    try { await api.setMemberRole(member.id, nextRole); await refresh(); onChanged?.(); }
    catch (err) { onToast(err.message); await refresh(); }
  };

  const removeMember = async member => {
    if (!window.confirm(`确定移除 ${member.email}？移除后该成员会话立即失效。`)) return;
    try { await api.removeMember(member.id); await refresh(); onChanged?.(); }
    catch (err) { onToast(err.message); }
  };

  const resendInvite = async item => {
    try {
      const result = await api.resendInvite(item.id);
      setInviteUrl(`${window.location.origin}${result.invitePath}`);
      setEmail(item.email);
      setInviteRole(item.role);
      setInviteOpen(true);
    } catch (err) { onToast(err.message); }
  };

  const revokeInvite = async item => {
    try { await api.revokeInvite(item.id); await refresh(); onChanged?.(); }
    catch (err) { onToast(err.message); }
  };

  const roleCounts = useMemo(() => ({
    all: members.length,
    'org.admin': members.filter(m => m.role === 'org.admin').length,
    'org.reviewer': members.filter(m => m.role === 'org.reviewer').length,
    'org.user': members.filter(m => m.role === 'org.user').length,
  }), [members]);

  return (
    <>
      <PanelHeading title="成员管理" description="邀请成员加入组织，并管理成员角色与权限">
        <button type="button" className="admin-primary" onClick={() => { setInviteUrl(''); setInviteOpen(true); }}><Plus size={17} />邀请成员</button>
      </PanelHeading>

      <div className="admin-card member-table-card">
        <div className="admin-toolbar">
          <label className="admin-search"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索邮箱" /></label>
          <div className="role-filter-pills" role="tablist" aria-label="按角色筛选">
            {[
              ['全部角色', `全部 (${roleCounts.all})`],
              ['组织管理员', `管理员 (${roleCounts['org.admin']})`],
              ['审核员', `审核员 (${roleCounts['org.reviewer']})`],
              ['组织成员', `成员 (${roleCounts['org.user']})`],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={role === key ? 'is-active' : ''}
                onClick={() => setRole(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="table-total">{loading ? '正在加载…' : `共 ${filtered.length} 位成员 · ${filteredInvites.length} 个待接受邀请`}</span>
        </div>

        <div className="admin-table">
          <div className="table-head"><span>成员 / 邀请</span><span>角色</span><span>状态</span><span className="table-head-actions">操作</span></div>
          {filtered.map((member, index) => (
            <div className="table-row" key={member.id}>
              <div className="member-row">
                <span className={`member-avatar ${avatarColors[index % avatarColors.length]}`}>{member.email.slice(0, 1).toUpperCase()}</span>
                <div className="member-info"><b>{member.email}</b><small>加入于 {new Date(member.createdAt).toLocaleDateString('zh-CN')}</small></div>
              </div>
              <div className="member-role-cell">
                <select
                  className={`role-select is-${member.role.replace('.', '-')}`}
                  aria-label={`${member.email}的角色`}
                  value={member.role}
                  onChange={event => changeRole(member, event.target.value)}
                >
                  <option value="org.admin">组织管理员</option>
                  <option value="org.reviewer">审核员</option>
                  <option value="org.user">组织成员</option>
                </select>
              </div>
              <div><span className="invite-status joined">已加入</span></div>
              <div className="table-row-actions">
                <button type="button" className="icon-action" title={`移除 ${member.email}`} aria-label={`移除 ${member.email}`} onClick={() => removeMember(member)}><X size={16} /></button>
              </div>
            </div>
          ))}
          {filteredInvites.map(item => (
            <div className="table-row" key={item.id}>
              <div className="member-row">
                <span className="member-avatar gold">{item.email.slice(0, 1).toUpperCase()}</span>
                <div className="member-info"><b>{item.email}</b><small>有效至 {new Date(item.expiresAt).toLocaleDateString('zh-CN')}</small></div>
              </div>
              <div className="member-role-cell">
                <span className={`member-role-badge is-${item.role.replace('.', '-')}`}>{ROLE_NAME[item.role]}</span>
              </div>
              <div><span className="invite-status pending"><Mail size={12} />邀请中</span></div>
              <div className="table-row-actions">
                <span className="invite-actions">
                  <button type="button" onClick={() => resendInvite(item)}>重发</button>
                  <button type="button" className="danger" onClick={() => revokeInvite(item)}>撤回</button>
                </span>
              </div>
            </div>
          ))}
          {!loading && !filtered.length && !filteredInvites.length && (
            <EmptyState title="没有匹配的成员" description="调整搜索或筛选条件，或邀请新成员加入。" />
          )}
        </div>
        <div className="table-foot">邀请链接有效期为 7 天。移除后该成员的会话立即失效，项目和素材仍归组织所有。</div>
      </div>

      {inviteOpen && (
        <div className="admin-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setInviteOpen(false); }}>
          <div className="admin-modal" role="dialog" aria-modal="true" aria-label="邀请成员">
            <button type="button" className="modal-x" onClick={() => setInviteOpen(false)} aria-label="关闭"><X size={18} /></button>
            <span className="modal-icon"><Mail size={20} /></span>
            <h2>邀请成员</h2>
            <p>生成有效期 7 天的邀请链接，复制后发送给对方。</p>
            <label>邮箱地址
              <input autoFocus type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" onKeyDown={event => event.key === 'Enter' && invite()} />
            </label>
            <label>加入后角色
              <select value={inviteRole} onChange={event => setInviteRole(event.target.value)}>
                <option value="org.user">组织成员</option>
                <option value="org.reviewer">审核员</option>
                <option value="org.admin">组织管理员</option>
              </select>
            </label>
            {inviteUrl && <label>邀请链接<input readOnly value={inviteUrl} onFocus={event => event.target.select()} /></label>}
            <div className="modal-actions">
              <button type="button" className="admin-outline" onClick={() => setInviteOpen(false)}>关闭</button>
              <button type="button" className="admin-primary" onClick={invite}><Mail size={16} />{inviteUrl ? '重新生成链接' : '生成邀请链接'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- 积分分配 ---------- */

function Quota({ onToast }) {
  const [quota, setQuota] = useState(null);
  const [selected, setSelected] = useState([]);
  const [batchAmount, setBatchAmount] = useState('');
  const [usage, setUsage] = useState(null);
  const [usagePage, setUsagePage] = useState(1);
  const [tab, setTab] = useState('allocate');
  // 分配额度对话框：每行只有一个按钮，点开后输入并确认，不再在行内直接编辑。
  const [allocTarget, setAllocTarget] = useState(null);
  const [allocAmount, setAllocAmount] = useState('');

  const refresh = useCallback(async () => {
    try { setQuota(await api.orgQuota()); } catch (err) { onToast(err.message); }
  }, [onToast]);

  useEffect(() => { refresh(); }, [refresh]);

  const loadUsage = useCallback(async page => {
    try { setUsage(await api.orgQuotaUsage({ limit: 20, offset: (page - 1) * 20 })); }
    catch (err) { onToast(err.message); }
  }, [onToast]);

  useEffect(() => { if (tab === 'usage') loadUsage(usagePage); }, [tab, usagePage, loadUsage]);

  // 打开分配对话框：预填当前额度，方便在原值上调整。
  const openAllocate = member => {
    setAllocTarget(member);
    setAllocAmount(String(member.allocation ?? 0));
  };

  const closeAllocate = () => {
    setAllocTarget(null);
    setAllocAmount('');
  };

  // 确认分配：校验后写入，成功后关闭对话框。
  const confirmAllocate = async () => {
    if (!allocTarget) return;
    const amount = Number(allocAmount);
    if (!Number.isInteger(amount) || amount < 0) {
      onToast('请输入 0 或正整数积分');
      return;
    }
    const floor = Number(allocTarget.used || 0) + Number(allocTarget.reserved || 0);
    if (amount < floor) {
      onToast(`不能低于已用预占的 ${count(floor)} 积分`);
      return;
    }
    try {
      setQuota(await api.setMemberQuota(allocTarget.id, amount));
      onToast(`${allocTarget.email} 的额度已设为 ${count(amount)} 积分`);
      closeAllocate();
    } catch (err) { onToast(err.message); }
  };

  const batchAssign = async () => {
    const amount = Number(batchAmount);
    if (!selected.length) return onToast('先选中要分配的成员');
    if (!Number.isInteger(amount) || amount < 0) return onToast('请输入有效的积分数');
    try {
      setQuota(await api.setMemberQuotaBatch(selected.map(userId => ({ userId, amount }))));
      onToast(`已批量分配给 ${selected.length} 位成员各 ${amount} 积分`);
      setSelected([]);
      setBatchAmount('');
    } catch (err) { onToast(err.message); }
  };

  const revoke = async () => {
    if (!quota) return;
    const input = window.prompt(`回收多少积分？（当前最多可回收 ${quota.remaining} 点）`);
    if (!input) return;
    try {
      setQuota(await api.revokeOrgQuota(Number(input)));
      onToast('组织额度已回收');
    } catch (err) { onToast(err.message); }
  };

  const alerts = quota?.alerts;
  const alertLevel = alerts?.level;
  const toggle = id => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const usagePages = usage ? Math.max(1, Math.ceil(usage.total / 20)) : 1;

  return (
    <>
      <PanelHeading title="积分分配" description="把 Org 本月积分分配给成员">
        <span className="admin-count-label">{quota?.period || '读取中'}</span>
      </PanelHeading>

      {alertLevel && alertLevel !== 'ok' && (
        <div className={`admin-card`} style={{ padding: '10px 14px', marginBottom: 12, borderLeft: `3px solid ${alertLevel === 'warn' ? '#c08a35' : '#c0504d'}` }}>
          <b>{alertLevel === 'warn' ? '额度预警' : '额度告急'}</b>
          <span style={{ marginLeft: 8 }}>
            本月剩余 {count(alerts.remaining)} / {count(alerts.granted)} 点（{(alerts.ratio * 100).toFixed(1)}%），请尽快划拨或回收调整。
          </span>
        </div>
      )}

      <div className="quota-toolbar">
        <div className="role-filter-pills" role="tablist">
          <button type="button" className={tab === 'allocate' ? 'is-active' : ''} onClick={() => setTab('allocate')}>成员分配</button>
          <button type="button" className={tab === 'usage' ? 'is-active' : ''} onClick={() => setTab('usage')}>对账明细</button>
        </div>
        <div className="quota-toolbar-actions">
          <button type="button" className="admin-outline" onClick={revoke}>回收额度</button>
          <button type="button" className="admin-outline" onClick={() => window.open('/api/org/quota/export', '_blank')}>导出 CSV</button>
        </div>
      </div>

      {tab === 'allocate' ? (
        <>
          <div className="admin-metrics usage-metrics">
            <Metric icon={Wallet} label="Org 总积分" value={`${count(quota?.granted)} 积分`} note="平台本月划拨" />
            <Metric icon={Check} label="已消耗积分" value={`${count(quota?.used)} 积分`} note={`实际花费 ¥${Number(quota?.costCny || 0).toFixed(2)}`} />
            <Metric icon={Activity} label="执行中预占" value={`${count(quota?.reserved)} 积分`} note="失败或取消会退还" />
            <Metric icon={Users} label="未分配积分" value={`${count(quota?.unallocated)} 积分`} note="留在 Org 积分池" />
          </div>

          {selected.length > 0 && (
            <div className="admin-card quota-batch-bar">
              <b>已选 {selected.length} 位成员</b>
              <input type="number" min="0" step="1" value={batchAmount} onChange={event => setBatchAmount(event.target.value)} placeholder="每人积分" />
              <button type="button" className="admin-primary" onClick={batchAssign}>批量分配</button>
              <button type="button" className="admin-outline" onClick={() => setSelected([])}>取消选择</button>
            </div>
          )}

          <article className="admin-card quota-allocation-card">
            <div className="quota-table-head">
              <span><input type="checkbox" checked={!!quota?.members?.length && selected.length === quota.members.length} onChange={event => setSelected(event.target.checked ? (quota?.members || []).map(item => item.id) : [])} aria-label="全选" /></span>
              <span>成员</span><span>积分使用</span><span>实际花费</span><span>可用积分</span><span>设置积分</span>
            </div>
            {(quota?.members || []).map(member => {
              const allocated = Number(member.allocation) || 0;
              const used = Number(member.used) || 0;
              const reserved = Number(member.reserved) || 0;
              const available = Number(member.available) || 0;
              const usagePct = allocated ? Math.min(100, Math.round(((used + reserved) / allocated) * 100)) : 0;
              const availLevel = available === 0 ? 'empty' : available <= (allocated * 0.15 || 50) ? 'low' : 'ok';
              return (
                <div className="quota-member-row" key={member.id}>
                  <span><input type="checkbox" checked={selected.includes(member.id)} onChange={() => toggle(member.id)} aria-label={`选择 ${member.email}`} /></span>
                  <span className="member-info">
                    <span className={`member-avatar is-${(member.role || 'org.user').replace('.', '-')}`} aria-hidden="true">{member.email.charAt(0).toUpperCase()}</span>
                    <span className="member-meta">
                      <b>{member.email}</b>
                      <span className={`member-role-badge is-${(member.role || 'org.user').replace('.', '-')}`}>{ROLE_NAME[member.role] || '组织成员'}</span>
                    </span>
                  </span>
                  <span className="quota-usage-cell">
                    <span className="quota-usage-nums">
                      <b>{count(used + reserved)}</b>
                      <span className="quota-usage-total">/ {count(allocated)}</span>
                    </span>
                    <span className="quota-usage-bar" role="img" aria-label={`已用 ${usagePct}%`}>
                      <span className="quota-usage-fill" style={{ width: `${usagePct}%` }} />
                    </span>
                  </span>
                  <span className="quota-cost">¥{Number(member.costCny || 0).toFixed(2)}</span>
                  <span className={`quota-available is-${availLevel}`}>{count(available)}</span>
                  <span className="quota-edit">
                    <button type="button" className="quota-btn assign" onClick={() => openAllocate(member)}>
                      <Wallet size={14} />分配
                    </button>
                  </span>
                </div>
              );
            })}
            {!quota?.members?.length && <EmptyState title="当前组织还没有成员" description="邀请成员加入后即可分配积分。" />}
            <div className="table-foot">图片任务预占 1 积分，视频任务预占 8 积分；完成后按真实成本结算（视频随 token 波动），失败或取消自动退还。LLM 调用每 1000 tokens 计 1 积分。积分按自然月重置。</div>
          </article>

          {allocTarget && (
            <div
              className="admin-modal-backdrop"
              onMouseDown={event => { if (event.target === event.currentTarget) closeAllocate(); }}
            >
              <div className="admin-modal" role="dialog" aria-modal="true" aria-label="分配积分">
                <button type="button" className="modal-x" onClick={closeAllocate} aria-label="关闭"><X size={18} /></button>
                <span className="modal-icon"><Wallet size={20} /></span>
                <h2>分配积分</h2>
                <p>{allocTarget.email}</p>
                <label>发送额度（积分）
                  <input
                    autoFocus
                    type="number"
                    min={Number(allocTarget.used || 0) + Number(allocTarget.reserved || 0)}
                    step="1"
                    value={allocAmount}
                    onChange={event => setAllocAmount(event.target.value)}
                    onKeyDown={event => event.key === 'Enter' && confirmAllocate()}
                  />
                </label>
                <p className="quota-alloc-hint">
                  当前额度 {count(allocTarget.allocation)} 积分，已用 {count(Number(allocTarget.used || 0) + Number(allocTarget.reserved || 0))} 积分。
                  额度不能低于已用部分。
                </p>
                <div className="modal-actions">
                  <button type="button" className="admin-outline" onClick={closeAllocate}>取消</button>
                  <button type="button" className="admin-primary" onClick={confirmAllocate}><Check size={16} />保存确认</button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <article className="admin-card quota-usage-card">
          <div className="quota-usage-table">
            <div className="quota-usage-head"><span>成员</span><span>期间</span><span>积分</span><span>状态</span><span>实际成本</span><span>结算时间</span></div>
            {(usage?.items || []).map(row => (
              <div className="quota-usage-row" key={row.taskId}>
                <span className="quota-usage-email">{row.userEmail || '—'}</span>
                <span>{row.period}</span>
                <b>{row.amount}</b>
                <span>
                  <em className={`quota-status-pill is-${row.status}`}>
                    {row.status === 'settled' ? '已结算' : row.status === 'reserved' ? '预占中' : '已释放'}
                  </em>
                </span>
                <span>¥{Number(row.costCny || 0).toFixed(4)}</span>
                <span className="quota-usage-time">{row.settledAt || row.createdAt ? new Date(row.settledAt || row.createdAt).toLocaleString('zh-CN') : '—'}</span>
              </div>
            ))}
            {!usage?.items?.length && <EmptyState title="暂无额度使用记录" description="成员生成任务后会在这里产生明细。" />}
          </div>
          {usagePages > 1 && (
            <footer className="org-pagination">
              <span>第 {usagePage} / {usagePages} 页 · 共 {usage?.total || 0} 条</span>
              <button type="button" disabled={usagePage <= 1} onClick={() => setUsagePage(p => p - 1)}>上一页</button>
              <button type="button" disabled={usagePage >= usagePages} onClick={() => setUsagePage(p => p + 1)}>下一页</button>
            </footer>
          )}
        </article>
      )}
    </>
  );
}

/* ---------- 项目管理 ---------- */

function Projects({ onToast }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [creatorFilter, setCreatorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    api.list('projects')
      .then(data => setProjects(data.items || []))
      .catch(err => onToast(err.message))
      .finally(() => setLoading(false));
  }, [onToast]);

  const creators = useMemo(
    () => Array.from(new Set(projects.map(p => p.createdByEmail).filter(Boolean))).sort(),
    [projects],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter(project => {
      const status = projectStatus(project);
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (creatorFilter !== 'all' && (project.createdByEmail || '未知') !== creatorFilter) return false;
      if (q && ![project.name, project.createdByEmail].some(v => String(v || '').toLowerCase().includes(q))) return false;
      return true;
    });
  }, [projects, query, creatorFilter, statusFilter]);

  return (
    <>
      <PanelHeading title="项目管理" description="管理员可查看本 Org 全部项目与创建人；支持按创建人与状态筛选">
        <span className="admin-count-label">
          {filtered.length === projects.length ? `共 ${projects.length} 个项目` : `显示 ${filtered.length} / ${projects.length} 个项目`}
        </span>
      </PanelHeading>

      <div className="admin-card project-list-card">
        <div className="admin-toolbar project-toolbar">
          <label className="admin-search">
            <Search size={16} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索项目名称或创建人…" />
          </label>
          <select value={creatorFilter} onChange={e => setCreatorFilter(e.target.value)} aria-label="按创建人筛选">
            <option value="all">全部创建人</option>
            {creators.map(email => <option key={email} value={email}>{email}</option>)}
          </select>
          <div className="role-filter-pills" role="tablist" aria-label="按状态筛选">
            {['all', '进行中', '待审核', '已完成'].map(key => (
              <button
                key={key}
                type="button"
                className={statusFilter === key ? 'is-active' : ''}
                onClick={() => setStatusFilter(key)}
              >
                {key === 'all' ? '全部' : key}
              </button>
            ))}
          </div>
        </div>

        <div className="project-list">
          {filtered.map(project => {
            const progress = projectProgress(project);
            const status = projectStatus(project);
            return (
              <div className="project-row project-large" key={project.id}>
                <div className="project-cover"><Video size={20} /></div>
                <div className="project-info">
                  <b>{project.name || '未命名项目'}</b>
                  <small className="project-meta-line">
                    <span className="project-creator-chip">创建人：{project.createdByEmail || '系统'}</span>
                    <span>最近更新 {projectUpdated(project)}</span>
                  </small>
                </div>
                <div className="project-progress">
                  <div><span>制作进度</span><b>{progress}%</b></div>
                  <i><em style={{ width: `${progress}%` }} /></i>
                </div>
                <span className={`status-pill ${status === '已完成' ? 'done' : ''}`}>{status}</span>
                <a className="icon-action" href="/app/projects" aria-label={`打开${project.name || ''}项目`}><ArrowRight size={18} /></a>
              </div>
            );
          })}
          {!filtered.length && (
            <EmptyState
              title={loading ? '正在读取项目…' : projects.length ? '没有匹配的项目' : '当前组织还没有项目'}
              description={loading ? '' : projects.length ? '尝试清空搜索或切换创建人/状态筛选。' : '在创作工作台新建项目后会出现在这里。'}
            />
          )}
        </div>
      </div>
    </>
  );
}

/* ---------- 用量与任务 ---------- */

function Usage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setData(await api.orgUsage(days)); setError(''); }
    catch (err) { setError(err.message); }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const tasks = data?.tasks || {};
  const calls = data?.calls || {};
  const successRate = tasks.total ? Math.round((tasks.done / tasks.total) * 100) : 0;

  return (
    <>
      <PanelHeading title="用量与任务" description="组织 AI 用量汇总及生成任务状态">
        <div className="usage-range">
          {[[7, '近 7 天'], [30, '近 30 天'], [90, '近 90 天']].map(([value, label]) => (
            <button type="button" key={value} className={days === value ? 'selected' : ''} onClick={() => setDays(value)}>{label}</button>
          ))}
        </div>
      </PanelHeading>

      <ErrorBanner message={error} onRetry={load} />

      <div className="admin-metrics usage-metrics">
        <Metric icon={HardDrive} label="Tokens 用量" value={count(calls.tokens)} note={`${count(calls.calls)} 次调用`} />
        <Metric icon={Gauge} label="预估花费" value={`¥${Number(calls.cost || 0).toFixed(2)}`} note="按方舟刊例价折算" />
        <Metric icon={Check} label="成功任务" value={`${count(tasks.done)} 个`} note={`成功率 ${successRate}%`} />
        <Metric icon={Activity} label="进行中 / 失败" value={`${count(tasks.running)} / ${count(tasks.failed)}`} note={`共 ${count(tasks.total)} 个任务`} />
      </div>

      <article className="admin-card usage-card">
        <div className="admin-card-head">
          <div><h3>最近任务</h3><p>失败或取消的任务不计入最终用量</p></div>
          <span className="admin-count-label">近 {days} 天</span>
        </div>
        {(data?.recent || []).map(task => (
          <div className="usage-task-row" key={task.id}>
            <div>
              <b title={task.prompt}>{(task.prompt || '（无提示词）').slice(0, 40)}</b>
              <small>{task.userEmail || '系统'} · {stamp(task.createdAt)}</small>
            </div>
            <span className={`task-state ${task.status === 'done' ? 'success' : task.status === 'failed' ? 'failed' : ''}`}>
              {task.status === 'done' ? '已完成' : task.status === 'failed' ? '失败' : '进行中'}
            </span>
            <b>{task.type === 'video' ? '视频' : '图片'}</b>
            <span className="table-foot-cell">{task.costMs ? `${(task.costMs / 1000).toFixed(1)}s` : '—'}</span>
          </div>
        ))}
        {!data?.recent?.length && <EmptyState title="暂无任务记录" description="在成片或画布发起一次生成试试。" />}
      </article>
    </>
  );
}

/* ---------- 审计记录 ---------- */

const ORG_ACTION_LABELS = {
  'organization.renamed': '组织改名',
  'organization.status_changed': '组织状态变更',
  'invite.created': '创建邀请',
  'invite.resent': '重新发送邀请',
  'invite.revoked': '撤销邀请',
  'invite.accepted': '接受邀请',
  'member.role_changed': '成员角色变更',
  'member.removed': '移除成员',
  'quota.member.allocated': '成员积分分配',
  'quota.org.granted': '组织积分划拨',
  'user.disabled': '停用账号',
  'user.enabled': '启用账号',
  'user.sessions_revoked': '强制下线',
};
const orgActionLabel = action => ORG_ACTION_LABELS[action] || String(action || '其他操作').replace(/[._]/g, ' ');

function Audit() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [actions, setActions] = useState([]);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    try {
      const data = await api.orgAudit({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, action: action || undefined, q: q.trim() || undefined });
      setItems(data.items || []);
      setTotal(data.total || 0);
      setActions(data.actions || []);
      setError('');
    } catch (err) { setError(err.message); }
  }, [page, action, q]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [action, q]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const exportCsv = () => {
    // 导出走浏览器下载：Cookie 会话已存在，直接打开即可
    const params = new URLSearchParams();
    if (action) params.set('action', action);
    if (q.trim()) params.set('q', q.trim());
    window.open(`/api/org/audit/export${params.size ? `?${params}` : ''}`, '_blank');
  };

  return (
    <>
      <PanelHeading title="管理操作审计" description="记录邀请、角色调整、积分分配与成员移除" />
      <ErrorBanner message={error} onRetry={load} />
      <div className="org-toolbar" style={{ marginBottom: 12 }}>
        <label><Search size={15} /><input value={q} onChange={event => setQ(event.target.value)} placeholder="搜索对象、动作、操作人" /></label>
        <select value={action} onChange={event => setAction(event.target.value)} aria-label="筛选操作类型">
          <option value="">全部操作</option>
          {actions.map(item => <option key={item} value={item}>{orgActionLabel(item)}</option>)}
        </select>
        <button type="button" className="admin-outline" onClick={exportCsv}>导出 CSV</button>
        <span>共 {total} 条</span>
      </div>
      <div className="admin-card member-table-card">
        <div className="admin-table">
          <div className="table-head audit-head-row"><span>操作</span><span>操作人</span><span>对象</span><span>时间</span></div>
          {items.map(item => (
            <div className="table-row audit-row" key={item.id}>
              <div><b>{orgActionLabel(item.action)}</b><small>{item.details ? JSON.stringify(item.details) : ''}</small></div>
              <span>{item.actorEmail || '系统'}</span>
              <span>{item.target || '—'}</span>
              <span>{new Date(item.createdAt).toLocaleString('zh-CN')}</span>
            </div>
          ))}
          {!items.length && <EmptyState title="暂无管理操作记录" description="邀请成员、调整角色等操作会记录在这里。" />}
        </div>
        {pages > 1 && (
          <footer className="org-pagination">
            <span>第 {page} / {pages} 页</span>
            <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</button>
            <button type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>下一页</button>
          </footer>
        )}
      </div>
    </>
  );
}

/* ---------- 组织设置 ---------- */

function SettingsTab({ profile, onToast, onSaved }) {
  const [name, setName] = useState(profile?.name || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setName(profile?.name || ''); }, [profile?.name]);

  const save = async () => {
    if (!name.trim()) return onToast('组织名称不能为空');
    setSaving(true);
    try {
      await api.renameOrg(name.trim());
      onToast('组织信息已保存');
      await onSaved();
    } catch (err) { onToast(err.message); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PanelHeading title="组织设置" description="更新组织资料与信息">
        <button type="button" className="admin-primary" disabled={saving} onClick={save}><Check size={16} />{saving ? '保存中…' : '保存更改'}</button>
      </PanelHeading>

      <article className="admin-card settings-card">
        <h3>基本信息</h3>
        <label>组织名称
          <input value={name} onChange={event => setName(event.target.value)} placeholder="组织名称" maxLength={80} />
        </label>
        <label>组织 ID
          <div className="readonly-input">
            {profile?.id || '—'}
            <span>创建于 {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('zh-CN') : '—'}</span>
          </div>
        </label>
        <label>组织管理员
          <div className="setting-admin">
            <span className="member-avatar teal">{(profile?.adminEmail || '管').slice(0, 1).toUpperCase()}</span>
            <span><b>{profile?.adminEmail || '待指派'}</b><small>{profile?.memberCount ?? 0} 位成员</small></span>
            <span className="role-tag">组织管理员</span>
          </div>
        </label>
        <label>组织状态
          <div className="readonly-input">
            {profile?.status === 'suspended' ? '已停用' : '正常'}
            <span>由平台管理员控制</span>
          </div>
        </label>
      </article>

      <article className="admin-card retention-card">
        <div className="retention-icon"><Clock3 size={19} /></div>
        <div><b>数据位置</b><p>组织数据存储在平台本地 SQLite，停用组织后成员将无法访问。</p></div>
        <span>{profile?.status === 'suspended' ? '已停用' : '正常'}</span>
      </article>
    </>
  );
}
