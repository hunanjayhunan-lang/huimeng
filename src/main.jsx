import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Home,
  Pencil,
  Video,
  MessagesSquare,
  LayoutGrid,
  FileText,
  Scissors,
  Image as ImageIcon,
  PanelLeft,
  ChartNoAxesColumn,
  Bell,
  UserRound,
  Plus,
  Wallet,
  Upload,
  Clipboard,
  ChevronRight,
  PlaySquare,
  Sparkles,
  ArrowRight,
  Palette,
  Share2,
  Play,
  Film,
  Bot,
  Layers,
  FolderKanban,
  BarChart3
} from 'lucide-react';
import './style.css';
import TopbarActions from './components/TopbarActions.jsx';
import VideosPage from './pages/VideosPage.jsx';
import AgentsPage from './pages/AgentsPage.jsx';
import CanvasPage from './pages/CanvasPage.jsx';
import DecomposePage from './pages/DecomposePage.jsx';
import ScriptsPage from './pages/ScriptsPage.jsx';
import AssetsPage from './pages/AssetsPage.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import DataPage from './pages/DataPage.jsx';
import CreateWorkbench from './pages/CreateWorkbench.jsx';
import DistributePage from './pages/DistributePage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import SuperadminPage from './pages/SuperadminPage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import { api, setToken } from './api.js';
// 主题覆盖必须最后加载：同优先级下才能盖住各页面自己的配色
import './theme.css';

const navItems = [
  { icon: Home, label: '首页' },
  { icon: Pencil, label: '创作' },
  { icon: Video, label: '成片' },
  { icon: MessagesSquare, label: '智能体' },
  { icon: LayoutGrid, label: '画布' },
  { icon: FileText, label: '剧本' },
  { icon: Scissors, label: '拆解' },
  { icon: ImageIcon, label: '资产' },
  { icon: PanelLeft, label: '项目' },
  { icon: ChartNoAxesColumn, label: '数据' },
  { icon: Share2, label: '分发' },
];

// 四套配色：和 theme.css 里的 [data-theme] 一一对应
const THEMES = [
  { key: 'gold', name: '新国风雅金', swatch: 'linear-gradient(135deg,#fffdf8 0 45%,#345971 46%)' },
  { key: 'ink', name: '夜幕黑紫', swatch: 'linear-gradient(135deg,#232631 0 45%,#7950d5 46%)' },
  { key: 'aurora', name: '极光淡紫', swatch: 'linear-gradient(135deg,#ffffff 0 45%,#7c4ed0 46%)' },
  { key: 'jade', name: '青绿山水', swatch: 'linear-gradient(135deg,#f7fbf7 0 45%,#2f6b5a 46%)' },
];

const readTheme = () => {
  try {
    const saved = localStorage.getItem('huimeng_theme');
    return THEMES.some(item => item.key === saved) ? saved : 'gold';
  } catch {
    return 'gold';
  }
};

// 在 React 挂载前就写好，避免首屏闪一下默认配色
document.documentElement.dataset.theme = readTheme();

// 每个 tab 一个 URL：直接用浏览器地址栏、前进后退、刷新都能保持
// 工作台统一挂在 /app 下；/admin、/login、/invite 不属于工作台，保持独立
const APP_HOME = '/app/dashboard';
const TAB_ROUTES = {
  首页: APP_HOME,
  创作: '/app/create',
  成片: '/app/videos',
  智能体: '/app/agents',
  画布: '/app/canvas',
  剧本: '/app/scripts',
  拆解: '/app/breakdown',
  资产: '/app/assets',
  项目: '/app/projects',
  数据: '/app/data',
  分发: '/app/distribute',
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

const normalizePath = path => (path.replace(/\/+$/, '') || '/');

const tabFromPath = () => {
  const path = normalizePath(window.location.pathname);
  if (isAdminPath(path)) return '管理';
  const found = Object.entries(TAB_ROUTES).find(([, route]) => route === path);
  return found ? found[0] : '首页';
};

const pathForTab = tab => TAB_ROUTES[tab] || APP_HOME;

// 精致祥云 SVG 图标
function CloudEmblem() {
  return (
    <svg className="cloud-emblem-svg" viewBox="0 0 48 24" width="48" height="24" fill="none">
      <path
        d="M24 18c-4.5 0-7.5-3-7.5-6.5 0-2.8 2-5 4.8-5.5.8-2.6 3.1-4 6-4 3.7 0 6.7 2.6 7.2 6.2 2.2.6 3.8 2.5 3.8 4.8 0 2.8-2.3 5-5.3 5H24z"
        stroke="#d5a842"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="rgba(248, 237, 206, 0.4)"
      />
      <path
        d="M19 18c-1.8 0-3.5-1.2-4-3-.4-1.5.2-3 1.5-3.8-.2-.7-.1-1.5.3-2.1 1-1.4 2.8-1.9 4.2-1.1"
        stroke="#d5a842"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="27" cy="11" r="1.5" fill="#d5a842" />
    </svg>
  );
}

// 顶部背景科技金线与节点
function GoldenTechBackground() {
  return (
    <div className="golden-circuit-backdrop" aria-hidden="true">
      <svg className="circuit-lines" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 1440 320">
        <defs>
          <linearGradient id="goldGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#d4af37" stopOpacity="0.1" />
            <stop offset="30%" stopColor="#c59f42" stopOpacity="0.55" />
            <stop offset="70%" stopColor="#d8b458" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#d4af37" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        {/* 左侧电路连接线 */}
        <path d="M 0 50 L 180 50 L 220 80 L 420 80 L 460 115 L 530 115" stroke="url(#goldGlow)" strokeWidth="1.2" fill="none" />
        <path d="M 60 20 L 240 20 L 290 65 L 390 65" stroke="url(#goldGlow)" strokeWidth="1.1" strokeDasharray="5,4" fill="none" />
        <path d="M 120 120 L 280 120 L 320 155 L 440 155" stroke="url(#goldGlow)" strokeWidth="1.2" fill="none" />
        <circle cx="180" cy="50" r="3" fill="#d5a842" />
        <circle cx="420" cy="80" r="3.5" fill="#d5a842" />
        <circle cx="530" cy="115" r="3" fill="#c59f42" />
        <circle cx="280" cy="120" r="2.5" fill="#d5a842" />

        {/* 右侧电路连接线 */}
        <path d="M 1440 60 L 1260 60 L 1210 95 L 1020 95 L 970 125 L 910 125" stroke="url(#goldGlow)" strokeWidth="1.2" fill="none" />
        <path d="M 1360 30 L 1190 30 L 1140 70 L 1050 70" stroke="url(#goldGlow)" strokeWidth="1.1" strokeDasharray="5,4" fill="none" />
        <path d="M 1300 135 L 1160 135 L 1110 165 L 990 165" stroke="url(#goldGlow)" strokeWidth="1.2" fill="none" />
        <circle cx="1260" cy="60" r="3" fill="#d5a842" />
        <circle cx="1020" cy="95" r="3.5" fill="#d5a842" />
        <circle cx="910" cy="125" r="3" fill="#c59f42" />
        <circle cx="1160" cy="135" r="2.5" fill="#d5a842" />
      </svg>
      {/* 飘逸柔和云朵 */}
      <div className="bg-floating-cloud cloud-left"></div>
      <div className="bg-floating-cloud cloud-right"></div>
    </div>
  );
}

// 模拟精选作品封面数据
const featuredWorks = [
  {
    id: 1,
    title: '雨巷迷踪',
    tag: '悬疑·民国',
    duration: '02:45',
    img: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 2,
    title: '雨夜老街对峙',
    tag: '古风·动作',
    duration: '01:50',
    img: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 3,
    title: '天台晚霞誓约',
    tag: '都市·情感',
    duration: '03:12',
    img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 4,
    title: '旧仓库回眸',
    tag: '悬疑·剧情',
    duration: '02:08',
    img: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 5,
    title: '少年刀客行',
    tag: '国风·动漫',
    duration: '01:34',
    img: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 6,
    title: '赛博深空漫游',
    tag: '科幻·概念',
    duration: '04:02',
    img: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 7,
    title: '幽林隐士录',
    tag: '奇幻·短剧',
    duration: '02:20',
    img: 'https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?auto=format&fit=crop&w=400&q=80',
  },
];

function App() {
  const [activeTab, setActiveTab] = useState(tabFromPath);
  const [session, setSession] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [promptText, setPromptText] = useState('');
  const [creationMode, setCreationMode] = useState('剧本成片');
  const [theme, setTheme] = useState(readTheme);
  const [themeOpen, setThemeOpen] = useState(false);
  const themeRef = useRef(null);

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
        setActiveTab('管理');
        const current = normalizePath(window.location.pathname);
        if (!isAdminPath(current)) {
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
    if (!Object.values(TAB_ROUTES).includes(normalizePath(window.location.pathname)) && !isAdminPath(normalizePath(window.location.pathname))) {
      window.history.replaceState({ tab: '首页' }, '', APP_HOME);
    }
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    document.title = `${activeTab} · AI绘梦`;
  }, [activeTab]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('huimeng_theme', theme);
    } catch {
      /* 隐私模式下忽略 */
    }
  }, [theme]);

  useEffect(() => {
    if (!themeOpen) return undefined;
    const onDown = event => {
      if (themeRef.current && !themeRef.current.contains(event.target)) setThemeOpen(false);
    };
    const onKey = event => { if (event.key === 'Escape') setThemeOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [themeOpen]);

  const inspirationTags = ['悬疑 旧仓库回头', '古风 雨巷对峙', '都市 天台晚霞'];

  const handleStartCreation = (textToUse) => {
    const finalVal = typeof textToUse === 'string' ? textToUse : promptText;
    navigate('创作');
    if (finalVal.trim()) {
      setCreationMode('分镜出片');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleStartCreation();
    }
  };

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
    <div className="app-shell">
      {/* 顶部全局导航 */}
      <header className="topbar">
        <div className="brand" onClick={() => navigate('首页')} style={{ cursor: 'pointer' }}>
          <div className="brand-mark">AI</div>
          <strong>AI绘梦</strong>
          <span className="brand-sub">漫剧 · 短剧创作平台</span>
          {selectedProject && <button type="button" className="pill" onClick={event => { event.stopPropagation(); navigate('项目'); }} title="返回项目列表">项目：{selectedProject.name}</button>}
        </div>

        <TopbarActions session={session} onNavigate={navigate} onCreateMode={setCreationMode} onLogin={() => navigate('登录')} onLogout={logout} showLogin={!session} />
      </header>

      {/* 左侧垂直导航栏 */}
      <aside className="sidebar">
        {navItems.map(({ icon: Icon, label }) => {
          const isActive = activeTab === label;
          return (
            <button
              key={label}
              className={`nav-item ${isActive ? 'active' : ''} ${label === '剧本' ? 'has-tooltip' : ''}`}
              onClick={() => navigate(label)}
            >
              <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
              <span>{label}</span>
              {label === '剧本' && (
                <span className="nav-tooltip" role="tooltip">上传剧本，切分镜、拆资产、铺卡片</span>
              )}
            </button>
          );
        })}
      </aside>

      {/* 视图分发：根据选中的 Tab 渲染 */}
      {activeTab === '首页' ? (
        <main className="main-content home-view">
          <GoldenTechBackground />

          {/* 标语 */}
          <h1 className="hero-title">全局闭环 化繁为简</h1>

          {/* 核心多功能输入卡片 */}
          <section className="prompt-card">
            <div className="prompt-input-wrapper">
              <textarea
                className="prompt-textarea"
                rows={2}
                placeholder="写一句分镜：谁、在哪里、做什么、镜头怎么动"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <div className="prompt-card-footer">
              <div className="footer-left">
                <button
                  type="button"
                  className="tool-btn"
                  onClick={() => {
                    navigate('创作');
                    setCreationMode('剧本成片');
                  }}
                >
                  <FileText size={15} /> 传剧本
                </button>
                <button
                  type="button"
                  className="tool-btn"
                  onClick={() => {
                    navigate('画布');
                  }}
                >
                  <LayoutGrid size={15} /> 新建画布
                </button>
              </div>

              <div className="footer-right">
                <span className="shortcut-hint">回车带到创作页 · Shift + 回车换行</span>
                <button
                  type="button"
                  className="start-btn"
                  onClick={() => handleStartCreation()}
                >
                  开始创作 <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </section>

          {/* 引导副标题区 */}
          <section className="guide-section">
            <div className="cloud-icon-wrap">
              <CloudEmblem />
            </div>
            <h2 className="guide-title">从一句话开始，出第一条片</h2>
            <p className="guide-desc">在上面写一句分镜，回车带到创作页；提示词你确认之后才出片。</p>
            <div className="inspiration-tags">
              <span className="tags-label">没想好写什么？试试</span>
              {inspirationTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="tag-pill"
                  onClick={() => {
                    setPromptText(tag);
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </section>

          {/* 四大功能卡片网格 */}
          <section className="portal-grid">
            {/* 卡片 1: 开始创作 */}
            <div
              className="portal-card card-create"
              onClick={() => {
                navigate('创作');
              }}
            >
              <div className="portal-info">
                <h3>开始创作</h3>
                <p>分镜出片，剧本成片</p>
              </div>
              <div className="portal-visual visual-create">
                <div className="sketch-frame">
                  <div className="frame-lines">
                    <span></span>
                    <span></span>
                  </div>
                </div>
                <div className="video-thumb-card">
                  <Play size={13} fill="currentColor" />
                </div>
              </div>
            </div>

            {/* 卡片 2: 无限画布 */}
            <div
              className="portal-card card-canvas"
              onClick={() => {
                navigate('画布');
              }}
            >
              <div className="portal-info">
                <h3>无限画布</h3>
                <p>拖拽连线，原位生成</p>
              </div>
              <div className="portal-visual visual-canvas">
                <div className="node-box left-node">
                  <div className="node-bar"></div>
                  <div className="node-bar short"></div>
                </div>
                <svg className="node-connector" width="46" height="32" viewBox="0 0 46 32">
                  <path d="M 4 16 C 22 16, 24 16, 42 16" stroke="#c0b59b" strokeWidth="2" fill="none" />
                  <circle cx="23" cy="16" r="3" fill="#245166" />
                </svg>
                <div className="node-box right-node">
                  <Play size={10} fill="currentColor" />
                </div>
              </div>
            </div>

            {/* 卡片 3: 资产库 */}
            <div
              className="portal-card card-assets"
              onClick={() => {
                navigate('资产');
              }}
            >
              <div className="portal-info">
                <h3>资产库</h3>
                <p>人物 / 场景 / 道具</p>
              </div>
              <div className="portal-visual visual-assets">
                <div className="avatar-preview-card">
                  <div className="preview-person-head"></div>
                  <div className="preview-person-body"></div>
                </div>
                <div className="scene-preview-card">
                  <div className="scene-sun"></div>
                  <div className="scene-mountains"></div>
                </div>
                <div className="prop-cube">
                  <div className="cube-top"></div>
                  <div className="cube-left"></div>
                  <div className="cube-right"></div>
                </div>
              </div>
            </div>

            {/* 卡片 4: 剧本库 */}
            <div
              className="portal-card card-scripts"
              onClick={() => {
                navigate('剧本');
              }}
            >
              <div className="portal-info">
                <h3>剧本库</h3>
                <p>剧本切分镜、拆资产</p>
              </div>
              <div className="portal-visual visual-scripts">
                <div className="script-sheet">
                  <i className="sheet-corner"></i>
                  <span className="sheet-line"></span>
                  <span className="sheet-line"></span>
                  <span className="sheet-line"></span>
                  <span className="sheet-line short"></span>
                </div>
                <div className="cut-clips-badge">
                  <span className="cut-seg"></span>
                  <span className="cut-seg active"></span>
                  <span className="cut-seg"></span>
                </div>
              </div>
            </div>
          </section>

          {/* 精选作品横栏 */}
          <section className="featured-section">
            <div className="featured-header">
              <h3 className="featured-title">精选</h3>
              <button
                type="button"
                className="view-all-link"
                onClick={() => navigate('成片')}
              >
                全部成片 <ChevronRight size={15} />
              </button>
            </div>

            <div className="featured-carousel-row">
              {featuredWorks.map((work) => (
                <div key={work.id} className="featured-work-card">
                  <div className="work-cover-wrap">
                    <img src={work.img} alt={work.title} className="work-cover-img" />
                    <div className="work-overlay">
                      <div className="play-circle">
                        <Play size={12} fill="white" />
                      </div>
                      <span className="duration-tag">{work.duration}</span>
                    </div>
                  </div>
                  <div className="work-meta">
                    <div className="work-name">{work.title}</div>
                    <div className="work-category">{work.tag}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      ) : activeTab === '创作' ? (
        <CreateWorkbench mode={creationMode} projectId={selectedProject?.id} projectName={selectedProject?.name} onModeChange={setCreationMode} onOpenScripts={() => navigate('剧本')} />
      ) : activeTab === '成片' ? (
        /* 成片：列表 + 详情（卡片可点开详情页） */
        <VideosPage projectId={selectedProject?.id} onCreate={() => navigate('创作')} />
      ) : activeTab === '智能体' ? (
        /* 智能体：左侧技能栏 + 右侧对话工作台 */
        <AgentsPage />
      ) : activeTab === '画布' ? (
        /* 画布：画布列表 + 全屏画布编辑器 */
        <CanvasPage projectId={selectedProject?.id} />
      ) : activeTab === '剧本' ? (
        /* 剧本：剧本库空状态 / 列表 + 上传弹窗 */
        <ScriptsPage projectId={selectedProject?.id} onOpenShots={() => navigate('画布')} />
      ) : activeTab === '拆解' ? (
        /* 拆解：对标视频拆解表单 + 拆解记录 */
        <DecomposePage projectId={selectedProject?.id} />
      ) : activeTab === '资产' ? (
        /* 资产：人物 / 场景 / 道具资产库 */
        <AssetsPage projectId={selectedProject?.id} />
      ) : activeTab === '项目' ? (
        /* 项目：项目列表 + 新建项目弹窗 */
        <ProjectsPage onOpenProject={openProjectPage} />
      ) : activeTab === '数据' ? (
        /* 数据：生产报表 / 抖音账号 */
        <DataPage />
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
                {activeTab === '数据' && <ChartNoAxesColumn size={36} />}
              </div>
              <h2>{activeTab}工作台</h2>
              <p className="placeholder-sub">正在为您加载{activeTab}模块相关数据与工具集...</p>
              <div className="placeholder-actions">
                <button className="primary" onClick={() => navigate('首页')}>
                  返回首页
                </button>
                <button className="secondary" onClick={() => navigate('创作')}>
                  进入创作
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* 左下角调色盘/主题选择器 */}
      <div className="theme-bar" ref={themeRef}>
        <button type="button" className="palette-btn" title="配色主题" onClick={() => setThemeOpen(open => !open)}>
          <Palette size={16} />
        </button>
        <div className="theme-dots">
          {THEMES.map(item => <i key={item.key} role="button" tabIndex={0} title={item.name}
            className={theme === item.key ? 'chosen' : ''}
            style={{ background: item.swatch }}
            onClick={() => setTheme(item.key)}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setTheme(item.key);
              }
            }} />)}
        </div>
      </div>

      {themeOpen && <div className="theme-menu">
        <header>配色主题</header>
        {THEMES.map(item => <button key={item.key} type="button"
          className={theme === item.key ? 'current' : ''}
          onClick={() => { setTheme(item.key); setThemeOpen(false); }}>
          <i style={{ background: item.swatch }} />{item.name}
          {theme === item.key && <small>当前</small>}
        </button>)}
      </div>}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
