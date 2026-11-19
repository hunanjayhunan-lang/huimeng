import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, Background, Controls, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Clapperboard,
  FileText,
  Film,
  FolderKanban,
  Highlighter,
  Lightbulb,
  Link2,
  Loader2,
  Lock,
  Maximize2,
  MoreHorizontal,
  PanelLeft,
  PanelRight,
  PenTool,
  Play,
  Plus,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Upload,
  Wand2,
  Wrench,
  X,
} from 'lucide-react';
import { Toast, useToast } from '../components/AdminWorkspace.jsx';
import {
  AI_SCRIPT_YAML,
  ASSET_NODES,
  BREAKDOWN,
  COVER_PRESETS,
  DEMO_PROJECTS,
  GROUP_META,
  IDEA_EXAMPLE,
  PRESET_SCRIPT,
  PROJECT_METADATA,
  RECOMMENDED_STYLE,
  STAGES,
  STYLES,
  VIDEO_SHOTS,
} from './workspaceDemo.js';
import './WorkspacePage.css';

const styleName = key => STYLES.find(s => s.key === key)?.name || '';

const ASSET_BY_NAME = new Map(ASSET_NODES.map(a => [a.name, a]));
const ASSET_BY_ID = new Map(ASSET_NODES.map(a => [a.id, a]));
const LINK_RE = new RegExp(`(@(?:${ASSET_NODES.map(a => a.name).join('|')}))`, 'g');

function renderLinkedText(text, onOpenAsset) {
  return text.split(LINK_RE).map((part, i) => {
    if (part.startsWith('@')) {
      const asset = ASSET_BY_NAME.get(part.slice(1));
      if (asset) {
        const color = GROUP_META[asset.group]?.color || '#2f6fb0';
        return (
          <button
            key={i}
            type="button"
            className="ws-asset-link"
            style={{ '--ac': color }}
            title={`点击查看「${asset.name}」资产图`}
            onClick={() => onOpenAsset(asset)}
          >
            <Link2 size={10} />
            {asset.name}
          </button>
        );
      }
    }
    return part;
  });
}

function renderLinkedPrompt(text, onOpenAsset) {
  return text.split('\n').map((line, lineIdx) => {
    const trimmed = line.trim();
    const isDialog = trimmed.startsWith('/台词') || trimmed.startsWith('【台词】');
    if (isDialog) {
      const content = trimmed.startsWith('/台词') ? trimmed.slice('/台词'.length).trim() : trimmed.slice('【台词】'.length).trim();
      return (
        <div key={lineIdx} className="ws-dialogue-line">
          <span className="ws-dialogue-tag">台词</span>
          <span>{renderLinkedText(content, onOpenAsset)}</span>
        </div>
      );
    }
    return (
      <div key={lineIdx} className="ws-prompt-line">
        {renderLinkedText(line, onOpenAsset)}
      </div>
    );
  });
}

/* ---------------- 提示词编辑：@ 引用资产（所见即所得 inline chip） ---------------- */

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 纯文本 -> 富文本 HTML（@资产 -> inline chip，【台词】行 -> 台词块）
function richHtml(text) {
  return text.split('\n').map(line => {
    const t = line.trim();
    const isDialogOld = t.startsWith('【台词】');
    const isDialogNew = t.startsWith('/台词');
    const isDialogue = isDialogOld || isDialogNew;
    const body = isDialogOld ? t.slice('【台词】'.length).trim() : isDialogNew ? t.slice('/台词'.length).trim() : line;
    const inner = body.split(LINK_RE).map(part => {
      if (part.startsWith('@')) {
        const asset = ASSET_BY_NAME.get(part.slice(1));
        if (asset) {
          const color = GROUP_META[asset.group]?.color || '#2f6fb0';
          return '<span class="ws-asset-link" data-asset="' + asset.name + '" contenteditable="false" style="--ac:' + color + '"><span class="ws-asset-link-ico">&#128279;</span>' + escapeHtml(asset.name) + '</span>';
        }
      }
      return escapeHtml(part);
    }).join('');
    if (isDialogue) {
      return '<div class="ws-dialogue-line" data-dialogue="1"><span class="ws-dialogue-tag" contenteditable="false">台词</span><span>' + (inner || '<br>') + '</span></div>';
    }
    return '<div class="ws-prompt-line">' + inner + '</div>';
  }).join('');
}

// / 命令列表
const SLASH_COMMANDS = [
  { key: 'dialogue', label: '台词', hint: '新增一条台词（对白）', match: ['台词', '对白', 'dialogue'] },
];

function MentionPromptEditor({ value, onChange, assets, onPreviewAsset, onSave, onCancel }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('asset'); // asset | command
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);

  const assetList = useMemo(() => {
    const q = query.trim();
    return assets.filter(a => !q || a.name.includes(q));
  }, [assets, query]);

  const commandList = useMemo(() => {
    const q = query.trim();
    if (!q) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter(c => c.label.includes(q) || c.match.some(m => m.includes(q)));
  }, [query]);

  const resetMenu = () => { setOpen(false); setKind('asset'); setQuery(''); setSel(0); };

  const serialize = () => {
    const el = ref.current;
    if (!el) return value;
    const out = [];
    const walk = node => {
      node.childNodes.forEach(child => {
        if (child.nodeType === Node.TEXT_NODE) {
          out.push(child.textContent);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          if (child.hasAttribute && child.hasAttribute('data-asset')) {
            out.push('@' + child.getAttribute('data-asset'));
          } else if (child.hasAttribute && child.hasAttribute('data-dialogue')) {
            // 台词块：跳过「台词」标签，输出 /台词 标记 + 正文（先确保在行首）
            if (out.length && out[out.length - 1] !== '\n') out.push('\n');
            out.push('/台词 ');
            child.childNodes.forEach(inner => {
              if (inner.nodeType === Node.TEXT_NODE) out.push(inner.textContent);
              else if (inner.nodeType === Node.ELEMENT_NODE) {
                if (inner.classList && inner.classList.contains('ws-dialogue-tag')) return; // 跳过「台词」标签
                if (inner.hasAttribute('data-asset')) out.push('@' + inner.getAttribute('data-asset'));
                else if (inner.tagName === 'BR') return; // 忽略空正文占位 <br>
                else walk(inner);
              }
            });
          } else if (child.tagName === 'BR') {
            out.push('\n');
          } else if (child.tagName === 'DIV' || child.tagName === 'P') {
            if (out.length && out[out.length - 1] !== '\n') out.push('\n');
            walk(child);
          } else {
            walk(child);
          }
        }
      });
    };
    walk(el);
    return out.join('').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');
  };

  const sync = () => onChange(serialize());

  // 初始：手动设 HTML（非受控，React 不追踪 innerHTML，光标不会因重渲染而重建）
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.innerHTML = richHtml(value);
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(range);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 外部 value 变化（右侧「+ 链接」插入资产）时同步回编辑器
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value !== serialize()) {
      el.innerHTML = richHtml(value);
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const snd = window.getSelection();
      snd.removeAllRanges();
      snd.addRange(range);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const detectMenu = () => {
    const s = window.getSelection();
    if (!s || s.rangeCount === 0) return resetMenu();
    const node = s.anchorNode;
    const offset = s.anchorOffset;
    if (node?.nodeType !== Node.TEXT_NODE) return resetMenu();
    const head = node.textContent.slice(0, offset);
    const mA = /@([^\s@]*)$/.exec(head);
    if (mA) { setKind('asset'); setQuery(mA[1]); setSel(0); setOpen(true); return; }
    const mC = /\/([^\s/]*)$/.exec(head);
    if (mC) { setKind('command'); setQuery(mC[1]); setSel(0); setOpen(true); return; }
    resetMenu();
  };

  const applyAsset = asset => {
    const s = window.getSelection();
    if (s && s.rangeCount > 0) {
      const range = s.getRangeAt(0);
      const node = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE) {
        const offset = range.startOffset;
        const text = node.textContent;
        const before = text.slice(0, offset).replace(/@([^\s@]*)$/, '');
        const after = text.slice(offset);
        if (before.length + after.length !== text.length) {
          node.textContent = before + after;
          s.collapse(node, before.length);
        }
      }
    }
    resetMenu();
    const color = GROUP_META[asset.group]?.color || '#2f6fb0';
    document.execCommand('insertHTML', false, '<span class="ws-asset-link" data-asset="' + asset.name + '" contenteditable="false" style="--ac:' + color + '">&#128279;' + escapeHtml(asset.name) + '</span>&nbsp;');
    sync();
  };

  const applyCommand = cmd => {
    const s = window.getSelection();
    if (s && s.rangeCount > 0) {
      const range = s.getRangeAt(0);
      const node = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE) {
        const offset = range.startOffset;
        const text = node.textContent;
        const before = text.slice(0, offset).replace(/\/[^\s/]*$/, '');
        const after = text.slice(offset);
        if (before.length + after.length !== text.length) {
          node.textContent = before + after;
          s.collapse(node, before.length);
        }
      }
    }
    resetMenu();
    if (cmd.key === 'dialogue') {
      const el = ref.current;
      // 插入纯文本标记：换行 + /台词 + 空格（随后统一重建成台词块）
      document.execCommand('insertHTML', false, '<br>/台词 ');
      const result = serialize();
      onChange(result);
      // 重建 DOM，让 /台词 行渲染成台词块
      el.innerHTML = richHtml(result);
      // 光标定位到刚插入的（最后一个）台词块正文
      setTimeout(() => {
        const dialogs = el.querySelectorAll('.ws-dialogue-line');
        const body = dialogs.length ? dialogs[dialogs.length - 1].querySelector('span:last-of-type') : null;
        if (body) {
          const range = document.createRange();
          range.setStart(body, 0);
          range.collapse(true);
          const snd = window.getSelection();
          snd.removeAllRanges();
          snd.addRange(range);
          el.focus();
        } else {
          el.focus();
        }
      }, 0);
    }
  };

  const onKeyDown = e => {
    if (!open) return;
    const list = kind === 'asset' ? assetList : commandList;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(x => Math.min(x + 1, list.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(x => Math.max(x - 1, 0)); }
    else if (e.key === 'Enter' || e.key === 'Tab') {
      const item = list[sel];
      if (item) { e.preventDefault(); if (kind === 'asset') applyAsset(item); else applyCommand(item); }
    } else if (e.key === 'Escape') { e.preventDefault(); resetMenu(); }
  };

  return (
    <div className="ws-mention-editor">
      <div className="ws-mention-input-wrap">
        <div
          ref={ref}
          className="ws-prompt ws-prompt--rich"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          onClick={detectMenu}
          onInput={() => { sync(); detectMenu(); }}
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(resetMenu, 150)}
        />
        {open && (
          <div className="ws-mention-menu" role="listbox">
            <div className="ws-mention-menu-title">{kind === 'asset' ? '引用过审资产（@）' : '插入命令（/）'}</div>
            {kind === 'asset' ? (
              assetList.length === 0
                ? <div className="ws-mention-empty">没有匹配的资产</div>
                : assetList.map((a, i) => (
                  <button
                    key={a.id}
                    type="button"
                    role="option"
                    aria-selected={i === sel}
                    className={'ws-mention-item ' + (i === sel ? 'active' : '')}
                    onMouseDown={e => { e.preventDefault(); applyAsset(a); }}
                    onMouseEnter={() => setSel(i)}
                  >
                    <i className="ws-mention-dot" style={{ background: GROUP_META[a.group]?.color }} />
                    <img src={a.img} alt={a.name} />
                    <span className="ws-mention-name">@{a.name}</span>
                    <span className="ws-mention-sub">{GROUP_META[a.group]?.label} · {a.sub}</span>
                  </button>
                ))
            ) : (
              commandList.length === 0
                ? <div className="ws-mention-empty">没有匹配的命令</div>
                : commandList.map((c, i) => (
                  <button
                    key={c.key}
                    type="button"
                    role="option"
                    aria-selected={i === sel}
                    className={'ws-mention-item ' + (i === sel ? 'active' : '')}
                    onMouseDown={e => { e.preventDefault(); applyCommand(c); }}
                    onMouseEnter={() => setSel(i)}
                  >
                    <span className="ws-mention-cmd">/</span>
                    <span className="ws-mention-name">{c.label}</span>
                    <span className="ws-mention-sub">{c.hint}</span>
                  </button>
                ))
            )}
          </div>
        )}
      </div>
      <div className="ws-mention-actions">
        <button type="button" className="ws-btn" onClick={onCancel}>取消</button>
        <button type="button" className="ws-btn primary" onClick={() => { sync(); onSave(serialize()); }}>
          <Check size={13} /> 保存
        </button>
      </div>
    </div>
  );
}

const STATUS_TEXT = {
  queued: '排队中',
  generating: '生成中',
  checking: '自检中',
  fail: '自检未通过',
  retrying: '自动重跑',
  pass: '自检通过',
};

const SCRIPT_TOKENS = [
  { word: '纵身翻越屋顶，凌空翻滚落地', kind: 'hard', label: '动捕' },
  { word: '苏晚', kind: 'character' },
  { word: '沈砚', kind: 'character' },
  { word: '神秘人', kind: 'character' },
  { word: '油纸伞', kind: 'prop' },
  { word: '停走的怀表', kind: 'prop' },
  { word: '怀表', kind: 'prop' },
  { word: '黄铜钥匙', kind: 'prop' },
  { word: '泛黄旧照片', kind: 'prop' },
  { word: '旧照片', kind: 'prop' },
  { word: '雨夜老街', kind: 'place' },
  { word: '药铺内景', kind: 'place' },
  { word: '黄昏天台', kind: 'place' },
  { word: '天台', kind: 'place' },
];

const SCRIPT_TOKEN_RE = new RegExp(
  `(${SCRIPT_TOKENS.map(t => t.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
  'g',
);

// 用于全屏编辑器底层高亮叠加层（与 textarea 同字体/间距，文字透明显示底层颜色）
function renderHighlightedScript(text) {
  return text.split('\n').map((line, lineIdx) => {
    const isHeading = /^第\d+场/.test(line.trim());
    const parts = line.split(SCRIPT_TOKEN_RE);
    return (
      <div key={lineIdx} className={`ws-script-line ${isHeading ? 'heading' : ''}`}>
        {line === '' ? '\u00A0' : parts.map((part, i) => {
          const hit = SCRIPT_TOKENS.find(t => t.word === part);
          if (!hit) return part;
          return (
            <mark key={i} className={`ws-hl ${hit.kind}`}>
              {part}
              {hit.label && <em>{hit.label}</em>}
            </mark>
          );
        })}
      </div>
    );
  });
}

/* ---------------- 上传剧本解析 ---------------- */

// 从 docx（zip 压缩包）里抽出 document.xml 的纯文本。
// docx 的正文在 word/document.xml，段落 <w:p>，文本 <w:t>。
async function extractDocxText(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  let xml = '';

  const readU16 = o => view.getUint16(o, true);
  const readU32 = o => view.getUint32(o, true);

  // 遍历 zip 的 local file header，直到 central directory
  while (offset + 30 < bytes.length) {
    const sig = readU32(offset);
    if (sig !== 0x04034b50) break; // 不是 local file header 就停
    const method = readU16(offset + 8);
    const compSize = readU32(offset + 18);
    const nameLen = readU16(offset + 26);
    const extraLen = readU16(offset + 28);
    const name = new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + nameLen));
    const dataStart = offset + 30 + nameLen + extraLen;
    const compData = bytes.slice(dataStart, dataStart + compSize);

    if (name === 'word/document.xml') {
      let raw;
      if (method === 0) {
        raw = compData; // STORE，明文
      } else if (method === 8) {
        raw = new Uint8Array(await new Response(
          new Blob([compData]).stream().pipeThrough(new DecompressionStream('deflate-raw')),
        ).arrayBuffer());
      } else {
        // 其它压缩方式不支持，跳过
      }
      if (raw) xml = new TextDecoder().decode(raw);
      break;
    }
    offset = dataStart + compSize;
  }

  if (!xml) throw new Error('未找到 document.xml');

  const text = xml
    .replace(/<w:p[ >]/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text) throw new Error('docx 中没有可提取的文本');
  return text;
}

/* ---------------- 画布节点 ---------------- */

function RootNode({ data }) {
  return (
    <div className={`wsn-root clickable ${data.visible ? 'sketch-in' : 'sketch-wait'}`} title="点击打开剧本资产">
      <div className="wsn-root-head">
        <FileText size={14} /> 剧本拆解
        <span className="wsn-root-open">查看剧本</span>
      </div>
      <b>{data.scriptTitle}</b>
      <div className="wsn-root-meta">{data.scriptMeta}</div>
      <div className="wsn-root-style"><Lock size={11} /> 风格：{data.styleName}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function GroupFrame({ data }) {
  return (
    <div className={`wsn-frame ${data.visible ? 'sketch-in' : 'sketch-wait'}`} style={{ '--g': data.color }}>
      <span className="wsn-frame-label">{data.label} · {data.done}/{data.total}</span>
      <Handle type="target" position={Position.Left} />
    </div>
  );
}

function AssetNode({ data }) {
  const { asset, state, selected, visible } = data;
  const status = state?.status || 'queued';
  const busy = status === 'queued' || status === 'generating' || status === 'retrying';
  const sketching = status === 'generating' || status === 'retrying';
  const imgClass = `wsn-img ${status === 'queued' ? 'queued-hide' : ''} ${sketching ? 'sketching' : ''} ${status === 'fail' ? 'too-bright' : ''} ${state?.fixed && status === 'pass' ? 'fixed' : ''}`;
  const meta = GROUP_META[asset.group];

  return (
    <div className={`wsn-asset status-${status} ${selected ? 'selected' : ''} ${visible ? 'sketch-in' : 'sketch-wait'}`}>
      <div className="wsn-asset-media">
        <img src={asset.img} alt={asset.name} className={imgClass} />
        {sketching && (
          <div className="wsn-pen-layer" aria-hidden="true">
            <svg className="wsn-sketch-svg" viewBox="0 0 216 140" fill="none">
              <path
                d="M28 112 C46 58, 74 36, 108 38 C142 40, 166 64, 184 112 M62 84 Q108 22 154 84 M44 104 L172 104"
                stroke="#8ec5ff"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeDasharray="360"
              />
            </svg>
            <div className="wsn-pen-nib">
              <PenTool size={15} />
            </div>
          </div>
        )}
        {status === 'queued' && (
          <div className="wsn-queued-hint">
            <PenTool size={14} />
            <span>待描边</span>
          </div>
        )}
        {sketching && <div className="wsn-progress"><i /></div>}
      </div>
      <div className="wsn-asset-body">
        <div className="wsn-asset-title">
          <span className="wsn-dot" style={{ background: meta.color }} />
          <b>{asset.name}</b>
          <small>{asset.sub}</small>
        </div>
        <div className={`wsn-chip ${status}`}>
          {busy || status === 'checking' ? <Loader2 size={11} className="spin" /> : status === 'fail' ? <X size={11} /> : <Check size={11} />}
          {status === 'retrying' ? `${STATUS_TEXT.retrying} · 第 ${state.round} 轮` : STATUS_TEXT[status]}
          {state?.score != null && (status === 'pass' || status === 'fail') && <span className="wsn-score">{state.score.toFixed(2)}</span>}
        </div>
        {status === 'fail' && <div className="wsn-note">{asset.failNote}</div>}
        {state?.fixed && status === 'pass' && <div className="wsn-note ok">已自动修正为暗调</div>}
      </div>
    </div>
  );
}

const NODE_TYPES = { root: RootNode, frame: GroupFrame, asset: AssetNode };

/* ---------------- 主页面 ---------------- */

const projectIdFromPath = () => {
  const m = window.location.pathname.match(/^\/app\/workspace\/projects\/([^/]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : '';
};

export default function WorkspacePage({ role } = {}) {
  const canViewTrace = role === 'superadmin' || role === 'org.admin';
  const initialPid = projectIdFromPath();
  const [projects, setProjects] = useState(DEMO_PROJECTS);
  const [activeProjectId, setActiveProjectId] = useState(initialPid || DEMO_PROJECTS[0].id);
  const [projectQuery, setProjectQuery] = useState('');
  const [hubStatusFilter, setHubStatusFilter] = useState('active'); // active | progress | done | archived
  const [hubStyleFilter, setHubStyleFilter] = useState('all');
  const [menuFor, setMenuFor] = useState(null); // 打开“...”菜单的项目 id
  const [newProjOpen, setNewProjOpen] = useState(false);
  const [newProj, setNewProj] = useState({ title: '', desc: '', cover: '', genre: '悬疑短剧', styleKey: 'noir' });
  const [newProjError, setNewProjError] = useState('');
  const [stage, setStage] = useState(0); // 已解锁到第几步
  const [activeSession, setActiveSession] = useState('part1');
  const [view, setView] = useState(initialPid ? 'script' : 'hub'); // hub | script | canvas | review | video | publish
  const [phase, setPhase] = useState('entry'); // entry | running | style | done
  const [entryMode, setEntryMode] = useState('preset');
  const [idea, setIdea] = useState(IDEA_EXAMPLE);
  const [thread, setThread] = useState([]);
  const [reveal, setReveal] = useState({});
  const [pickedStyle, setPickedStyle] = useState(RECOMMENDED_STYLE);
  const [lockedStyle, setLockedStyle] = useState('');
  const [assets, setAssets] = useState({});
  const [log, setLog] = useState([]);
  const [logOpen, setLogOpen] = useState(true);
  const [sketchStep, setSketchStep] = useState(99); // 0: 根节点, 1: 分组框, 2+: 逐个资产卡片
  const [selectedId, setSelectedId] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [leftTab, setLeftTab] = useState('sessions');
  const [rightTab, setRightTab] = useState('breakdown');
  const [draft, setDraft] = useState('');
  const [previewImg, setPreviewImg] = useState(null);
  const [reviewState, setReviewState] = useState('idle'); // idle | checking | passed
  const [reviewChecks, setReviewChecks] = useState({ kit: true, script: false, style: false });
  const [scriptText, setScriptText] = useState(PRESET_SCRIPT.excerpt);
  const [scriptDraft, setScriptDraft] = useState(PRESET_SCRIPT.excerpt);
  const [scriptTitle, setScriptTitle] = useState(PRESET_SCRIPT.title);
  const [scriptMeta, setScriptMeta] = useState(PRESET_SCRIPT.meta);
  const [scriptModalOpen, setScriptModalOpen] = useState(() => new URLSearchParams(window.location.search).get('openScript') === '1');
  const [scriptViewMode, setScriptViewMode] = useState('human'); // human | yaml
  const [scriptEditing, setScriptEditing] = useState(false);
  const [highlightOn, setHighlightOn] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shotPrompts, setShotPrompts] = useState(() => Object.fromEntries(VIDEO_SHOTS.map(s => [s.id, s.prompt])));
  const [shotStatus, setShotStatus] = useState({});
  const [editingShotId, setEditingShotId] = useState('');
  const [draftPrompt, setDraftPrompt] = useState('');
  const [harnessAlert, setHarnessAlert] = useState('');
  const [toast, showToast] = useToast();

  const timersRef = useRef([]);
  const threadEndRef = useRef(null);
  const scriptEditorRef = useRef(null);
  const scriptBackdropRef = useRef(null);
  const fileInputRef = useRef(null);
  const logIdRef = useRef(0);

  const later = useCallback((ms, fn) => {
    timersRef.current.push(setTimeout(fn, ms));
  }, []);
  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };
  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    if (!previewImg && !scriptModalOpen) return undefined;
    const onKey = e => {
      if (e.key === 'Escape') {
        setPreviewImg(null);
        setScriptModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewImg, scriptModalOpen]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [thread]);

  // 打开剧本编辑器后自动聚焦，让光标立即可见
  useEffect(() => {
    if (scriptModalOpen) {
      const t = setTimeout(() => {
        scriptEditorRef.current?.focus();
        const el = scriptEditorRef.current;
        if (el) el.setSelectionRange(el.value.length, el.value.length);
      }, 60);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [scriptModalOpen]);

  const patchItem = (id, patch) => setThread(list => list.map(it => (it.id === id ? { ...it, ...patch } : it)));
  const patchAsset = (id, patch) => setAssets(map => {
    const prev = map[id] || {};
    const next = typeof patch === 'function' ? patch(prev) : patch;
    return { ...map, [id]: { ...prev, ...next } };
  });
  const pushLog = (text, tone = 'info') => {
    logIdRef.current += 1;
    const id = logIdRef.current;
    setLog(list => [...list, { id, text, tone }]);
  };

  /* ---------- 第 1 步：剧本 ---------- */
  const startScript = () => {
    clearTimers();
    const fromIdea = entryMode === 'idea';
    setPhase('running');
    setReveal({});
    setRightTab('breakdown');
    setRightOpen(true);
    setThread([{
      id: 'u1',
      kind: 'user',
      text: fromIdea ? (idea.trim() || IDEA_EXAMPLE) : '用这份写好的剧本开工：拆场次、角色、道具、场景，推荐风格，并检查高难度动作。',
      attach: fromIdea ? '' : scriptTitle,
    }]);

    let t = 500;
    const tool = (id, name, label, runMs, detail, onDone) => {
      later(t, () => setThread(list => [...list, { id, kind: 'tool', name, label, status: 'running' }]));
      t += runMs;
      later(t, () => {
        patchItem(id, { status: 'ok', detail, duration: `${(runMs / 1000).toFixed(1)}s` });
        onDone?.();
      });
      t += 450;
    };

    later(t, () => setThread(list => [...list, {
      id: 'plan',
      kind: 'plan',
      text: fromIdea
        ? '先把创意扩写成一场可拍的剧本，再按 SOP 拆解；题材偏悬疑夜戏，风格倾向暗调；最后扫描动作描写，高难度动作单独走动捕通道。'
        : '读取剧本后按 SOP 拆解场次与三类资产清单；根据题材与夜戏占比推荐风格；最后扫描动作描写，高难度动作单独走动捕通道。',
    }]));
    t += 700;

    if (fromIdea) tool('t0', 'expand_script', '扩写成剧本', 1700, { type: 'script' });
    tool('t1', 'breakdown_script', '拆解场次 / 角色 / 道具 / 场景', 1600,
      { type: 'text', text: '拆出 3 场 · 3 个角色 · 3 件道具 · 3 个场景' },
      () => {
        ['scenes', 'characters', 'props', 'places'].forEach((k, i) => later(i * 260, () => setReveal(r => ({ ...r, [k]: true }))));
      });
    tool('t2', 'recommend_style', '从 8 种固定风格中推荐', 1200,
      { type: 'text', text: `推荐「${styleName(RECOMMENDED_STYLE)}」：悬疑题材，夜戏占 2/3，需要低照度与冷暖对比。` },
      () => setReveal(r => ({ ...r, style: true })));
    tool('t3', 'detect_hard_actions', '识别高难度动作', 1300,
      { type: 'hard' },
      () => setReveal(r => ({ ...r, hard: true })));

    later(t, () => {
      setThread(list => [...list, { id: 'gate', kind: 'styleGate' }]);
      setPhase('style');
    });
  };

  const lockStyle = () => {
    setLockedStyle(pickedStyle);
    setPhase('done');
    setStage(1);
    setThread(list => [...list, {
      id: 'done1',
      kind: 'next',
      text: `风格已锁定为「${styleName(pickedStyle)}」，全片不可再切换。第 1 步完成，可以进入画布生成三类资产图。`,
    }]);
    showToast(`已锁定风格：${styleName(pickedStyle)}`);
  };

  /* ---------- 第 2 步：资产图（画布） ---------- */
  const startAssets = () => {
    clearTimers();
    const init = {};
    ASSET_NODES.forEach(n => { init[n.id] = { status: 'queued', round: 1, rounds: [] }; });
    setAssets(init);
    setLog([]);
    setSketchStep(0);
    pushLog('Agent 执笔从 0 勾勒画布：剧本拆解 → 三类资产框架');

    // 0 -> 1 描边铺开节奏：先画根节点，再画分组框与连线，再逐张描出卡片轮廓
    later(240, () => setSketchStep(1));
    ASSET_NODES.forEach((_, idx) => {
      later(480 + idx * 110, () => setSketchStep(2 + idx));
    });

    ASSET_NODES.forEach((n, i) => {
      const base = 1100 + i * 420;
      later(base, () => { patchAsset(n.id, { status: 'generating' }); pushLog(`开始生成「${n.name}」${n.sub}`); });
      later(base + 1700, () => patchAsset(n.id, { status: 'checking' }));
      if (n.failFirst) {
        later(base + 2500, () => {
          patchAsset(n.id, prev => ({ status: 'fail', score: 0.68, rounds: [...(prev.rounds || []), { round: 1, score: 0.68, ok: false, note: n.failNote }] }));
          pushLog(`「${n.name}」自检 0.68 ✗ ${n.failNote}`, 'fail');
        });
        later(base + 3500, () => {
          patchAsset(n.id, { status: 'retrying', round: 2 });
          pushLog(`自动重跑「${n.name}」· ${n.fixNote}`, 'retry');
        });
        later(base + 5200, () => patchAsset(n.id, { status: 'checking' }));
        later(base + 6000, () => {
          patchAsset(n.id, prev => ({ status: 'pass', score: 0.93, fixed: true, rounds: [...(prev.rounds || []), { round: 2, score: 0.93, ok: true, note: '暗部压低，风格与锁定一致' }] }));
          pushLog(`「${n.name}」第 2 轮自检 0.93 ✓ 已修正为暗调`, 'ok');
        });
      } else {
        const score = 0.88 + (i % 4) * 0.02;
        later(base + 2500, () => {
          patchAsset(n.id, prev => ({ status: 'pass', score, rounds: [...(prev.rounds || []), { round: 1, score, ok: true, note: '人物/风格一致性达标' }] }));
          pushLog(`「${n.name}」自检 ${score.toFixed(2)} ✓`, 'ok');
        });
      }
    });
  };

  const enterCanvas = () => {
    setView('canvas');
    setRightTab('node');
    if (!Object.keys(assets).length) startAssets();
  };

  const rerunNode = id => {
    const n = ASSET_NODES.find(a => a.id === id);
    if (!n) return;
    const round = (assets[id]?.rounds?.length || 0) + 1;
    patchAsset(id, { status: 'retrying', round, fixed: assets[id]?.fixed });
    pushLog(`人工接管「${n.name}」：按修改后的提示词重跑`, 'retry');
    later(1800, () => patchAsset(id, { status: 'checking' }));
    later(2600, () => {
      patchAsset(id, prev => ({ status: 'pass', score: 0.95, rounds: [...(prev.rounds || []), { round, score: 0.95, ok: true, note: '人工修改提示词后重跑' }] }));
      pushLog(`「${n.name}」第 ${round} 轮自检 0.95 ✓`, 'ok');
    });
  };

  const counts = useMemo(() => {
    const c = { character: [0, 0], prop: [0, 0], place: [0, 0] };
    ASSET_NODES.forEach(n => {
      c[n.group][1] += 1;
      if (assets[n.id]?.status === 'pass') c[n.group][0] += 1;
    });
    return c;
  }, [assets]);
  const allPass = ASSET_NODES.every(n => assets[n.id]?.status === 'pass');
  const anyBusy = ASSET_NODES.some(n => ['generating', 'retrying', 'checking', 'queued'].includes(assets[n.id]?.status));

  const openScriptReader = (mode = 'human') => {
    setScriptDraft(scriptText);
    setScriptViewMode(mode);
    setScriptEditing(true);
    setScriptModalOpen(true);
  };

  const saveScriptEdit = () => {
    const next = scriptDraft.trim();
    if (!next) return;
    setSaving(true);
    setSaved(false);
    later(650, () => {
      setScriptText(next);
      setScriptEditing(false);
      setSaving(false);
      setSaved(true);
      pushLog('剧本资产已修订并同步至 Harness 上下文', 'ok');
      showToast('剧本已更新并同步至 Harness 上下文');
      later(1600, () => setSaved(false));
    });
  };

  const handleUpload = async event => {
    const file = event.target.files?.[0];
    event.target.value = ''; // 允许重复选择同一个文件
    if (!file) return;

    const name = file.name || '';
    const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
    const allowed = ['.md', '.txt', '.markdown', '.text', '.docx'];
    if (!allowed.includes(ext)) {
      showToast('仅支持 .md / .txt / .docx 剧本文件');
      return;
    }

    showToast(`正在读取「${name}」…`);
    try {
      let text;
      if (ext === '.docx') {
        text = await extractDocxText(await file.arrayBuffer());
      } else {
        text = await file.text();
      }
      const cleaned = text.replace(/\r\n?/g, '\n').trim();
      if (!cleaned) {
        showToast('文件内容为空，未能读取到剧本正文');
        return;
      }
      if (cleaned.length > 200000) {
        showToast('单本剧本不能超过 20 万字');
        return;
      }

      const baseName = name.replace(/\.[^.]+$/, '');
      setScriptText(cleaned);
      setScriptDraft(cleaned);
      setScriptTitle(baseName || '上传剧本');
      setScriptMeta(`${ext.replace('.', '').toUpperCase()} · ${Math.round(cleaned.replace(/\s+/g, '').length)} 字 · 已从本地导入`);
      setEntryMode('preset');
      pushLog(`已导入本地剧本「${baseName}」（${ext.replace('.', '').toUpperCase()}）并写入 Harness 剧本资产`, 'ok');
      showToast(`「${baseName}」已导入，稍后拆解即用此剧本`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('剧本解析失败', err);
      showToast(`剧本解析失败：${err.message || '未知错误'}`);
    }
  };

  const submitReview = () => {
    clearTimers();
    setStage(2);
    setView('review');
    setReviewState('checking');
    setReviewChecks({ kit: true, script: false, style: false });
    showToast('三类资产齐套，正在审核…');
    later(800, () => setReviewChecks(c => ({ ...c, script: true })));
    later(1500, () => setReviewChecks(c => ({ ...c, style: true })));
    later(2000, () => {
      setReviewState('passed');
      setStage(3);
      showToast('三项审核全部通过，已结算 +50 积分并解锁「生视频」');
    });
  };

  const enterVideoStep = () => {
    setView('video');
    setRightTab('assets');
    setRightOpen(true);
    setHarnessAlert('');
    const hasAny = VIDEO_SHOTS.some(s => shotStatus[s.id]);
    if (!hasAny) generateAllShotPrompts();
  };

  const generateAllShotPrompts = () => {
    setHarnessAlert('');
    const writing = {};
    VIDEO_SHOTS.forEach(s => { writing[s.id] = 'writing'; });
    setShotStatus(writing);
    pushLog(`AI 正在读取「${scriptTitle}」剧本与 9 项过审资产，生成链接式提示词…`);

    VIDEO_SHOTS.forEach((s, idx) => {
      later(550 + idx * 450, () => {
        setShotPrompts(prev => ({ ...prev, [s.id]: s.prompt }));
        setShotStatus(prev => ({ ...prev, [s.id]: 'idle' }));
        pushLog(`已生成「${s.scene} · ${s.title}」提示词（已链接 ${s.assetIds.length} 项资产）`, 'ok');
      });
    });
  };

  const runVideoShot = shotId => {
    setHarnessAlert('');
    const shot = VIDEO_SHOTS.find(s => s.id === shotId);
    setShotStatus(prev => ({ ...prev, [shotId]: 'generating' }));
    pushLog(`启动「${shot?.scene}」${shot?.mocap ? '深度动作捕捉通道' : '图生视频通道'}…`);
    later(1900, () => {
      setShotStatus(prev => {
        const next = { ...prev, [shotId]: 'done' };
        if (VIDEO_SHOTS.every(s => next[s.id] === 'done')) {
          setStage(4);
          showToast('全部分镜图生视频完成，已解锁第 5 步「发布」');
        }
        return next;
      });
      pushLog(`「${shot?.scene} · ${shot?.title}」成片片段已生成`, 'ok');
    });
  };

  const runAllVideoShots = () => {
    VIDEO_SHOTS.forEach((s, idx) => {
      later(idx * 420, () => runVideoShot(s.id));
    });
  };

  const triggerTextToVideoGuardrail = () => {
    setHarnessAlert('⛔ SOP 铁律拦截：严禁文生视频直出！所有分镜必须通过「人物 + 道具 + 场景」三类过审资产图链接生成，违规操作不予结算积分。');
    pushLog('Harness 拦截：已阻止「文生视频直出」违规请求', 'fail');
  };

  const activeProject = useMemo(
    () => projects.find(p => p.id === activeProjectId) || projects[0],
    [projects, activeProjectId],
  );

  const openProject = (proj, { syncUrl = true } = {}) => {
    clearTimers();
    setActiveProjectId(proj.id);
    if (syncUrl) {
      const target = `/app/workspace/projects/${encodeURIComponent(proj.id)}`;
      if (window.location.pathname !== target) {
        window.history.pushState({}, '', target);
      }
    }
    setStage(0);
    setView('script');
    setPhase('entry');
    setThread([]);
    setReveal({});
    setPickedStyle(proj.styleKey || RECOMMENDED_STYLE);
    setLockedStyle('');
    setAssets({});
    setLog([]);
    setSelectedId('');
    setRightTab('breakdown');
    setScriptTitle(proj.id === 'proj-rain-alley' ? PRESET_SCRIPT.title : `${proj.name} · EP01`);
    setScriptMeta(`${proj.genre} · 3 场 · 约 90 秒`);
    if (syncUrl) showToast(`已进入项目「${proj.name}」`);
  };

  const backToHub = ({ syncUrl = true } = {}) => {
    clearTimers();
    if (syncUrl && window.location.pathname !== '/app/workspace') {
      window.history.pushState({}, '', '/app/workspace');
    }
    setView('hub');
  };

  useEffect(() => {
    const onPop = () => {
      const pid = projectIdFromPath();
      if (!pid) {
        setView('hub');
      } else {
        const found = projects.find(p => p.id === pid) || projects[0];
        openProject(found, { syncUrl: false });
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [projects]); // eslint-disable-line react-hooks/exhaustive-deps

  const createProject = () => {
    const title = newProj.title.trim();
    if (!title) { setNewProjError('请填写项目标题'); return; }
    if (!newProj.desc.trim()) { setNewProjError('请填写项目描述'); return; }
    if (!newProj.cover) { setNewProjError('请选择或上传封面'); return; }
    const proj = {
      id: `proj-${Date.now()}`,
      name: title,
      desc: newProj.desc.trim(),
      genre: newProj.genre,
      styleKey: newProj.styleKey,
      cover: newProj.cover,
      sessionsCount: 1,
      stageIndex: 0,
      statusText: '新建 · 待拆剧本',
      quotaUsed: 0,
      quotaLimit: 1000,
      updatedAt: '刚刚',
    };
    setProjects(prev => [proj, ...prev]);
    setNewProjOpen(false);
    setNewProj({ title: '', desc: '', cover: '', genre: '悬疑短剧', styleKey: 'noir' });
    setNewProjError('');
    openProject(proj);
  };

  const resetDemo = () => {
    clearTimers();
    setStage(0); setView('script'); setPhase('entry'); setThread([]); setReveal({});
    setPickedStyle(RECOMMENDED_STYLE); setLockedStyle(''); setAssets({}); setLog([]);
    setSelectedId(''); setRightTab('breakdown'); setDraft('');
    setReviewState('idle'); setReviewChecks({ kit: true, script: false, style: false });
    setScriptText(PRESET_SCRIPT.excerpt); setScriptDraft(PRESET_SCRIPT.excerpt);
    setScriptTitle(PRESET_SCRIPT.title); setScriptMeta(PRESET_SCRIPT.meta);
    setScriptModalOpen(false); setScriptEditing(false);
    setShotPrompts(Object.fromEntries(VIDEO_SHOTS.map(s => [s.id, s.prompt])));
    setShotStatus({}); setEditingShotId(''); setDraftPrompt(''); setHarnessAlert('');
    showToast('演示已重置');
  };

  const sendNote = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const id = `n-${Date.now()}`;
    setThread(list => [...list, { id: `${id}-u`, kind: 'user', text }]);
    later(700, () => setThread(list => [...list, { id: `${id}-a`, kind: 'agent', text: '收到，已写入本 Session 的约束，后续 Loop 会遵守。' }]));
  };

  /* ---------- 画布数据 ---------- */
  const selectedAsset = ASSET_NODES.find(a => a.id === selectedId);
  useEffect(() => { if (selectedAsset) setEditPrompt(selectedAsset.prompt); }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const flow = useMemo(() => {
    const rows = ['character', 'prop', 'place'];
    const ROW_H = 300;
    const COL_W = 236;
    const nodes = [{
      id: 'root', type: 'root', position: { x: 0, y: ROW_H - 40 },
      data: { styleName: styleName(lockedStyle), scriptTitle, scriptMeta, visible: sketchStep >= 0 }, draggable: false, selectable: false, zIndex: 2,
    }];
    const edges = [];
    let cardIdx = 0;
    rows.forEach((g, r) => {
      const items = ASSET_NODES.filter(n => n.group === g);
      const y = r * ROW_H;
      nodes.push({
        id: `frame-${g}`, type: 'frame', position: { x: 320, y },
        data: { label: GROUP_META[g].label, color: GROUP_META[g].color, done: counts[g][0], total: counts[g][1], visible: sketchStep >= 1 },
        style: { width: 24 + items.length * COL_W, height: ROW_H - 30 },
        draggable: false, selectable: false, zIndex: 0,
      });
      const busy = items.some(n => ['generating', 'retrying'].includes(assets[n.id]?.status));
      edges.push({
        id: `e-${g}`, source: 'root', target: `frame-${g}`, type: 'smoothstep', animated: busy || sketchStep < 2,
        style: {
          stroke: GROUP_META[g].color,
          strokeWidth: 1.6,
          opacity: sketchStep >= 1 ? 1 : 0,
          transition: 'opacity .35s ease',
        },
      });
      items.forEach((n, i) => {
        const idx = cardIdx++;
        nodes.push({
          id: n.id, type: 'asset', position: { x: 334 + i * COL_W, y: y + 30 },
          data: { asset: n, state: assets[n.id], selected: selectedId === n.id, visible: sketchStep >= 2 + idx },
          draggable: false, zIndex: 1,
        });
      });
    });
    return { nodes, edges };
  }, [assets, counts, lockedStyle, selectedId, scriptTitle, scriptMeta, sketchStep]);

  /* ---------- 状态派生 ---------- */
  const sessionStatus = stage >= 2 ? ['review', '审核中']
    : view === 'canvas' && anyBusy ? ['running', 'Loop 运行中']
      : view === 'canvas' && allPass ? ['gate', '待提交审核']
        : phase === 'running' ? ['running', 'Loop 运行中']
          : phase === 'style' ? ['gate', '待确认风格']
            : phase === 'done' ? ['gate', '待进入画布']
              : ['idle', '待开始'];

  const goStage = idx => {
    if (idx === 0) setView('script');
    else if (idx === 1) enterCanvas();
    else if (idx === 2) setView('review');
    else if (idx === 3) enterVideoStep();
    else if (idx === 4) setView('publish');
  };
  const viewIndex = view === 'script' ? 0 : view === 'canvas' ? 1 : view === 'review' ? 2 : view === 'video' ? 3 : 4;

  /* ---------- 渲染：线程条目 ---------- */
  const renderItem = item => {
    if (item.kind === 'user') {
      return (
        <div key={item.id} className="ws-msg-user">
          {item.attach && <div className="ws-attach"><FileText size={12} /> {item.attach}</div>}
          {item.text}
        </div>
      );
    }
    if (item.kind === 'plan') {
      return (
        <div key={item.id} className="ws-plan">
          <div className="ws-plan-head"><Lightbulb size={13} /> 规划</div>
          <div>{item.text}</div>
        </div>
      );
    }
    if (item.kind === 'agent') return <div key={item.id} className="ws-agent-text">{item.text}</div>;
    if (item.kind === 'tool') {
      const running = item.status === 'running';
      return (
        <div key={item.id} className={`ws-tool ${running ? 'running' : 'ok'}`}>
          <div className="ws-tool-row">
            <span className="ws-tool-icon">{running ? <Loader2 size={13} className="spin" /> : <Check size={13} />}</span>
            <span className="ws-tool-label">{item.label}</span>
            <code>{item.name}</code>
            <span className="ws-tool-time">{running ? '运行中…' : item.duration}</span>
          </div>
          {!running && item.detail?.type === 'text' && <div className="ws-tool-detail">{item.detail.text}</div>}
          {!running && item.detail?.type === 'script' && (
            <pre className="ws-tool-script">{scriptText}</pre>
          )}
          {!running && item.detail?.type === 'hard' && (
            <div className="ws-tool-detail">
              {BREAKDOWN.hardActions.map(h => (
                <div key={h.id} className="ws-hard-row">
                  <AlertTriangle size={13} />
                  <b>{h.scene}</b> {h.action}
                  <span className="ws-hard-tag">→ {h.channel}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    if (item.kind === 'styleGate') {
      const locked = Boolean(lockedStyle);
      return (
        <div key={item.id} className={`ws-gate ${locked ? 'locked' : ''}`}>
          <div className="ws-gate-head">
            {locked ? <Lock size={15} /> : <ShieldCheck size={15} />}
            <b>{locked ? '风格已锁定' : '请确认全片风格'}</b>
            <span>SOP：选定后全片不得中途切换</span>
          </div>
          <div className="ws-style-grid">
            {STYLES.map(s => {
              const active = (locked ? lockedStyle : pickedStyle) === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  disabled={locked}
                  className={`ws-style ${active ? 'active' : ''}`}
                  onClick={() => setPickedStyle(s.key)}
                >
                  <i style={{ background: s.tone }} />
                  <span>{s.name}</span>
                  {s.key === RECOMMENDED_STYLE && <em>推荐</em>}
                </button>
              );
            })}
          </div>
          {!locked && (
            <div className="ws-gate-actions">
              <button type="button" className="ws-btn primary" onClick={lockStyle}>
                <Lock size={13} /> 锁定「{styleName(pickedStyle)}」
              </button>
              <span className="ws-gate-hint">锁定后进入第 2 步</span>
            </div>
          )}
        </div>
      );
    }
    if (item.kind === 'next') {
      return (
        <div key={item.id} className="ws-next">
          <div className="ws-next-text"><Check size={15} /> {item.text}</div>
          <button type="button" className="ws-btn primary" onClick={enterCanvas}>
            进入画布 · 生成资产图 <ArrowRight size={13} />
          </button>
        </div>
      );
    }
    return null;
  };

  /* ---------- 渲染：右栏 ---------- */
  const Section = ({ title, ready, children, count }) => (
    <section className="ws-bd-section">
      <div className="ws-bd-title">{title}{ready && count != null && <span>{count}</span>}</div>
      {ready ? children : phase === 'running' ? <div className="ws-skel"><i /><i /></div> : <div className="ws-bd-empty">等待剧本拆解</div>}
    </section>
  );

  const breakdownPanel = (
    <div className="ws-right-scroll">
      <Section title="风格" ready={reveal.style}>
        <div className="ws-bd-style">
          <i style={{ background: STYLES.find(s => s.key === (lockedStyle || RECOMMENDED_STYLE))?.tone }} />
          <b>{styleName(lockedStyle || RECOMMENDED_STYLE)}</b>
          <span className={lockedStyle ? 'locked' : ''}>{lockedStyle ? <><Lock size={11} /> 已锁定</> : 'Agent 推荐 · 待确认'}</span>
        </div>
      </Section>
      <Section title="场次" ready={reveal.scenes} count={BREAKDOWN.scenes.length}>
        {BREAKDOWN.scenes.map(s => (
          <div key={s.id} className={`ws-bd-scene ${s.hard ? 'hard' : ''}`}>
            <div><b>{s.no}</b> {s.place} <small>{s.time}</small></div>
            <p>{s.beat}</p>
            {s.hard && <span className="ws-hard-tag"><AlertTriangle size={11} /> 动捕通道</span>}
          </div>
        ))}
      </Section>
      <Section title="角色" ready={reveal.characters} count={BREAKDOWN.characters.length}>
        {BREAKDOWN.characters.map(c => (
          <div key={c.id} className="ws-bd-row"><b>{c.name}</b><small>{c.role}</small><p>{c.look}</p></div>
        ))}
      </Section>
      <Section title="道具" ready={reveal.props} count={BREAKDOWN.props.length}>
        <div className="ws-bd-tags">{BREAKDOWN.props.map(p => <span key={p.id}>{p.name}<small>{p.scene}</small></span>)}</div>
      </Section>
      <Section title="场景" ready={reveal.places} count={BREAKDOWN.places.length}>
        <div className="ws-bd-tags">{BREAKDOWN.places.map(p => <span key={p.id}>{p.name}<small>{p.scene}</small></span>)}</div>
      </Section>
      <Section title="动捕通道" ready={reveal.hard} count={BREAKDOWN.hardActions.length}>
        {BREAKDOWN.hardActions.map(h => (
          <div key={h.id} className="ws-bd-hard">
            <AlertTriangle size={13} />
            <div><b>{h.scene} · {h.action}</b><p>难度{h.level}，不走普通图生视频，转{h.channel}</p></div>
          </div>
        ))}
      </Section>
    </div>
  );

  const nodePanel = selectedAsset ? (
    <div className="ws-right-scroll">
      <div
        className="ws-node-hero clickable"
        role="button"
        tabIndex={0}
        title="点击查看大图"
        onClick={() => setPreviewImg({
          src: selectedAsset.img,
          name: selectedAsset.name,
          sub: selectedAsset.sub,
          filterClass: assets[selectedId]?.status === 'fail' ? 'too-bright' : assets[selectedId]?.fixed ? 'fixed' : '',
        })}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setPreviewImg({
              src: selectedAsset.img,
              name: selectedAsset.name,
              sub: selectedAsset.sub,
              filterClass: assets[selectedId]?.status === 'fail' ? 'too-bright' : assets[selectedId]?.fixed ? 'fixed' : '',
            });
          }
        }}
      >
        <img src={selectedAsset.img} alt={selectedAsset.name} className={assets[selectedId]?.status === 'fail' ? 'too-bright' : assets[selectedId]?.fixed ? 'fixed' : ''} />
        <span className={`wsn-chip ${assets[selectedId]?.status || 'queued'}`}>{STATUS_TEXT[assets[selectedId]?.status || 'queued']}</span>
        <span className="ws-zoom-badge"><Maximize2 size={11} /> 查看大图</span>
      </div>
      <div className="ws-node-title">
        <span className="wsn-dot" style={{ background: GROUP_META[selectedAsset.group].color }} />
        <b>{selectedAsset.name}</b><small>{selectedAsset.sub}</small>
      </div>
      <section className="ws-bd-section">
        <div className="ws-bd-title">Loop 记录</div>
        {(assets[selectedId]?.rounds || []).length === 0 && <div className="ws-bd-empty">尚未完成自检</div>}
        {(assets[selectedId]?.rounds || []).map(r => (
          <div key={r.round} className={`ws-round ${r.ok ? 'ok' : 'fail'}`}>
            <span>第 {r.round} 轮</span>
            <b>{r.score.toFixed(2)} {r.ok ? '✓' : '✗'}</b>
            <p>{r.note}</p>
          </div>
        ))}
      </section>
      <section className="ws-bd-section">
        <div className="ws-bd-title">提示词 <span>可人工接管</span></div>
        <textarea className="ws-prompt" rows={4} value={editPrompt} onChange={e => setEditPrompt(e.target.value)} />
        <button
          type="button"
          className="ws-btn"
          disabled={['generating', 'retrying', 'checking', 'queued'].includes(assets[selectedId]?.status)}
          onClick={() => rerunNode(selectedId)}
        >
          <RotateCcw size={13} /> 按此提示词重跑该节点
        </button>
      </section>
    </div>
  ) : (
    <div className="ws-right-scroll"><div className="ws-bd-empty pad">点击画布中的资产节点，查看 Loop 记录或人工接管重跑</div></div>
  );

  const insertAssetToShot = asset => {
    if (!editingShotId) {
      setPreviewImg({ src: asset.img, name: asset.name, sub: asset.sub, filterClass: '' });
      return;
    }
    setDraftPrompt(cur => {
      const sep = cur && !cur.endsWith(' ') ? ' ' : '';
      return `${cur}${sep}@${asset.name} `;
    });
    showToast(`已将 @${asset.name} 链接到当前镜头提示词`);
  };

  const assetsPanel = (
    <div className="ws-right-scroll">
      <div className="ws-assets-tip">
        {editingShotId
          ? '正在微调提示词：点击右侧「+ 链接」可插入 @资产'
          : '已过审入库 9 项资产，点击查看大图'}
      </div>
      {['character', 'prop', 'place'].map(g => {
        const list = ASSET_NODES.filter(n => n.group === g);
        return (
          <section key={g} className="ws-bd-section">
            <div className="ws-bd-title">
              <span>{GROUP_META[g].label}</span>
              <span>{list.length} 项 · 已过审</span>
            </div>
            <div className="ws-asset-list">
              {list.map(a => (
                <div key={a.id} className="ws-asset-row">
                  <button
                    type="button"
                    className="ws-asset-row-main"
                    onClick={() => setPreviewImg({ src: a.img, name: a.name, sub: a.sub, filterClass: '' })}
                  >
                    <img src={a.img} alt={a.name} />
                    <div>
                      <b>{a.name}</b>
                      <small>{a.sub}</small>
                    </div>
                  </button>
                  {editingShotId ? (
                    <button type="button" className="ws-asset-insert" onClick={() => insertAssetToShot(a)}>
                      + 链接
                    </button>
                  ) : (
                    <span className="ws-asset-ok"><Check size={11} /></span>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );

  const toggleArchive = proj => {
    const nextArchived = !proj.archived;
    setProjects(prev => prev.map(p => (p.id === proj.id ? { ...p, archived: nextArchived } : p)));
    showToast(nextArchived ? `已归档「${proj.name}」` : `已恢复「${proj.name}」`);
  };

  const toggleFavorite = proj => {
    const nextFavorite = !proj.favorite;
    setProjects(prev => prev.map(p => (p.id === proj.id ? { ...p, favorite: nextFavorite } : p)));
    showToast(nextFavorite ? `已收藏「${proj.name}」` : `已取消收藏「${proj.name}」`);
  };

  // 点击卡片外的区域关闭“...”菜单
  useEffect(() => {
    const close = e => { if (!e.target.closest('.ws-hub-menu-wrap')) setMenuFor(null); };
    if (menuFor) { document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close); }
  }, [menuFor]);

  /* ---------- 渲染 ---------- */
  if (view === 'hub') {
    const archivedCount = projects.filter(p => p.archived).length;
    const visibleProjects = projects.filter(p => {
      if (hubStatusFilter === 'archived') {
        if (!p.archived) return false;
      } else {
        if (p.archived) return false;
        if (hubStatusFilter === 'progress' && p.stageIndex >= 4) return false;
        if (hubStatusFilter === 'done' && p.stageIndex < 4) return false;
      }
      if (hubStyleFilter !== 'all' && p.styleKey !== hubStyleFilter) return false;
      if (projectQuery.trim()) {
        const q = projectQuery.trim();
        if (!p.name.includes(q) && !p.genre.includes(q)) return false;
      }
      return true;
    });
    return (
      <div className="ws-shell">
        <header className="ws-header">
          <div className="ws-header-left">
            <span className="ws-project"><FolderKanban size={14} /> 创作工作台 · 项目管理</span>
          </div>
          <div className="ws-header-right">
            <input
              className="ws-hub-search"
              value={projectQuery}
              onChange={e => setProjectQuery(e.target.value)}
              placeholder="搜索项目或题材…"
            />
            {canViewTrace && (
              <button
                type="button"
                className="ws-btn"
                onClick={() => window.open('/admin/org/tracing', '_blank')}
                title="查看全链路 Trace 追踪"
              >
                Trace ↗
              </button>
            )}
            <button type="button" className="ws-btn primary" onClick={() => { setNewProj({ title: '', desc: '', cover: '', genre: '悬疑短剧', styleKey: 'noir' }); setNewProjError(''); setNewProjOpen(true); }}>
              <Plus size={14} /> 新建项目
            </button>
          </div>
        </header>

        <div className="ws-hub">
          <div className="ws-hub-head">
            <div>
              <h2>我的项目</h2>
            </div>
            <div className="ws-hub-filters">
              <div className="ws-hub-tabs" role="tablist">
                {[
                  ['active', '全部项目'],
                  ['progress', '进行中'],
                  ['done', '已完成'],
                  ['archived', `已归档 (${archivedCount})`],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={hubStatusFilter === key ? 'active' : ''}
                    onClick={() => setHubStatusFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <select
                className="ws-hub-style-select"
                value={hubStyleFilter}
                onChange={e => setHubStyleFilter(e.target.value)}
                aria-label="按风格筛选"
              >
                <option value="all">全部风格</option>
                {STYLES.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
              </select>
              <span className="ws-hub-count">共 {visibleProjects.length} 个项目</span>
            </div>
          </div>

          {visibleProjects.length === 0 ? (
            <div className="ws-hub-empty">
              <b>{hubStatusFilter === 'archived' ? '暂无已归档项目' : '没有匹配的项目'}</b>
              <p>{hubStatusFilter === 'archived' ? '在项目卡片右下角点击「归档」可收纳不再活跃的项目' : '调整筛选条件或新建一个项目'}</p>
            </div>
          ) : (
            <div className="ws-hub-grid">
              {visibleProjects.map(proj => (
                <article key={proj.id} className={`ws-hub-card ${proj.archived ? 'archived' : ''}`} onClick={() => openProject(proj)}>
                  <div className="ws-hub-cover">
                    <img src={proj.cover} alt={proj.name} />
                    <div className="ws-hub-menu-wrap" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        className="ws-hub-menu-btn"
                        aria-label="项目菜单"
                        onClick={() => setMenuFor(menuFor === proj.id ? null : proj.id)}
                      >
                        <MoreHorizontal size={17} />
                      </button>
                      {menuFor === proj.id && (
                        <div className="ws-hub-menu">
                          <button type="button" onClick={() => { toggleFavorite(proj); setMenuFor(null); }}>
                            <Star size={15} fill={proj.favorite ? 'currentColor' : 'none'} />
                            {proj.favorite ? '取消收藏' : '收藏'}
                          </button>
                          <button type="button" onClick={() => { toggleArchive(proj); setMenuFor(null); }}>
                            {proj.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                            {proj.archived ? '恢复' : '归档'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="ws-hub-body">
                    <div className="ws-hub-title">
                      <span className="ws-hub-name">
                        {proj.favorite && <Star size={13} className="ws-hub-fav" fill="currentColor" />}
                        <b>{proj.name}</b>
                      </span>
                      <small>{proj.updatedAt}</small>
                    </div>
                    {proj.desc && <p className="ws-hub-desc">{proj.desc}</p>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {newProjOpen && (
          <div className="ws-lightbox" role="dialog" aria-modal="true" onClick={() => setNewProjOpen(false)}>
            <div className="ws-hub-modal" onClick={e => e.stopPropagation()}>
              <div className="ws-hub-modal-head">
                <div>
                  <b>新建项目</b>
                  <small>填写项目基础信息，创建后即可进入工作台拆剧本</small>
                </div>
                <button type="button" className="ws-btn icon" onClick={() => setNewProjOpen(false)} aria-label="关闭">
                  <X size={15} />
                </button>
              </div>

              <div className="ws-hub-modal-body">
                <div className="ws-hub-field">
                  <label htmlFor="np-title">标题 <em>*</em></label>
                  <input
                    id="np-title"
                    value={newProj.title}
                    onChange={e => { setNewProj(p => ({ ...p, title: e.target.value })); setNewProjError(''); }}
                    placeholder="例如：《古宅迷雾》第 1 季"
                    autoFocus
                  />
                </div>

                <div className="ws-hub-field">
                  <label htmlFor="np-desc">描述 <em>*</em></label>
                  <textarea
                    id="np-desc"
                    rows={3}
                    value={newProj.desc}
                    onChange={e => { setNewProj(p => ({ ...p, desc: e.target.value })); setNewProjError(''); }}
                    placeholder="一句话说清项目题材、人物与冲突…"
                  />
                </div>

                <div className="ws-hub-field">
                  <label>封面 <em>*</em></label>
                  <div className="ws-hub-covers">
                    {COVER_PRESETS.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        className={`ws-hub-cover-opt ${newProj.cover === c.src ? 'active' : ''}`}
                        onClick={() => { setNewProj(p => ({ ...p, cover: c.src })); setNewProjError(''); }}
                        title={c.name}
                      >
                        <img src={c.src} alt={c.name} />
                        <span>{c.name}</span>
                        {newProj.cover === c.src && <i className="ws-hub-cover-check"><Check size={12} /></i>}
                      </button>
                    ))}
                    <label className="ws-hub-upload">
                      <Upload size={14} />
                      <span>上传封面</span>
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => { setNewProj(p => ({ ...p, cover: reader.result })); setNewProjError(''); };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  </div>
                  {newProj.cover && (
                    <div className="ws-hub-cover-preview">
                      <img src={newProj.cover} alt="封面预览" />
                      <span>当前封面</span>
                    </div>
                  )}
                </div>

                {newProjError && <p className="ws-hub-error" role="alert">{newProjError}</p>}
              </div>

              <div className="ws-hub-modal-foot">
                <button type="button" className="ws-btn" onClick={() => setNewProjOpen(false)}>取消</button>
                <button type="button" className="ws-btn primary" onClick={createProject}>
                  创建并进入 <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </div>
        )}

        <Toast message={toast} />
      </div>
    );
  }

  return (
    <div className="ws-shell">
      <header className="ws-header">
        <div className="ws-header-left">
          <button type="button" className="ws-btn" onClick={() => backToHub()} title="返回项目列表">
            <ArrowLeft size={13} /> 项目列表
          </button>
          <span className="ws-project">
            <FolderKanban size={14} /> {activeProject.name}
          </span>
        </div>

        {/* 五步阶段条（集成在顶栏） */}
        <nav className="ws-stepper" aria-label="生产阶段">
          {STAGES.map((s, i) => {
            const state = i < stage ? 'done' : i === stage ? 'current' : 'locked';
            return (
              <button
                key={s.key}
                type="button"
                title={s.desc}
                className={`ws-step ${state} ${viewIndex === i ? 'viewing' : ''}`}
                onClick={() => goStage(i)}
              >
                <span className="ws-step-no">{state === 'done' ? <Check size={11} /> : state === 'locked' ? <Lock size={10} /> : i + 1}</span>
                <span className="ws-step-text"><b>{s.label}</b></span>
                {i < STAGES.length - 1 && <span className="ws-step-line" />}
              </button>
            );
          })}
        </nav>

        <div className="ws-header-right">
          {canViewTrace && (
            <button
              type="button"
              className="ws-btn"
              onClick={() => window.open('/admin/org/tracing', '_blank')}
              title="查看全链路 Trace 追踪"
            >
              Trace ↗
            </button>
          )}
          <button type="button" className="ws-btn" onClick={resetDemo}><RotateCcw size={13} /> 重置演示</button>
          <button type="button" className={`ws-btn icon ${leftOpen ? 'on' : ''}`} onClick={() => setLeftOpen(v => !v)} title="左栏"><PanelLeft size={15} /></button>
          <button type="button" className={`ws-btn icon ${rightOpen ? 'on' : ''}`} onClick={() => setRightOpen(v => !v)} title="右栏"><PanelRight size={15} /></button>
        </div>
      </header>

      <div className="ws-panes">
        {leftOpen && (
          <aside className="ws-left">
            <div className="ws-tabs">
              <button type="button" className={leftTab === 'sessions' ? 'active' : ''} onClick={() => setLeftTab('sessions')}>Sessions</button>
              <button type="button" className={leftTab === 'harness' ? 'active' : ''} onClick={() => setLeftTab('harness')}>Harness</button>
            </div>
            <div className="ws-left-scroll">
              {leftTab === 'sessions' ? (
                <>
                  <button
                    type="button"
                    className={`ws-session ${activeSession === 'part1' ? 'selected' : ''}`}
                    onClick={() => setActiveSession('part1')}
                  >
                    <div className="ws-session-top"><i className={`ws-dot ${sessionStatus[0]}`} /><b>Part 1</b></div>
                    <div className="ws-session-meta">{sessionStatus[1]}</div>
                  </button>
                  <button
                    type="button"
                    className={`ws-session ${activeSession === 'part2' ? 'selected' : ''}`}
                    onClick={() => {
                      setActiveSession('part2');
                      showToast(allPass ? '已切到 Part 2 · 自动共享项目 9 项过审资产' : '已切到 Part 2 Session');
                    }}
                  >
                    <div className="ws-session-top"><i className={`ws-dot ${allPass ? 'gate' : 'idle'}`} /><b>Part 2</b></div>
                    <div className="ws-session-meta">{allPass ? '已共享 9 项资产' : '待开始'}</div>
                  </button>
                  <button type="button" className="ws-new-session" onClick={() => showToast('演示中仅开放 Part 1 / Part 2')}>+ 新建 Session</button>
                </>
              ) : (
                <>
                  <div className="ws-h-title">剧本资产 & Project Metadata</div>
                  <button type="button" className="ws-h-item clickable" onClick={() => openScriptReader('human')}>
                    <FileText size={13} />
                    <span>{scriptTitle}</span>
                    <small className="ok">正文</small>
                  </button>
                  <button type="button" className="ws-h-item clickable" onClick={() => openScriptReader('yaml')}>
                    <Wrench size={13} />
                    <span>AI 结构化剧本 (YAML)</span>
                    <small className="ok">Spec</small>
                  </button>
                  <div className="ws-h-title">风格锁定</div>
                  <div className="ws-h-item">
                    {lockedStyle ? <Lock size={13} /> : <Sparkles size={13} />}
                    <span>{lockedStyle ? styleName(lockedStyle) : '未锁定'}</span>
                    <small className={lockedStyle ? 'ok' : ''}>{lockedStyle ? '不可切换' : '第 1 步确认'}</small>
                  </div>
                  <div className="ws-h-title">三类资产齐套</div>
                  {['character', 'prop', 'place'].map(g => (
                    <div key={g} className="ws-h-item">
                      <span className="wsn-dot" style={{ background: GROUP_META[g].color }} />
                      <span>{GROUP_META[g].label}</span>
                      <small className={counts[g][0] === counts[g][1] ? 'ok' : ''}>{counts[g][0]}/{counts[g][1]}</small>
                    </div>
                  ))}
                  <div className="ws-h-title">Session 状态机</div>
                  <div className="ws-h-item">
                    <span className="wsn-dot" style={{ background: '#2f6fb0' }} />
                    <span>{STAGES[viewIndex]?.label || '剧本'}</span>
                    <small className="ok">{view.toUpperCase()}</small>
                  </div>
                  <div className="ws-h-title">记忆上下文 · 跨 Session 共享</div>
                  <div className="ws-h-item">
                    <Sparkles size={13} />
                    <span>剧本 1 · 风格 {lockedStyle ? 1 : 0} · 共享资产 {allPass ? 9 : 0}</span>
                    <small className="ok">{activeSession === 'part2' && allPass ? 'Part 2 已继承' : '已挂载'}</small>
                  </div>
                  <div className="ws-h-title">成本与重试护栏</div>
                  <div className="ws-h-item"><RotateCcw size={13} /><span>maxRetry 上限</span><small className="ok">3 次</small></div>
                  <div className="ws-h-item"><ShieldCheck size={13} /><span>单集算力上限</span><small className="ok">160 / 1000</small></div>
                  <div className="ws-h-title">SOP 铁律 · 合规与幂等</div>
                  <div className="ws-h-item"><ShieldCheck size={13} /><span>严禁文生视频直出</span><small className="ok">生效</small></div>
                  <div className="ws-h-item"><Lock size={13} /><span>资产图未过审不得生视频</span><small className="warn">{stage >= 3 ? '已解锁' : '锁定中'}</small></div>
                  <div className="ws-h-item"><Clapperboard size={13} /><span>高难度动作走动捕通道</span><small>{reveal.hard ? `${BREAKDOWN.hardActions.length} 项` : '—'}</small></div>
                  <div className="ws-h-item"><Check size={13} /><span>工具调用幂等 & 合规校验</span><small className="ok">通过</small></div>
                </>
              )}
            </div>
          </aside>
        )}

        <section className="ws-center">
          {view === 'script' && (
            <>
              <div className="ws-center-bar">
                <b>第 1 步 · 剧本（{activeSession === 'part2' ? 'Part 2' : 'Part 1'}）</b>
                <span>
                  {activeSession === 'part2' && allPass
                    ? '已自动继承项目锁定的风格与 9 项过审资产，无需重新生成'
                    : 'Agent 拆解剧本、推荐风格、标记动捕；你只需确认风格'}
                </span>
              </div>
              {phase === 'entry' ? (
                <div className="ws-entry">
                  <h2>从哪里开始？</h2>
                  <p>选一种方式交给 Agent，后面的拆解由它自己跑完</p>
                  <div className="ws-entry-cards">
                    <button type="button" className={`ws-entry-card ${entryMode === 'preset' ? 'active' : ''}`} onClick={() => setEntryMode('preset')}>
                      <div className="ws-entry-icon"><FileText size={18} /></div>
                      <b>用写好的剧本</b>
                      <span>上传或选择已有剧本，直接拆解</span>
                    </button>
                    <button type="button" className={`ws-entry-card ${entryMode === 'idea' ? 'active' : ''}`} onClick={() => setEntryMode('idea')}>
                      <div className="ws-entry-icon"><Wand2 size={18} /></div>
                      <b>从 0 开始</b>
                      <span>一句话创意，Agent 先扩写成剧本</span>
                    </button>
                  </div>
                  {entryMode === 'preset' ? (
                    <div className="ws-entry-detail">
                      <div className="ws-script-card">
                        <FileText size={16} />
                        <div><b>{scriptTitle}</b><small>{scriptMeta}</small></div>
                        <span className="ws-script-ok"><Check size={12} /> 已选择</span>
                      </div>
                      <button type="button" className="ws-upload" onClick={() => fileInputRef.current?.click()}><Upload size={13} /> 上传其他剧本（.md / .docx / .txt）</button>
                      <input ref={fileInputRef} type="file" accept=".md,.txt,.markdown,.text,.docx" onChange={handleUpload} hidden />
                    </div>
                  ) : (
                    <div className="ws-entry-detail">
                      <textarea className="ws-idea" rows={3} value={idea} onChange={e => setIdea(e.target.value)} placeholder="一句话说清：时代、人物、事件、悬念" />
                    </div>
                  )}
                  <button type="button" className="ws-btn primary lg" onClick={startScript}>
                    <Sparkles size={14} /> 开始拆解
                  </button>
                </div>
              ) : (
                <>
                  <div className="ws-thread">
                    {thread.map(renderItem)}
                    {phase === 'running' && <div className="ws-typing"><i /><i /><i /></div>}
                    <div ref={threadEndRef} />
                  </div>
                  <div className="ws-composer-wrap">
                    <div className="ws-composer">
                      <textarea
                        rows={1}
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendNote(); } }}
                        placeholder="给 Agent 补充要求，例如：沈砚的眼镜换成金丝边"
                      />
                      <button type="button" className="ws-send" onClick={sendNote} aria-label="发送"><Send size={14} /></button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {view === 'canvas' && (
            <div className="ws-canvas">
              <div className="ws-canvas-bar">
                <b>第 2 步 · 资产图</b>
                <div className="ws-kit">
                  {['character', 'prop', 'place'].map(g => (
                    <span key={g} className={counts[g][0] === counts[g][1] ? 'ok' : ''}>
                      <i style={{ background: GROUP_META[g].color }} />{GROUP_META[g].label} {counts[g][0]}/{counts[g][1]}
                    </span>
                  ))}
                </div>
                <button type="button" className="ws-btn" onClick={startAssets} title="重播 0→1 执笔绘制动画">
                  <PenTool size={13} /> 重绘 0→1
                </button>
                <button type="button" className="ws-btn primary" disabled={!allPass} onClick={submitReview}>
                  {allPass ? <>提交审核 <ArrowRight size={13} /></> : <><Loader2 size={13} className="spin" /> 资产生成中</>}
                </button>
              </div>
              <div className="ws-flow">
                {sketchStep < 11 && (
                  <div className="ws-canvas-pen-banner" aria-hidden="true">
                    <PenTool size={13} /> Agent 正在从 0 勾勒画布框架…
                  </div>
                )}
                <ReactFlow
                  nodes={flow.nodes}
                  edges={flow.edges}
                  nodeTypes={NODE_TYPES}
                  nodesDraggable={false}
                  nodesConnectable={false}
                  fitView
                  fitViewOptions={{ padding: 0.12 }}
                  minZoom={0.3}
                  proOptions={{ hideAttribution: true }}
                  onNodeClick={(_, node) => {
                    if (node.type === 'root') {
                      openScriptReader();
                      return;
                    }
                    if (node.type !== 'asset') return;
                    setSelectedId(node.id);
                    setRightTab('node');
                    setRightOpen(true);
                  }}
                >
                  <Background gap={20} size={1} color="#dfe3e9" />
                  <Controls showInteractive={false} position="bottom-right" />
                </ReactFlow>

                <div className={`ws-log ${logOpen ? '' : 'closed'}`}>
                  <button type="button" className="ws-log-head" onClick={() => setLogOpen(v => !v)}>
                    <Wrench size={12} /> Agent Loop 日志 <span>{log.length}</span><ChevronDown size={12} className={logOpen ? '' : 'rot'} />
                  </button>
                  {logOpen && (
                    <div className="ws-log-body">
                      {log.slice(-8).map(l => <div key={l.id} className={`ws-log-row ${l.tone}`}>{l.text}</div>)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {view === 'review' && (
            <div className="ws-entry">
              <div className="ws-entry-icon big"><ShieldCheck size={22} /></div>
              <h2>{reviewState === 'passed' ? '三项审核全部通过' : '正在审核资产图…'}</h2>
              <p>
                {reviewState === 'passed'
                  ? `人物 3 · 道具 3 · 场景 3 已入库，风格锁定为「${styleName(lockedStyle)}」，+50 积分已结算`
                  : `人物 3 · 道具 3 · 场景 3 齐套，正在校验剧本贴合度与「${styleName(lockedStyle)}」风格统一性`}
              </p>
              <div className="ws-review-list">
                <span><Check size={12} /> 三类齐套</span>
                <span className={reviewChecks.script ? '' : 'pending'}>
                  {reviewChecks.script ? <Check size={12} /> : <Loader2 size={12} className="spin" />} 剧本贴合度
                </span>
                <span className={reviewChecks.style ? '' : 'pending'}>
                  {reviewChecks.style ? <Check size={12} /> : <Loader2 size={12} className="spin" />} 风格统一性
                </span>
              </div>
              {reviewState === 'passed' ? (
                <div className="ws-gate-actions">
                  <button type="button" className="ws-btn primary lg" onClick={enterVideoStep}>
                    进入第 4 步 · 生视频 <ArrowRight size={14} />
                  </button>
                  <button type="button" className="ws-btn" onClick={() => setView('canvas')}>返回画布</button>
                </div>
              ) : (
                <p className="ws-muted">审核完成后自动解锁「生视频」通道…</p>
              )}
            </div>
          )}

          {view === 'video' && (
            <div className="ws-video-page">
              <div className="ws-canvas-bar">
                <div>
                  <b>第 4 步 · 生视频</b>
                  <span className="ws-video-sub">AI 读剧本 + 链接已过审三类资产，自动生成分镜提示词</span>
                </div>
                <div className="ws-video-actions">
                  <button type="button" className="ws-btn primary" onClick={runAllVideoShots}>
                    <Play size={13} /> 生成视频
                  </button>
                  {VIDEO_SHOTS.every(s => shotStatus[s.id] === 'done') && (
                    <button type="button" className="ws-btn" onClick={() => setView('publish')}>
                      进入第 5 步 · 发布 <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </div>

              {harnessAlert && (
                <div className="ws-harness-alert" role="alert">
                  <ShieldAlert size={16} />
                  <span>{harnessAlert}</span>
                  <button type="button" onClick={() => setHarnessAlert('')} aria-label="关闭"><X size={14} /></button>
                </div>
              )}

              <div className="ws-video-list">
                {VIDEO_SHOTS.map((shot, idx) => {
                  const st = shotStatus[shot.id] || 'idle';
                  const promptVal = shotPrompts[shot.id] || shot.prompt;
                  const isEditing = editingShotId === shot.id;

                  return (
                    <div key={shot.id} className={`ws-shot-card ${shot.mocap ? 'mocap' : ''} ${st === 'done' ? 'done' : ''}`}>
                      <div className="ws-shot-head">
                        <b>{shot.scene} · {shot.title}</b>
                        <small>{shot.duration}</small>
                        {canViewTrace && (
                          <button
                            type="button"
                            className="ws-shot-trace"
                            title="点击查看全链路 Trace"
                            onClick={() => window.open(`/admin/org/tracing?trace=${encodeURIComponent(shot.traceId)}`, '_blank')}
                          >
                            {shot.traceId} ↗
                          </button>
                        )}
                      </div>

                      <div className="ws-shot-body">
                        <div className="ws-shot-left">
                          <div className="ws-shot-prompt-box">
                            <div className="ws-shot-prompt-head">
                              <span><Sparkles size={12} /> AI 根据剧本生成的视频提示词</span>
                              {!isEditing && (
                                <button type="button" className="ws-link-btn" onClick={() => { setDraftPrompt(promptVal); setEditingShotId(shot.id); }}>
                                  微调提示词
                                </button>
                              )}
                            </div>
                            {st === 'writing' ? (
                              <div className="ws-shot-writing"><Loader2 size={13} className="spin" /> 正在读取剧本并链接人物/道具/场景资产…</div>
                            ) : isEditing ? (
                              <MentionPromptEditor
                                value={draftPrompt}
                                onChange={setDraftPrompt}
                                assets={ASSET_NODES}
                                onPreviewAsset={a => setPreviewImg({ src: a.img, name: a.name, sub: a.sub, filterClass: '' })}
                                onSave={() => { setShotPrompts(prev => ({ ...prev, [shot.id]: draftPrompt })); setEditingShotId(''); }}
                                onCancel={() => setEditingShotId('')}
                              />
                            ) : (
                              <div className="ws-shot-prompt-text">
                                {renderLinkedPrompt(promptVal, a => setPreviewImg({ src: a.img, name: a.name, sub: a.sub, filterClass: '' }))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="ws-shot-right">
                          <div className={`ws-shot-preview ${st}`}>
                            <img src={shot.previewImg} alt={shot.title} />
                            {st === 'generating' && (
                              <div className="ws-shot-overlay">
                                <Loader2 size={18} className="spin" />
                                <span>{shot.mocap ? '动捕驱动生成中…' : '图生视频合成中…'}</span>
                              </div>
                            )}
                            {st === 'done' && (
                              <div className="ws-shot-done-badge">
                                <Check size={12} /> 成片片段已就绪 · {shot.duration}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            className={`ws-btn ${st === 'done' ? '' : 'primary'}`}
                            disabled={st === 'writing' || st === 'generating'}
                            onClick={() => runVideoShot(shot.id)}
                          >
                            {st === 'generating'
                              ? <><Loader2 size={13} className="spin" /> 生成中…</>
                              : st === 'done'
                                ? <><RotateCcw size={13} /> 重新生成</>
                                : <><Play size={13} /> 生成该镜头</>}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === 'publish' && (
            <div className="ws-video-page">
              <div className="ws-canvas-bar">
                <div>
                  <b>第 5 步 · 发布</b>
                  <span className="ws-video-sub">运营 Session 自动汇总成片与多平台宣发草稿</span>
                </div>
                <div className="ws-video-actions">
                  <button type="button" className="ws-btn" onClick={() => setView('video')}>返回生视频</button>
                  <button
                    type="button"
                    className="ws-btn primary"
                    onClick={() => {
                      pushLog('EP01 成片及抖音/小红书宣发草稿已同步至分发队列', 'ok');
                      showToast('已同步至分发队列');
                    }}
                  >
                    <Check size={13} /> 同步到分发队列
                  </button>
                </div>
              </div>
              <div className="ws-video-list">
                <div className="ws-shot-card done">
                  <div className="ws-shot-head">
                    <span className="ws-shot-no">成片预览</span>
                    <b>超燃决战菜市场！（{scriptTitle} · 成片演示）</b>
                    <span className="ws-shot-channel">暗调电影感 · 已过审</span>
                  </div>
                  <div className="ws-publish-body">
                    <div className="ws-publish-video-wrap">
                      <video
                        className="ws-publish-video"
                        src="/api/files/demo-caishichang.mp4"
                        controls
                        preload="metadata"
                      />
                    </div>
                    <div className="ws-publish-copy">
                      <b>小红书 / 抖音宣发草稿（Agent 自动提炼）</b>
                      <p>🌧️ 民国雨夜，一封无名电报把女记者苏晚引向“济世堂”后门…</p>
                      <p>指针停在 3:15 的怀表、刻着「07 · 钟楼天台」的黄铜钥匙，还有那句“明晚三点十五，天台见”。</p>
                      <div className="ws-publish-tags">
                        <span>#民国悬疑</span>
                        <span>#AI漫剧</span>
                        <span>#雨巷迷踪</span>
                        <span>#短剧推荐</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {rightOpen && (
          <aside className="ws-right">
            {view === 'video' ? (
              <>
                <div className="ws-tabs">
                  <button type="button" className="active">资产列表（9）</button>
                </div>
                {assetsPanel}
              </>
            ) : (
              <>
                <div className="ws-tabs">
                  <button type="button" className={rightTab === 'breakdown' ? 'active' : ''} onClick={() => setRightTab('breakdown')}>拆解表</button>
                  <button type="button" className={rightTab === 'node' ? 'active' : ''} onClick={() => setRightTab('node')} disabled={stage < 1}>节点详情</button>
                </div>
                {rightTab === 'breakdown' ? breakdownPanel : nodePanel}
              </>
            )}
          </aside>
        )}
      </div>

      {previewImg && (
        <div className="ws-lightbox" role="dialog" aria-modal="true" onClick={() => setPreviewImg(null)}>
          <div className="ws-lightbox-inner" onClick={e => e.stopPropagation()}>
            <div className="ws-lightbox-head">
              <b>{previewImg.name}</b>
              <span>{previewImg.sub}</span>
              <button type="button" className="ws-lightbox-close" onClick={() => setPreviewImg(null)} aria-label="关闭">
                <X size={16} />
              </button>
            </div>
            <div className="ws-lightbox-body">
              <img src={previewImg.src} alt={previewImg.name} className={previewImg.filterClass} />
            </div>
          </div>
        </div>
      )}

      {scriptModalOpen && (
        <div className="ws-lightbox ws-lightbox--full" role="dialog" aria-modal="true" onClick={() => setScriptModalOpen(false)}>
          <div className="ws-script-modal ws-script-modal--full" onClick={e => e.stopPropagation()}>
            <div className="ws-script-modal-head">
              <FileText size={16} color="#2f6fb0" />
              <div>
                <b>{scriptTitle}</b>
                <small>{scriptMeta} · Harness 剧本资产</small>
              </div>
              <div className="ws-script-modal-actions">
                <div className="ws-script-mode-tabs">
                  <button
                    type="button"
                    className={scriptViewMode === 'human' ? 'active' : ''}
                    onClick={() => setScriptViewMode('human')}
                  >
                    剧本正文
                  </button>
                  <button
                    type="button"
                    className={scriptViewMode === 'yaml' ? 'active' : ''}
                    onClick={() => setScriptViewMode('yaml')}
                  >
                    AI 结构化 YAML
                  </button>
                </div>
                {scriptViewMode === 'human' && (
                  <button
                    type="button"
                    className={`ws-btn icon ${highlightOn ? 'on' : ''}`}
                    onClick={() => setHighlightOn(v => !v)}
                    title="高亮人物 / 道具 / 场景 / 动捕"
                    aria-label="高亮"
                  >
                    <Highlighter size={15} />
                  </button>
                )}
                <button type="button" className="ws-btn" onClick={() => setScriptModalOpen(false)}>取消</button>
                {scriptViewMode === 'human' && (
                  <button type="button" className={`ws-btn primary ${saved ? 'saved' : ''}`} onClick={saveScriptEdit} disabled={saving}>
                    {saving ? <Loader2 size={13} className="spin" /> : saved ? <Check size={13} /> : <Check size={13} />}
                    {saving ? '保存中…' : saved ? '已保存' : '保存并更新 Harness'}
                  </button>
                )}
                <button type="button" className="ws-btn icon" onClick={() => setScriptModalOpen(false)} aria-label="关闭">
                  <X size={15} />
                </button>
              </div>
            </div>

            {scriptViewMode === 'human' && highlightOn && (
              <div className="ws-script-legend">
                <span><i className="character" /> 人物</span>
                <span><i className="prop" /> 道具</span>
                <span><i className="place" /> 场景</span>
                <span><i className="hard" /> 动捕通道动作</span>
              </div>
            )}

            <div className="ws-script-modal-body">
              {scriptViewMode === 'yaml' ? (
                <div className="ws-yaml-view">
                  <div className="ws-meta-cards">
                    <div><small>画幅</small><b>{PROJECT_METADATA.aspect_ratio}</b></div>
                    <div><small>叙事风格</small><b>{PROJECT_METADATA.narrative_style}</b></div>
                    <div><small>整体风格</small><b>{PROJECT_METADATA.visual_style}</b></div>
                    <div><small>角色 / 场景 / 道具</small><b>{PROJECT_METADATA.characters.length} / {PROJECT_METADATA.locations.length} / {PROJECT_METADATA.props.length}</b></div>
                    <div className="wide"><small>故事梗概</small><p>{PROJECT_METADATA.synopsis}</p></div>
                    <div className="wide"><small>全局约束（Global Constraints）</small><p>{PROJECT_METADATA.global_constraints.join(' · ')}</p></div>
                  </div>
                  <pre className="ws-yaml-code">{AI_SCRIPT_YAML}</pre>
                </div>
              ) : (
                <div className={`ws-script-editor-wrap ${highlightOn ? 'hl' : ''}`}>
                  {highlightOn && (
                    <div ref={scriptBackdropRef} className="ws-script-editor-backdrop" aria-hidden="true">
                      {renderHighlightedScript(scriptDraft)}
                    </div>
                  )}
                  <textarea
                    ref={scriptEditorRef}
                    className="ws-script-editor ws-script-editor--full"
                    value={scriptDraft}
                    onChange={e => setScriptDraft(e.target.value)}
                    onScroll={e => {
                      if (scriptBackdropRef.current) scriptBackdropRef.current.scrollTop = e.currentTarget.scrollTop;
                    }}
                    spellCheck={false}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Toast message={toast} />
    </div>
  );
}
