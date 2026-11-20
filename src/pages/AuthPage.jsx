import { useState } from 'react';
import { Eye, EyeOff, LockKeyhole, Mail, Sparkles } from 'lucide-react';
import { api, setToken } from '../api.js';
import imgRainAlley from '../assets/assets/scene-rain-alley-new.webp';
import './AuthPage.css';

export default function AuthPage({ onAuthenticated }) {
  const inviteToken = new URLSearchParams(window.location.search).get('token');
  const [registering, setRegistering] = useState(Boolean(inviteToken));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [agreed, setAgreed] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async event => {
    event.preventDefault();
    if (!agreed) {
      setError('请先阅读并同意用户服务协议与隐私政策');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = inviteToken
        ? await api.acceptInvite(inviteToken, email, password)
        : registering ? await api.register(email, password, orgName) : await api.login(email, password);
      setToken(result.token);
      onAuthenticated({ ...result, role: result.role || result.org?.role || 'org.user' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = Boolean(email.trim() && password && (!registering || inviteToken || orgName.trim()) && agreed);

  return (
    <main className="auth-stage">
      {/* 暗色模糊工作台背景氛围层 */}
      <div className="auth-backdrop" aria-hidden="true">
        <div className="auth-top-banner">
          <span className="auth-banner-badge">新版本</span>
          <span>AI绘梦 2.0 上新 · 剧本拆解、资产画布、审核台与抖音运营全链路上线 ›</span>
        </div>
        <div className="auth-bg-glow one" />
        <div className="auth-bg-glow two" />
      </div>

      {/* 居中分栏登录弹窗 */}
      <section className="auth-modal-card" aria-label="账号登录">
        <div className="auth-showcase">
          <video
            src="/login-cover.mp4"
            poster={imgRainAlley}
            autoPlay
            loop
            muted
            playsInline
            className="auth-showcase-img"
          />
          <div className="auth-showcase-scrim" />

          <div className="auth-showcase-content">
            <h2>AI绘梦 · 剧本到成片全链路</h2>
            <p>对剧本拆解、资产绘图与分镜视频进行精细控制，让灵感快速迭代，轻松抵达理想成片效果。</p>
          </div>
        </div>

        <div className="auth-panel">
          <div className="auth-panel-brand">
            <span className="auth-logo-mark"><Sparkles size={15} /></span>
            <b>AI绘梦</b>
          </div>

          <h1>{inviteToken ? '接受邀请加入组织' : registering ? '注册 AI绘梦' : '欢迎登录 AI绘梦'}</h1>

          <form className="auth-form" onSubmit={submit}>
            {registering && !inviteToken && (
              <div className="auth-dark-field">
                <input
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="请输入组织名称（如：星河短剧工作室）"
                  maxLength={80}
                  required
                />
              </div>
            )}

            <div className="auth-dark-field">
              <Mail size={15} className="auth-field-icon" />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="请输入邮箱"
                required
              />
            </div>

            <div className="auth-dark-field">
              <LockKeyhole size={15} className="auth-field-icon" />
              <input
                type={showPwd ? 'text' : 'password'}
                autoComplete={registering ? 'new-password' : 'current-password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={registering ? '请设置密码（至少 10 位）' : '请输入密码'}
                minLength={registering ? 10 : undefined}
                maxLength={128}
                required
              />
              <button
                type="button"
                className="auth-pwd-toggle"
                onClick={() => setShowPwd(v => !v)}
                aria-label={showPwd ? '隐藏密码' : '显示密码'}
              >
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {error && <p className="auth-dark-error" role="alert">{error}</p>}

            <button className="auth-dark-submit" type="submit" disabled={busy || !canSubmit}>
              {busy ? '请稍候…' : inviteToken ? '接受邀请并登录' : registering ? '注册并创建组织' : '登录'}
            </button>
          </form>

          {!inviteToken && (
            <>
              <div className="auth-divider"><span>其他方式</span></div>
              <div className="auth-mode-switch">
                <button
                  type="button"
                  className={!registering ? 'is-active' : ''}
                  onClick={() => { setRegistering(false); setError(''); }}
                >
                  邮箱密码登录
                </button>
                <button
                  type="button"
                  className={registering ? 'is-active' : ''}
                  onClick={() => { setRegistering(true); setError(''); }}
                >
                  创建新组织
                </button>
              </div>
            </>
          )}

          <label className="auth-agree">
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
            <span>已阅读并同意 <em>用户服务协议</em>、<em>隐私政策</em>、<em>AI功能使用须知</em></span>
          </label>
        </div>
      </section>
    </main>
  );
}
