import { Router } from 'express';
import { getDocument, patchDocument } from '../db.js';
import { llm } from '../llm.js';

const router = Router();

const disabled = res => res.status(503).json({
  error: 'LLM 未启用：在 server/.env 里设置 LLM_PROVIDER=ark 并填 ARK_API_KEY',
});

/* 通用对话：前端需要时可直接调用 */
router.post('/ai/chat', async (req, res) => {
  const { messages, json = false } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages 不能为空' });
  }
  if (!llm.isEnabled()) return disabled(res);
  try {
    const result = await llm.chat(messages.slice(-12), { json, maxTokens: 1200, kind: 'chat' });
    return res.json(result);
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
});

/* 剧本 → 分镜：豆包输出结构化 JSON，写回 documents(scripts) */
router.post('/scripts/:id/split', async (req, res) => {
  const doc = getDocument(req.params.id);
  if (!doc || doc.kind !== 'scripts') return res.status(404).json({ error: '剧本不存在' });
  if (!llm.isEnabled()) return disabled(res);

  const content = (doc.content || '').slice(0, 8000);
  if (!content.trim()) {
    return res.status(400).json({ error: '这本剧本没有正文，无法拆分镜（.docx 解析还未接入）' });
  }

  try {
    const { data, usage, model } = await llm.chatJson([
      {
        role: 'system',
        content: '你是短剧/漫剧的分镜师。把剧本拆成可直接出片的分镜，只输出 JSON，不要解释。',
      },
      {
        role: 'user',
        content: `剧本标题：${doc.title}\n\n正文：\n${content}\n\n` +
          '请输出 JSON：{"shots":[{"no":1,"scene":"场次","summary":"这一镜发生什么","prompt":"出片提示词(中文,含景别/光线/镜头运动)","duration":3}]}。' +
          '要求 6-16 个分镜，duration 取 3/5/8 之一，prompt 具体可执行。',
      },
    ], { maxTokens: 2200, temperature: 0.5, kind: 'script_split' });

    const shots = Array.isArray(data?.shots) ? data.shots.slice(0, 24).map((shot, index) => ({
      no: Number(shot.no) || index + 1,
      scene: String(shot.scene || '').slice(0, 40),
      summary: String(shot.summary || '').slice(0, 80),
      prompt: String(shot.prompt || '').slice(0, 300),
      duration: [3, 5, 8].includes(Number(shot.duration)) ? Number(shot.duration) : 5,
    })) : [];

    if (!shots.length) throw new Error('模型没有返回可用的 shots');

    const updated = patchDocument(doc.id, {
      shots,
      scenes: shots.length,
      splitStatus: 'done',
      splitModel: model,
    });
    return res.json({ ...updated, usage });
  } catch (error) {
    patchDocument(doc.id, { splitStatus: 'failed' });
    return res.status(502).json({ error: `拆分镜失败：${error.message}` });
  }
});

/* 拆解记录 → 分析要点 */
router.post('/breakdowns/:id/analyze', async (req, res) => {
  const doc = getDocument(req.params.id);
  if (!doc || doc.kind !== 'breakdowns') return res.status(404).json({ error: '拆解记录不存在' });
  if (!llm.isEnabled()) return disabled(res);

  try {
    const { data, model } = await llm.chatJson([
      {
        role: 'system',
        content: '你是短剧爆款拆解专家。基于给定信息，分析原片的叙事结构与可复用套路。只输出 JSON。',
      },
      {
        role: 'user',
        content: `对标片：${doc.fileName || doc.name}\n改编档位：${doc.tier}\n目标画幅：${doc.ratio}\n改编备注：${doc.note || '无'}\n\n` +
          '输出 JSON：{"formula":"一句话爆款公式","points":["要点1","要点2","要点3","要点4"],"suggestion":"给创作的一句建议"}。' +
          'points 要具体到镜头/节奏/情绪，不要空话。',
      },
    ], { maxTokens: 900, temperature: 0.7, kind: 'breakdown' });

    const insights = {
      formula: String(data?.formula || '').slice(0, 120),
      points: Array.isArray(data?.points) ? data.points.slice(0, 6).map(point => String(point).slice(0, 160)) : [],
      suggestion: String(data?.suggestion || '').slice(0, 160),
      model,
    };
    return res.json(patchDocument(doc.id, { insights }));
  } catch (error) {
    return res.status(502).json({ error: `分析失败：${error.message}` });
  }
});

/* 提示词改写：AI 对话里“改提示词/补充”的落地接口。
   - llm 启用时：模型输出清洗后的新提示词（JSON）
   - 未启用时：规则兜底，避免把用户口语原样拼进提示词 */
router.post('/ai/rewrite-prompt', async (req, res) => {
  const { current = '', instruction = '', context = {} } = req.body || {};
  const ins = String(instruction || '').trim();
  if (!ins) return res.status(400).json({ error: 'instruction 不能为空' });

  const norm = s => String(s || '').replace(/[\s，,。；;、]/g, '');
  const base = String(current || '');

  // 规则兜底：判断是否像“改提示词”的请求
  const looksModify = /(改成|改为|换成|替换|去掉|删除|加|增加|补|背景|颜色|光线|风格|更亮|更暗|更|太|不要|变成|把|画幅|构图|镜头|优化|修正)/.test(ins)
    && !/(不变|原样|无需修改|不用改|不要改|维持原|保持原)/.test(ins);

  const ruleRewrite = () => {
    let after = base;
    const notes = [];
    if (/背景/.test(ins) && /(黑|暗|过暗|太黑)/.test(ins)) {
      after = after.replace(/?\s*暗调剪影感/g, '').replace(/[，,]?\s*$/, '');
      after = `${after}；浅灰纯色背景，均匀明亮布光，背景避免过暗`;
      notes.push('背景改为浅灰纯色、均匀布光');
    }
    if (!notes.length && /(更暗|压暗|暗部)/.test(ins)) {
      after = `${after}；低照度，暗部压低`;
      notes.push('整体压暗');
    }
    if (/(胶片|颗粒|35mm)/i.test(ins) && !/胶片|颗粒/.test(after)) {
      after = `${after}；35mm 胶片颗粒`;
      notes.push('增加胶片颗粒');
    }
    if (!notes.length) {
      const clean = ins.replace(/帮我|帮忙|请|麻烦|改一下|改改|修改|调整|一下|的?提示词|把|这个|这句|背景/g, '').trim();
      after = base ? `${base}；${clean || ins}` : (clean || ins);
      notes.push('追加要求');
    }
    const cleaned = after.replace(/，{2,}/g, '，').replace(/；{2,}/g, '；').replace(/^[；，,\s]+/, '');
    return { after: cleaned, changed: norm(cleaned) !== norm(base), summary: `已按你的要求调整：${notes.join('；')}。` };
  };

  if (!llm.isEnabled()) {
    if (looksModify) {
      const r = ruleRewrite();
      return res.json({ action: 'modify_prompt', after: r.after, changed: r.changed, summary: r.summary, model: 'mock' });
    }
    return res.json({ action: 'reply', reply: '收到。要改提示词可以直接说，例如「把背景改成深灰」。', model: 'mock' });
  }

  try {
    const { data } = await llm.chatJson([
      { role: 'system', content: '你是创作工作台的助手，可按需调用一个工具。判断用户意图，只输出 JSON：\n- 若用户要求修改/优化提示词（背景、颜色、光线、风格、构图、增删元素等），返回 {"action":"modify_prompt","after":"改写后的完整提示词","summary":"一句话说明"}\n- 否则（闲聊、确认、提问、表示保持不变等），返回 {"action":"reply","reply":"自然、简短的中文回复"}\n要求：after 只能是指示词本身，绝不能包含“阶段/对象”等说明；不要复述用户指令；不要保留“帮我改一下”等口语。' },
      { role: 'user', content: `当前提示词：${base.slice(0, 600)}\n用户指令：${ins.slice(0, 300)}` },
    ], { maxTokens: 600, temperature: 0.4, kind: 'prompt_rewrite' });

    if (data?.action === 'modify_prompt' && data.after) {
      const after = String(data.after).trim().slice(0, 800);
      return res.json({ action: 'modify_prompt', after, changed: norm(after) !== norm(base), summary: String(data.summary || '已生成修订建议。').slice(0, 160) });
    }
    return res.json({ action: 'reply', reply: String(data?.reply || data?.summary || '好的，收到。').slice(0, 300) });
  } catch (error) {
    if (looksModify) {
      const r = ruleRewrite();
      return res.json({ action: 'modify_prompt', after: r.after, changed: r.changed, summary: r.summary, model: 'mock', warning: error.message });
    }
    return res.json({ action: 'reply', reply: '好的，收到。', model: 'mock', warning: error.message });
  }
});

export default router;
