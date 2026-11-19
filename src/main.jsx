import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Home,
  Video,
  LayoutGrid,
  FileText,
  Scissors,
  Image as ImageIcon,
  PanelLeft,
  Bot,
  Layers,
} from 'lucide-react';
import './style.css';
import AdminWorkspace from './components/AdminWorkspace.jsx';
import VideosPage from './pages/VideosPage.jsx';
import AgentsPage from './pages/AgentsPage.jsx';
import CanvasPage from './pages/CanvasPage.jsx';
import DecomposePage from './pages/DecomposePage.jsx';
import ScriptsPage from './pages/ScriptsPage.jsx';
import AssetsPage from './pages/AssetsPage.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import CreateWorkbench from './pages/CreateWorkbench.jsx';
import DistributePage from './pages/DistributePage.jsx';
import WorkspacePage from './pages/WorkspacePage.jsx';
import HomeDashboard from './pages/HomeDashboard.jsx';
import AdminPage from './pages/AdminPage.jsx';
import SuperadminPage from './pages/SuperadminPage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import { api, setToken } from './api.js';
// 主题覆盖必须最后加载：同优先级下才能盖住各页面自己的配色
import './theme.css';

const navItems = [
  { icon: Home, label: '首页' },
  { icon: Layers, label: '工作台' },

  { icon: Video, label: '成片' },


  { icon: FileText, label: '剧本' },

  { icon: ImageIcon, label: '资产' },



];

// 每个 tab 一个 URL：直接用浏览器地址栏、前进后退、刷新都能保持
// 工作台统一挂在 /app 下；/admin、/login、/invite 不属于工作台，保持独立
const APP_HOME = '/app/dashboard';
const TAB_ROUTES = {
  首页: APP_HOME,
  工作台: '/app/workspace',

  成片: '/app/videos',


  剧本: '/app/scripts',

  资产: '/app/assets',



  管理: '/admin',
  登录: '/login',
  邀请: '/invite',
};
// 平台/组织管理：两套面板共用同一工作区，各自有自己的 tab 路径
const ADMIN_PATHS = {
  '/admin': '平台概览',
  '/admin/overview': '平台概览',
  '/admin/organizations': '组织管理',
  '/admin/users': '用户与权限',
  '/admin/usage': '平台用量',
  '/admin/tracing': '调用追踪',
  '/admin/audit': '操作审计',
  '/admin/org/overview': '概览',
  '/admin/org/members': '成员管理',
  '/admin/org/quota': '额度分配',
  '/admin/org/projects': '项目管理',
  '/admin/org/usage': '用量与任务',
  '/admin/org/tracing': '调用追踪',
  '/admin/org/audit': '审计记录',
  '/admin/org/settings': '组织设置',
};
const isAdminPath = path => Object.hasOwn(ADMIN_PATHS, path)
  || path === '/platform/organizations'
  || path.startsWith('/platform/organizations/');

const isWorkspacePath = path => path === '/app/workspace' || path.startsWith('/app/workspace/projects/');
const normalizePath = path => (path.replace(/\/+$/, '') || '/');

const tabFromPath = () => {
  const path = normalizePath(window.location.pathname);
  if (isAdminPath(path)) return '管理';
  if (isWorkspacePath(path)) return '工作台';
  const found = Object.entries(TAB_ROUTES).find(([, route]) => route === path);
  return found ? found[0] : '首页';
};

const pathForTab = tab => TAB_ROUTES[tab] || APP_HOME;

function App() {
  const [activeTab, setActiveTab] = useState(tabFromPath);
  const [session, setSession] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [creationMode, setCreationMode] = useState('剧本成片');

  // 切 tab = pushState：浏览器前进/后退、刷新、直接贴 URL 都能用
  const navigate = useCallback(tab => {
    setActiveTab(tab);
    const path = pathForTab(tab);
    const current = normalizePath(window.location.pathname);
    if (current !== path || window.location.hash) {
      window.history.pushState({ tab }, '', path);
    }
    window.scrollTo({ top: 0 });
  }, []);

  const openProjectPage = (tab, project) => {
    setSelectedProject(project);
    navigate(tab);
  };

  useEffect(() => {
    let token = '';
    try { token = localStorage.getItem('huimeng_token') || ''; } catch { /* 隐私模式下按未登录处理 */ }
    if (!token) { setActiveTab('登录'); if (normalizePath(window.location.pathname) !== '/invite') window.history.replaceState({ tab: '登录' }, '', '/login'); setSessionReady(true); return; }
    api.session().then(value => {
      setSession(value);
      if (value.role === 'superadmin' || value.role === 'org.admin') {
        if (!normalizePath(window.location.pathname).startsWith('/app')) setActiveTab('管理');
        const current = normalizePath(window.location.pathname);
        if (!current.startsWith('/app') && !isAdminPath(current)) {
          window.history.replaceState({ tab: '管理' }, '', value.role === 'superadmin' ? '/admin/overview' : '/admin/org/overview');
        } else if (value.role === 'org.admin' && current.startsWith('/platform/')) {
          // 普通组织管理员误入平台页面，归一到自家面板
          window.history.replaceState({ tab: '管理' }, '', '/admin/org/overview');
        }
      }
      setSessionReady(true);
    })
      .catch(() => { setToken(''); setSession(null); setActiveTab('登录'); window.history.replaceState({ tab: '登录' }, '', '/login'); setSessionReady(true); });
  }, []);

  useEffect(() => {
    const onPop = () => setActiveTab(tabFromPath());
    window.addEventListener('popstate', onPop);
    // 未知路径归一到首页，不留死链
    const cur = normalizePath(window.location.pathname);
    if (!Object.values(TAB_ROUTES).includes(cur) && !isAdminPath(cur) && !isWorkspacePath(cur)) {
      const toWorkspace = ['/app/projects', '/app/breakdown', '/app/data', '/app/agents', '/app/create', '/app/distribute', '/app/canvas'].includes(cur);
      window.history.replaceState({ tab: '首页' }, '', toWorkspace ? '/app/workspace' : APP_HOME);
      if (toWorkspace) setActiveTab('工作台');
    }
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    document.title = `${activeTab} · AI绘梦`;
  }, [activeTab]);

  const isAdmin = session?.role === 'superadmin' || session?.role === 'org.admin';
  useEffect(() => { if (sessionReady && activeTab === '管理' && !isAdmin) navigate(session ? '首页' : '登录'); }, [sessionReady, activeTab, isAdmin, session, navigate]);
  useEffect(() => { if (sessionReady && session && activeTab === '登录') navigate(isAdmin ? '管理' : '首页'); }, [sessionReady, session, activeTab, isAdmin, navigate]);
  if (!sessionReady) return <div className="auth-loading">正在验证登录状态…</div>;
  if (!session) return <AuthPage onAuthenticated={value => {
    const role = value.role || value.org?.role || 'org.user';
    const authenticated = { ...value, role };
    setSession(authenticated);
    navigate(role === 'superadmin' || role === 'org.admin' ? '管理' : '首页');
  }} />;
  if (activeTab === '登录') return <AuthPage onAuthenticated={value => {
    const role = value.role || value.org?.role || 'org.user';
    setSession({ ...value, role });
    navigate(role === 'superadmin' || role === 'org.admin' ? '管理' : '首页');
  }} />;
  const logout = async () => { try { await api.logout(); } catch { /* 本地退出仍应可用 */ } finally { setToken(''); setSession(null); navigate('登录'); } };
  if (isAdmin && activeTab === '管理') return <div className="app-shell admin-shell">{session.role === 'superadmin'
    ? <SuperadminPage user={session.user} org={session.org} role={session.role} onLogout={logout} onNavigate={navigate} />
    : <AdminPage org={session.org} user={session.user} role={session.role} onLogout={logout} onNavigate={navigate} />}</div>;

  return (
    <AdminWorkspace
      workspaceIcon={Home}
      workspaceTitle="AI绘梦"
      workspaceSubtitle="创作工作台"
      navLabel="工作台"
      tabs={navItems.map(({ icon, label }) => ({ key: label, label, icon }))}
      activeTab={activeTab}
      onTabChange={navigate}
      breadcrumbParent="工作台"
      user={session.user}
      org={session.org}
      role={session.role}
      onLogout={logout}
      onNavigate={label => {
        if (typeof label === 'string' && label.startsWith('/')) navigate('首页');
        else navigate(label);
      }}
      statusText="工作台运行正常"
      searchPlaceholder="搜索项目、剧本或素材…"
    >
      {/* 视图分发：根据选中的 Tab 渲染 */}
      {activeTab === '首页' ? (
        <HomeDashboard
          user={session.user}
          org={session.org}
          onNavigate={navigate}
        />
) : activeTab === '工作台' ? (
        <WorkspacePage onNavigate={navigate} role={session.role} />
      ) : activeTab === '创作' ? (
        <CreateWorkbench mode={creationMode} projectId={selectedProject?.id} projectName={selectedProject?.name} onModeChange={setCreationMode} onOpenScripts={() => navigate('剧本')} />
      ) : activeTab === '成片' ? (
        /* 成片：列表 + 详情（卡片可点开详情页） */
        <VideosPage projectId={selectedProject?.id} onCreate={() => navigate('工作台')} />
      ) : activeTab === '智能体' ? (
        /* 智能体：左侧技能栏 + 右侧对话工作台 */
        <AgentsPage />
      ) : activeTab === '画布' ? (
        /* 画布：画布列表 + 全屏画布编辑器 */
        <CanvasPage projectId={selectedProject?.id} />
      ) : activeTab === '剧本' ? (
        /* 剧本：剧本库空状态 / 列表 + 上传弹窗 */
        <ScriptsPage
          projectId={selectedProject?.id}
          onOpenShots={(pid = 'proj-rain-alley') => {
            const target = `/app/workspace/projects/${encodeURIComponent(pid)}?openScript=1`;
            window.history.pushState({ tab: '工作台' }, '', target);
            setActiveTab('工作台');
          }}
        />
      ) : activeTab === '拆解' ? (
        /* 拆解：对标视频拆解表单 + 拆解记录 */
        <DecomposePage projectId={selectedProject?.id} />
      ) : activeTab === '资产' ? (
        /* 资产：人物 / 场景 / 道具资产库 */
        <AssetsPage projectId={selectedProject?.id} />
      ) : activeTab === '项目' ? (
        /* 项目：项目列表 + 新建项目弹窗 */
        <ProjectsPage onOpenProject={openProjectPage} />
      ) : activeTab === '分发' ? (
        /* 分发：抖音视频 → 小红书草稿（半自动，人工发布） */
        <DistributePage />
      ) : (
        /* 其他 Tab 的通用展示页，支持一键返回首页或创作 */
        <main className="main-content">
          <div className="tab-placeholder-page">
            <div className="placeholder-card">
              <div className="placeholder-icon-wrap">
                {activeTab === '智能体' && <Bot size={36} />}
                {activeTab === '画布' && <LayoutGrid size={36} />}
                {activeTab === '剧本' && <FileText size={36} />}
                {activeTab === '拆解' && <Scissors size={36} />}
                {activeTab === '资产' && <ImageIcon size={36} />}
                {activeTab === '项目' && <PanelLeft size={36} />}
              </div>
              <h2>{activeTab}工作台</h2>
              <p className="placeholder-sub">正在为您加载{activeTab}模块相关数据与工具集...</p>
              <div className="placeholder-actions">
                <button className="primary" onClick={() => navigate('首页')}>
                  返回首页
                </button>
                <button className="secondary" onClick={() => navigate('工作台')}>
                  进入创作
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

    </AdminWorkspace>
  );
}

createRoot(document.getElementById('root')).render(<App />);
