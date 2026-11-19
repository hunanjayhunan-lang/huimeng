import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, LogOut, Settings, ShieldCheck, UserRound } from 'lucide-react';

/**
 * 顶栏用户中心：展示真实登录账号，展开后可查看身份与退出。
 * 数据来自 session（/api/auth/session），不是写死的文案。
 */
export default function AdminUserMenu({ user, org, role, onLogout, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState('');
  const wrapRef = useRef(null);
  const timerRef = useRef(null);

  const email = user?.email || '未登录';
  const initial = email.slice(0, 1).toUpperCase();
  const roleLabel = role === 'superadmin' ? '平台管理员' : role === 'org.admin' ? '组织管理员' : '组织成员';

  const notify = message => {
    setToast(message);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(''), 2000);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  useEffect(() => {
    if (!open) return;
    const onDown = event => { if (!wrapRef.current?.contains(event.target)) setOpen(false); };
    const onKey = event => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

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
          <dl className="admin-user-meta">
            <div><dt>账号</dt><dd title={email}>{email}</dd></div>
            <div><dt>账号 ID</dt><dd title={user?.id || ''}>{(user?.id || '—').slice(0, 8)}…</dd></div>
            <div><dt>角色</dt><dd>{roleLabel}</dd></div>
            {org?.name && <div><dt>所属组织</dt><dd>{org.name}</dd></div>}
          </dl>

          <div className="admin-user-actions">
            <button type="button" role="menuitem" onClick={() => { setOpen(false); notify('个人资料为演示功能'); }}>
              <UserRound size={14} />个人资料
            </button>
            <button type="button" role="menuitem" onClick={() => { setOpen(false); notify('偏好设置为演示功能'); }}>
              <Settings size={14} />偏好设置
            </button>
            {onNavigate && (
              <button type="button" role="menuitem" onClick={() => { setOpen(false); onNavigate('/app/dashboard'); }}>
                <ShieldCheck size={14} />返回工作台
              </button>
            )}
            <button type="button" role="menuitem" className="danger" onClick={() => { setOpen(false); onLogout?.(); }}>
              <LogOut size={14} />退出登录
            </button>
          </div>
        </div>
      )}

      {toast && <div className="admin-user-toast"><Check size={13} />{toast}</div>}
    </div>
  );
}
