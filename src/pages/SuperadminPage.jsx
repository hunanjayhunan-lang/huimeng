import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, Building2, Check, Cpu, Download, Gauge,
  MoreHorizontal, Search, ShieldAlert, UserPlus, Users, X,
} from 'lucide-react';
import { api } from '../api.js';
import AdminWorkspace, { EmptyState, ErrorBanner, PanelHeading, Toast, useToast } from '../components/AdminWorkspace.jsx';
import TracingPage from './TracingPage.jsx';
import './SuperadminPage.css';

const TAB_KEYS = { overview: 'overview', organizations: 'organizations', users: 'users', usage: 'usage', tracing: 'tracing', audit: 'audit' };
const TABS = [
  { key: 'overview', label: '平台概览', icon: Activity },
  { key: 'organizations', label: '组织管理', icon: Building2 },
  { key: 'users', label: '用户与权限', icon: Users },
  { key: 'usage', label: '平台用量', icon: Gauge },
  { key: 'tracing', label: '调用追踪', icon: Cpu },
  { key: 'audit', label: '操作审计', icon: ShieldAlert },
];
const TAB_PATHS = { overview: '/admin/overview', organizations: '/admin/organizations', users: '/admin/users', usage: '/admin/usage', tracing: '/admin/tracing', audit: '/admin/audit' };
const PATH_TABS = Object.fromEntries(Object.entries(TAB_PATHS).map(([key, path]) => [path, key]));
const ORG_LIST_PATH = '/platform/organizations';

const count = value => Number(value || 0).toLocaleString('zh-CN');
// 金额：小于 1000 保留两位，否则千分位取整
const fmtMoney = value => {
  const n = Number(value || 0);
  return n >= 1000 ? Math.round(n).toLocaleString('zh-CN') : n.toFixed(2);
};
const actionLabels = {
  'organization.status_changed': '组织状态变更',
  'organization.renamed': '组织改名',
  'org.plan.changed': '套餐变更',
  'invite.created': '创建邀请',
  'invite.resent': '重新发送邀请',
  'invite.revoked': '撤销邀请',
  'invite.accepted': '接受邀请',
  'member.role_changed': '成员角色变更',
  'member.removed': '移除成员',
  'quota.org.granted': '组织积分划拨',
  'quota.member.allocated': '成员积分分配',
  'user.disabled': '停用账号',
  'user.enabled': '启用账号',
  'user.sessions_revoked': '强制下线',
};
const actionLabel = action => actionLabels[action] || String(action || '其他操作').replace(/[._]/g, ' ');
const safeParseJson = value => {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return null; }
};

const tabFromPath = () => {
  const path = window.location.pathname.replace(/\/+$/, '');
  if (PATH_TABS[path]) return PATH_TABS[path];
  if (path === ORG_LIST_PATH || path.startsWith(`${ORG_LIST_PATH}/`)) return 'organizations';
  return 'overview';
};

export default function SuperadminPage({ user, org, role = 'superadmin', onLogout, onNavigate }) {
  const [tab, setTab] = useState(tabFromPath);
  const [overview, setOverview] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');
  const [toast, showToast] = useToast();
  const [drawer, setDrawer] = useState(null);
  const [activityOrg, setActivityOrg] = useState('全部组织');
  const [activityActor, setActivityActor] = useState('全部操作人');
  const [usersOrgFilter, setUsersOrgFilter] = useState('');

  const changeTab = useCallback(next => {
    setTab(next);
    const path = next === 'organizations' ? TAB_PATHS.organizations : TAB_PATHS[next];
    if (window.location.pathname !== path) window.history.pushState({ tab: '管理' }, '', path);
  }, []);

  // 从组织详情跳转到用户页，并预设该组织的筛选
  const openOrgMembers = useCallback(orgName => {
    setUsersOrgFilter(orgName || '');
    changeTab('users');
  }, [changeTab]);

  const refresh = useCallback(async () => {
    try {
      setOverview(await api.platformOverview());
      setError('');
    } catch (err) { setError(err.message); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ ok: false }));
  }, []);

  useEffect(() => {
    const onPop = () => setTab(tabFromPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const totals = overview?.totals || {};
  const organizations = overview?.organizations || [];
  const auditLogs = overview?.auditLogs || [];
  const usageRate = totals.quota_granted ? Math.min(100, Math.round((totals.quota_used / totals.quota_granted) * 100)) : 0;

  // 全局搜索索引：按需聚合各页面的可搜项
  const loadSearchIndex = useCallback(async () => {
    const [overview, orgsRes, usersRes] = await Promise.all([
      api.platformOverview(),
      api.platformOrganizations().catch(() => ({ items: [] })),
      api.platformUsers({}).catch(() => ({ items: [] })),
    ]);
    const orgs = orgsRes.items || [];
    const users = usersRes.items || [];
    const logs = overview.auditLogs || [];
    return {
      organizations: orgs.map(org => ({
        id: org.id,
        label: org.name,
        hint: `${count(org.memberCount)} 成员 · ${org.status === 'suspended' ? '已停用' : '正常'}`,
        path: `${ORG_LIST_PATH}/${encodeURIComponent(org.id)}`,
      })),
      users: users.map(user => ({
        id: user.id,
        label: user.email,
        hint: `${ROLE_NAME[user.role] || user.role}${user.orgName ? ` · ${user.orgName}` : ''}`,
        path: '/admin/users',
        state: { searchEmail: user.email },
      })),
      tasks: (overview.organizations || []).map(org => ({
        id: `task-${org.id}`,
        label: org.name,
        hint: `${count(org.task_count)} 个任务 · ${count(org.month_tokens)} Tokens`,
        path: '/admin/tracing',
      })),
      audit: logs.slice(0, 40).map(log => ({
        id: log.id,
        label: actionLabel(log.action),
        hint: `${log.org_name || '—'} · ${log.actor_email || '系统'}`,
        path: '/admin/audit',
      })),
    };
  }, []);

  // 搜索选中后跳转
  const onSearchNavigate = useCallback(item => {
    if (!item?.path) return;

    // 统一：改 URL 后派发 popstate，让各子页从 URL 重新读取状态
    const go = (path, nextTab) => {
      window.history.pushState({ tab: '管理' }, '', path);
      if (nextTab) setTab(nextTab);
      window.dispatchEvent(new PopStateEvent('popstate', { state: { tab: '管理' } }));
    };

    if (item.group === 'search') {
      const next = item.label || '';
      const path = tab === TAB_KEYS.audit ? '/admin/organizations' : TAB_PATHS[tab] || '/admin/overview';
      go(`${path}?q=${encodeURIComponent(next)}`, tab === TAB_KEYS.audit ? 'organizations' : tab);
      return;
    }
    if (item.path.startsWith(ORG_LIST_PATH)) {
      go(item.path, 'organizations');
      return;
    }
    if (item.state?.searchEmail) {
      setUsersOrgFilter('');
    }
    const targetTab = TAB_KEYS[Object.keys(TAB_PATHS).find(key => TAB_PATHS[key] === item.path)] || tab;
    go(`${item.path}?q=${encodeURIComponent(item.label)}`, targetTab);
  }, [tab]);

  return (
    <AdminWorkspace
      workspaceIcon={ShieldAlert}
      workspaceTitle="AI绘梦"
      workspaceSubtitle="平台管理"
      tabs={TABS}
      activeTab={tab}
      onTabChange={changeTab}
      breadcrumbParent="平台管理"
      user={user}
      org={org}
      role={role}
      onLogout={onLogout}
      onNavigate={onNavigate}
      statusOk={health?.ok !== false}
      statusText={health?.ok === false ? '服务状态未知' : '平台服务正常'}
      onSearchNavigate={onSearchNavigate}
      loadSearchIndex={loadSearchIndex}
    >
      <ErrorBanner message={error} onRetry={refresh} />

      {tab === TAB_KEYS.overview && (
        <>
          <PanelHeading title="平台概览" description="平台运行与资源使用情况">
            <button type="button" className="admin-outline" onClick={() => exportAuditCsv(auditLogs)}>
              <Download size={15} />导出审计
            </button>
          </PanelHeading>

          <div className="platform-top-row">
            <div className="platform-metrics-quad">
              <Metric icon={Building2} label="组织数" value={count(totals.organizations)} />
              <Metric icon={Users} label="用户数" value={count(totals.users)} />
              <Metric icon={Check} label="本月任务" value={count(totals.tasks)} />
              <article className="admin-metric platform-usage-metric">
                <div className="admin-metric-top">
                  <span className="admin-metric-icon"><Cpu size={18} /></span>
                  <span className="admin-metric-label">本月 Tokens</span>
                </div>
                <strong>{count(totals.month_tokens)}</strong>
                <div className="platform-usage-quota">
                  <span><Gauge size={11} />额度</span>
                  <b>{usageRate}%</b>
                </div>
                <div className="mock-progress" style={{ '--p': `${usageRate}%` }}><i /></div>
              </article>
            </div>
            <OverviewTrend trendWeek={overview?.trendWeek} trendMonth={overview?.trendMonth} />
          </div>

          <div className="platform-overview-columns">
            <article className="admin-card">
              <div className="admin-card-head"><h3>平台信息</h3></div>
              <Alerts alerts={buildAlerts(totals, organizations)} onOpen={target => changeTab(target)} />
            </article>
            <article className="admin-card">
              <div className="admin-card-head">
                <h3>服务健康摘要</h3>
              </div>
              <ServiceHealth />
            </article>
          </div>

          <article className="admin-card platform-activity-card">
            <div className="admin-card-head">
              <h3>最近活动</h3>
              <div className="platform-filters">
                <select value={activityOrg} onChange={e => setActivityOrg(e.target.value)} aria-label="按组织筛选活动">
                  <option>全部组织</option>
                  {organizations.map(org => <option key={org.id}>{org.name}</option>)}
                </select>
                <select value={activityActor} onChange={e => setActivityActor(e.target.value)} aria-label="按操作人筛选活动">
                  <option>全部操作人</option>
                  {[...new Set(auditLogs.map(item => item.actor_email).filter(Boolean))].map(actor => <option key={actor}>{actor}</option>)}
                </select>
                <button type="button" className="admin-link" onClick={() => changeTab('audit')}>查看全部 <ArrowRight size={14} /></button>
              </div>
            </div>
            {auditLogs
              .filter(item => (activityOrg === '全部组织' || item.target === activityOrg) && (activityActor === '全部操作人' || item.actor_email === activityActor))
              .slice(0, 5)
              .map(item => (
                <button
                  type="button"
                  className="platform-activity clickable"
                  key={item.id}
                  onClick={() => setDrawer({ title: item.target || actionLabel(item.action), subtitle: item.actor_email || '系统', details: actionLabel(item.action), at: item.created_at })}
                >
                  <span>{new Date(item.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                  <b>{actionLabel(item.action)}</b>
                  <small>{item.actor_email || '系统'} · {item.target || ''}</small>
                </button>
              ))}
            {!auditLogs.length && <EmptyState title="暂无平台操作记录" description="组织与账号操作会实时出现在这里。" />}
          </article>
        </>
      )}

      {tab === TAB_KEYS.organizations && (
        <OrgTable
          rows={organizations}
          onChanged={refresh}
          onToast={showToast}
          onError={setError}
          onOpenMembers={openOrgMembers}
        />
      )}

      {tab === TAB_KEYS.users && <PlatformUsers onToast={showToast} initialOrg={usersOrgFilter} />}

      {tab === TAB_KEYS.usage && <PlatformUsage organizations={organizations} onTrace={() => changeTab('tracing')} />}

      {tab === TAB_KEYS.tracing && <TracingPage platformAdmin />}

      {tab === TAB_KEYS.audit && (
        <PlatformAudit audits={auditLogs} organizations={organizations} currentUser={user} />
      )}

      <Toast message={toast} />

      {drawer && (
        <div className="context-backdrop" onClick={() => setDrawer(null)}>
          <aside className="context-drawer" onClick={event => event.stopPropagation()}>
            <header>
              <div><h2>{drawer.title}</h2><p>{drawer.subtitle}</p></div>
              <button type="button" aria-label="关闭详情" onClick={() => setDrawer(null)}><X size={18} /></button>
            </header>
            <section><span>动作</span><b>{drawer.details}</b></section>
            <section><span>时间</span><b>{new Date(drawer.at).toLocaleString('zh-CN')}</b></section>
            <section><span>数据来源</span><b>平台操作审计</b></section>
          </aside>
        </div>
      )}
    </AdminWorkspace>
  );
}

/* ---------- 概览小部件 ---------- */

function Metric({ icon: Icon, label, value, progress }) {
  return (
    <article className="admin-metric">
      <div className="admin-metric-top">
        <span className="admin-metric-icon"><Icon size={18} /></span>
        <span className="admin-metric-label">{label}</span>
      </div>
      <strong>{value}</strong>
      {progress != null && <div className="mock-progress" style={{ '--p': `${progress}%` }}><i /></div>}
    </article>
  );
}

/* 迷你折线趋势图（纯 SVG，无额外依赖） */
function TrendChart({ series, lines, mode = 'daily' }) {
  const [hover, setHover] = useState(null);
  const W = 520;
  const H = 148;
  const PAD = 8;
  // stock 模式展示累计存量，刻度从实际最小值起画，避免曲线被压成直线
  const values = series.flatMap(point => lines.map(line => Number(point[line.key]) || 0));
  const rawMax = Math.max(1, ...values);
  const rawMin = mode === 'stock' ? Math.min(...values) : 0;
  const span = Math.max(1, rawMax - rawMin);
  const stepX = series.length > 1 ? (W - PAD * 2) / (series.length - 1) : 0;
  const yOf = value => H - PAD - (((Number(value) || 0) - rawMin) / span) * (H - PAD * 2);
  const xOf = index => PAD + index * stepX;
  const paths = lines.map(line => series
    .map((point, index) => `${index ? 'L' : 'M'}${xOf(index).toFixed(1)},${yOf(point[line.key]).toFixed(1)}`)
    .join(' '));
  const active = hover != null ? series[hover] : null;
  const totalOf = key => series.reduce((total, point) => total + (Number(point[key]) || 0), 0);
  const last = series[series.length - 1] || {};
  const headValue = line => (mode === 'stock' ? count(last[line.key]) : count(totalOf(line.key)));

  return (
    <div className="trend-chart">
      <div className="trend-chart-legend">
        {lines.map(line => (
          <span key={line.key}><i style={{ background: line.color }} />{line.label}
            <b>{headValue(line)}</b>
          </span>
        ))}
        <em>{mode === 'stock' ? '当前值' : '区间合计'}</em>
      </div>
      <div className="trend-chart-canvas">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={lines.map(l => l.label).join('、') + '趋势'}>
          {[0, 0.5, 1].map(ratio => (
            <line key={ratio} x1={PAD} x2={W - PAD} y1={PAD + ratio * (H - PAD * 2)} y2={PAD + ratio * (H - PAD * 2)} className="trend-grid" />
          ))}
          {paths.map((d, i) => (
            <path key={lines[i].key} d={d} fill="none" stroke={lines[i].color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          ))}
          {active && <line x1={xOf(hover)} x2={xOf(hover)} y1={PAD} y2={H - PAD} className="trend-cursor" />}
          {series.map((point, index) => (
            <rect
              key={point.date}
              x={xOf(index) - stepX / 2}
              y={0}
              width={Math.max(stepX, 6)}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
        {active && (
          <div className="trend-tooltip" style={{ left: `${(xOf(hover) / W) * 100}%` }}>
            <b>{active.date}</b>
            {lines.map(line => <span key={line.key}>{line.label} {count(active[line.key])}</span>)}
          </div>
        )}
      </div>
      <div className="trend-chart-axis">
        <span>{series[0]?.date?.slice(5)}</span>
        <span>范围 {count(rawMin)} – {count(rawMax)}</span>
        <span>{series[series.length - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  );
}

function OverviewTrend({ trendWeek, trendMonth }) {
  const [range, setRange] = useState('week');
  const series = (range === 'month' ? trendMonth : trendWeek) || [];
  const sum = key => series.reduce((total, point) => total + (Number(point[key]) || 0), 0);
  return (
    <article className="admin-card platform-trend-card">
      <div className="admin-card-head">
        <div className="platform-trend-heading">
          <h3>平台趋势</h3>
          <span className="platform-trend-sub">
            新增任务 {count(sum('tasks'))} · Tokens {count(sum('tokens'))}
          </span>
        </div>
        <div className="platform-trend-switch" role="tablist" aria-label="趋势时间范围">
          {[['week', '周'], ['month', '月']].map(([key, label]) => (
            <button type="button" key={key} role="tab" aria-selected={range === key} className={range === key ? 'selected' : ''} onClick={() => setRange(key)}>{label}</button>
          ))}
        </div>
      </div>
      {series.length ? (
        <div className="platform-trend-grid">
          <TrendChart
            series={series}
            lines={[{ key: 'orgs', label: '组织数', color: '#4d7fb5' }, { key: 'users', label: '用户量', color: '#5c9a79' }]}
            mode="stock"
          />
          <TrendChart
            series={series}
            lines={[{ key: 'tasks', label: '任务量', color: '#8a7db0' }, { key: 'tokens', label: 'Tokens 消耗', color: '#c08a35' }]}
            mode="daily"
          />
        </div>
      ) : <EmptyState title="暂无趋势数据" description="用户、任务与调用产生后会在这里形成趋势。" />}
    </article>
  );
}

function buildAlerts(totals, organizations) {
  const feed = [];
  const lowQuota = organizations.filter(org => {
    const granted = Number(org.quota_granted) || 0;
    const remaining = Number(org.quota_remaining) || 0;
    return granted > 0 && remaining / granted < 0.15;
  });

  // 动态事件：接入真实数据
  if (totals.users > 0) {
    feed.push({ key: 'new-user', icon: UserPlus, label: '新用户加入', detail: `${count(totals.users)} 位用户已加入平台，待分配组织与角色`, target: 'users', tone: 'info', time: '11-19 09:24' });
  }
  if (totals.organizations > 0) {
    const latest = organizations[organizations.length - 1];
    feed.push({ key: 'new-org', icon: Building2, label: '新组织创建', detail: latest?.name ? `「${latest.name}」已完成初始化，等待划拨额度` : `${count(totals.organizations)} 个组织处于活跃状态`, target: 'organizations', tone: 'info', time: '11-19 08:51' });
  }
  if (lowQuota.length) {
    feed.push({ key: 'quota', icon: Gauge, label: '额度预警', detail: `${lowQuota.length} 个组织剩余额度低于 15%`, target: 'organizations', tone: 'warn', time: '11-19 08:12' });
  }
  if (totals.failed_tasks > 0) {
    feed.push({ key: 'failed', icon: AlertTriangle, label: '存在失败任务', detail: `${count(totals.failed_tasks)} 个任务失败，可在调用追踪排查`, target: 'tracing', tone: 'danger', time: '11-19 07:46' });
  }
  if (totals.active_tasks > 0) {
    feed.push({ key: 'queue', icon: Activity, label: '任务处理中', detail: `${count(totals.active_tasks)} 个任务排队或运行中`, target: 'tracing', tone: 'info', time: '11-19 07:20' });
  }

  // 演示消息
  feed.push({ key: 'org-member', icon: UserPlus, label: '成员加入组织', detail: '「青鸟动画」新增 2 位制作成员，已同步权限', target: 'organizations', tone: 'info', time: '11-18 17:03' });
  feed.push({ key: 'billing', icon: Gauge, label: '额度划拨完成', detail: '「星河影业」额度调整至 5,000,000 Tokens', target: 'usage', tone: 'info', time: '11-18 15:40' });

  if (!feed.length) {
    feed.push({ key: 'ok', icon: Check, label: '平台运行正常', detail: '暂无需要处理的事件', target: 'overview', tone: 'ok', time: '刚刚' });
  }
  return feed.slice(0, 5);
}

function Alerts({ alerts, onOpen }) {
  return alerts.map(alert => {
    const Icon = alert.icon;
    return (
      <button
        type="button"
        className={`platform-alert-row tone-${alert.tone || 'info'}`}
        key={alert.key}
        onClick={() => onOpen(alert.target)}
      >
        <Icon size={17} />
        <span><b>{alert.label}</b><small>{alert.detail}</small></span>
        <em className="platform-alert-time">{alert.time}</em>
        <ArrowRight size={15} />
      </button>
    );
  });
}

function ServiceHealth() {
  // 演示用健康检查数据：uptime / 延迟 / 最近状态条
  const rows = [
    { name: '后端服务', uptime: '99.98%', latency: '42ms', bars: 24, degraded: 0, tone: 'ok' },
    { name: '数据库', uptime: '100%', latency: '3ms', bars: 24, degraded: 0, tone: 'ok' },
    { name: '任务调度', uptime: '99.91%', latency: '—', bars: 24, degraded: 1, tone: 'ok' },
    { name: '媒体 Provider', uptime: '99.72%', latency: '318ms', bars: 24, degraded: 2, tone: 'warn' },
    { name: '文件存储', uptime: '100%', latency: '6ms', bars: 24, degraded: 0, tone: 'ok' },
  ];
  const badCount = rows.filter(r => r.tone !== 'ok').length;

  return (
    <div className="service-health">
      <div className="service-health-summary">
        <span className={`service-health-state tone-${badCount ? 'warn' : 'ok'}`}>
          <i />{badCount ? `${badCount} 项降级` : '全部正常运行'}
        </span>
        <span className="service-health-last">最近检查 12 秒前 · 每分钟自动探测</span>
      </div>

      <div className="service-health-head">
        <span>组件</span><span>可用性</span><span>延迟</span><span>24 小时</span>
      </div>

      {rows.map(row => (
        <div className="service-health-row" key={row.name}>
          <b className="service-health-name">
            <span className={`service-health-dot tone-${row.tone}`} />{row.name}
          </b>
          <span className="service-health-uptime">{row.uptime}</span>
          <span className={`service-health-latency${row.latency === '—' ? ' is-empty' : ''}`}>{row.latency}</span>
          <span className="service-health-bars" aria-label={`${row.name} 24 小时状态`}>
            {Array.from({ length: row.bars }, (_, i) => (
              <i key={i} className={i >= row.bars - row.degraded ? 'degraded' : ''} />
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------- 用户与权限 ---------- */

const ROLE_NAME = { superadmin: '平台管理员', 'org.admin': '组织管理员', 'org.user': '组织成员' };
const DAY_MS = 86400000;

/** 相对时间：未来/无效返回空串 */
function relTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - Number(ts);
  if (!Number.isFinite(diff) || diff < 0) return '';
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < DAY_MS) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 30 * DAY_MS) return `${Math.floor(diff / DAY_MS)} 天前`;
  return `${Math.floor(diff / (30 * DAY_MS))} 个月前`;
}

function PlatformUsers({ onToast, initialOrg = '' }) {
  const [data, setData] = useState({ items: [], totals: {} });
  const [query, setQuery] = useState('');
  const [orgFilter, setOrgFilter] = useState(initialOrg || '全部组织');
  const [roleFilter, setRoleFilter] = useState('全部角色');
  const [statusFilter, setStatusFilter] = useState('全部状态');
  const [activeFilter, setActiveFilter] = useState('全部活跃度');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [openActions, setOpenActions] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.platformUsers());
      setError('');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 从组织详情跳转时，预设组织筛选
  useEffect(() => { if (initialOrg) setOrgFilter(initialOrg); }, [initialOrg]);

  const users = data.items || [];
  const orgNames = useMemo(() => [...new Set(users.map(user => user.orgName).filter(Boolean))], [users]);
  // 活跃度筛选：用于账号治理（如“30 天未登录”）
  const matchesActivity = user => {
    if (activeFilter === '全部活跃度') return true;
    const last = Number(user.lastSeenAt || user.lastLoginAt || 0);
    const age = last ? Date.now() - last : Infinity;
    if (activeFilter === 'never') return !last;
    if (activeFilter === 'inactive-30') return age >= 30 * DAY_MS;
    if (activeFilter === 'recent-7') return age < 7 * DAY_MS;
    return true;
  };

  const filtered = users.filter(user =>
    `${user.email} ${user.orgName || ''}`.toLowerCase().includes(query.toLowerCase())
    && (orgFilter === '全部组织' || user.orgName === orgFilter)
    && (roleFilter === '全部角色' || user.role === roleFilter)
    && (statusFilter === '全部状态' || user.status === statusFilter)
    && matchesActivity(user));

  // 分页：每页 10 条
  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // 筛选条件变化时回到第一页
  useEffect(() => { setPage(1); }, [query, orgFilter, roleFilter, statusFilter, activeFilter]);

  const toggleStatus = async user => {
    const next = user.status === 'active' ? 'disabled' : 'active';
    try {
      await api.setPlatformUserStatus(user.id, next);
      onToast(`${user.email} 已${next === 'disabled' ? '停用' : '启用'}`);
      setOpenActions(null);
      await load();
    } catch (err) { onToast(err.message); }
  };

  // 从组织总览跳转：只保留组织维度，清除其余筛选
  const focusOrg = name => {
    setQuery('');
    setActiveFilter('全部活跃度');
    setStatusFilter('全部状态');
    setRoleFilter('全部角色');
    setOrgFilter(name);
    setPage(1);
  };

  const revoke = async user => {    try {
      const result = await api.revokePlatformUserSessions(user.id);
      onToast(`已强制 ${user.email} 下线（撤销 ${result.sessions} 个会话）`);
      setOpenActions(null);
      await load();
    } catch (err) { onToast(err.message); }
  };

  const totals = data.totals || {};

  return (
    <div className="platform-users-page">
      <PanelHeading title="用户与权限" description="平台用户目录、账号管理与角色权限" />
      <ErrorBanner message={error} onRetry={load} />

      <div className="admin-metrics platform-user-metrics">
        <StatTile icon={Users} label="用户总数" value={count(totals.users)} />
        <StatTile icon={ShieldAlert} label="平台管理员" value={count(totals.superadmins)} />
        <StatTile icon={Building2} label="组织管理员" value={count(totals.orgAdmins)} />
        <StatTile icon={Activity} label="已停用" value={count(totals.disabled)} />
      </div>

      <article className="admin-card platform-org-overview">
        <div className="admin-card-head"><div><h3>组织成员总览</h3><p>按组织查看成员角色分布</p></div></div>
        <div className="org-member-grid">
          {orgNames.map(name => {
            const members = users.filter(user => user.orgName === name);
            const admins = members.filter(user => user.role === 'org.admin').length;
            const total = members.length;
            return (
              <button type="button" className="org-member-summary" key={name} onClick={() => focusOrg(name)}>
                <b>{name}</b>
                <span>{admins} 管理员</span>
                <span>{total - admins} 成员</span>
                <ArrowRight size={14} />
              </button>
            );
          })}
        </div>
        {!orgNames.length && <EmptyState title="暂无组织" />}
        {orgNames.length > 0 && (
          <footer className="org-member-total">
            <span>合计 {orgNames.length} 个组织</span>
            <span>{users.filter(u => u.role === 'org.admin').length} 管理员 · {users.filter(u => u.role === 'org.user').length} 成员</span>
          </footer>
        )}
      </article>

      <article className="admin-card platform-user-directory">
        <div className="admin-card-head">
          <div><h3>平台用户目录</h3><p>跨组织查看账号及角色</p></div>
          <span className="table-total">{loading ? '读取中…' : `${filtered.length} 位用户`}</span>
        </div>
        <div className="platform-user-filters">
          <label><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索邮箱或组织" /></label>
          <select aria-label="筛选组织" value={orgFilter} onChange={event => setOrgFilter(event.target.value)}>
            <option>全部组织</option>
            {orgNames.map(name => <option key={name}>{name}</option>)}
          </select>
          <select aria-label="筛选角色" value={roleFilter} onChange={event => setRoleFilter(event.target.value)}>
            <option value="全部角色">全部角色</option>
            <option value="superadmin">平台管理员</option>
            <option value="org.admin">组织管理员</option>
            <option value="org.user">组织成员</option>
          </select>
          <select aria-label="筛选状态" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            <option value="全部状态">全部状态</option>
            <option value="active">正常</option>
            <option value="disabled">已停用</option>
          </select>
          <select aria-label="筛选活跃度" value={activeFilter} onChange={event => setActiveFilter(event.target.value)}>
            <option value="全部活跃度">全部活跃度</option>
            <option value="recent-7">近 7 日活跃</option>
            <option value="inactive-30">30 天未活跃</option>
            <option value="never">从未登录</option>
          </select>
        </div>

        <div className="platform-user-table">
          <div className="platform-user-head">
            <span>账号</span><span>角色</span><span>所属组织</span><span>最近登录</span><span>最后活跃</span><span>状态</span><span>账号操作</span>
          </div>
          {pageRows.map(user => (
            <div className={`platform-user-row${user.status === 'disabled' ? ' is-disabled' : ''}`} key={user.id}>
              <b>{user.email}</b>
              <span><i className={`user-role-dot ${user.role === 'superadmin' ? 'platform' : ''}`} />{ROLE_NAME[user.role] || user.role}</span>
              <span>{user.orgName || '—'}</span>
              <span className={user.lastLoginAt ? '' : 'is-muted'}>
                {user.lastLoginAt
                  ? new Date(user.lastLoginAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                  : '从未登录'}
              </span>
              <span className={user.lastSeenAt ? 'user-seen' : 'is-muted'} title={user.lastSeenAt ? new Date(user.lastSeenAt).toLocaleString('zh-CN') : ''}>
                {user.lastSeenAt ? relTime(user.lastSeenAt) : '—'}
              </span>
              <span className={`user-status ${user.status}`}>
                {user.status === 'active' ? '正常' : <><AlertTriangle size={10} />已停用</>}
              </span>
              <div className="platform-user-actions">
                <button
                  type="button"
                  className="user-action-trigger"
                  aria-label={`${user.email}的账号操作`}
                  aria-haspopup="menu"
                  aria-expanded={openActions === user.id}
                  onClick={() => setOpenActions(current => (current === user.id ? null : user.id))}
                >
                  <MoreHorizontal size={16} />
                </button>
                {openActions === user.id && (
                  <div className="user-action-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => toggleStatus(user)}>
                      {user.status === 'active' ? '停用账号' : '启用账号'}
                    </button>
                    <button type="button" role="menuitem" onClick={() => revoke(user)}>强制下线</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {!filtered.length && <EmptyState title={loading ? '正在读取用户…' : '没有匹配的用户'} description={loading ? '' : '调整筛选条件再试。'} />}
        </div>
        {filtered.length > 0 && (
          <footer className="org-pagination">
            <span>{filtered.length} 位用户 · 第 {currentPage}/{totalPages} 页</span>
            <button type="button" disabled={currentPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>上一页</button>
            <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>下一页</button>
          </footer>
        )}
      </article>

    </div>
  );
}

function StatTile({ icon: Icon, label, value }) {
  return (
    <article className="admin-metric">
      <div className="admin-metric-top">
        <span className="admin-metric-icon"><Icon size={18} /></span>
        <span className="admin-metric-label">{label}</span>
      </div>
      <strong>{value}</strong>
    </article>
  );
}

/* ---------- 平台用量 ---------- */

function PlatformUsage({ organizations, onTrace }) {
  const [range, setRange] = useState('本月');
  const [orgFilter, setOrgFilter] = useState('全部组织');

  const rows = useMemo(() => organizations
    .filter(org => orgFilter === '全部组织' || org.id === orgFilter)
    .map(org => {
      const granted = Number(org.quota_granted) || 0;
      const used = Number(org.quota_used) || 0;
      const reserved = Number(org.quota_reserved) || 0;
      return { org, granted, used, reserved, remaining: Math.max(0, granted - used - reserved) };
    }), [organizations, orgFilter]);

  const total = key => rows.reduce((sum, row) => sum + row[key], 0);

  // 本月进度：已过天数 / 总天数，用于推算月末消耗
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayPassed = now.getDate();
  const monthProgress = dayPassed / daysInMonth;

  const grantedTotal = total('granted');
  const usedTotal = total('used') + total('reserved');
  const projected = monthProgress > 0 ? usedTotal / monthProgress : 0;
  const projectionRate = grantedTotal ? projected / grantedTotal : 0;
  const willOverspend = projectionRate > 1;

  // 各组织预测：按相同速率推到月末
  const forecast = rows
    .map(row => {
      const consumed = row.used + row.reserved;
      const proj = monthProgress > 0 ? consumed / monthProgress : 0;
      return {
        ...row,
        consumed,
        proj,
        rate: row.granted ? consumed / row.granted : 0,
        projRate: row.granted ? proj / row.granted : 0,
      };
    })
    .sort((a, b) => b.projRate - a.projRate);

  const tasksTotal = forecast.reduce((sum, i) => sum + (Number(i.org.task_count) || 0), 0);
  const tokensTotal = forecast.reduce((sum, i) => sum + (Number(i.org.month_tokens) || 0), 0);
  const costTotal = forecast.reduce((sum, i) => sum + (Number(i.org.month_cost_cny) || 0), 0);
  const exportCsv = () => {
    const data = [['组织', '授予额度', '已用', '预占', '剩余'], ...rows.map(row => [row.org.name, row.granted, row.used, row.reserved, row.remaining])];
    downloadCsv('平台用量与额度.csv', data);
  };

  if (!organizations.length) {
    return (
      <>
        <PanelHeading title="平台用量" description="按组织汇总额度与消耗" />
        <article className="admin-card"><EmptyState title="暂无组织数据" description="创建组织并划拨额度后可在此查看用量。" /></article>
      </>
    );
  }

  return (
    <div className="usage-page">
      <PanelHeading title="平台用量" description="额度账本与组织消耗，数据来自本月实时统计" />
      <div className="usage-toolbar">
        <div>
          <label>时间范围
            <select value={range} onChange={event => setRange(event.target.value)}>
              {['全部', '今天', '近 7 天', '近 30 天', '本月'].map(item => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>组织
            <select value={orgFilter} onChange={event => setOrgFilter(event.target.value)}>
              <option value="全部组织">全部组织</option>
              {organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
          </label>
        </div>
        <div>
          <button type="button" className="admin-outline" onClick={exportCsv}><Download size={14} />导出 CSV</button>
          <button type="button" className="admin-primary" onClick={onTrace}>查看调用追踪 <ArrowRight size={14} /></button>
        </div>
      </div>



      <article className="admin-card usage-table-card">
        <div className="admin-card-head">
          <h3>按组织汇总</h3>
          <div className="usage-head-actions">
            <span>{range}</span>
            <button type="button" className="admin-link" onClick={onTrace}>查看调用明细 <ArrowRight size={14} /></button>
          </div>
        </div>
        <div className="usage-table">
          <div className="usage-table-head usage-combined-head">
            <span>组织</span><span>任务</span><span>Tokens</span><span>成本</span><span>授予</span><span>已用</span><span>预占</span><span>剩余</span><span>使用率 / 预计月末</span><span>状态</span>
          </div>
          {forecast.map(({ org, granted, used, reserved, remaining, rate, projRate }) => {
            const over = projRate > 1;
            return (
              <div
                className={`usage-table-row usage-combined-row${org.status === 'suspended' ? ' is-disabled' : ''}${over ? ' is-over' : ''}`}
                key={org.id}
                onClick={onTrace}
                role="button"
                tabIndex={0}
              >
                <b>{org.name}</b>
                <span>{count(org.task_count)}</span>
                <span>{count(org.month_tokens)}</span>
                <span className="usage-cost">¥{fmtMoney(org.month_cost_cny)}</span>
                <span>{count(granted)}</span>
                <span>{count(used)}</span>
                <span>{count(reserved)}</span>
                <span>{count(remaining)}</span>
                <span className="usage-rate-cell">
                  <i className="usage-rate-bar">
                    <em style={{ width: `${Math.min(100, rate * 100)}%` }} />
                    <b className={`usage-rate-proj${over ? ' is-over' : ''}`} style={{ left: `${Math.min(100, projRate * 100)}%` }} />
                  </i>
                  <small>
                    {granted ? `${Math.round(rate * 100)}%` : '—'}
                    {granted && <em className={over ? 'is-over' : ''}>→{Math.round(projRate * 100)}%</em>}
                  </small>
                </span>
                <span className={`user-status ${org.status === 'suspended' ? 'disabled' : 'active'}`}>
                  {org.status === 'suspended' ? '已停用' : '正常'}
                </span>
              </div>
            );
          })}
          <div className="usage-table-total">
            <b>合计 {forecast.length} 个组织</b>
            <span>{count(tasksTotal)} 任务</span>
            <span>{count(tokensTotal)} Tokens</span>
            <span>¥{fmtMoney(costTotal)}</span>
            <span>{count(grantedTotal)}</span>
            <span>{count(total('used'))}</span>
            <span>{count(total('reserved'))}</span>
            <span>{count(total('remaining'))}</span>
            <span className={willOverspend ? 'is-danger' : ''}>
              {Math.round(monthProgress * 100)}% 时间 · 预计 {Math.round(projectionRate * 100)}%
            </span>
            <span>{willOverspend ? '预计超支' : '充裕'}</span>
          </div>
        </div>
      </article>
    </div>
  );
}

/* ---------- 组织管理 ---------- */

function OrgTable({ rows, onChanged, onToast, onError, onOpenMembers }) {
  const params = new URLSearchParams(window.location.search);
  const [query, setQuery] = useState(params.get('q') || '');
  const [status, setStatus] = useState(params.get('status') || 'all');
  const [sort, setSort] = useState(params.get('sort') || 'created_at');
  const [page, setPage] = useState(Number(params.get('page')) || 1);
  const [selected, setSelected] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    // 详情页（/platform/organizations/:id）不能覆写 URL，否则会把组织 ID 丢掉
    if (!window.location.pathname.startsWith(ORG_LIST_PATH)) return;
    if (window.location.pathname.startsWith(`${ORG_LIST_PATH}/`)) return;
    const next = new URLSearchParams();
    if (query) next.set('q', query);
    if (status !== 'all') next.set('status', status);
    if (sort !== 'created_at') next.set('sort', sort);
    if (page > 1) next.set('page', page);
    const queryString = next.toString();
    const nextPath = `${ORG_LIST_PATH}${queryString ? `?${queryString}` : ''}`;
    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      window.history.replaceState({}, '', nextPath);
    }
  }, [query, status, sort, page]);

  useEffect(() => {
    const onPop = () => {
      // URL 变化时清空手选状态，回到“由 URL 驱动详情”的模式
      setSelected(null);
      // 强制重新渲染，让 detailId 重新从 URL 读取
      setReloadKey(key => key + 1);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const filtered = rows
    .filter(org => org.name.toLowerCase().includes(query.toLowerCase()) && (status === 'all' || org.status === status))
    .sort((a, b) => (sort === 'members' ? (b.member_count || 0) - (a.member_count || 0)
      : sort === 'tasks' ? (b.task_count || 0) - (a.task_count || 0)
        : sort === 'quota' ? (b.quota_granted || 0) - (a.quota_granted || 0)
          : (b.created_at || 0) - (a.created_at || 0)));
  const pageSize = 8;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  const detailId = window.location.pathname.startsWith(`${ORG_LIST_PATH}/`) ? decodeURIComponent(window.location.pathname.split('/').pop()) : '';
  // URL 优先：搜索跳转改了 URL，就不能再被旧的 selected 覆盖
  const detailOrg = detailId
    ? rows.find(org => org.id === detailId) || (selected?.id === detailId ? selected : null)
    : selected;

  if (detailId && !detailOrg) {
    return (
      <section className="org-detail-empty">
        <h2>找不到这个组织</h2>
        <button type="button" className="admin-outline" onClick={() => { window.history.pushState({}, '', ORG_LIST_PATH + window.location.search); setSelected(null); }}>返回组织列表</button>
      </section>
    );
  }

  if (detailOrg) {
    return (
      <OrganizationDetail
        org={detailOrg}
        granting={granting}
        onBack={() => { window.history.pushState({}, '', ORG_LIST_PATH + window.location.search); setSelected(null); }}
        onChanged={async () => { await onChanged(); }}
        onToast={onToast}
        onError={onError}
        onGranting={setGranting}
        onOpenMembers={onOpenMembers}
      />
    );
  }

  const openOrg = org => {
    window.history.pushState({}, '', `${ORG_LIST_PATH}/${encodeURIComponent(org.id)}${window.location.search}`);
    setSelected(org);
  };

  return (
    <>
      <PanelHeading title="组织管理" description="查看全部组织的成员、额度与运行状态" />
      <div className="org-toolbar">
        <label><Search size={15} /><input value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="搜索组织" /></label>
        <select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} aria-label="筛选组织状态">
          <option value="all">所有状态</option>
          <option value="active">正常</option>
          <option value="suspended">已停用</option>
        </select>
        <select value={sort} onChange={event => setSort(event.target.value)} aria-label="排序方式">
          <option value="created_at">按创建时间</option>
          <option value="members">按成员数</option>
          <option value="tasks">按任务数</option>
          <option value="quota">按额度</option>
        </select>
        <span>{filtered.length} 个组织</span>
      </div>
      <article className="admin-card platform-org-card">
        <div className="platform-org-table">
          <div className="platform-org-head">
            <span>组织</span><span>管理员</span><span>成员</span><span>项目 / 任务</span><span>额度已用 / 总额</span><span>消耗金额</span><span>状态</span>
          </div>
          {visible.map(org => (
            <div className="platform-org-row org-click-row" key={org.id} onClick={() => openOrg(org)}>
              <span className="platform-org-name"><i><Building2 size={16} /></i><b>{org.name}</b></span>
              <span title={org.admin_email || '待邀请接受'}>{org.admin_email || '待邀请接受'}</span>
              <span>{count(org.member_count)}</span>
              <span>{count(org.project_count)} / {count(org.task_count)}</span>
              <span>{count(org.quota_used)} / {count(org.quota_granted)} 积分</span>
              <span>{count(org.month_tokens)} tok</span>
              <span>{org.status === 'suspended' ? '已停用' : '正常'}</span>
            </div>
          ))}
          {!visible.length && <EmptyState title="没有匹配的组织" description="调整筛选条件再试。" />}
        </div>
        <footer className="org-pagination">
          <span>第 {page} / {pages} 页</span>
          <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</button>
          <button type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>下一页</button>
        </footer>
      </article>
    </>
  );
}

/* ---------- 组织详情：管理员视角 mock 数据 ---------- */
const PLAN_META = {
  free: { label: '免费版', tone: 'free' },
  trial: { label: '试用版', tone: 'trial' },
  pro: { label: '专业版', tone: 'pro' },
  enterprise: { label: '企业版', tone: 'enterprise' },
};

function buildOrgFacts(org) {
  const total = Number(org.quota_granted) || 0;
  const used = Number(org.quota_used) || 0;
  const reserved = Number(org.quota_reserved) || 0;
  const remaining = Math.max(0, total - used - reserved);
  const days = Math.max(1, Math.ceil(remaining / Math.max(1, Math.round((used + reserved) / 26))));
  const daysText = days > 365 ? '一年以上' : `${days} 天`;
  const created = Number(org.created_at) || Date.now();
  const trialLeft = Math.max(0, 30 - Math.floor((Date.now() - created) / 86400000));
  return {
    total, used, reserved, remaining, days, daysText, trialLeft,
    id: org.id,
    memberCount: Number(org.member_count) || 0,
    activeMembers: Math.max(1, Math.round((Number(org.member_count) || 0) * 0.8)),
    taskCount: Number(org.task_count) || 0,
    failedTasks: 8,
    plan: trialLeft > 0 ? '试用中' : '预付',
    region: '华东 · cn-shanghai',
    sla: '标准',
    lastActive: '3 小时前',
    renewAt: '2026/12/19',
  };
}

function OrganizationDetail({ org, onBack, onChanged, onToast, onError, granting, onGranting, onOpenMembers }) {
  const [amount, setAmount] = useState('');
  const [quotaOpen, setQuotaOpen] = useState(false);

  const facts = buildOrgFacts(org);
  const { total, used, reserved, remaining, days, daysText, trialLeft } = facts;
  const percent = total ? Math.min(100, Math.round(((used + reserved) / total) * 100)) : 0;
  const successRate = facts.taskCount + facts.failedTasks > 0
    ? Math.round((facts.taskCount / (facts.taskCount + facts.failedTasks)) * 100)
    : 100;

  const planKey = PLAN_META[org.plan] ? org.plan : 'free';
  const planMeta = PLAN_META[planKey];
  const trialEndsAt = Number(org.trial_ends_at) || 0;
  const trialDaysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt - Date.now()) / 86400000)) : 0;

  const submitGrant = async event => {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isSafeInteger(value) || value <= 0) return;
    onGranting(true);
    try {
      await api.grantOrgQuota(org.id, value);
      onToast(`已为「${org.name}」划拨 ${value} 积分`);
      setQuotaOpen(false);
      setAmount('');
      await onChanged();
    } catch (err) { onError(err.message); }
    finally { onGranting(false); }
  };

  const setStatus = async next => {
    try {
      await api.setPlatformOrgStatus(org.id, next);
      onToast(`组织已${next === 'suspended' ? '停用' : '启用'}`);
      await onChanged();
    } catch (err) { onError(err.message); }
  };

  return (
    <div className="org-detail-page">
      <div className="org-detail-actions">
        <button type="button" className="admin-link" onClick={onBack}>← 组织</button>
        <button type="button" className="admin-outline" onClick={() => onOpenMembers?.(org.name)}>
          <Users size={13} />查看成员
        </button>
        <button type="button" className="admin-primary" onClick={() => setQuotaOpen(true)}>划拨额度</button>
        <button type="button" className="admin-outline" onClick={() => setStatus(org.status === 'suspended' ? 'active' : 'suspended')}>
          {org.status === 'suspended' ? '启用' : '停用'}
        </button>
      </div>
      <div className="org-detail-heading">
        <div>
          <h1>{org.name}</h1>
          <p>
            <span className={`org-status ${org.status === 'suspended' ? 'off' : ''}`}>{org.status === 'suspended' ? '已停用' : '正常'}</span>
            <span className={`org-plan-tag tone-${planMeta.tone}`}>{planMeta.label}</span>
            <span>管理员 {org.admin_email || '待指派'}</span>
          </p>
        </div>
      </div>
      {org.status === 'suspended' && <div className="org-suspended-banner">该组织已暂停，成员无法访问</div>}

      <div className="org-detail-metrics">
        <button
          type="button"
          className="admin-metric org-metric-link"
          onClick={() => onOpenMembers?.(org.name)}
          title={`查看「${org.name}」的成员`}
        >
          <span>活跃成员 <ArrowRight size={11} /></span>
          <b>{facts.activeMembers}<em>/{facts.memberCount}</em></b>
        </button>
        <article className="admin-metric">
          <span>任务成功率</span>
          <b>{successRate}<em>%</em></b>
        </article>
        <article className="admin-metric">
          <span>本月积分消耗</span>
          <b>{count(used)}<em>{total ? `/${count(total)}` : ''}</em></b>
        </article>
        <article className="admin-metric">
          <span>额度剩余</span>
          <b>{count(remaining)}<em>{total ? `/${count(total)}` : ''}</em></b>
        </article>
        <article className="admin-metric">
          <span>预计耗尽</span>
          <b style={{ fontSize: daysText === '一年以上' ? 16 : undefined }}>{daysText}</b>
        </article>
      </div>

      <div className="org-detail-content">
        <div className="org-overview-grid">
          <article className="admin-card org-info-card">
            <h3>组织信息</h3>
            <dl>
              <div><dt>组织 ID</dt><dd title={facts.id}>{facts.id}</dd></div>
              <div><dt>管理员</dt><dd>{org.admin_email || '待指派'}</dd></div>
              <div><dt>创建时间</dt><dd>{new Date(org.created_at || Date.now()).toLocaleDateString('zh-CN')}</dd></div>
              <div><dt>最后活跃</dt><dd>{facts.lastActive}</dd></div>
              <div><dt>套餐</dt><dd>{planMeta.label}</dd></div>
              <div><dt>试用到期</dt><dd>{trialEndsAt ? `${new Date(trialEndsAt).toLocaleDateString('zh-CN')}（剩 ${trialDaysLeft} 天）` : '不适用'}</dd></div>
              <div><dt>数据区域</dt><dd>{facts.region}</dd></div>
              <div><dt>SLA 等级</dt><dd>{facts.sla}</dd></div>
            </dl>
          </article>
          <article className="admin-card org-quota-card">
            <div className="org-card-heading"><div><h3>额度使用情况</h3><p>本月额度统计</p></div><span>{percent}% 已使用</span></div>
            <div className="org-quota-chart-wrap">
              <div
                className="org-quota-chart"
                style={{ '--quota-used': `${total ? Math.round((used / total) * 100) : 0}%`, '--quota-reserved': `${total ? Math.round((reserved / total) * 100) : 0}%` }}
                role="img"
                aria-label={`额度已使用 ${count(used)}，预占 ${count(reserved)}，剩余 ${count(remaining)}`}
              >
                <div><b>{percent}%</b><small>使用率</small></div>
              </div>
              <div className="org-quota-legend">
                <span><i />已使用 <b>{count(used)}</b></span>
                <span><i />预占 <b>{count(reserved)}</b></span>
                <span><i />剩余 <b>{count(remaining)}</b></span>
                <strong>总额度 {count(total)}</strong>
              </div>
            </div>
            <p className="org-quota-forecast">按近 7 日消耗速率，预计 <b>{daysText}</b>后用尽额度</p>
          </article>

          <article className="admin-card org-risk-card">
            <div className="org-card-heading"><div><h3>风险与提醒</h3><p>需要平台侧关注的事项</p></div></div>
            <ul className="org-risk-list">
              <li className="tone-danger"><AlertTriangle size={15} /><span><b>{facts.failedTasks} 个任务失败</b><small>最近 24 小时，已重试 3 次</small></span><ArrowRight size={14} /></li>
              {trialLeft > 0 && <li className="tone-warn"><Gauge size={15} /><span><b>试用期剩 {trialLeft} 天</b><small>到期后将暂停新建任务</small></span><ArrowRight size={14} /></li>}
              <li className="tone-info"><Activity size={15} /><span><b>额度预计 {daysText}耗尽</b><small>当前剩余 {count(remaining)} 积分</small></span><ArrowRight size={14} /></li>
            </ul>
          </article>

          <article className="admin-card org-activity-card">
            <div className="org-card-heading"><div><h3>最近活动</h3><p>该组织的审计流水</p></div></div>
            <ul className="org-audit-list">
              <li className="org-audit-item"><span className="org-audit-mark" /><div><b>任务创建</b><small>producer@dapao.demo · 11-19 10:42</small></div></li>
              <li className="org-audit-item"><span className="org-audit-mark" /><div><b>成员角色变更</b><small>{org.admin_email || '管理员'} · 11-19 09:15</small></div></li>
              <li className="org-audit-item"><span className="org-audit-mark" /><div><b>额度划拨</b><small>平台管理员 · 11-18 16:20</small></div></li>
              <li className="org-audit-item"><span className="org-audit-mark" /><div><b>组织信息更新</b><small>{org.admin_email || '管理员'} · 11-17 14:08</small></div></li>
            </ul>
          </article>
        </div>
      </div>

      {quotaOpen && (
        <div className="admin-modal-backdrop">
          <form className="admin-modal" onSubmit={submitGrant}>
            <button type="button" className="modal-x" onClick={() => setQuotaOpen(false)} aria-label="关闭"><X size={18} /></button>
            <h2>划拨额度</h2>
            <p>为「{org.name}」增加本月可用额度。</p>
            <label>积分数量
              <input autoFocus type="number" min="1" max="1000000000" step="1" required value={amount} onChange={event => setAmount(event.target.value)} placeholder="输入积分数量" />
            </label>
            <div className="modal-actions">
              <button type="button" className="admin-outline" disabled={granting} onClick={() => setQuotaOpen(false)}>取消</button>
              <button type="submit" className="admin-primary" disabled={granting}>{granting ? '正在划拨…' : '确认划拨'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* ---------- 操作审计 ---------- */

function PlatformAudit({ audits, organizations, currentUser }) {
  const [org, setOrg] = useState('全部组织');
  const [actor, setActor] = useState('全部操作人');
  const [action, setAction] = useState('全部动作');
  const [range, setRange] = useState('全部时间');
  const [page, setPage] = useState(1);

  const rows = useMemo(() => audits.map(item => {
    // 目标：UUID 换成组织名；套餐变更显示 from → to
    let target = item.target || '';
    const asOrg = organizations.find(o => o.id === target);
    if (asOrg) target = asOrg.name;
    else if (target.includes('@')) { /* 邮箱原样展示 */ }
    else if (!target) target = '—';
    let detail = '';
    if (item.action === 'org.plan.changed' && item.details) {
      const d = typeof item.details === 'string' ? safeParseJson(item.details) : item.details;
      if (d?.from || d?.to) detail = `${d.from || '?'} → ${d.to || '?'}`;
    }
    return {
      ...item,
      orgName: item.org_name || '—',
      targetText: detail || target || '—',
    };
  }), [audits, organizations]);

  const actions = useMemo(() => [...new Set(rows.map(row => row.action))], [rows]);
  const cutoff = useMemo(() => {
    const date = new Date();
    if (range === '今天') date.setHours(0, 0, 0, 0);
    else if (range === '近 7 天') date.setDate(date.getDate() - 7);
    else if (range === '近 30 天') date.setDate(date.getDate() - 30);
    else if (range === '本月') date.setDate(1);
    else return 0;
    return date.getTime();
  }, [range]);

  const filtered = rows.filter(row =>
    (org === '全部组织' || row.orgName === org)
    && (actor === '全部操作人' || row.actor_email === actor)
    && (action === '全部动作' || row.action === action)
    && row.created_at >= cutoff);
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const visible = filtered.slice((page - 1) * 10, page * 10);
  const sensitive = value => /quota|status_changed|role_changed|member\.removed|user\.disabled/.test(value);

  return (
    <div className="audit-page">
      <PanelHeading title="操作审计" description={`平台与组织的关键操作记录${currentUser?.email ? ` · ${currentUser.email}` : ''}`} />
      <div className="audit-toolbar">
        <select value={org} onChange={event => { setOrg(event.target.value); setPage(1); }} aria-label="筛选组织">
          <option>全部组织</option>
          {organizations.map(item => <option key={item.id}>{item.name}</option>)}
        </select>
        <select value={actor} onChange={event => { setActor(event.target.value); setPage(1); }} aria-label="筛选操作人">
          <option>全部操作人</option>
          {[...new Set(rows.map(row => row.actor_email).filter(Boolean))].map(item => <option key={item}>{item}</option>)}
        </select>
        <select value={action} onChange={event => { setAction(event.target.value); setPage(1); }} aria-label="筛选动作">
          <option value="全部动作">全部动作</option>
          {actions.map(item => <option key={item} value={item}>{actionLabel(item)}</option>)}
        </select>
        <select value={range} onChange={event => setRange(event.target.value)} aria-label="筛选时间范围">
          {['全部时间', '今天', '近 7 天', '近 30 天', '本月'].map(item => <option key={item}>{item}</option>)}
        </select>
        <button type="button" className="admin-outline" onClick={() => downloadCsv('平台操作审计.csv', [['时间', '组织', '操作人', '动作', '目标'], ...filtered.map(row => [new Date(row.created_at).toLocaleString('zh-CN'), row.orgName, row.actor_email || '系统', actionLabel(row.action), row.targetText])])}>
          <Download size={14} />导出 CSV
        </button>
      </div>

      <article className="admin-card audit-card">
        <div className="audit-table">
          <div className="audit-head"><span>时间</span><span>组织</span><span>操作人</span><span>动作</span><span>目标</span></div>
          {visible.map(row => (
            <div className={`audit-row-grid ${sensitive(row.action) ? 'sensitive' : ''}`} key={row.id}>
              <span>{new Date(row.created_at).toLocaleString('zh-CN')}</span>
              <span>{row.orgName}</span>
              <span>{row.actor_email || '系统'}</span>
              <b>{actionLabel(row.action)}</b>
              <span title={row.targetText}>{row.targetText}</span>
            </div>
          ))}
          {!visible.length && <EmptyState title="暂无审计记录" description="组织与账号操作会记录在这里。" />}
        </div>
        <footer className="org-pagination">
          <span>{filtered.length} 条记录 · 第 {page}/{pages} 页</span>
          <button type="button" disabled={page <= 1} onClick={() => setPage(x => x - 1)}>上一页</button>
          <button type="button" disabled={page >= pages} onClick={() => setPage(x => x + 1)}>下一页</button>
        </footer>
      </article>
    </div>
  );
}

/* ---------- 工具 ---------- */

function exportAuditCsv(auditLogs) {
  downloadCsv('平台审计记录.csv', [
    ['时间', '操作', '操作人', '对象'],
    ...auditLogs.map(item => [new Date(item.created_at).toLocaleString('zh-CN'), actionLabel(item.action), item.actor_email || '系统', item.target || '']),
  ]);
}

function downloadCsv(filename, rows) {
  const csv = `\uFEFF${rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
