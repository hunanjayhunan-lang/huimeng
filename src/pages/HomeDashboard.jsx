import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ClipboardCheck,
  FileText,
  FolderKanban,
  Image as ImageIcon,
  Loader2,
  Plus,
  Video,
  Wand2,
} from 'lucide-react';
import { api } from '../api.js';
import { DEMO_PROJECTS, STYLES } from './workspaceDemo.js';
import './HomeDashboard.css';

const styleName = key => STYLES.find(s => s.key === key)?.name || '';
const relTime = ts => {
  if (typeof ts !== 'number') return ts || '刚刚';
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const day = Math.floor(h / 24);
  return day === 1 ? '昨天' : `${day} 天前`;
};
const greeting = () => {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 12) return '早上好';
  if (h < 18) return '下午好';
  return '晚上好';
};
const todayText = () => {
  const d = new Date();
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 · 星期${week}`;
};

export default function HomeDashboard({ user, org, onNavigate, onOpenProject }) {
  const [projects, setProjects] = useState(DEMO_PROJECTS);
  const [counts, setCounts] = useState({ assets: 9, videos: 3, scripts: 1, tasks: 5 });
  const [loading, setLoading] = useState(true);
  const [activeVideos, setActiveVideos] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const settle = () => { if (!cancelled) setLoading(false); };

    // 拉取真实项目，失败则用 demo 项目兜底
    api.list('projects', 100).then(data => {
      if (cancelled) return;
      if (Array.isArray(data?.items) && data.items.length) {
        setProjects(data.items.map(item => ({
          id: item.id,
          name: item.name || item.title || '未命名项目',
          desc: item.desc || item.description || '',
          genre: item.genre || '短剧',
          styleKey: item.styleKey || 'noir',
          cover: item.cover || DEMO_PROJECTS[0].cover,
          sessionsCount: item.sessionsCount || 1,
          stageIndex: item.stageIndex || 0,
          status: item.status || '',
          statusText: item.statusText || '进行中',
          quotaUsed: item.quotaUsed || 0,
          quotaLimit: item.quotaLimit || 1000,
          updatedAt: relTime(item.updatedAt),
        })));
      }
      settle();
    }).catch(settle);

    // 关键资产 / 成片计数，后端没数据就保持演示值
    Promise.allSettled([
      api.list('assets', 500),
      api.list('canvases', 500),
      api.list('scripts', 500),
    ]).then(results => {
      if (cancelled) return;
      const [assets, canvases, scripts] = results;
      const next = { ...counts };
      if (assets.status === 'fulfilled' && Array.isArray(assets.value?.items)) next.assets = assets.value.items.length || 9;
      if (canvases.status === 'fulfilled' && Array.isArray(canvases.value?.items)) next.videos = canvases.value.items.length || 3;
      if (scripts.status === 'fulfilled' && Array.isArray(scripts.value?.items)) next.scripts = scripts.value.items.length || 1;
      setCounts(next);
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pendingCount = projects.filter(p => p.status === 'review').length;

  // 正在生成的视频：queued / running 的视频任务，页面可见时每 3 秒同步一次
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await api.listTasks({ limit: 100 });
        if (cancelled) return;
        const live = (data?.items || [])
          .filter(task => task.type === 'video' && (task.status === 'queued' || task.status === 'running'))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setActiveVideos(live);
      } catch {
        // 后端不可用时保持现状，不打断首页
      }
    };
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const projectNameOf = id => projects.find(p => p.id === id)?.name;

  const stats = useMemo(() => [
    { key: 'projects', icon: FolderKanban, label: '我的项目', value: projects.length, color: '#2f6fb0' },
    { key: 'assets', icon: ImageIcon, label: '资产图', value: counts.assets, color: '#b5791c' },
    { key: 'videos', icon: Video, label: '成片', value: counts.videos, color: '#2e8a5c' },
    { key: 'scripts', icon: FileText, label: '剧本', value: counts.scripts, color: '#7c52c9' },
    { key: 'review', icon: ClipboardCheck, label: '待审核', value: pendingCount, color: '#c2412d' },
  ], [projects.length, counts, pendingCount]);

  // 最近项目：按 updatedAt 语义排序（demo 数据保持原顺序，取前 4）
  const recentProjects = projects.slice(0, 4);

  return (
    <main className="home-dashboard">
      {/* 问候 + 快捷操作 */}
      <header className="hd-hero">
        <div className="hd-hero-text">
          <p className="hd-greeting">{greeting()}，{user?.email?.split('@')[0] || '创作者'}</p>
          <h1>今天 {todayText()}，继续把好故事做出来。</h1>
          <p className="hd-sub">
            {org?.name ? `所属团队「${org.name}」` : 'AI绘梦创作工作台'} · 你的项目、资产与成片都在这里。
          </p>
        </div>
        <div className="hd-hero-actions">
          <button type="button" className="hd-btn ghost" onClick={() => onNavigate('剧本')}>
            <FileText size={15} /> 上传剧本
          </button>
          <button type="button" className="hd-btn primary" onClick={() => onOpenProject ? onOpenProject(null) : onNavigate('工作台')}>
            <Plus size={15} /> 新建项目
          </button>
        </div>
      </header>

      {/* 统计卡片 */}
      <section className="hd-stats">
        {stats.map(stat => (
          <button
            key={stat.key}
            type="button"
            className="hd-stat-card"
            onClick={() => {
              const map = { projects: '工作台', assets: '资产', videos: '成片', scripts: '剧本', review: '工作台' };
              onNavigate(map[stat.key]);
            }}
          >
            <span className="hd-stat-icon" style={{ color: stat.color, background: `${stat.color}14` }}>
              <stat.icon size={18} />
            </span>
            <div className="hd-stat-body">
              <b>{stat.value}</b>
              <span>{stat.label}</span>
            </div>
            <ArrowRight size={15} className="hd-stat-arrow" />
          </button>
        ))}
      </section>

      {/* 正在生成的视频：真实 queued / running 任务，带进度条 */}
      {activeVideos.length > 0 && (
        <section className="hd-panel hd-generating">
          <div className="hd-panel-head">
            <div>
              <h2>正在生成的视频 <span className="hd-generating-count">{activeVideos.length}</span></h2>
              <p>实时进度，页面可见时每 3 秒刷新</p>
            </div>
            <button type="button" className="hd-link" onClick={() => onNavigate('成片')}>
              全部成片 <ArrowRight size={13} />
            </button>
          </div>
          <div className="hd-generating-list">
            {activeVideos.slice(0, 4).map(task => {
              const progress = Math.max(0, Math.min(100, task.status === 'running' ? (task.progress || 0) : 0));
              const projectName = task.projectId ? projectNameOf(task.projectId) : null;
              const prompt = (task.prompt || '').trim() || '未命名视频任务';
              return (
                <div key={task.id} className="hd-generating-row">
                  <span className={`hd-generating-icon ${task.status}`}>
                    {task.status === 'running' ? <Loader2 size={16} className="hd-spin" /> : <Wand2 size={16} />}
                  </span>
                  <div className="hd-generating-main">
                    <div className="hd-generating-title">
                      <b title={prompt}>{prompt.length > 42 ? `${prompt.slice(0, 42)}…` : prompt}</b>
                      <span className={`hd-generating-tag ${task.status}`}>
                        {task.status === 'running' ? `生成中 ${progress}%` : '排队中'}
                      </span>
                    </div>
                    <div className="hd-generating-bar">
                      <i className={task.status} style={{ width: `${task.status === 'queued' ? 4 : progress}%` }} />
                    </div>
                    <small className="hd-generating-meta">
                      {projectName ? `${projectName} · ` : ''}
                      {task.params?.duration ? `${task.params.duration}s · ` : ''}
                      {task.quotaPoints ? `${task.quotaPoints} 点` : '视频'} · {relTime(task.createdAt)}
                    </small>
                  </div>
                </div>
              );
            })}
            {activeVideos.length > 4 && (
              <button type="button" className="hd-generating-more" onClick={() => onNavigate('成片')}>
                还有 {activeVideos.length - 4} 个视频在生成 <ArrowRight size={13} />
              </button>
            )}
          </div>
        </section>
      )}

      {/* 最近项目 + 进行中的工作 */}
      <div className="hd-columns">
        <section className="hd-panel">
          <div className="hd-panel-head">
            <div>
              <h2>最近项目</h2>
              <p>点击继续上次的工作</p>
            </div>
            <button type="button" className="hd-link" onClick={() => onNavigate('工作台')}>
              全部项目 <ArrowRight size={13} />
            </button>
          </div>

          {loading ? (
            <div className="hd-loading"><Loader2 size={18} className="hd-spin" /> 正在加载项目…</div>
          ) : recentProjects.length === 0 ? (
            <div className="hd-empty">
              <FolderKanban size={32} />
              <h3>还没有项目</h3>
              <p>从新建项目开始，或导入一份剧本。</p>
              <button type="button" className="hd-btn primary" onClick={() => onOpenProject ? onOpenProject(null) : onNavigate('工作台')}>
                <Plus size={15} /> 新建项目
              </button>
            </div>
          ) : (
            <div className="hd-project-list">
              {recentProjects.map(project => (
                <button
                  key={project.id}
                  type="button"
                  className="hd-project-row"
                  onClick={() => onOpenProject ? onOpenProject(project) : onNavigate('工作台')}
                >
                  <span className="hd-project-cover">
                    <img src={project.cover} alt="" />
                  </span>
                  <span className="hd-project-main">
                    <b>{project.name}</b>
                    <small>{project.genre ? `${project.genre} · ` : ''}{project.sessionsCount} 个 Session · {project.updatedAt}</small>
                  </span>
                  <span className="hd-project-status">{project.statusText}</span>
                  {project.styleKey && (
                    <span className="hd-project-style">
                      <i style={{ background: STYLES.find(s => s.key === project.styleKey)?.tone }} />
                      {styleName(project.styleKey) || '未锁定'}
                    </span>
                  )}
                  <ArrowRight size={15} className="hd-row-arrow" />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* 右侧：本周概览 */}
        <aside className="hd-side">
          <section className="hd-panel hd-side-card">
            <div className="hd-panel-head">
              <div>
                <h2>本周概览</h2>
                <p>过去 7 天的产出</p>
              </div>
            </div>
            <ul className="hd-summary-list">
              <li><span className="hd-summary-dot done" aria-hidden="true" /><span>完成成片</span><b>{counts.videos} 条</b></li>
              <li><span className="hd-summary-dot run" aria-hidden="true" /><span>进行中任务</span><b>{counts.tasks} 个</b></li>
              <li><span className="hd-summary-dot new" aria-hidden="true" /><span>新入库资产</span><b>{counts.assets} 张</b></li>
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}
