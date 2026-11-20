import express from 'express';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { canAccessFile, getSession, stats } from './db.js';
import { inOrg } from './org-context.js';
import { inUser } from './user-context.js';
import { providerFallback, providerInfo } from './providers/index.js';
import { startPoller } from './poller.js';
import tasksRouter from './routes/tasks.js';
import documentsRouter from './routes/documents.js';
import aiRouter from './routes/ai.js';
import tracingRouter from './routes/tracing.js';
import distributeRouter from './routes/distribute.js';
import pipelineRouter, { ffmpegAvailable } from './routes/pipeline.js';
import authRouter from './routes/auth.js';
import platformRouter from './routes/platform.js';
import platformUsersRouter from './routes/platform-users.js';
import orgUsageRouter from './routes/org-usage.js';
import quotaRouter from './routes/quota.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// 请求日志：带 request id 与耗时，排查上游问题全靠它
app.use((req, res, next) => {
  const startedAt = Date.now();
  req.requestId = randomUUID().slice(0, 8);
  res.setHeader('X-Request-Id', req.requestId);
  res.on('finish', () => {
    // eslint-disable-next-line no-console
    console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms #${req.requestId}`);
  });
  next();
});

// 用户和 Org 由服务端会话确定，客户端不能提交 org_id。
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || ['/auth/register', '/auth/login', '/auth/accept-invite'].includes(req.path)) return next();
  const cookie = (req.headers.cookie || '').split('; ').find(value => value.startsWith('huimeng_session='))?.slice('huimeng_session='.length);
  const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '') || cookie;
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: '请先登录' });
  req.user = session.user;
  req.role = session.role;
  req.org = session.org;
  // 暂停/试用到期/归档的组织冻结业务接口（superadmin 代管不受限）
  const lockedStatus = ['suspended', 'expired', 'archived'];
  if (lockedStatus.includes(session.org.status) && session.role !== 'superadmin') {
    const reason = {
      suspended: '该组织已暂停使用，请联系平台管理员',
      expired: '该组织试用已到期，请联系平台管理员续费或升级套餐',
      archived: '该组织已归档，如需恢复请联系平台管理员',
    }[session.org.status];
    return res.status(403).json({ error: reason, orgStatus: session.org.status });
  }
  if (req.path.startsWith('/files/')) {
    const name = decodeURIComponent(req.path.slice('/files/'.length));
    if (name.includes('/') || name.includes('\\') || !canAccessFile(name, session.org.id, session.user.id, session.role)) return res.status(404).json({ error: '文件不存在' });
  }
  return inOrg(session.org.id, () => inUser(session.user.id, session.role, next));
});

app.get('/api/health', (req, res) => res.json({
  ok: true,
  provider: providerInfo().name,
  version: '1.0.0',
  uptime: Number(process.uptime().toFixed(1)),
}));

app.use('/api', authRouter);
app.use('/api', platformRouter);
app.use('/api', platformUsersRouter);
app.use('/api', orgUsageRouter);
app.use('/api', quotaRouter);

app.get('/api/config', (req, res) => res.json({
  provider: providerInfo(),
  supportedTypes: ['image', 'video'],
  capabilities: { ffmpeg: ffmpegAvailable },
  pollIntervalMs: config.pollIntervalMs,
  taskTimeoutMs: config.taskTimeoutMs,
}));

app.get('/api/stats', (req, res) => res.json(stats()));

app.use('/api', tasksRouter);
app.use('/api', documentsRouter);
app.use('/api', aiRouter);
app.use('/api', tracingRouter);
app.use('/api', distributeRouter);
app.use('/api', pipelineRouter);

// 产物静态目录：前端 <img src="/api/files/xxx.svg"> 直接能显示
app.use('/api/files', express.static(config.uploadDir, { maxAge: '1h', fallthrough: false }));

app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));

// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error('[api] 未处理异常', error);
  res.status(error.status || 500).json({ error: error.message || '服务器内部错误' });
});

startPoller();

app.listen(config.port, '127.0.0.1', () => {
  const info = providerInfo();
  // eslint-disable-next-line no-console
  console.log(`[server] http://127.0.0.1:${config.port}  provider=${info.name}`);
  if (providerFallback) console.warn(`[server] ${providerFallback}`);
  if (info.llm && info.llm.provider === 'ark' && !info.llm.enabled) {
    console.warn('[server] LLM_PROVIDER=ark 但缺少 ARK_API_KEY，智能体/拆分镜会退回模板');
  }
  if (info.name === 'jimeng' && !info.configured) {
    console.warn('[server] JIMENG_PROVIDER=jimeng 但缺少 VOLC_ACCESS_KEY / VOLC_SECRET_KEY，任务会一直失败');
  }
});
