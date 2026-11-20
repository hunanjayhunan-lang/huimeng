import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, ChevronDown, Clock, Copy, Download, Image as ImageIcon, Loader2, Plus, RefreshCw, RotateCcw, Search, Sparkles, Trash2, Video, X } from 'lucide-react';
import { api } from '../api.js';
import './VideosPage.css';
import './VideoDetail.css';

const statuses = [['全部', 'all'], ['生成中', 'processing'], ['已生成', 'done'], ['失败', 'failed']];
const VIEW_LABEL = { processing: '生成中', done: '已生成', failed: '失败' };
const TONES = {
  image: ['#2f5568', '#152d39'],
  video: ['#8d6a5b', '#3d2a24'],
};
const RATIOS = [['1:1', 1024, 1024], ['16:9', 1280, 720], ['9:16', 720, 1280], ['4:3', 1024, 768]];
const DURATIONS = ['5', '10'];

const viewOf = status => (status === 'done' ? 'done' : status === 'failed' ? 'failed' : 'processing');

const titleOf = task => {
  const text = (task.prompt || '').trim();
  if (!text) return '未命名任务';
  return text.length > 18 ? `${text.slice(0, 18)}…` : text;
};

const sizeText = task => {
  const { width, height, duration } = task.params || {};
  if (task.type === 'video') return duration ? `视频 · ${duration}s` : '视频';
  return width && height ? `${width}×${height}` : '图片';
};

const timeText = timestamp => new Date(timestamp).toLocaleString('zh-CN', {
  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});

function idFromHash() {
  const matched = /^#video=(.+)$/.exec(window.location.hash);
  return matched ? decodeURIComponent(matched[1]) : null;
}

function VideoCard({ task, view, onOpen }) {
  const state = viewOf(task.status);
  const tone = TONES[task.type] || TONES.image;
  return <article className={`video-card ${view}`} onClick={onOpen} tabIndex={0} role="button"
    onKeyDown={event => event.key === 'Enter' && onOpen()} aria-label={`查看 ${titleOf(task)} 详情`}>
    <div className="video-thumb" style={{ '--tone-1': tone[0], '--tone-2': tone[1] }}>
      {task.status === 'done' && task.resultUrl
        ? (/\.mp4(\?|$)/i.test(task.resultUrl)
          ? <video className="thumb-img" src={`${task.resultUrl}#t=0.1`} muted playsInline preload="metadata" aria-label={titleOf(task)} />
          : <img className="thumb-img" src={task.resultUrl} alt={titleOf(task)} loading="lazy" />)
        : <span className="thumb-cloud" aria-hidden="true" />}
      <span className={`video-badge ${state}`}><i className={`status-dot dot-${state}`} aria-hidden="true" />{VIEW_LABEL[state]}</span>
      <span className="thumb-duration">{sizeText(task)}</span>
      {task.status === 'done' && task.resultUrl && <span className="thumb-play" aria-hidden="true"><Sparkles size={16} /></span>}
      {state === 'processing' && <span className="thumb-progress"><i style={{ width: `${task.progress}%` }} /></span>}
    </div>
    <div className="video-card-body">
      <div className="video-card-title">
        <h3>{titleOf(task)}</h3>
        <span className="video-card-time"><Clock size={12} />{timeText(task.createdAt)}</span>
      </div>
      <p className="video-card-prompt">{task.prompt}</p>
      {state === 'failed' && <div className="video-card-error"><AlertTriangle size={14} />{task.error || '生成失败'}</div>}
      {state === 'processing' && <div className="video-card-progress"><i style={{ width: `${task.progress}%` }} />{task.progress}%</div>}
    </div>
  </article>;
}

function ComposeDialog({ onClose, onSubmit, submitting, error }) {
  const [form, setForm] = useState({ type: 'image', prompt: '', ratio: '1:1', duration: '5' });
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const ratio = RATIOS.find(([label]) => label === form.ratio) || RATIOS[0];

  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = () => {
    if (!form.prompt.trim()) return;
    const params = { width: ratio[1], height: ratio[2] };
    if (form.type === 'video') params.duration = Number(form.duration);
    else params.seed = -1;
    onSubmit({ type: form.type, prompt: form.prompt.trim(), params });
  };

  return <div className="compose-mask" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="compose-card" role="dialog" aria-modal="true" aria-label="新建生成任务">
      <header>
        <h2>新建生成任务</h2>
        <button type="button" className="compose-close" aria-label="关闭" onClick={onClose}><X size={18} /></button>
      </header>

      <div className="compose-types">
        {[['image', ImageIcon, '图片'], ['video', Video, '视频']].map(([type, Icon, label]) => <button key={type} type="button"
          className={form.type === type ? 'current' : ''} onClick={() => update('type', type)}><Icon size={16} />{label}</button>)}
      </div>

      <div className="compose-field">
        <label htmlFor="compose-prompt">提示词</label>
        <textarea id="compose-prompt" rows={4} maxLength={800} value={form.prompt} autoFocus
          onChange={event => update('prompt', event.target.value)}
          placeholder="写一句分镜：谁、在哪里、做什么、镜头怎么动" />
        <span className="compose-counter">{form.prompt.length}/800</span>
      </div>

      <div className="compose-field">
        <label>画面比例</label>
        <div className="compose-chips">
          {RATIOS.map(([label]) => <button key={label} type="button"
            className={form.ratio === label ? 'current' : ''} onClick={() => update('ratio', label)}>{label}</button>)}
        </div>
      </div>

      {form.type === 'video' && <div className="compose-field">
        <label>时长</label>
        <div className="compose-chips">
          {DURATIONS.map(value => <button key={value} type="button"
            className={form.duration === value ? 'current' : ''} onClick={() => update('duration', value)}>{value} 秒</button>)}
        </div>
      </div>}

      {error && <p className="compose-error">{error}</p>}

      <footer>
        <small className="compose-quota-note">本任务预占 {form.type === 'video' ? 8 : 1} 点，失败或取消会释放</small>
        <button type="button" className="compose-ghost" onClick={onClose}>取消</button>
        <button type="button" className="compose-primary" disabled={submitting || !form.prompt.trim()} onClick={submit}>
          {submitting ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
          {submitting ? '提交中…' : '提交生成'}
        </button>
      </footer>
    </div>
  </div>;
}

function TaskDetail({ task, onBack, onCopy, onDownload, onRetry, onDelete, busy }) {
  const state = viewOf(task.status);
  const tone = TONES[task.type] || TONES.image;
  const isVideo = task.type === 'video' && /\.mp4(\?|$)/.test(task.resultUrl || '');
  return <>
    <div className="detail-top">
      <button type="button" className="detail-back" onClick={onBack}><ArrowLeft size={17} />返回成片</button>
      <div className="detail-top-actions">
        <button type="button" className="detail-ghost" disabled={state !== 'failed' || busy} onClick={onRetry}><RotateCcw size={16} />重新生成</button>
        <button type="button" className="detail-primary" onClick={() => onCopy(task)}><Copy size={16} />复制提示词</button>
      </div>
    </div>

    <div className="detail-heading">
      <h1>{titleOf(task)}<span className={`video-badge inline ${state}`}><i className={`status-dot dot-${state}`} aria-hidden="true" />{VIEW_LABEL[state]}</span></h1>
      <p>{task.reqKey} · {sizeText(task)} · 提交于 {timeText(task.createdAt)}{task.costMs ? ` · 耗时 ${(task.costMs / 1000).toFixed(1)}s` : ''}</p>
    </div>

    <div className="detail-layout">
      <div className="detail-main">
        <div className="preview-frame" style={{ '--tone-1': tone[0], '--tone-2': tone[1] }}>
          {state === 'done' && task.resultUrl
            ? (isVideo
              ? <video className="preview-media" src={task.resultUrl} controls playsInline />
              : <img className="preview-media" src={task.resultUrl} alt={task.prompt} />)
            : <>
              <span className="thumb-cloud" aria-hidden="true" />
              <span className="preview-tag">
                {state === 'processing' ? <><Loader2 size={14} className="spin" />生成中 {task.progress}%</> : <><AlertTriangle size={14} />生成失败</>}
              </span>
              {state === 'processing' && <div className="preview-progressbar"><i style={{ width: `${task.progress}%` }} /></div>}
            </>}
        </div>

        <section className="detail-block">
          <div className="block-head"><h2><Sparkles size={16} />提示词</h2><button type="button" className="text-btn" onClick={() => onCopy(task)}><Copy size={15} />复制</button></div>
          <p className="prompt-block">{task.prompt}</p>
          {state === 'failed' && task.error && <div className="detail-error"><AlertTriangle size={15} />{task.error}</div>}
        </section>
      </div>

      <aside className="detail-side">
        <section className="side-card">
          <h2>生成参数</h2>
          <div className="param-grid">
            {[
              ['类型', task.type === 'video' ? '视频' : '图片'],
              ['模型标识', task.reqKey],
              ['画面尺寸', task.params?.width && task.params?.height ? `${task.params.width}×${task.params.height}` : '跟随模型'],
              ['时长', task.type === 'video' ? (task.params?.duration ? `${task.params.duration} 秒` : '默认') : '—'],
              ['随机种子', task.params?.seed ?? '—'],
              ['额度点数', `${task.quotaPoints ?? (task.type === 'video' ? 8 : 1)} 点${state === 'done' ? ' · 已结算' : state === 'processing' ? ' · 预占中' : ' · 已释放'}`],
              ['生成耗时', task.costMs ? `${(task.costMs / 1000).toFixed(1)} 秒` : '—'],
            ].map(([label, value]) => <div className="param" key={label}><span>{label}</span><b>{value}</b></div>)}
          </div>
        </section>

        <section className="side-card">
          <h2>任务信息</h2>
          <div className="task-info">
            <div><span>任务 ID</span><b title={task.id}>{task.id.slice(0, 12)}…</b></div>
            <div><span>上游任务</span><b title={task.remoteTaskId || ''}>{task.remoteTaskId ? `${task.remoteTaskId.slice(0, 12)}…` : '尚未提交'}</b></div>
            <div><span>尝试次数</span><b>{task.attempts ?? 0}</b></div>
            <div><span>最近更新</span><b>{timeText(task.updatedAt)}</b></div>
          </div>
        </section>

        <div className="detail-actions">
          <button type="button" className="detail-primary" disabled={state !== 'done' || !task.resultUrl} onClick={() => onDownload(task)}><Download size={16} />下载产物</button>
          <button type="button" className="detail-ghost danger" disabled={busy} onClick={onDelete}><Trash2 size={16} />删除任务</button>
        </div>
      </aside>
    </div>
  </>;
}

export default function VideosPage({ onCreate, projectId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [view, setView] = useState('grid');
  const [selectedId, setSelectedId] = useState(idFromHash);
  const [composeOpen, setComposeOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [composeError, setComposeError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const toastTimer = useRef(null);

  const selected = tasks.find(task => task.id === selectedId) || null;

  const notify = message => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2000);
  };

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // 列表轮询：页面可见时每 2.5 秒同步一次，详情页也是同一份数据
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await api.listTasks({ limit: 60 });
        if (cancelled) return;
        setTasks(data.items);
        setError('');
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, 2500);
    return () => { cancelled = true; clearInterval(timer); };
  }, [refreshKey, projectId]);

  useEffect(() => {
    const next = selectedId ? `#video=${encodeURIComponent(selectedId)}` : '';
    if (window.location.hash !== next) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${next}`);
    }
  }, [selectedId]);

  const visible = useMemo(() => tasks.filter(task => {
    if (task.type !== 'video') return false;
    const keyword = query.trim();
    const hitKeyword = !keyword || (task.prompt || '').includes(keyword);
    const hitStatus = status === 'all' || viewOf(task.status) === status;
    return hitKeyword && hitStatus;
  }), [tasks, query, status]);

  const copyPrompt = async task => {
    try {
      await navigator.clipboard.writeText(task.prompt);
      notify('提示词已复制');
    } catch {
      notify('复制失败，请手动选中');
    }
  };

  const downloadTask = task => {
    if (!task.resultUrl) return;
    const link = document.createElement('a');
    link.href = task.resultUrl;
    link.download = `${titleOf(task)}.${task.type === 'video' ? 'mp4' : 'png'}`;
    link.click();
    notify('已开始下载');
  };

  const submitTask = async payload => {
    setSubmitting(true);
    setComposeError('');
    try {
      const task = await api.createTask({ ...payload, projectId, runId: `ui-${Date.now()}` });
      setTasks(current => [task, ...current]);
      setComposeOpen(false);
      setStatus('all');
      notify('已提交生成任务');
    } catch (err) {
      setComposeError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const retryTask = async task => {
    setBusy(true);
    try {
      const next = await api.retryTask(task.id);
      setTasks(current => current.map(item => (item.id === next.id ? next : item)));
      notify('已重新提交');
    } catch (err) {
      notify(err.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteTask = async task => {
    setBusy(true);
    try {
      await api.deleteTask(task.id);
      setTasks(current => current.filter(item => item.id !== task.id));
      setSelectedId(null);
      notify('任务已删除');
    } catch (err) {
      notify(err.message);
    } finally {
      setBusy(false);
    }
  };

  return <>
    {selected ? <main className="videos-page detail-view">
      <TaskDetail task={selected} onBack={() => setSelectedId(null)} onCopy={copyPrompt}
        onDownload={downloadTask} onRetry={() => retryTask(selected)} onDelete={() => deleteTask(selected)} busy={busy} />
    </main> : <div className="ws-shell">
      <header className="ws-header">
        <div className="ws-header-left">
          <span className="ws-project"><Video size={14} /> 成片库</span>
        </div>
        <div className="ws-header-right">
          <input
            className="ws-hub-search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="搜索提示词内容…"
          />
          <button type="button" className="ws-btn primary" onClick={() => { setComposeError(''); setComposeOpen(true); }}><Plus size={14} /> 新建生成任务</button>
        </div>
      </header>
      <div className="ws-page-body">
        <main className="videos-page">
          <div className="ws-hub-head">
            <div>
              <h2>我的成片</h2>
            </div>
            <div className="ws-hub-filters">
              <div className="ws-hub-tabs" role="tablist">
                {statuses.map(([label, value]) => (
                  <button
                    key={value}
                    type="button"
                    className={status === value ? 'active' : ''}
                    onClick={() => setStatus(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <select
                className="ws-hub-style-select"
                value={view}
                onChange={e => setView(e.target.value)}
                aria-label="切换视图"
              >
                <option value="grid">网格视图</option>
                <option value="list">列表视图</option>
              </select>
              <span className="ws-hub-count">共 {visible.length} 个成片</span>
            </div>
          </div>

      {error && <div className="data-banner">
        <AlertTriangle size={16} />
        <span>{error}</span>
        <button type="button" onClick={() => setRefreshKey(key => key + 1)}>重试</button>
      </div>}

      {loading ? <div className="video-loading"><Loader2 size={20} className="spin" />正在读取任务…</div>
        : visible.length ? <div className={`video-results ${view}`}>
          {visible.map(task => <VideoCard key={task.id} task={task} view={view}
            onOpen={() => setSelectedId(task.id)} />)}
        </div>
          : <section className="video-empty">
            <div className="cloud-mark">⌁</div>
            <strong>{tasks.length === 0 ? '还没有成片' : '没有找到匹配的成片'}</strong>
            <p>{tasks.length === 0 ? '提交一条生成任务，进度和成片会出现在这里。' : '换个关键词或筛选条件试试。'}</p>
            {tasks.length === 0 && <button type="button" className="primary" onClick={() => { setComposeError(''); setComposeOpen(true); }}><Sparkles size={17} />新建生成任务</button>}
          </section>}
        </main>
      </div>
    </div>}

    {composeOpen && <ComposeDialog onClose={() => setComposeOpen(false)} onSubmit={submitTask} submitting={submitting} error={composeError} />}
    {toast && <div className="copy-toast"><Check size={16} />{toast}</div>}
  </>;
}

// 这两个图标只在视图切换里用，单独包一层避免和 lucide 的 Grid2X2 命名冲突
function GridIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>;
}

function ListIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 6h13M8 12h13M8 18h13" /><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </svg>;
}
