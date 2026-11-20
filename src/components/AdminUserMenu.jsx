import { useEffect, useRef, useState } from 'react';
import { Building2, Check, ChevronRight, Copy, LogOut, RotateCcw, Settings, ShieldCheck, UserRound, X } from 'lucide-react';

const PREFS_KEY = 'huimeng.admin.prefs';
const DEFAULT_PREFS = {
  density: 'comfortable', // 'comfortable' | 'compact'
  sidebarDefault: 'expanded', // 'expanded' | 'collapsed'
  confirmDanger: true,
  showShortcuts: true,
};

const loadPrefs = () => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
};

const applyPrefs = prefs => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.adminDensity = prefs.density || 'comfortable';
  document.documentElement.dataset.adminShortcuts = prefs.showShortcuts ? 'on' : 'off';
};

/**
 * 顶栏用户中心：展示真实登录账号，展开后可查看个人资料、调整偏好设置与退出。
 * 数据来自 session（/api/auth/session），偏好设置持久化于 localStorage。
 */
export default function AdminUserMenu({ user, org, role, onLogout, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(''); // '' | 'profile' | 'prefs'
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState('');
  const [prefs, setPrefs] = useState(loadPrefs);
  const [draftPrefs, setDraftPrefs] = useState(prefs);
  const wrapRef = useRef(null);
  const timerRef = useRef(null);
  const copyTimerRef = useRef(null);

  const email = user?.email || '未登录';
  const userId = user?.id || '';
  const initial = email.slice(0, 1).toUpperCase();
  const roleLabel = role === 'superadmin' ? '平台管理员' : role === 'org.admin' ? '组织管理员' : role === 'org.reviewer' ? '审核员' : '组织成员';
  const roleTone = role === 'superadmin' ? 'is-super' : role === 'org.admin' ? 'is-org' : role === 'org.reviewer' ? 'is-reviewer' : 'is-member';
  const isAdminRole = ['superadmin', 'org.admin', 'org.reviewer'].includes(role);
  const inAdmin = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/platform')
  );

  const notify = message => {
    setToast(message);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(''), 2200);
  };

  const copyId = async () => {
    if (!userId) return;
    try {
      await navigator.clipboard?.writeText(userId);
      setCopied(true);
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1600);
      notify('已复制完整账号 ID');
    } catch {
      notify('复制失败，请手动复制');
    }
  };

  const openModal = kind => {
    setOpen(false);
    if (kind === 'prefs') setDraftPrefs(prefs);
    setModal(kind);
  };

  const savePrefs = () => {
    setPrefs(draftPrefs);
    applyPrefs(draftPrefs);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(draftPrefs));
    } catch {
      // ignore storage quota errors
    }
    setModal('');
    notify('偏好设置已保存');
  };

  const resetPrefs = () => {
    setDraftPrefs({ ...DEFAULT_PREFS });
  };

  useEffect(() => {
    applyPrefs(prefs);
  }, [prefs]);

  useEffect(() => () => {
    clearTimeout(timerRef.current);
    clearTimeout(copyTimerRef.current);
  }, []);

  useEffect(() => {
    if (!open && !modal) return;
    const onDown = event => {
      if (open && !wrapRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = event => {
      if (event.key === 'Escape') {
        setOpen(false);
        setModal('');
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, modal]);

  return (
    <div className="admin-user-menu" ref={wrapRef}>
      <button
        type="button"
        className={`toolbar-admin${open ? ' is-open' : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="admin-user-avatar">{initial}</span>
        <span className="admin-user-label">{roleLabel}</span>
        <ChevronRight size={13} className="admin-user-caret" />
      </button>

      {open && (
        <div className="admin-user-panel" role="menu">
          <div className="admin-user-head">
            <span className="admin-user-avatar lg">{initial}</span>
            <div className="admin-user-identity">
              <strong title={email}>{email}</strong>
              <span className={`admin-user-role ${roleTone}`}>{roleLabel}</span>
            </div>
          </div>

          <div className="admin-user-actions">
            <button type="button" role="menuitem" onClick={() => openModal('profile')}>
              <UserRound size={14} /><span>个人资料</span>
            </button>
            <button type="button" role="menuitem" onClick={() => openModal('prefs')}>
              <Settings size={14} /><span>偏好设置</span>
            </button>
            {onNavigate && inAdmin && (
              <button type="button" role="menuitem" onClick={() => { setOpen(false); onNavigate('/app/dashboard'); }}>
                <ShieldCheck size={14} /><span>返回工作台</span>
              </button>
            )}
            {onNavigate && !inAdmin && isAdminRole && (
              <button type="button" role="menuitem" onClick={() => { setOpen(false); onNavigate('管理'); }}>
                <ShieldCheck size={14} /><span>{role === 'org.reviewer' ? '返回审核台' : '返回管理台'}</span>
              </button>
            )}
          </div>

          <div className="admin-user-footer">
            <button type="button" role="menuitem" className="danger" onClick={() => { setOpen(false); onLogout?.(); }}>
              <LogOut size={14} /><span>退出登录</span>
            </button>
          </div>
        </div>
      )}

      {modal === 'profile' && (
        <div className="admin-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModal(''); }}>
          <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-profile-title">
            <header className="admin-modal-head">
              <div>
                <h3 id="admin-profile-title">个人资料</h3>
                <p>当前登录账号与所属组织信息</p>
              </div>
              <button type="button" className="admin-modal-close" aria-label="关闭" onClick={() => setModal('')}>
                <X size={16} />
              </button>
            </header>

            <div className="admin-profile-hero">
              <span className="admin-user-avatar xl">{initial}</span>
              <div className="admin-user-identity">
                <strong>{email}</strong>
                <span className={`admin-user-role ${roleTone}`}>{roleLabel}</span>
              </div>
            </div>

            <dl className="admin-profile-grid">
              <div>
                <dt>账号</dt>
                <dd>{email}</dd>
              </div>
              <div>
                <dt>角色权限</dt>
                <dd>{roleLabel}</dd>
              </div>
              <div>
                <dt><Building2 size={12} />所属组织</dt>
                <dd>{org?.name || '未绑定组织'}</dd>
              </div>
              <div>
                <dt>账号 ID</dt>
                <dd className="admin-profile-id-row">
                  <code title={userId}>{userId || '—'}</code>
                  {userId && (
                    <button type="button" className="admin-user-id-btn" onClick={copyId}>
                      {copied ? <><Check size={11} className="is-copied" />已复制</> : <><Copy size={11} />复制</>}
                    </button>
                  )}
                </dd>
              </div>
            </dl>

            <footer className="admin-modal-foot">
              <button type="button" className="admin-outline" onClick={() => setModal('')}>关闭</button>
            </footer>
          </div>
        </div>
      )}

      {modal === 'prefs' && (
        <div className="admin-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModal(''); }}>
          <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-prefs-title">
            <header className="admin-modal-head">
              <div>
                <h3 id="admin-prefs-title">偏好设置</h3>
                <p>个性化控制台显示与交互行为（本地持久化保存）</p>
              </div>
              <button type="button" className="admin-modal-close" aria-label="关闭" onClick={() => setModal('')}>
                <X size={16} />
              </button>
            </header>

            <div className="admin-prefs-list">
              <div className="admin-pref-item">
                <div>
                  <strong>界面密度</strong>
                  <small>调整列表与卡片的留白和行高</small>
                </div>
                <div className="admin-pref-segmented">
                  <button
                    type="button"
                    className={draftPrefs.density === 'comfortable' ? 'is-active' : ''}
                    onClick={() => setDraftPrefs(p => ({ ...p, density: 'comfortable' }))}
                  >舒适</button>
                  <button
                    type="button"
                    className={draftPrefs.density === 'compact' ? 'is-active' : ''}
                    onClick={() => setDraftPrefs(p => ({ ...p, density: 'compact' }))}
                  >紧凑</button>
                </div>
              </div>

              <div className="admin-pref-item">
                <div>
                  <strong>侧边栏默认状态</strong>
                  <small>进入管理台时左侧导航的默认形态</small>
                </div>
                <div className="admin-pref-segmented">
                  <button
                    type="button"
                    className={draftPrefs.sidebarDefault === 'expanded' ? 'is-active' : ''}
                    onClick={() => setDraftPrefs(p => ({ ...p, sidebarDefault: 'expanded' }))}
                  >展开</button>
                  <button
                    type="button"
                    className={draftPrefs.sidebarDefault === 'collapsed' ? 'is-active' : ''}
                    onClick={() => setDraftPrefs(p => ({ ...p, sidebarDefault: 'collapsed' }))}
                  >折叠</button>
                </div>
              </div>

              <label className="admin-pref-item is-toggle">
                <div>
                  <strong>危险操作二次确认</strong>
                  <small>停用组织、移除成员或重置额度前弹窗确认</small>
                </div>
                <input
                  type="checkbox"
                  checked={draftPrefs.confirmDanger}
                  onChange={e => setDraftPrefs(p => ({ ...p, confirmDanger: e.target.checked }))}
                />
              </label>

              <label className="admin-pref-item is-toggle">
                <div>
                  <strong>显示快捷键角标</strong>
                  <small>在搜索框与操作按钮旁展示快捷键提示</small>
                </div>
                <input
                  type="checkbox"
                  checked={draftPrefs.showShortcuts}
                  onChange={e => setDraftPrefs(p => ({ ...p, showShortcuts: e.target.checked }))}
                />
              </label>
            </div>

            <footer className="admin-modal-foot split">
              <button type="button" className="admin-link-btn" onClick={resetPrefs}>
                <RotateCcw size={12} />恢复默认
              </button>
              <div className="admin-modal-foot-right">
                <button type="button" className="admin-outline" onClick={() => setModal('')}>取消</button>
                <button type="button" className="admin-primary" onClick={savePrefs}>保存设置</button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {toast && <div className="admin-user-toast"><Check size={13} />{toast}</div>}
    </div>
  );
}
