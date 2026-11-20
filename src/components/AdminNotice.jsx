import { useEffect, useRef, useState } from 'react';
import { Bell, Check } from 'lucide-react';
import './AdminNotice.css';

/**
 * 管理端通知中心：纯前端演示，点开条目即标记已读并跳到对应 tab。
 * 不需要后端接口。
 */
const DEMO_NOTICES = [
  { id: 'a1', title: '「星河影业」本月额度已用 82%', meta: '12 分钟前 · 建议提前划拨', tab: 'organizations', read: false },
  { id: 'a2', title: '「大炮文化」新增 2 位成员', meta: '46 分钟前 · 成员管理', tab: 'members', read: false },
  { id: 'a3', title: '3 个任务生成失败，需要排查', meta: '1 小时前 · 调用追踪', tab: 'tracing', read: false },
  { id: 'a4', title: '「山海工作室」试用即将到期', meta: '3 小时前 · 组织管理', tab: 'organizations', read: true },
  { id: 'a5', title: '上月审计记录已归档', meta: '昨天 · 操作审计', tab: 'audit', read: true },
];

export default function AdminNotice({ onTabChange, tabs = [] }) {
  const [open, setOpen] = useState(false);
  const [notices, setNotices] = useState(DEMO_NOTICES);
  const wrapRef = useRef(null);
  const unread = notices.filter(item => !item.read).length;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = event => { if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false); };
    const onKey = event => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openItem = item => {
    setNotices(list => list.map(n => (n.id === item.id ? { ...n, read: true } : n)));
    setOpen(false);
    // 目标 tab 在当面板不存在时（如组织端没有 organizations），就不跳转
    const hasTab = !tabs.length || tabs.some(tab => tab.key === item.tab);
    if (hasTab) onTabChange?.(item.tab);
  };

  return (
    <div className="an-wrap" ref={wrapRef}>
      <button type="button" className="toolbar-icon" aria-label="通知" aria-expanded={open} onClick={() => setOpen(v => !v)}>
        <Bell size={17} />
        {unread > 0 && <i className="an-badge" />}
      </button>
      {open && (
        <div className="an-panel">
          <header className="an-head">
            <div><strong>通知</strong><small>{unread > 0 ? `${unread} 条未读` : '全部已读'}</small></div>
            <button type="button" onClick={() => setNotices(list => list.map(n => ({ ...n, read: true })))}>
              <Check size={13} />全部已读
            </button>
          </header>
          <ul className="an-list">
            {notices.map(item => (
              <li key={item.id}>
                <button type="button" onClick={() => openItem(item)}>
                  <i className={item.read ? '' : 'an-dot'} />
                  <span><strong>{item.title}</strong><small>{item.meta}</small></span>
                </button>
              </li>
            ))}
            {!notices.length && <li className="an-empty">暂无通知</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
