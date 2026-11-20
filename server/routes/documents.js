import { Router } from 'express';
import { llm } from '../llm.js';
import {
  countDocuments,
  createDocument,
  dailyTaskSeries,
  getDocument,
  listDocuments,
  patchDocument,
  removeDocument,
  stats as taskStats,
} from '../db.js';

const router = Router();

// 允许的文档类型
const KINDS = new Set(['scripts', 'projects', 'canvases', 'breakdowns', 'messages', 'assets']);

const requireKind = (req, res, next) => {
  const { kind } = req.params;
  if (!KINDS.has(kind)) return res.status(404).json({ error: `不支持的资源类型：${kind}` });
  next();
  return undefined;
};

/* ===== 剧本：带字数 / 分镜统计 ===== */
function countScenes(text) {
  if (!text) return 0;
  const byHeading = text
    .split(/\n(?=\s*(?:第[一二三四五六七八九十百零两\d]+[幕场集回]|场景\s*\d+|SCENE\s*\d+))/i)
    .filter(part => part.trim());
  if (byHeading.length > 1) return byHeading.length;
  const blocks = text.split(/\n\s*\n/).filter(block => block.trim());
  return Math.max(1, Math.min(blocks.length, 99));
}

router.post('/scripts', (req, res) => {
  const { title, source = '原创', text = '', fileName = '', projectId = null } = req.body || {};
  if (projectId && getDocument(projectId)?.kind !== 'projects') return res.status(404).json({ error: '项目不存在' });
  const content = String(text);
  if (!content.trim() && !fileName) {
    return res.status(400).json({ error: '剧本文本不能为空' });
  }
  if (content.length > 200000) {
    return res.status(400).json({ error: '单本剧本不能超过 20 万字' });
  }
  const name = String(title || fileName.replace(/\.[^.]+$/, '') || '未命名剧本').slice(0, 80);
  const script = createDocument('scripts', {
    title: name,
    source,
    fileName,
    chars: content.replace(/\s+/g, '').length,
    scenes: countScenes(content),
    excerpt: content.trim() ? content.replace(/\s+/g, ' ').slice(0, 72) : '文件已上传，正在自动切分镜。',
    content: content.slice(0, 200000),
    projectId,
  });
  return res.status(201).json(script);
});

router.get('/scripts', (req, res) => {
  const items = listDocuments('scripts');
  res.json({ items: req.query.projectId ? items.filter(item => item.projectId === req.query.projectId) : items });
});

/* ===== 智能体：存对话；配置了方舟就用豆包真回复，否则模板兜底 ===== */
const buildReply = (skill, text) => [
  `收到，我按「${skill}」的思路拆一下：${text}`,
  '',
  '1. 先把场景、人物关系和情绪落点定清楚；',
  '2. 给你两到三个可执行的方案，各带画面与节奏说明；',
  '3. 你选定后，我直接产出分镜表与出片提示词。',
  '',
  '要不要我先出第一版？',
].join('\n');

const SKILL_HINTS = {
  '选角Casting': '你是选角导演，擅长按气质、年龄、戏份给出演员画像与适配理由。',
  '是枝裕和电影美学': '你熟悉是枝裕和的日常写实美学：克制、留白、生活肌理。',
  '电影质感画面专业生成': '你擅长把一句大白话扩写成电影级出片提示词。',
  'AI电影镜头设计师': '你擅长景别、机位、运镜与镜头语言设计。',
};

router.get('/agent/messages', (req, res) => {
  const skill = typeof req.query.skill === 'string' ? req.query.skill : '';
  const items = listDocuments('messages', 200)
    .filter(item => !skill || item.skill === skill)
    .sort((a, b) => a.createdAt - b.createdAt);
  res.json({ items });
});

router.post('/agent/messages', async (req, res) => {
  const { skill = '通用技能', text } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: '内容不能为空' });
  }

  // 先取历史，再落库，避免自己的消息重复进上下文
  const history = listDocuments('messages', 60)
    .filter(item => item.skill === skill)
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(-8)
    .map(item => ({ role: item.role === 'user' ? 'user' : 'assistant', content: item.text }));

  const user = createDocument('messages', { skill, role: 'user', text: text.trim() });

  let replyText = buildReply(skill, text.trim());
  let model = null;
  if (llm.isEnabled()) {
    try {
      const result = await llm.chat([
        {
          role: 'system',
          content: `${SKILL_HINTS[skill] || `你是「${skill}」方向的专业创作助手。`}` +
            '回答要具体、可执行，中文，控制在 200 字以内，必要时给 2-3 条建议。',
        },
        ...history,
        { role: 'user', content: text.trim() },
      ], { maxTokens: 600, temperature: 0.8, kind: 'agent' });
      if (result.text) {
        replyText = result.text;
        model = result.model;
      }
    } catch (error) {
      replyText = `${buildReply(skill, text.trim())}\n\n（模型调用失败，已回退模板：${error.message}）`;
    }
  }

  const reply = createDocument('messages', { skill, role: 'agent', text: replyText, model });
  return res.status(201).json({ user, reply });
});

/* ===== 生产报表 ===== */
router.get('/report', (req, res) => {
  const days = Math.min(90, Math.max(1, Number(req.query.days) || 30));
  const series = dailyTaskSeries(days);
  const totals = {
    ...taskStats(),
    scripts: countDocuments('scripts'),
    breakdowns: countDocuments('breakdowns'),
    projects: countDocuments('projects'),
    canvases: countDocuments('canvases'),
    messages: countDocuments('messages'),
  };
  const sum = key => series.reduce((total, item) => total + item[key], 0);
  res.json({ days, series, totals, inRange: { tasks: sum('tasks'), done: sum('done'), failed: sum('failed'), scripts: sum('scripts') } });
});

/* ===== 通用文档 CRUD ===== */
router.get('/documents/:kind', requireKind, (req, res) => {
  const items = listDocuments(req.params.kind);
  res.json({ items: req.query.projectId ? items.filter(item => item.projectId === req.query.projectId) : items });
});

router.get('/documents/:kind/:id', requireKind, (req, res) => {
  const doc = getDocument(req.params.id);
  if (!doc || doc.kind !== req.params.kind) return res.status(404).json({ error: '记录不存在' });
  return res.json(doc);
});

router.post('/documents/:kind', requireKind, (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  if (body.projectId && getDocument(body.projectId)?.kind !== 'projects') return res.status(404).json({ error: '项目不存在' });
  res.status(201).json(createDocument(req.params.kind, body));
});

router.patch('/documents/:kind/:id', requireKind, (req, res) => {
  const current = getDocument(req.params.id);
  if (!current || current.kind !== req.params.kind) return res.status(404).json({ error: '记录不存在' });
  if (req.body?.projectId && getDocument(req.body.projectId)?.kind !== 'projects') return res.status(404).json({ error: '项目不存在' });
  return res.json(patchDocument(req.params.id, req.body || {}));
});

router.delete('/documents/:kind/:id', requireKind, (req, res) => {
  const current = getDocument(req.params.id);
  if (!current || current.kind !== req.params.kind) return res.status(404).json({ error: '记录不存在' });
  removeDocument(req.params.id);
  res.status(204).end();
});

export default router;
