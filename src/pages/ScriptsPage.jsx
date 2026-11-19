import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Clipboard,
  CloudUpload,
  FileText,
  Film,
  Loader2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import './ScriptsPage.css';
import { api } from '../api.js';
import { PRESET_SCRIPT } from './workspaceDemo.js';

const WORKSPACE_FEATURED_SCRIPT = {
  id: 'ws-script-rain-alley',
  title: PRESET_SCRIPT.title,
  source: '工作台项目',
  chars: PRESET_SCRIPT.excerpt.replace(/\s+/g, '').length,
  scenes: 3,
  fileName: '雨巷迷踪_EP01.md',
  excerpt: PRESET_SCRIPT.excerpt,
  createdLabel: '关联项目 · 《雨巷迷踪》第1季',
  workspaceProjectId: 'proj-rain-alley',
};

const SOURCES = ['原创', '改编', '转载', '其他'];
const ACCEPT = '.docx,.txt,.md,.csv';
const MAX_CHARS = 200000;
const SAMPLE = `第一幕：后山洞口
李守真发现洞口，听见里面有人说话......

第二幕：山洞甬道
......`;

function CloudMark() {
  return <svg className="script-cloud" viewBox="0 0 82 52" width="74" height="47" fill="none" aria-hidden="true">
    <path
      d="M20 39c-7 0-12.5-5-12.5-11.4 0-5.7 4.4-10.4 10-11.1C19 10.6 24.8 5.5 32 5.5c7.8 0 14.2 5.6 15.2 13 4.9.7 8.8 4.8 8.8 9.8 0 5.6-4.6 10.7-10.7 10.7H20Z"
      stroke="#d3a63f"
      strokeWidth="1.9"
      strokeLinejoin="round"
      fill="rgba(248, 238, 206, 0.32)"
    />
    <path d="M49 41c5.6 2.6 11.8 1.7 16.5-2" stroke="#d3a63f" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M40 45.5c6.5 2.4 13.5 1.9 19.5-1.4" stroke="#d3a63f" strokeWidth="1.6" strokeLinecap="round" opacity=".72" />
    <circle cx="43" cy="21" r="2.2" fill="#d3a63f" />
  </svg>;
}

function countScenes(text) {
  if (!text) return 0;
  const byHeading = text
    .split(/\n(?=\s*(?:第[一二三四五六七八九十百零两\d]+[幕场集回]|场景\s*\d+|SCENE\s*\d+))/i)
    .filter(part => part.trim());
  if (byHeading.length > 1) return byHeading.length;
  const blocks = text.split(/\n\s*\n/).filter(block => block.trim());
  return Math.max(1, Math.min(blocks.length, 99));
}

function formatChars(count) {
  return count > 9999 ? `${(count / 10000).toFixed(1)} 万字` : `${count.toLocaleString()} 字`;
}

function relative(timestamp) {
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} 小时前`;
  return `${Math.round(minutes / 1440)} 天前`;
}

// 后端返回的剧本 → 列表展示用的字段
const toView = item => ({
  id: item.id,
  title: item.title || '未命名剧本',
  source: item.source || '原创',
  chars: item.chars || 0,
  scenes: item.scenes || 0,
  fileName: item.fileName || '',
  excerpt: item.excerpt || '',
  createdLabel: relative(item.createdAt || Date.now()),
});

export default function ScriptsPage({ onOpenShots, projectId }) {
  const [scripts, setScripts] = useState([WORKSPACE_FEATURED_SCRIPT]);
  const [modalOpen, setModalOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [source, setSource] = useState(SOURCES[0]);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const uploadTimerRef = useRef(null);
  const finishTimerRef = useRef(null);
  const latestDraftRef = useRef({ title, source, text });

  useEffect(() => {
    latestDraftRef.current = { title, source, text };
  }, [title, source, text]);

  const clearTimers = () => {
    if (uploadTimerRef.current) {
      clearInterval(uploadTimerRef.current);
      uploadTimerRef.current = null;
    }
    if (finishTimerRef.current) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
  };

  const resetDraft = () => {
    clearTimers();
    setTitle('');
    setSource(SOURCES[0]);
    setText('');
    setFile(null);
    setDragging(false);
    setUploading(false);
    setProgress(0);
    setError('');
  };

  const openModal = mode => {
    resetDraft();
    setPasteOpen(mode === 'paste');
    setModalOpen(true);
  };

  const closeModal = () => {
    resetDraft();
    setPasteOpen(false);
    setModalOpen(false);
  };

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!modalOpen) return undefined;
    const onKeyDown = event => {
      if (event.key === 'Escape') closeModal();
    };
    document.body.classList.add('scripts-modal-open');
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.classList.remove('scripts-modal-open');
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [modalOpen]);

  useEffect(() => {
    if (modalOpen && pasteOpen) {
      const timer = setTimeout(() => textareaRef.current?.focus(), 80);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [modalOpen, pasteOpen]);

  useEffect(() => clearTimers, []);

  // 首次加载：从后端剧本库读取
  useEffect(() => {
    let cancelled = false;
    api.listScripts(projectId)
      .then(data => { if (!cancelled) setScripts([WORKSPACE_FEATURED_SCRIPT, ...data.items.map(toView)]); })
      .catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [projectId]);

  const saveScript = async ({ title, source, text, fileName }) => {
    const script = await api.createScript({ title, source, text, fileName, projectId });
    setScripts(previous => [toView(script), ...previous]);
    // 有正文就让豆包拆分镜；没配置模型会 503，忽略即可
    if (script.content) {
      api.splitScript(script.id)
        .then(updated => setScripts(previous => previous.map(item => (item.id === updated.id ? toView(updated) : item))))
        .catch(() => {});
    }
    return script;
  };

  const finishUpload = async targetFile => {
    const draft = latestDraftRef.current;
    const finalTitle = draft.title.trim() || targetFile.name.replace(/\.[^.]+$/, '') || '未命名剧本';
    const isText = /\.(txt|md|csv)$/i.test(targetFile.name);
    let content = '';
    try {
      if (isText) content = await targetFile.text();
    } catch {
      content = '';
    }
    try {
      const script = await saveScript({ title: finalTitle, source: draft.source, text: content, fileName: targetFile.name });
      closeModal();
      setToast(isText
        ? `《${script.title}》已上传，切出 ${script.scenes} 个分镜`
        : `《${script.title}》已上传（.docx 正文解析待接入）`);
    } catch (err) {
      setError(err.message);
    }
  };

  const startUpload = targetFile => {
    clearTimers();
    setError('');
    setFile(targetFile);
    setUploading(true);
    setProgress(6);
    let value = 6;
    uploadTimerRef.current = setInterval(() => {
      value = Math.min(100, value + 9 + Math.random() * 13);
      setProgress(value);
      if (value >= 100) {
        clearInterval(uploadTimerRef.current);
        uploadTimerRef.current = null;
        finishTimerRef.current = setTimeout(() => finishUpload(targetFile), 420);
      }
    }, 150);
  };

  const pickFile = targetFile => {
    if (!targetFile) return;
    if (!/\.(docx|txt|md|csv)$/i.test(targetFile.name)) {
      setError('只支持 .docx / .txt / .md / .csv 文件');
      return;
    }
    startUpload(targetFile);
  };

  const submitPaste = async () => {
    const content = text.trim();
    if (!content) {
      setError('先粘贴一段剧本文本，或者选择剧本文件');
      return;
    }
    if (uploading) return;
    try {
      const script = await saveScript({ title: title.trim() || '未命名剧本', source, text: content, fileName: '' });
      closeModal();
      setToast(`《${script.title}》已保存，切出 ${script.scenes} 个分镜`);
    } catch (err) {
      setError(err.message);
    }
  };

  const removeScript = async item => {
    try {
      await api.remove('scripts', item.id);
      setScripts(previous => previous.filter(script => script.id !== item.id));
      setToast(`已删除《${item.title}》`);
    } catch (err) {
      setError(err.message);
    }
  };

  const togglePaste = () => {
    setPasteOpen(value => !value);
    setError('');
  };

  return <main className="scripts-page">
    <section className="scripts-hero">
      <h1>
        剧本库
        <span className="hero-divider" aria-hidden="true" />
        <em>剧本入，成片出</em>
      </h1>
      <p>上传后自动切好分镜，再拆资产、铺提示词卡片，到分镜工作台逐张确认出片。</p>
    </section>

    {scripts.length === 0 ? <section className="scripts-empty">
      <CloudMark />
      <h2>还没有剧本</h2>
      <p>支持 .docx / .txt / .md / .csv，也可以直接粘贴文本。</p>
      <div className="empty-actions">
        <button className="primary" onClick={() => openModal('upload')}>上传剧本</button>
        <button className="secondary" onClick={() => openModal('paste')}>粘贴文本</button>
      </div>
    </section> : <section className="scripts-collection">
      <div className="collection-head">
        <h2>我的剧本 <span className="count">{scripts.length}</span></h2>
        <div className="collection-actions">
          <button onClick={() => openModal('upload')}><Upload size={15} />上传剧本</button>
          <button onClick={() => openModal('paste')}><Clipboard size={15} />粘贴文本</button>
        </div>
      </div>
      <div className="script-list">
        {scripts.map(item => <article className="script-row" key={item.id}>
          <div className="script-icon"><FileText size={20} /></div>
          <div className="script-main">
            <div className="script-title-line">
              <h3>{item.title}</h3>
              <span className="source-chip">{item.source}</span>
            </div>
            <p className="script-excerpt">{item.excerpt}</p>
            <div className="script-meta">
              {item.fileName && <span>{item.fileName}</span>}
              {item.chars > 0 && <><i aria-hidden="true" /><span>{formatChars(item.chars)}</span></>}
              <i aria-hidden="true" />
              <span>{item.createdLabel}</span>
            </div>
          </div>
          <div className="script-stats">
            <span><Film size={14} />{item.scenes ? `${item.scenes} 个分镜` : '切分镜中'}</span>
          </div>
          <div className="script-actions">
            <button className="open-shots" onClick={() => onOpenShots?.(item.workspaceProjectId || 'proj-rain-alley')}>
              {item.workspaceProjectId ? '在工作台打开' : '查看分镜'}
            </button>
            {!item.workspaceProjectId && (
              <button className="icon-btn" aria-label={`删除${item.title}`} onClick={() => removeScript(item)}><Trash2 size={16} /></button>
            )}
          </div>
        </article>)}
      </div>
    </section>}

    {modalOpen && <div className="script-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeModal(); }}>
      <div className="script-modal" role="dialog" aria-modal="true" aria-labelledby="script-modal-title">
        <header>
          <h2 id="script-modal-title">上传剧本</h2>
          <button className="modal-close" onClick={closeModal} aria-label="关闭"><X size={18} /></button>
        </header>

        <div className="modal-fields">
          <label className="field title-field">
            <span>标题</span>
            <input value={title} onChange={event => setTitle(event.target.value)} placeholder="可选，默认用文件名" maxLength={80} />
          </label>
          <label className="field source-field">
            <span>来源</span>
            <div className="select-wrap">
              <select value={source} onChange={event => setSource(event.target.value)}>
                {SOURCES.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
              <ChevronDown size={16} />
            </div>
          </label>
        </div>

        <div
          className={`dropzone ${dragging ? 'dragging' : ''} ${uploading ? 'uploading' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => !uploading && fileInputRef.current?.click()}
          onKeyDown={event => {
            if (!uploading && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={event => {
            event.preventDefault();
            if (!uploading) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={event => {
            event.preventDefault();
            setDragging(false);
            if (!uploading) pickFile(event.dataTransfer.files?.[0]);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            hidden
            onChange={event => {
              pickFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          {uploading ? <>
            <div className="drop-icon uploading-icon"><Loader2 size={22} className="spin" /></div>
            <strong className="drop-title">正在上传 {file?.name}</strong>
            <span className="drop-sub">{Math.round(progress)}% · 传完自动切出分镜</span>
            <div className="upload-track"><i style={{ width: `${Math.min(100, progress)}%` }} /></div>
          </> : <>
            <div className="drop-icon"><CloudUpload size={24} /></div>
            <strong className="drop-title">把剧本文件拖到这里，或点击选择文件</strong>
            <span className="drop-sub">支持 .docx / .txt / .md / .csv · 选好就开始上传，传完自动切出分镜</span>
          </>}
        </div>

        <div className={`paste-toggle ${pasteOpen ? 'open' : ''}`}>
          <span className="toggle-line" aria-hidden="true" />
          <button type="button" onClick={togglePaste}>
            {pasteOpen ? '收起粘贴框' : '或直接粘贴剧本文本（适合快速试一段）'}
            {pasteOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <span className="toggle-line" aria-hidden="true" />
        </div>

        {pasteOpen && <>
          <div className="paste-area">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={event => { setText(event.target.value); setError(''); }}
              placeholder={SAMPLE}
              maxLength={MAX_CHARS}
              spellCheck={false}
            />
            <span className="char-count">{text.length} / {MAX_CHARS}</span>
          </div>
          <div className="modal-footer">
            <p>标题留空会存成「未命名剧本」；保存后当场切出分镜。</p>
            <button className="modal-save" onClick={submitPaste}>保存并拆分镜</button>
          </div>
        </>}

        {error && <p className="modal-error" role="alert"><AlertCircle size={15} />{error}</p>}
      </div>
    </div>}

    {toast && <div className="scripts-toast" role="status"><Check size={16} />{toast}</div>}
  </main>;
}
