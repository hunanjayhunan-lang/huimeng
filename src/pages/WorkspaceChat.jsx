import { useEffect, useRef } from 'react';
import { Sparkles, Send, X, Check, Plus, HelpCircle } from 'lucide-react';

/**
 * 全流程 AI 对话条（底部常驻）。
 * - HITL：AI 只出提案卡（原文→建议），由人点「应用/撤销」。
 * - 运行中消息排队（busy 时占位提示）。
 */
export default function WorkspaceChat({ open, onToggle, scopeLabel, messages, input, setInput, onSend, onApply, onDismiss, onAttach, busy }) {
  const logRef = useRef(null);
  useEffect(() => {
    if (open) logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  return (
    <div className={`ws-chat-dock ${open ? 'open' : ''}`}>
      {open && (
        <div className="ws-chat-panel">
          <header className="ws-chat-head">
            <span className="ws-chat-title"><Sparkles size={14} /> Agent · 全流程助手</span>
            <button type="button" className="ws-chat-close" onClick={onToggle} aria-label="收起"><X size={15} /></button>
          </header>
          <div className="ws-chat-log" ref={logRef}>
            {messages.map(msg => (
              <div key={msg.id} className={`ws-chat-msg ${msg.role}`}>
                <div className="ws-chat-bubble">
                  {msg.text}
                  {msg.status === 'queued' && <span className="ws-chat-tag">已排队</span>}
                </div>
                {msg.proposal && (
                  <div className={`ws-chat-proposal ${msg.status === 'applied' ? 'applied' : msg.status === 'dismissed' ? 'dismissed' : ''}`}>
                    <div className="ws-chat-diff">
                      <div><span>原文</span><p>{msg.proposal.before || '（空）'}</p></div>
                      <div className="after"><span>建议{modeLabel(msg.proposal.mode)}</span><p>{msg.proposal.after}</p></div>
                    </div>
                    {msg.status === 'applied' ? (
                      <div className="ws-chat-applied"><Check size={13} /> 已应用</div>
                    ) : msg.status === 'dismissed' ? (
                      <div className="ws-chat-dismissed">已撤销</div>
                    ) : (
                      <div className="ws-chat-actions">
                        <button type="button" className="ghost" onClick={() => onDismiss(msg)}>撤销</button>
                        <button type="button" className="primary" onClick={() => onApply(msg, msg.proposal)}>应用</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="ws-chat-bar">
        <span className="ws-chat-tip" tabIndex={0} aria-label="使用提示">
          <HelpCircle size={16} />
          <span className="ws-chat-tip-pop" role="tooltip">
            任何步骤都能让我改提示词或补充要求。先在画布选中资产节点 / 打开某个分镜，再聊，我会针对它给出修订建议。
          </span>
        </span>
        <button type="button" className="ws-chat-attach" onClick={onAttach} aria-label="附加/上传剧本" title="附加/上传剧本"><Plus size={17} /></button>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onFocus={() => { if (!open) onToggle(); }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder={busy ? 'Agent 执行中，消息会排队…' : '和 AI 聊…'}
        />
        <span className="ws-chat-scope-inline" title={`针对：${scopeLabel}`}>针对：{scopeLabel}</span>
        <button type="button" className="ws-chat-send" onClick={onSend} aria-label="发送"><Send size={16} /></button>
      </div>
    </div>
  );
}

const modeLabel = mode => (mode === 'append' ? '（追加）' : mode === 'rewrite' ? '（改写）' : '');
