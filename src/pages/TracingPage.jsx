import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, Check, ChevronDown, Clock3, Copy, Film, Image, Loader2, RefreshCw, Search, Sparkles, X } from 'lucide-react';
import { api } from '../api.js';
import './TracingPage.css';

const ranges = [['今天','1'],['7 天','7'],['30 天','30']];
const kindName = { image:'图片', video:'视频', chat:'对话', agent:'Agent', script_split:'拆分镜', breakdown:'拆解' };
const fmt = n => Number(n||0).toLocaleString('zh-CN');
const duration = n => n>=1000?`${(n/1000).toFixed(1)}s`:`${Math.round(n||0)}ms`;
const cost = n => `¥${Number(n||0).toFixed(2)}`;
const stamp = n => new Date(n).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});

function Sparkline({values=[]}) { const max=Math.max(1,...values.map(Number)); const points=values.map((value,i)=>`${values.length<2?0:i/(values.length-1)*100},${28-(Number(value)||0)/max*24}`).join(' '); return <svg className="trace-sparkline" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points={points||'0,26 100,26'}/></svg>; }

export default function TracingPage({ platformAdmin = false }) {
  const initial = new URLSearchParams(location.search);
  const [days,setDays] = useState(initial.get('days')||'7');
  const [orgs,setOrgs] = useState([]);
  const [orgId,setOrgId] = useState(platformAdmin ? (initial.get('org')||'') : '');
  const [kind,setKind] = useState(initial.get('kind')||'all');
  const [status,setStatus] = useState(initial.get('status')||'all');
  const [query,setQuery] = useState(initial.get('q')||'');
  const [tasks,setTasks] = useState([]);
  const [calls,setCalls] = useState([]);
  const [summary,setSummary] = useState(null);
  const [detail,setDetail] = useState(null);
  const [selectedId,setSelectedId] = useState(initial.get('trace')||'');
  const [detailTab,setDetailTab] = useState('概览');
  const [tree,setTree] = useState(false);
  const [auto,setAuto] = useState(true);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const cursorRef = useRef('');
  const [more,setMore] = useState(false);
  const [listScroll,setListScroll] = useState(0);
  const [expandedGroups,setExpandedGroups] = useState(()=>new Set());
  const [expanded,setExpanded] = useState(-1);
  const listRef = useRef(null);

  useEffect(()=>{ if(platformAdmin) api.platformOrganizations().then(d=>setOrgs(d.items||[])).catch(e=>setError(e.message)); },[platformAdmin]);
  const orgParam = platformAdmin ? (orgId||'all') : undefined;
  const load = useCallback(async (append=false,silent=false) => {
    if(!silent) setLoading(true);
    try {
      const [s,c,t] = await Promise.all([api.tracingSummary(days,orgParam),api.tracingCalls(200,orgParam),api.tracingTasks(300,orgParam,append?cursorRef.current:undefined)]);
      setSummary(s); setCalls(c.items||[]);
      const next=append?[...tasks,...(t.items||[])]:t.items||[];
      setTasks(current=>append?[...current,...(t.items||[])]:t.items||[]); cursorRef.current=t.nextCursor||''; setMore(Boolean(t.nextCursor)); setError('');
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  },[days,orgParam,platformAdmin,orgId]);
  useEffect(()=>{load();},[days,orgId,load]);
  useEffect(()=>{
    const p=new URLSearchParams(); if(platformAdmin&&orgId)p.set('org',orgId); if(days!=='7')p.set('days',days); if(kind!=='all')p.set('kind',kind); if(status!=='all')p.set('status',status); if(query)p.set('q',query); if(selectedId)p.set('trace',selectedId);
    const url=`${location.pathname}${p.size?`?${p}`:''}`; if(`${location.pathname}${location.search}`!==url)history.replaceState({},'',url);
  },[platformAdmin,orgId,days,kind,status,query,selectedId]);
  const selectTask=useCallback(async id=>{
    if(!id){setSelectedId('');setDetail(null);return;}
    setSelectedId(id);
    try { const d=await api.tracingTask(id,orgParam); setDetail(d); }
    catch(e){setError(e.message);setDetail(null);}
  },[orgParam]);
  useEffect(()=>{if(selectedId&&!detail)selectTask(selectedId);},[selectedId,detail,selectTask]);
  useEffect(()=>{
    if(!auto||!tasks.some(t=>['queued','running'].includes(t.status))) return;
    const id=setInterval(()=>{load(false,true);if(selectedId)selectTask(selectedId)},3000); return ()=>clearInterval(id);
  },[auto,tasks,load,selectedId,selectTask]);
  const filtered=useMemo(()=>{const since=Date.now()-Number(days)*86400000;return tasks.filter(t=>t.createdAt>=since&&(kind==='all'||t.type===kind)&&(status==='all'||t.status===status)&&`${t.id} ${t.prompt||''}`.toLowerCase().includes(query.toLowerCase()))},[tasks,kind,status,query,days]);
  // 按项目分组：项目作为会话单元
  const groups=useMemo(()=>{const map=new Map();for(const t of filtered){const key=t.projectId||'__none__';if(!map.has(key))map.set(key,{id:key,name:t.projectName||'未归属项目',org:t.organization||'',tasks:[]});map.get(key).tasks.push(t)}return [...map.values()].map(g=>({...g,done:g.tasks.filter(t=>t.status==='done').length,failed:g.tasks.filter(t=>t.status==='failed').length,running:g.tasks.filter(t=>t.status==='running').length,queued:g.tasks.filter(t=>t.status==='queued').length,lastAt:Math.max(...g.tasks.map(t=>t.createdAt))})).sort((a,b)=>{const ao=a.org||"",bo=b.org||"";if(ao!==bo)return ao.localeCompare(bo,"zh");return b.lastAt-a.lastAt})},[filtered]);
  const toggleGroup=useCallback(id=>setExpandedGroups(prev=>{const next=new Set(prev);next.has(id)?next.delete(id):next.add(id);return next}),[]);
  useEffect(()=>setListScroll(0),[kind,status,query,days,orgId]);
  const activeIndex=filtered.findIndex(t=>t.id===selectedId);
  const listStart=Math.floor(listScroll/68);
  const visibleTasks=filtered.slice(listStart,listStart+18);
  useEffect(()=>{const key=e=>{if(e.target.matches('input,textarea,select'))return;if(e.key==='j'||e.key==='k'){e.preventDefault();const i=Math.max(0,Math.min(filtered.length-1,(activeIndex<0?0:activeIndex)+(e.key==='j'?1:-1)));if(filtered[i])selectTask(filtered[i].id)}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[filtered,activeIndex,selectTask]);
  const events=detail?.events||[]; const callsForTask=detail?.calls||[];
  const phases=detail?[
    {name:'排队',ms:300,color:'#8ca5bb'},
    {name:'提交',ms:200,color:'#7b94ac'},
    {name:'生成等待',ms:Math.max(200,Number(detail.task.costMs||0)-1010),color:'#467da5'},
    {name:'下载',ms:500,color:'#75a98b'},
    {name:'结算',ms:10,color:'#d6a54b'},
  ]:[];
  const phaseTotal=phases.reduce((a,p)=>a+p.ms,0)||1;
  const emptyTitle=error?'加载失败':tasks.length?'没有匹配的任务':platformAdmin&&orgId==='all'?'平台暂无追踪数据':'该组织暂无追踪数据';

  return <section className="trace-workspace">
    <div className="platform-overview-head trace-overview-head"><div><h2>调用追踪</h2><p>以生成任务为主线查看全链路调用与事件</p></div><div className="trace-head-actions"><label className="trace-auto"><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)}/>自动刷新</label><button onClick={()=>load()}><RefreshCw size={14}/>刷新</button></div></div>
    
    {error&&<div className="trace-error"><AlertTriangle size={15}/>{error}<button onClick={()=>load()}>重试</button></div>}
    <article className="admin-card trace-directory"><div className="admin-card-head trace-directory-head"><div><h3>任务列表</h3><p>{filtered.length} 条记录 · j/k 切换</p></div></div>
    <div className="trace-filters">{platformAdmin&&<select aria-label="组织" value={orgId||'all'} onChange={e=>{setOrgId(e.target.value);setDetail(null);setSelectedId('')}}><option value="all">全部组织</option>{orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select>}<div className="trace-range">{ranges.map(([label,value])=><button className={days===value?'selected':''} key={value} onClick={()=>setDays(value)}>{label}</button>)}</div><select value={kind} onChange={e=>setKind(e.target.value)}><option value="all">全部类型</option>{Object.entries(kindName).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">全部状态</option><option value="done">成功</option><option value="failed">失败</option><option value="running">运行中</option><option value="queued">排队中</option></select><label className="trace-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="任务 ID / 提示词"/></label></div>
    <div className="trace-split"><aside className="trace-list"><div className="trace-list-scroll" ref={listRef} onScroll={e=>setListScroll(e.currentTarget.scrollTop)}>{loading&&!tasks.length?<div className="trace-skeleton">正在读取任务…</div>:filtered.length?groups.map(group=>{const isCollapsed=!expandedGroups.has(group.id);return <section className="trace-group" key={group.id}><button type="button" className={`trace-group-head${selectedId&&group.tasks.some(t=>t.id===selectedId)?' has-active':''}`} onClick={()=>toggleGroup(group.id)}><i className={`trace-group-chevron${isCollapsed?' collapsed':''}`}>{isCollapsed?'▸':'▾'}</i><span className="trace-group-name" title={group.name}>{group.name}</span>{group.org&&<span className="trace-group-org" title={`所属组织：${group.org}`}>{group.org}</span>}<span className="trace-group-stats">{group.done>0&&<em className="ok">{group.done} 完成</em>}{group.failed>0&&<em className="bad">{group.failed} 失败</em>}{group.running>0&&<em className="run">{group.running} 运行中</em>}{group.queued>0&&<em className="queue">{group.queued} 排队</em>}<em className="time">{stamp(group.lastAt)}</em></span><span className="trace-group-count">{group.tasks.length}</span></button>{!isCollapsed&&<div className="trace-group-items">{group.tasks.map(task=><button key={task.id} className={`trace-item ${task.id===selectedId?'selected':''}`} onClick={()=>selectTask(task.id)}><i className={`trace-state ${task.status}`}/><span className="trace-item-icon">{task.type==='video'?<Film size={15}/>:<Image size={15}/>}</span><div className="trace-item-info"><b title={task.prompt}>{task.prompt||'（无提示词）'}</b><small>{task.createdBy||'系统'} · {stamp(task.createdAt)}</small><small>{duration(task.costMs)} · {fmt(calls.filter(c=>c.taskId===task.id).reduce((a,c)=>a+(c.totalTokens||0),0))} tok · {cost(calls.filter(c=>c.taskId===task.id).reduce((a,c)=>a+(c.costCny||0),0))}</small></div><span className="trace-item-status">{task.status==='done'?'完成':task.status==='failed'?'失败':task.status==='queued'?'排队':'运行中'}</span></button>)}</div>}</section>}):<div className="trace-empty"><Activity size={22}/><b>{emptyTitle}</b><p>{error?'检查连接后重试':tasks.length?'调整筛选条件，或清除搜索':platformAdmin&&orgId==='all'?'去成片或画布发起一次生成。':'切换组织或调整时间范围试试。'}</p>{tasks.length>0&&<button onClick={()=>{setQuery('');setKind('all');setStatus('all')}}>清除筛选</button>}{!tasks.length&&platformAdmin&&orgId!=='all'&&<button onClick={()=>setOrgId('all')}>查看全部组织</button>}{!tasks.length&&(!platformAdmin||orgId==='all')&&<a href="/app/videos">去生成一次</a>}</div>}</div>{more&&<button className="trace-load-more" onClick={()=>load(true)}>加载更多</button>}</aside>
      <main className="trace-detail">{detail?<>
        <header className="trace-detail-head"><div><div className="trace-id-row"><b>#{detail.task.id}</b><button title="复制任务 ID" onClick={()=>navigator.clipboard.writeText(detail.task.id)}><Copy size={13}/></button><span className={`trace-status-pill ${detail.task.status}`}>{detail.task.status==='done'?'完成':detail.task.status==='failed'?'失败':'运行中'}</span></div><p>{platformAdmin?orgs.find(o=>o.id===orgId)?.name||'全部组织':'当前组织'} · {detail.task.model} · 尝试 {detail.task.attempts||1} 次</p></div><div><b>{duration(detail.task.costMs)}</b><small>{cost(callsForTask.reduce((n,c)=>n+(c.costCny||0),0))}</small></div></header><nav className="trace-detail-tabs">{['概览','Trace','产物','错误'].map(t=><button className={detailTab===t?'selected':''} key={t} onClick={()=>setDetailTab(t)}>{t}</button>)}</nav>{detailTab==='概览'?<div className="trace-waterfall"><p className="trace-estimate-note">分阶段耗时为估算；任务事件暂未分别记录下载与结算时长。</p><div className="trace-time-axis"><span>0s</span><span>{duration(phaseTotal/2)}</span><span>{duration(phaseTotal)}</span></div>{phases.map((p,i)=><button key={p.name} className="trace-span" onClick={()=>setExpanded(expanded===i?-1:i)}><span>{p.name}</span><div><i style={{width:`${Math.max(2,p.ms/phaseTotal*100)}%`,background:p.color}}/></div><small>{duration(p.ms)}</small>{expanded===i&&<code>阶段估算 · {stamp(detail.task.createdAt+i*1000)} · {duration(p.ms)}</code>}</button>)}</div>
:detailTab==='Trace'?(()=>{
      const steps=[
        ...events.map(e=>({kind:'event',at:e.at||e.createdAt,event:e.event,detail:e.detail,id:e.id})),
        ...callsForTask.map(c=>({kind:'call',at:c.createdAt,id:c.id,call:c})),
      ].sort((a,b)=>(a.at||0)-(b.at||0));
      const eventLabel={submit:'提交任务',progress:'进度更新',done:'生成完成',failed:'生成失败',queued:'进入队列',running:'开始运行'};
      return <div className="trace-trace">
        <div className="trace-trace-summary">
          <span>共 <b>{steps.length}</b> 步</span>
          <span>系统事件 <b>{events.length}</b></span>
          <span>API 调用 <b>{callsForTask.length}</b></span>
          <span>工具调用 <b>{callsForTask.reduce((n,c)=>n+((c.toolCalls||[]).length),0)}</b></span>
        </div>
        <ol className="trace-trace-list">
          {steps.length?steps.map((item,idx)=>{
            if(item.kind==='event'){
              const isFail=item.event==='failed';
              return <li key={item.id} className={`tr-step tr-event${isFail?' is-error':''}`}>
                <span className="tr-index">{idx+1}</span>
                <div className="tr-card">
                  <div className="tr-head"><b>{eventLabel[item.event]||item.event}</b><time>{stamp(item.at)}</time></div>
                  {item.detail&&<pre className="tr-pre">{JSON.stringify(item.detail,null,2)}</pre>}
                </div>
              </li>;
            }
            const c=item.call;
            const isLlm=c.kind==='llm';
            const isErr=c.status==='error';
            const tools=c.toolCalls||[];
            const msgs=c.input?.messages||null;
            return <li key={item.id} className={`tr-step tr-call${isErr?' is-error':''}`}>
              <span className="tr-index">{idx+1}</span>
              <div className="tr-card">
                <div className="tr-head">
                  <b>{isLlm?'LLM 调用':'生成调用'}</b>
                  <code className="tr-model">{c.model}</code>
                  <span className={`tr-badge ${isErr?'bad':'ok'}`}>{c.status}</span>
                  <span className="tr-provider">{c.provider}</span>
                  <time>{stamp(c.createdAt)}</time>
                </div>
                <div className="tr-metrics">
                  <span>耗时 <b>{duration(c.latencyMs)}</b></span>
                  <span>Tokens <b>{fmt(c.totalTokens)}</b></span>
                  {c.promptTokens>0&&<span>in <b>{fmt(c.promptTokens)}</b></span>}
                  {c.completionTokens>0&&<span>out <b>{fmt(c.completionTokens)}</b></span>}
                  <span>成本 <b>{cost(c.costCny||0)}</b></span>
                  {c.requestId&&<span className="tr-req">req <code>{c.requestId}</code></span>}
                </div>

                <section className="tr-section">
                  <h4>Input</h4>
                  {msgs?<div className="tr-messages">{msgs.map((m,i)=><div className={`tr-msg role-${m.role}`} key={i}><span className="tr-role">{m.role}</span><pre className="tr-pre">{m.content}</pre></div>)}</div>
                    :c.input?<pre className="tr-pre">{JSON.stringify(c.input,null,2)}</pre>
                    :<p className="tr-none">未记录输入</p>}
                </section>

                {tools.length>0&&<section className="tr-section">
                  <h4>Tool calls <span className="tr-count">{tools.length}</span></h4>
                  {tools.map((t,i)=><div className="tr-tool" key={t.id||i}>
                    <div className="tr-tool-head"><code>{t.function?.name||t.name}</code><span className="tr-badge ok">{t.type||'function'}</span></div>
                    <div className="tr-tool-grid">
                      <div><span>arguments</span><pre className="tr-pre">{typeof t.function?.arguments==='string'?t.function.arguments:JSON.stringify(t.function?.arguments??t.arguments,null,2)}</pre></div>
                      <div><span>result</span><pre className="tr-pre">{JSON.stringify(t.result??null,null,2)}</pre></div>
                    </div>
                  </div>)}
                </section>}

                <section className="tr-section">
                  <h4>Output</h4>
                  {c.output?<pre className="tr-pre">{typeof c.output==='string'?c.output:JSON.stringify(c.output,null,2)}</pre>
                    :isErr&&c.error?<p className="tr-error-line">{c.error}</p>
                    :<p className="tr-none">未记录输出</p>}
                </section>
              </div>
            </li>;
          }):<li className="tr-empty">暂无 tracing 记录</li>}
        </ol>
      </div>;
    })():detailTab==='产物'?(()=>{
      const t=detail.task;
      const url=t.resultUrl;
      const isVideo=t.type==='video';
      const isImage=t.type==='image'||/\.(png|jpe?g|webp|gif|svg)$/i.test(url||'');
      const callsWithOutput=callsForTask.filter(c=>c.output);
      const mediaUrls=[...new Set([url,...callsWithOutput.map(c=>c.output?.url).filter(Boolean)].filter(Boolean))];
      return <div className="trace-artifacts">
        {url?<>
          <div className="tr-artifact-main">
            <div className="tr-artifact-head">
              <b>{isVideo?'视频产物':'图像产物'}</b>
              <span className="tr-badge ok">已生成</span>
              <a href={url} target="_blank" rel="noreferrer">打开原文件</a>
            </div>
            <div className="tr-artifact-preview">
              {isVideo?<video controls src={url}/>
                :isImage?<img src={url} alt="任务产物"/>
                :<a className="tr-artifact-link" href={url} target="_blank" rel="noreferrer">{url}</a>}
            </div>
          </div>
          <dl className="tr-artifact-meta">
            <div><dt>类型</dt><dd>{t.type}</dd></div>
            <div><dt>文件名</dt><dd title={t.localPath||url.split('/').pop()}>{t.localPath||url.split('/').pop()}</dd></div>
            <div><dt>访问地址</dt><dd title={url}>{url}</dd></div>
            <div><dt>生成耗时</dt><dd>{duration(t.costMs)}</dd></div>
            <div><dt>尝试次数</dt><dd>{t.attempts||1}</dd></div>
            <div><dt>完成时间</dt><dd>{stamp(t.updatedAt||t.createdAt)}</dd></div>
          </dl>
        </>:(t.status==='failed'?<div className="tr-artifact-empty is-error"><AlertTriangle size={20}/><b>未生成产物</b><span>{t.error||'任务执行失败'}</span></div>
          :<div className="tr-artifact-empty"><Sparkles size={20}/><b>暂无产物</b><span>任务{t.status==='running'?'仍在运行':'尚未开始'}，完成后将在此显示</span></div>)}
        {mediaUrls.length>1&&<div className="tr-artifact-list">
          <h4>调用产生的媒体 <span className="tr-count">{mediaUrls.length}</span></h4>
          {mediaUrls.map((u,i)=><a key={i} href={u} target="_blank" rel="noreferrer"><code>{u}</code></a>)}
        </div>}
      </div>;
    })()
:<div className="trace-error-detail">{detail.task.error?<><AlertTriangle size={18}/><b>{detail.task.error}</b><p>已尝试 {detail.task.attempts||1} 次</p>{callsForTask.filter(c=>c.error).map(c=><div className="tr-call-error" key={c.id}><code>{c.model}</code><span>{c.error}</span></div>)}<button onClick={async()=>{try{await api.retryTask(detail.task.id);await load();await selectTask(detail.task.id)}catch(e){setError(e.message)}}}>重试任务</button></>:<p>此任务没有错误记录。</p>}</div>}</>:<div className="trace-no-selection"><Sparkles size={23}/><b>选择一条任务查看完整追踪</b><span>查看调用链、输入输出与错误详情</span></div>}</main></div>
    </article>
  </section>;
}
