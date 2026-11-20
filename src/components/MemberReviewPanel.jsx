import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, Clock3, FileText, Film, Image as ImageIcon, Layers, Search, XCircle } from 'lucide-react';
import { api } from '../api.js';
import { EmptyState, ErrorBanner, PanelHeading } from './AdminWorkspace.jsx';

const CATEGORY_META = {
  asset: { label: '资产', icon: ImageIcon },
  video: { label: '成片', icon: Film },
  script: { label: '剧本', icon: FileText },
};

const STATUS_LABEL = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
};

const formatStamp = value => (
  value ? new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
);

/**
 * 成员提交内容审核面板：供 审核员（org.reviewer）、组织管理员（org.admin）、平台管理员（superadmin）共用。
 */
export default function MemberReviewPanel({ showOrg = false, onNotify, onOpenCanvas }) {
  const [data, setData] = useState({ items: [], counts: { total: 0, pending: 0, approved: 0, rejected: 0 } });
  const [projects, setProjects] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [rejectingId, setRejectingId] = useState('');
  const [rejectNote, setRejectNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, projRes] = await Promise.all([
        api.orgReviews(),
        api.list('projects', 100).catch(() => ({ items: [] })),
      ]);
      setData({
        items: Array.isArray(res?.items) ? res.items : [],
        counts: res?.counts || { total: 0, pending: 0, approved: 0, rejected: 0 },
      });
      setProjects(Array.isArray(projRes?.items) ? projRes.items : []);
      setError('');
    } catch (err) {
      setError(err.message || '读取审核列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const openCanvasFor = item => {
    const matched = projects.find(p => p.name === item.project_name || p.title === item.project_name);
    const pid = matched?.id || 'proj-rain-alley';
    const url = `/app/workspace/projects/${encodeURIComponent(pid)}?view=canvas`;
    if (onOpenCanvas) onOpenCanvas(url);
    else window.location.assign(url);
  };

  useEffect(() => { load(); }, [load]);

  const decide = async (item, action, note = '') => {
    setBusyId(item.id);
    try {
      await api.decideOrgReview(item.id, action, note);
      setRejectingId('');
      setRejectNote('');
      onNotify?.(action === 'approve' ? `已通过「${item.title}」` : `已驳回「${item.title}」`);
      await load();
    } catch (err) {
      onNotify?.(err.message || '审核操作失败');
    } finally {
      setBusyId('');
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.items.filter(item => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (!q) return true;
      return [item.title, item.project_name, item.submitted_email, item.org_name, item.summary]
        .some(v => String(v || '').toLowerCase().includes(q));
    });
  }, [data.items, statusFilter, query]);

  const counts = data.counts || {};

  return (
    <section className="admin-panel review-panel">
      <PanelHeading
        title="内容审核"
        description="处理成员提交的剧本、资产图与成片审核队列"
        action={<button type="button" className="admin-outline" onClick={load} disabled={loading}>{loading ? '刷新中…' : '刷新列表'}</button>}
      />

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="review-metrics">
        <div className="admin-metric">
          <div className="admin-metric-top"><span>待审核</span><Clock3 size={14} /></div>
          <strong>{Number(counts.pending || 0)}</strong>
        </div>
        <div className="admin-metric">
          <div className="admin-metric-top"><span>已通过</span><CheckCircle2 size={14} /></div>
          <strong>{Number(counts.approved || 0)}</strong>
        </div>
        <div className="admin-metric">
          <div className="admin-metric-top"><span>已驳回</span><XCircle size={14} /></div>
          <strong>{Number(counts.rejected || 0)}</strong>
        </div>
        <div className="admin-metric">
          <div className="admin-metric-top"><span>累计提交</span><FileText size={14} /></div>
          <strong>{Number(counts.total || 0)}</strong>
        </div>
      </div>

      <div className="admin-card">
        <div className="review-toolbar">
          <div className="review-filter-tabs" role="tablist">
            {[
              ['all', `全部 (${Number(counts.total || 0)})`],
              ['pending', `待审核 (${Number(counts.pending || 0)})`],
              ['approved', `已通过 (${Number(counts.approved || 0)})`],
              ['rejected', `已驳回 (${Number(counts.rejected || 0)})`],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={statusFilter === key ? 'is-active' : ''}
                onClick={() => setStatusFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="review-search">
            <Search size={13} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="搜索标题、项目或提交成员…"
            />
          </label>
        </div>

        {!filtered.length ? (
          <EmptyState
            title={loading ? '正在读取审核队列…' : '暂无符合条件的审核项'}
            description={loading ? '' : '成员提交剧本、资产或成片后，会出现在这里等待处理。'}
          />
        ) : (
          <div className="review-list">
            {filtered.map(item => {
              const cat = CATEGORY_META[item.category] || CATEGORY_META.asset;
              const CatIcon = cat.icon;
              const isBusy = busyId === item.id;
              const isRejecting = rejectingId === item.id;
              return (
                <article key={item.id} className={`review-item is-${item.status}`}>
                  <div className="review-item-main">
                    <div className="review-item-top">
                      <span className="review-cat"><CatIcon size={12} />{cat.label}</span>
                      <b>{item.title}</b>
                      <span className={`review-status is-${item.status}`}>{STATUS_LABEL[item.status] || item.status}</span>
                    </div>
                    <div className="review-item-meta">
                      <span>项目：{item.project_name}</span>
                      {showOrg && item.org_name && <span>组织：{item.org_name}</span>}
                      <span>提交人：{item.submitted_email}</span>
                      <span>提交时间：{formatStamp(item.created_at)}</span>
                    </div>
                    {item.summary && <p className="review-item-summary">{item.summary}</p>}
                    {item.status !== 'pending' && (
                      <div className="review-decision-note">
                        <span>处理人：{item.reviewer_email || '系统'} · {formatStamp(item.reviewed_at)}</span>
                        {item.review_note && <em>备注：{item.review_note}</em>}
                      </div>
                    )}
                    {isRejecting && (
                      <div className="review-reject-box">
                        <input
                          value={rejectNote}
                          onChange={e => setRejectNote(e.target.value)}
                          placeholder="填写驳回原因（可选，例如：暗调对比度不足，请重绘）"
                          autoFocus
                        />
                        <button type="button" className="admin-outline" onClick={() => { setRejectingId(''); setRejectNote(''); }}>取消</button>
                        <button type="button" className="review-btn-reject" disabled={isBusy} onClick={() => decide(item, 'reject', rejectNote)}>
                          {isBusy ? '提交中…' : '确认驳回'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="review-item-actions">
                    <button
                      type="button"
                      className="admin-outline review-btn-canvas"
                      onClick={() => openCanvasFor(item)}
                      title={`打开「${item.project_name}」对应画布`}
                    >
                      <Layers size={13} />查看画布
                    </button>
                    {item.status === 'pending' && !isRejecting && (
                      <>
                        <button
                          type="button"
                          className="review-btn-approve"
                          disabled={isBusy}
                          onClick={() => decide(item, 'approve')}
                        >
                          <Check size={13} />{isBusy ? '处理中…' : '通过'}
                        </button>
                        <button
                          type="button"
                          className="review-btn-reject-outline"
                          disabled={isBusy}
                          onClick={() => { setRejectingId(item.id); setRejectNote(''); }}
                        >
                          驳回
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
