import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import GlobalSearch from './GlobalSearch.jsx';
import AdminUserMenu from './AdminUserMenu.jsx';

/**
 * 平台管理 / 组织管理 共用的侧栏工作区骨架。
 *
 * 两个面板（superadmin、org.admin）共用同一套布局与视觉语言：
 * 左侧固定侧栏 + 顶栏工具条 + 右侧内容区。
 * 差异只在 tabs 列表与内容区渲染函数。
 */
export default function AdminWorkspace({
  workspaceIcon: WorkspaceIcon,
  workspaceTitle,
  workspaceSubtitle,
  navLabel = '菜单',
  tabs,
  activeTab,
  onTabChange,
  breadcrumbParent = '平台管理',
  userLabel = '管理员',
  userInitial = '管',
  statusOk = true,
  statusText = '平台服务正常',
  searchPlaceholder = '搜索组织、用户、任务或审计…',
  onSearchNavigate,
  loadSearchIndex,
  user,
  org,
  role,
  onLogout,
  onNavigate,
  collapsed: collapsedProp,
  onCollapsedChange,
  sidebarExtra,
  children,
}) {
  const [collapsedState, setCollapsedState] = useState(false);
  const collapsed = collapsedProp ?? collapsedState;
  const toggle = () => {
    const next = !collapsed;
    if (collapsedProp === undefined) setCollapsedState(next);
    onCollapsedChange?.(next);
  };

  return (
    <div className={`admin-workspace ${collapsed ? 'collapsed' : ''}`}>
      <aside className="admin-workspace-sidebar">
        <div className="admin-workspace-brand">
          <span className="admin-workspace-mark">{WorkspaceIcon ? <WorkspaceIcon size={17} /> : 'AI'}</span>
          {!collapsed && (
            <div>
              <b>{workspaceTitle}</b>
              <small>{workspaceSubtitle}</small>
            </div>
          )}
        </div>

        {!collapsed && <div className="admin-workspace-nav-label">{navLabel}</div>}
        <nav className="admin-workspace-nav" aria-label={`${workspaceTitle}导航`}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                title={collapsed ? tab.label : undefined}
                className={activeTab === tab.key ? 'selected' : ''}
                onClick={() => onTabChange(tab.key)}
              >
                {Icon && <Icon size={17} />}
                {!collapsed && <span>{tab.label}</span>}
                {!collapsed && tab.badge != null && tab.badge !== '' && <em className="admin-workspace-badge">{tab.badge}</em>}
              </button>
            );
          })}
        </nav>

        {!collapsed && sidebarExtra}

        <div className="admin-workspace-foot">
          <span className={`platform-dot ${statusOk ? '' : 'offline'}`} />
          {!collapsed && statusText}
        </div>
      </aside>

      <section className="admin-workspace-body">
        <div className="admin-workspace-toolbar">
          <button type="button" className="sidebar-toggle" aria-label={collapsed ? '展开导航' : '折叠导航'} onClick={toggle}>
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
          <div className="workspace-breadcrumb">
            <span>{breadcrumbParent}</span>
            <b>/</b>
            <strong>{tabs.find(tab => tab.key === activeTab)?.label || ''}</strong>
          </div>
          <GlobalSearch placeholder={searchPlaceholder} onNavigate={onSearchNavigate} loadIndex={loadSearchIndex} />
          <button type="button" className="toolbar-icon" aria-label="通知">
            <Bell size={17} />
            <i />
          </button>
          <AdminUserMenu user={user} org={org} role={role} onLogout={onLogout} onNavigate={onNavigate} />
        </div>
        {children}
      </section>
    </div>
  );
}

/** 面板通用的轻量 toast */
export function useToast() {
  const [toast, setToast] = useState('');
  const timerRef = useRef(null);
  const show = useCallback(message => {
    setToast(String(message || ''));
    window.clearTimeout(timerRef.current);
    if (message) timerRef.current = window.setTimeout(() => setToast(''), 3600);
  }, []);
  useEffect(() => () => window.clearTimeout(timerRef.current), []);
  return [toast, show];
}

export function Toast({ message }) {
  if (!message) return null;
  return <div className="admin-toast" role="status">{message}</div>;
}

/** 统一的区块标题 */
export function PanelHeading({ title, description, children }) {
  return (
    <div className="platform-overview-head">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}

/** 统一的错误条 */
export function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="platform-load-error" role="alert">
      {message}
      {onRetry && <button type="button" className="admin-link" onClick={onRetry}>重试</button>}
    </div>
  );
}

/** 统一的空态 */
export function EmptyState({ title, description }) {
  return (
    <div className="platform-empty">
      <b>{title}</b>
      {description && <p>{description}</p>}
    </div>
  );
}
