import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// 有 .env 就加载（Node 20.12+ 内置能力，不引 dotenv）
const envFile = join(here, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

export const config = {
  port: Number(process.env.PORT || 3001),
  superadminEmails: (process.env.SUPERADMIN_EMAILS || '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean),
  // mock: 不依赖凭证；jimeng: 火山智能视觉（AK/SK 签名）；ark: 方舟（Bearer Key）
  provider: (process.env.MEDIA_PROVIDER || process.env.JIMENG_PROVIDER || 'mock').toLowerCase(),
  // mock: 模板回复；ark: 豆包真模型
  llmProvider: (process.env.LLM_PROVIDER || 'mock').toLowerCase(),
  uploadDir: join(here, 'uploads'),
  dataDir: join(here, 'data'),
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS || 1200),
  taskTimeoutMs: Number(process.env.TASK_TIMEOUT_MS || 15 * 60 * 1000),
  maxAttempts: Number(process.env.MAX_ATTEMPTS || 3),
  // 积分定价：1 积分折合多少人民币。用于把真实成本换算成消耗积分。
  // 默认对齐一张 Seedream 图（¥0.12），所以图片任务正好 1 分。
  creditCny: Number(process.env.CREDIT_CNY || 0.12),
  jimeng: {
    ak: process.env.VOLC_ACCESS_KEY || '',
    sk: process.env.VOLC_SECRET_KEY || '',
    host: 'visual.volcengineapi.com',
    region: 'cn-north-1',
    service: 'cv',
    version: '2022-08-31',
    reqKeys: {
      image: process.env.JIMENG_REQ_KEY_IMAGE || 'jimeng_t2i_v40',
      video: process.env.JIMENG_REQ_KEY_VIDEO || 'jimeng_t2v_v30',
    },
  },
  // 火山方舟：豆包 LLM + Seedream 图片 + Seedance 视频，统一 Bearer Key
  ark: {
    apiKey: process.env.ARK_API_KEY || '',
    baseUrl: process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
    model: process.env.ARK_MODEL || 'doubao-seed-2-1-pro-260915',
    imageModel: process.env.ARK_IMAGE_MODEL || 'doubao-seedream-5-5-261028',
    videoModel: process.env.ARK_VIDEO_MODEL || 'doubao-seedance-1-0-pro-250528',
    timeoutMs: Number(process.env.ARK_TIMEOUT_MS || 60000),
    // 豆包默认会开深度思考，出片/聊天场景关掉更快更便宜
    disableThinking: (process.env.ARK_THINKING || 'disabled') !== 'enabled',
    // 价格（元）：文本按百万 tokens，图片按张，视频按百万 tokens（不含视频输入）
    price: {
      llmInput: Number(process.env.ARK_PRICE_LLM_INPUT || 0.8),
      llmOutput: Number(process.env.ARK_PRICE_LLM_OUTPUT || 2.7),
      image: Number(process.env.ARK_PRICE_IMAGE || 0.12),
      video: Number(process.env.ARK_PRICE_VIDEO || 46),
    },
  },
};

export const pageSize = 20;
