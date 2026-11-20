import { useMemo, useState } from 'react';
import {
  BarChart3, CheckCircle2, Eye, Heart, MessageCircle, Plus, RefreshCw,
  Search, Share2, Sparkles, Trash2, TrendingUp, UserPlus, Users, Video, X,
} from 'lucide-react';
import { PanelHeading } from './AdminWorkspace.jsx';

const STORAGE_KEY = 'huimeng.admin.douyin.accounts';

const DEFAULT_ACCOUNTS = [
  {
    id: 'dy-1',
    name: '绘梦短剧社',
    handle: '@huimeng_drama',
    tag: '短剧主号',
    owner: '林小雨',
    status: 'active',
    followers: 128400,
    deltaFollowers: 4620,
    views7d: 1845000,
    completionRate: 38.4,
    engagementRate: 6.8,
    videosCount: 24,
    lastSync: '10 分钟前',
  },
  {
    id: 'dy-2',
    name: '雨巷漫剧工坊',
    handle: '@yuxiang_comic',
    tag: '漫剧切片',
    owner: '陈一鸣',
    status: 'active',
    followers: 64200,
    deltaFollowers: 2180,
    views7d: 962000,
    completionRate: 42.1,
    engagementRate: 7.4,
    videosCount: 18,
    lastSync: '25 分钟前',
  },
  {
    id: 'dy-3',
    name: 'AI 奇幻剧场',
    handle: '@ai_fantasy_lab',
    tag: '宣发矩阵',
    owner: '赵琪',
    status: 'expiring',
    followers: 31900,
    deltaFollowers: 890,
    views7d: 418000,
    completionRate: 31.6,
    engagementRate: 5.2,
    videosCount: 12,
    lastSync: '2 小时前',
  },
];

const DEMO_VIDEOS = [
  {
    id: 'v-1',
    accountId: 'dy-1',
    title: '带着AI穿越2018年！短剧成片',
    publishedAt: '11-19 19:30',
    duration: '01:28',
    views: 684200,
    completion: 44.2,
    likes: 41200,
    comments: 2890,
    shares: 5340,
    newFollowers: 1940,
    verdict: '爆款',
    insight: '前 3 秒穿越反转钩子留存率达 76%，建议作为投流主力素材继续放量。',
  },
  {
    id: 'v-2',
    accountId: 'dy-1',
    title: '超燃决战菜市场！广场大妈大战雷神索尔',
    publishedAt: '11-18 20:15',
    duration: '00:56',
    views: 521000,
    completion: 41.8,
    likes: 35600,
    comments: 3410,
    shares: 6120,
    newFollowers: 1420,
    verdict: '高互动',
    insight: '评论区玩梗率高，转发分享比 1.17% 显著高于均值，适合做二创话题。',
  },
  {
    id: 'v-3',
    accountId: 'dy-2',
    title: '“接下来交给我吧”！玄幻高燃漫剧成片',
    publishedAt: '11-19 18:00',
    duration: '01:05',
    views: 438900,
    completion: 46.5,
    likes: 31800,
    comments: 1960,
    shares: 2840,
    newFollowers: 1380,
    verdict: '高完播',
    insight: '高燃台词卡点精准，完播率全站前 10%，建议固定每周五 18:00 更新续集。',
  },
  {
    id: 'v-4',
    accountId: 'dy-2',
    title: '小黑猫也会害怕，小骑士也会受伤。治愈漫剧',
    publishedAt: '11-17 21:00',
    duration: '00:52',
    views: 294000,
    completion: 39.4,
    likes: 24500,
    comments: 1520,
    shares: 3190,
    newFollowers: 780,
    verdict: '高收藏',
    insight: '治愈向情绪共鸣强，完播稳定，可在片尾引导关注追更系列。',
  },
  {
    id: 'v-5',
    accountId: 'dy-3',
    title: '幻想还是现实！创意短剧成片',
    publishedAt: '11-18 12:30',
    duration: '01:12',
    views: 215400,
    completion: 29.8,
    likes: 9800,
    comments: 640,
    shares: 890,
    newFollowers: 410,
    verdict: '待优化',
    insight: '前 5 秒铺垫略长导致 32% 用户划走，建议剪辑时将反转画面前置至第 2 秒。',
  },
  {
    id: 'v-6',
    accountId: 'dy-3',
    title: '碧海生清梦，龙宫度闲年，古风奇幻短剧',
    publishedAt: '11-16 19:00',
    duration: '00:58',
    views: 176800,
    completion: 34.7,
    likes: 11200,
    comments: 720,
    shares: 1050,
    newFollowers: 360,
    verdict: '稳定',
    insight: '古风美术场景吸睛，建议在标题中加入剧情冲突词提升点击率。',
  },
];

const TREND_7D = [
  { day: '11-14', views: 340, followers: 780 },
  { day: '11-15', views: 410, followers: 920 },
  { day: '11-16', views: 385, followers: 860 },
  { day: '11-17', views: 495, followers: 1120 },
  { day: '11-18', views: 540, followers: 1290 },
  { day: '11-19', views: 615, followers: 1480 },
  { day: '11-20', views: 440, followers: 1240 },
];

const fmtNum = n => {
  const num = Number(n || 0);
  if (num >= 10000) return `${(num / 10000).toFixed(1)}w`;
  return num.toLocaleString('zh-CN');
};

const loadAccounts = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ACCOUNTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_ACCOUNTS;
  } catch {
    return DEFAULT_ACCOUNTS;
  }
};

export default function DouyinOpsPanel({ onNotify }) {
  const [accounts, setAccounts] = useState(loadAccounts);
  const [selectedAccountId, setSelectedAccountId] = useState('all');
  const [sortBy, setSortBy] = useState('views'); // views | completion | likes
  const [query, setQuery] = useState('');
  const [activeVideoId, setActiveVideoId] = useState(DEMO_VIDEOS[0].id);
  const [bindOpen, setBindOpen] = useState(false);
  const [form, setForm] = useState({ name: '', handle: '', tag: '短剧主号', owner: '' });

  const saveAccounts = next => {
    setAccounts(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const syncAccount = acc => {
    saveAccounts(accounts.map(a => (a.id === acc.id ? { ...a, status: 'active', lastSync: '刚刚' } : a)));
    onNotify?.(`已同步「${acc.name}」最新账号与视频数据`);
  };

  const removeAccount = acc => {
    if (accounts.length <= 1) {
      onNotify?.('至少保留一个抖音账号用于数据展示');
      return;
    }
    const next = accounts.filter(a => a.id !== acc.id);
    saveAccounts(next);
    if (selectedAccountId === acc.id) setSelectedAccountId('all');
    onNotify?.(`已解绑「${acc.name}」`);
  };

  const bindAccount = () => {
    if (!form.name.trim() || !form.handle.trim()) {
      onNotify?.('请填写账号名称与抖音号');
      return;
    }
    const handle = form.handle.trim().startsWith('@') ? form.handle.trim() : `@${form.handle.trim()}`;
    const created = {
      id: `dy-${Date.now()}`,
      name: form.name.trim(),
      handle,
      tag: form.tag,
      owner: form.owner.trim() || '未指派',
      status: 'active',
      followers: 1200,
      deltaFollowers: 140,
      views7d: 28500,
      completionRate: 35.0,
      engagementRate: 5.8,
      videosCount: 3,
      lastSync: '刚刚',
    };
    saveAccounts([created, ...accounts]);
    setBindOpen(false);
    setForm({ name: '', handle: '', tag: '短剧主号', owner: '' });
    onNotify?.(`已绑定抖音账号「${created.name}」`);
  };

  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);

  const scopedAccounts = useMemo(
    () => (selectedAccountId === 'all' ? accounts : accounts.filter(a => a.id === selectedAccountId)),
    [accounts, selectedAccountId],
  );

  const summary = useMemo(() => {
    const followers = scopedAccounts.reduce((s, a) => s + a.followers, 0);
    const delta = scopedAccounts.reduce((s, a) => s + a.deltaFollowers, 0);
    const views7d = scopedAccounts.reduce((s, a) => s + a.views7d, 0);
    const avgCompletion = scopedAccounts.length
      ? (scopedAccounts.reduce((s, a) => s + a.completionRate, 0) / scopedAccounts.length).toFixed(1)
      : '0.0';
    const avgEngagement = scopedAccounts.length
      ? (scopedAccounts.reduce((s, a) => s + a.engagementRate, 0) / scopedAccounts.length).toFixed(1)
      : '0.0';
    return { followers, delta, views7d, avgCompletion, avgEngagement };
  }, [scopedAccounts]);

  const filteredVideos = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DEMO_VIDEOS
      .filter(v => (selectedAccountId === 'all' || v.accountId === selectedAccountId))
      .filter(v => !q || v.title.toLowerCase().includes(q) || (accountMap.get(v.accountId)?.name || '').toLowerCase().includes(q))
      .sort((a, b) => (sortBy === 'completion' ? b.completion - a.completion : sortBy === 'likes' ? b.likes - a.likes : b.views - a.views));
  }, [selectedAccountId, query, sortBy, accountMap]);

  const activeVideo = filteredVideos.find(v => v.id === activeVideoId) || filteredVideos[0] || null;
  const maxTrend = Math.max(...TREND_7D.map(d => d.views));

  return (
    <section className="admin-panel douyin-panel">
      <PanelHeading
        title="抖音账号与视频分析"
        description="统一管理组织抖音矩阵账号、近 7 日流量趋势与单条成片完播/互动表现"
        action={
          <div className="douyin-head-actions">
            <select
              className="douyin-account-select"
              value={selectedAccountId}
              onChange={e => setSelectedAccountId(e.target.value)}
              aria-label="筛选抖音账号"
            >
              <option value="all">全部账号 ({accounts.length})</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button type="button" className="admin-primary" onClick={() => setBindOpen(true)}>
              <Plus size={15} />绑定抖音账号
            </button>
          </div>
        }
      />

      {/* 账号数据概览 */}
      <div className="review-metrics">
        <div className="admin-metric">
          <div className="admin-metric-top"><span>总粉丝量</span><Users size={14} /></div>
          <strong>{fmtNum(summary.followers)}</strong>
          <small className="douyin-delta">+{fmtNum(summary.delta)} 近7日</small>
        </div>
        <div className="admin-metric">
          <div className="admin-metric-top"><span>近 7 日播放量</span><Eye size={14} /></div>
          <strong>{fmtNum(summary.views7d)}</strong>
          <small className="douyin-delta">较上周 +14.2%</small>
        </div>
        <div className="admin-metric">
          <div className="admin-metric-top"><span>平均完播率</span><TrendingUp size={14} /></div>
          <strong>{summary.avgCompletion}%</strong>
          <small className="douyin-sub">行业均值 32.0%</small>
        </div>
        <div className="admin-metric">
          <div className="admin-metric-top"><span>平均互动率</span><Heart size={14} /></div>
          <strong>{summary.avgEngagement}%</strong>
          <small className="douyin-sub">赞评转 / 播放</small>
        </div>
      </div>

      {/* 账号管理 + 7日趋势 */}
      <div className="douyin-grid">
        <div className="admin-card douyin-accounts-card">
          <div className="douyin-card-head">
            <div>
              <h3>矩阵账号管理</h3>
              <p>授权状态、粉丝规模与运营负责人</p>
            </div>
            <span>{accounts.length} 个已绑定</span>
          </div>

          <div className="douyin-account-list">
            {accounts.map(acc => (
              <div
                key={acc.id}
                className={`douyin-account-row ${selectedAccountId === acc.id ? 'is-selected' : ''}`}
                onClick={() => setSelectedAccountId(prev => (prev === acc.id ? 'all' : acc.id))}
              >
                <span className="douyin-avatar">{acc.name.slice(0, 1)}</span>
                <div className="douyin-account-info">
                  <div className="douyin-account-title">
                    <b>{acc.name}</b>
                    <span className="douyin-tag">{acc.tag}</span>
                    <span className={`douyin-status ${acc.status === 'active' ? 'ok' : 'warn'}`}>
                      {acc.status === 'active' ? '授权正常' : '即将过期'}
                    </span>
                  </div>
                  <small>{acc.handle} · 负责人 {acc.owner} · {acc.videosCount} 条视频 · 同步于 {acc.lastSync}</small>
                </div>
                <div className="douyin-account-nums">
                  <b>{fmtNum(acc.followers)}</b>
                  <small>粉丝</small>
                </div>
                <div className="douyin-account-ops" onClick={e => e.stopPropagation()}>
                  <button type="button" title="同步最新数据" onClick={() => syncAccount(acc)}><RefreshCw size={13} /></button>
                  <button type="button" title="解绑账号" onClick={() => removeAccount(acc)}><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-card douyin-trend-card">
          <div className="douyin-card-head">
            <div>
              <h3>近 7 日播放与涨粉趋势</h3>
              <p>单位：千次播放（K）</p>
            </div>
            <BarChart3 size={16} className="douyin-muted-icon" />
          </div>
          <div className="douyin-bars">
            {TREND_7D.map(item => (
              <div key={item.day} className="douyin-bar-col">
                <span className="douyin-bar-val">{item.views}k</span>
                <div className="douyin-bar-track">
                  <i style={{ height: `${Math.round((item.views / maxTrend) * 100)}%` }} />
                </div>
                <small>{item.day}</small>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 视频分析明细 */}
      <div className="admin-card douyin-videos-card">
        <div className="review-toolbar">
          <div className="douyin-card-head-inline">
            <Video size={15} />
            <h3>视频数据分析</h3>
            <span className="douyin-count">共 {filteredVideos.length} 条作品</span>
          </div>
          <div className="douyin-video-controls">
            <label className="review-search">
              <Search size={13} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索视频标题或账号…" />
            </label>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="视频排序">
              <option value="views">按播放量排序</option>
              <option value="completion">按完播率排序</option>
              <option value="likes">按点赞数排序</option>
            </select>
          </div>
        </div>

        <div className="douyin-video-table">
          <div className="douyin-v-head">
            <span>视频作品</span>
            <span>播放量</span>
            <span>完播率</span>
            <span>点赞 / 评论 / 转发</span>
            <span>涨粉</span>
            <span>诊断</span>
          </div>
          {filteredVideos.map(v => {
            const acc = accountMap.get(v.accountId);
            const isActive = activeVideo?.id === v.id;
            return (
              <button
                key={v.id}
                type="button"
                className={`douyin-v-row ${isActive ? 'is-active' : ''}`}
                onClick={() => setActiveVideoId(v.id)}
              >
                <div className="douyin-v-title">
                  <b>{v.title}</b>
                  <small>{acc?.name || '未知账号'} · {v.publishedAt} · {v.duration}</small>
                </div>
                <span>{fmtNum(v.views)}</span>
                <span className="douyin-completion">
                  <b>{v.completion}%</b>
                  <i className="douyin-meter"><em style={{ width: `${Math.min(100, v.completion * 1.6)}%` }} /></i>
                </span>
                <span className="douyin-engage">
                  <Heart size={11} />{fmtNum(v.likes)}
                  <MessageCircle size={11} />{fmtNum(v.comments)}
                  <Share2 size={11} />{fmtNum(v.shares)}
                </span>
                <span className="douyin-follow-plus"><UserPlus size={11} />+{fmtNum(v.newFollowers)}</span>
                <span className={`douyin-verdict ${v.verdict === '待优化' ? 'warn' : 'ok'}`}>{v.verdict}</span>
              </button>
            );
          })}
        </div>

        {activeVideo && (
          <div className="douyin-insight">
            <Sparkles size={14} />
            <div>
              <b>AI 视频诊断 · {activeVideo.title}</b>
              <p>{activeVideo.insight}</p>
            </div>
            <span className="douyin-insight-badge"><CheckCircle2 size={12} />完播 {activeVideo.completion}%</span>
          </div>
        )}
      </div>

      {bindOpen && (
        <div className="admin-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setBindOpen(false); }}>
          <div className="admin-modal" role="dialog" aria-modal="true" aria-label="绑定抖音账号">
            <header className="admin-modal-head">
              <div>
                <h3>绑定抖音账号</h3>
                <p>将团队运营的抖音号接入后台，统一统计播放与视频表现</p>
              </div>
              <button type="button" className="admin-modal-close" onClick={() => setBindOpen(false)} aria-label="关闭"><X size={16} /></button>
            </header>
            <div className="douyin-bind-form">
              <label>账号名称
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="例如：绘梦漫剧二号" autoFocus />
              </label>
              <label>抖音号 / 主页 ID
                <input value={form.handle} onChange={e => setForm(f => ({ ...f, handle: e.target.value }))} placeholder="例如：@huimeng_02" />
              </label>
              <label>账号定位
                <select value={form.tag} onChange={e => setForm(f => ({ ...f, tag: e.target.value }))}>
                  <option value="短剧主号">短剧主号</option>
                  <option value="漫剧切片">漫剧切片</option>
                  <option value="宣发矩阵">宣发矩阵</option>
                  <option value="幕后花絮">幕后花絮</option>
                </select>
              </label>
              <label>运营负责人
                <input value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} placeholder="例如：林小雨" />
              </label>
            </div>
            <footer className="admin-modal-foot">
              <button type="button" className="admin-outline" onClick={() => setBindOpen(false)}>取消</button>
              <button type="button" className="admin-primary" onClick={bindAccount}>确认绑定</button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}
