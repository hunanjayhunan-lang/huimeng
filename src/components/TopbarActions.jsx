import { useEffect, useRef, useState } from 'react';
import { Bell, Check, ChevronRight, FolderKanban, Gift, LogOut, PlaySquare, Plus, Settings, Sparkles, UserRound, Video, Wallet } from 'lucide-react';
import { api } from '../api.js';
import './TopbarActions.css';

// 通知中心：演示数据。点开条目会跳转并标记为已读。
const DEMO_NOTICES = [
  { id: 'n1', title: '「第 2 集 · 旧照片特写」已生成', meta: '2 分钟前 · 点击去成片查看', tab: '成片', read: false },
  { id: 'n2', title: '组长驳回了「林知夏」的资产修改', meta: '18 分钟前 · 需要重新提交', tab: '资产', read: false },
  { id: 'n3', title: '本月额度已用 62%，请注意', meta: '32 分钟前 · 额度不足会暂停出片', tab: '管理', read: false },
  { id: 'n4', title: '本周生产报表已生成', meta: '1 小时前 · 平均耗时下降 12%', tab: '数据', read: true },
  { id: 'n5', title: '「雨巷迷踪」分镜拆解完成', meta: '3 小时前 · 共 14 个分镜待确认', tab: '拆解', read: true },
];

export default function TopbarActions({ onNavigate, onCreateMode, onLogin, onLogout, showLogin, session }) {
  const [open, setOpen] = useState(null);
  const [stats, setStats] = useState(null);
  const [quota, setQuota] = useState(null);
  const [statsError, setStatsError] = useState('');
  const [notices, setNotices] = useState(DEMO_NOTICES);
  const unread = notices.filter(item => !item.read).length;
  const [toast, setToast] = useState('');
  const wrapRef = useRef(null);
  const timerRef = useRef(null);

  const notify = message => {
    setToast(message);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(''), 2200);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // 点外面 / Esc 关闭浮层
  useEffect(() => {
    const onDown = event => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(null);
    };
    const onKey = event => { if (event.key === 'Escape') setOpen(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // 打开算力面板时拉一次真实任务统计
  useEffect(() => {
    if (open !== 'credit') return;
    let cancelled = false;
    setStatsError('');
    api.stats()
      .then(data => { if (!cancelled) setStats(data); })
      .catch(error => { if (!cancelled) { setStats(null); setStatsError(error.message); } });
    api.orgQuota()
      .then(data => { if (!cancelled) setQuota(data); })
      .catch(error => { if (!cancelled) setStatsError(error.message); });
    return () => { cancelled = true; };
  }, [open]);

  const toggle = key => setOpen(current => (current === key ? null : key));
  const displayName = session?.user?.email || '账号';
  const roleName = session?.role === 'superadmin' ? '平台管理员' : session?.org?.name || (session?.role === 'org.admin' ? '组织管理员' : session?.role === 'org.reviewer' ? '审核员' : '组织成员');
  const go = (tab, close = true) => {
    onNavigate(tab);
    if (close) setOpen(null);
  };

  return <div className="top-actions" ref={wrapRef}>
    {showLogin && <button type="button" className="pill" onClick={onLogin}>登录</button>}
    <button type="button" className="pill" onClick={() => go('成片')}><Video size={17} /> 成片</button>
    <button type="button" className="pill" onClick={() => { onCreateMode('分镜出片'); go('创作'); }}>
      <PlaySquare size={18} /> 分镜出片
    </button>
    <button type="button" className="pill" onClick={() => go('画布')}><Plus size={18} /> 新建画布</button>

    {/* 灵感特权 */}
    <div className="tb-item">
      <button type="button" className={`round gold-badge ${open === 'gift' ? 'tb-on' : ''}`} title="灵感特权" onClick={() => toggle('gift')}>
        <span className="gold-flower">❀</span>
      </button>
      {open === 'gift' && <div className="tb-panel">
        <header className="tb-panel-head">
          <span className="tb-panel-icon"><Gift size={15} /></span>
          <div><strong>灵感特权</strong><small>今日剩余 20 点</small></div>
        </header>
        <ul className="tb-list">
          <li>每日 20 点免费灵感，够出 2 条短片</li>
          <li>解锁爆款模板与镜头语言库</li>
          <li>出片队列优先，等待更短</li>
        </ul>
        <button type="button" className="tb-cta" onClick={() => notify('会员开通为演示功能')}>
          了解会员特权 <ChevronRight size={14} />
        </button>
      </div>}
    </div>

    {/* 算力 / 点数 */}
    <div className="tb-item">
      <button type="button" className={`credit ${open === 'credit' ? 'tb-on' : ''}`} title="可用额度" onClick={() => toggle('credit')}>
        <Wallet size={16} /> <b>{session?.role === 'org.admin' ? quota?.remaining ?? '—' : quota?.available ?? '—'}</b>
      </button>
      {open === 'credit' && <div className="tb-panel">
        <header className="tb-panel-head">
          <span className="tb-panel-icon"><Wallet size={15} /></span>
          <div><strong>算力中心</strong><small>1 条图片 ≈ 1 点 · 1 条视频 ≈ 8 点</small></div>
        </header>
        <div className="tb-balance"><span>{session?.role === 'org.admin' ? 'Org 可用额度' : '个人可用额度'}</span><b>{session?.role === 'org.admin' ? quota?.remaining ?? '—' : quota?.available ?? '—'} 点</b></div>
        {quota && <div className="tb-balance"><span>{session?.role === 'org.admin' ? 'Org 总额度' : '个人已分配'}</span><b>{session?.role === 'org.admin' ? quota.granted : quota.allocation} 点</b></div>}
        <div className="tb-stats">
          {statsError ? <span className="tb-warn">后台未连接：{statsError}</span> : stats ? <>
            <span>任务 {stats.total}</span>
            <span>成功 {stats.done}</span>
            <span>进行中 {stats.active}</span>
          </> : <span>读取任务统计…</span>}
        </div>
        <button type="button" className="tb-cta" onClick={() => session?.role === 'org.admin' ? onNavigate('管理') : notify('请联系组织管理员分配额度')}>{session?.role === 'org.admin' ? '管理组织额度' : '联系管理员分配额度'} <ChevronRight size={14} /></button>
      </div>}
    </div>

    {/* 通知 */}
    <div className="tb-item">
      <button type="button" className={`round ${open === 'notice' ? 'tb-on' : ''}`} title="通知消息" onClick={() => toggle('notice')}>
        <Bell size={18} />
        {unread > 0 && <i className="tb-badge" aria-hidden="true" />}
      </button>
      {open === 'notice' && <div className="tb-panel wide">
        <header className="tb-panel-head">
          <div><strong>通知</strong><small>{unread > 0 ? `${unread} 条未读` : '全部已读'}</small></div>
          <button type="button" className="tb-link" onClick={() => { setNotices(list => list.map(n => ({ ...n, read: true }))); notify('已全部标记为已读'); }}>
            <Check size={13} />全部已读
          </button>
        </header>
        <ul className="tb-notices">
          {notices.map(item => (
            <li key={item.id}>
              <button type="button" onClick={() => { setNotices(list => list.map(n => n.id === item.id ? { ...n, read: true } : n)); go(item.tab); }}>
                <i className={item.read ? '' : 'dot-new'} />
                <span><strong>{item.title}</strong><small>{item.meta}</small></span>
              </button>
            </li>
          ))}
          {!notices.length && <li><button type="button" disabled><span><small>暂无通知</small></span></button></li>}
        </ul>
      </div>}
    </div>

    {/* 用户菜单 */}
    <div className="tb-item">
      <button type="button" className={`profile ${open === 'user' ? 'tb-on' : ''}`} onClick={() => toggle('user')} aria-haspopup="menu">
        <span className="avatar"><UserRound size={19} /></span>
        <span className="profile-text"><b>{displayName}</b><small>{roleName}</small></span>
      </button>
      {open === 'user' && <div className="tb-panel">
        <div className="tb-user">
          <span className="avatar"><UserRound size={19} /></span>
          <div><b>{displayName}</b><small>{roleName}</small></div>
        </div>
        <div className="tb-menu">
          <button type="button" onClick={() => go('项目')}><FolderKanban size={15} />我的项目</button>
          <button type="button" onClick={() => notify('个人资料为演示功能')}><UserRound size={15} />个人资料</button>
          <button type="button" onClick={() => notify('偏好设置为演示功能')}><Settings size={15} />偏好设置</button>
          <button type="button" className="danger" onClick={onLogout}><LogOut size={15} />退出登录</button>
        </div>
      </div>}
    </div>

    {toast && <div className="tb-toast"><Check size={14} />{toast}</div>}
  </div>;
}
