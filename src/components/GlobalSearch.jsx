import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Building2, ChevronRight, Cpu, Search, ShieldAlert, Users } from 'lucide-react';

/**
 * 顶栏全局搜索：即时补全 + 键盘导航。
 *
 * 输入时在分组内匹配（组织 / 用户 / 任务 / 审计），
 * ↑↓ 选择、Enter 跳转、Esc 关闭、⌘K 聚焦。
 */
const GROUP_META = {
  organizations: { label: '组织', icon: Building2 },
  users: { label: '用户', icon: Users },
  tasks: { label: '任务', icon: Cpu },
  audit: { label: '审计', icon: ShieldAlert },
};

const MAX_PER_GROUP = 4;

export default function GlobalSearch({ placeholder, onNavigate, loadIndex }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState(null);
  const inputRef = useRef(null);
  const boxRef = useRef(null);

  // 懒加载搜索索引：首次聚焦时拉取一次
  const ensureIndex = useCallback(async () => {
    if (index || loading || !loadIndex) return;
    setLoading(true);
    try {
      setIndex(await loadIndex());
    } catch {
      setIndex({ organizations: [], users: [], tasks: [], audit: [] });
    } finally {
      setLoading(false);
    }
  }, [index, loading, loadIndex]);

  // ⌘K / Ctrl+K 聚焦
  useEffect(() => {
    const onKey = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
        ensureIndex();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ensureIndex]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const onClick = event => {
      if (!boxRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const results = useMemo(() => {
    if (!index) return [];
    const q = query.trim().toLowerCase();
    // 空输入不出结果，避免聚焦时弹出无关列表
    if (!q) return [];
    return Object.entries(GROUP_META).map(([key, meta]) => ({
      key,
      label: meta.label,
      icon: meta.icon,
      items: (index[key] || [])
        .filter(item => `${item.label} ${item.hint || ''}`.toLowerCase().includes(q))
        .slice(0, MAX_PER_GROUP),
    })).filter(group => group.items.length);
  }, [index, query]);

  const flat = useMemo(() => results.flatMap(group => group.items.map(item => ({ ...item, group: group.key }))), [results]);
  const total = flat.length;

  useEffect(() => { setActive(0); }, [query]);

  const choose = useCallback(item => {
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
    onNavigate?.(item);
  }, [onNavigate]);

  const onKeyDown = event => {
    if (event.key === 'Escape') { setOpen(false); inputRef.current?.blur(); return; }
    if (!total) {
      if (event.key === 'Enter') { event.preventDefault(); onNavigate?.({ group: 'search', label: query }); }
      return;
    }
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(i => (i + 1) % total); return; }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActive(i => (i - 1 + total) % total); return; }
    if (event.key === 'Enter') { event.preventDefault(); choose(flat[active]); }
  };

  let cursor = -1;

  return (
    <div className="workspace-search-wrap" ref={boxRef}>
      <label className={`workspace-search${open ? ' is-open' : ''}`}>
        <Search size={16} />
        <input
          ref={inputRef}
          aria-label={placeholder}
          placeholder={placeholder}
          value={query}
          onChange={event => { setQuery(event.target.value); setOpen(true); ensureIndex(); }}
          onFocus={() => { setOpen(true); ensureIndex(); }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-controls="global-search-list"
        />
        <kbd>⌘ K</kbd>
      </label>

      {open && (
        <div className="workspace-search-panel" id="global-search-list" role="listbox">
          {loading && <p className="workspace-search-empty">正在加载索引…</p>}
          {!loading && !total && (
            <p className="workspace-search-empty">
              {query ? `没有匹配「${query}」的结果` : '输入关键词搜索组织、用户、任务或审计'}
            </p>
          )}
          {!loading && results.map(group => (
            <section key={group.key} className="workspace-search-group">
              <header>
                <group.icon size={12} />
                <span>{group.label}</span>
              </header>
              {group.items.map(item => {
                cursor += 1;
                const isActive = cursor === active;
                return (
                  <button
                    type="button"
                    key={`${group.key}-${item.id}`}
                    className={`workspace-search-item${isActive ? ' is-active' : ''}`}
                    onMouseEnter={() => setActive(cursor)}
                    onClick={() => choose({ ...item, group: group.key })}
                    role="option"
                    aria-selected={isActive}
                  >
                    <span className="ws-item-main">
                      <b>{item.label}</b>
                      {item.hint && <small>{item.hint}</small>}
                    </span>
                    <ChevronRight size={13} />
                  </button>
                );
              })}
            </section>
          ))}
          {!loading && total > 0 && (
            <footer className="workspace-search-foot">
              <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
              <span><kbd>↵</kbd> 跳转</span>
              <span><kbd>esc</kbd> 关闭</span>
              {query && (
                <button type="button" className="ws-item-all" onClick={() => choose({ group: 'search', label: query })}>
                  查看全部结果 <ArrowRight size={11} />
                </button>
              )}
            </footer>
          )}
        </div>
      )}
    </div>
  );
}
