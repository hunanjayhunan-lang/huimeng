/**
 * 把工作台演示项目「雨巷迷踪」的内容落库：
 *  1. 把 src/assets 下相关图片复制到 server/uploads，并登记 file_owners
 *  2. 以 id=proj-rain-alley 写入 documents(kind=projects)，
 *     data 里包含项目卡字段 + metadata / script / breakdown / assets / shots 快照
 *
 * 内容来源：动态 import 一份「去掉图片 import 的 workspaceDemo.js」，
 * 把图片标识符替换成 /api/files/<name> 字符串，避免重复抄写大段文本。
 *
 * 用法：node scripts/seed-workspace.mjs
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const uploadDir = join(root, 'server', 'uploads');
const assetsDir = join(root, 'src', 'assets');
const dbPath = join(root, 'server', 'data', 'tasks.db');
mkdirSync(uploadDir, { recursive: true });
if (!existsSync(dbPath)) {
  console.error(`找不到数据库：${dbPath}\n请先启动一次后端。`);
  process.exit(1);
}

// 图片标识符 → { 源文件, 上传名 }
const IMAGES = {
  charSuwan: { file: 'people/suwan-new.png', name: 'ws-char-suwan.png' },
  charShenyan: { file: 'people/shenyan-new.png', name: 'ws-char-shenyan.png' },
  charMystery: { file: 'people/mystery-new.webp', name: 'ws-char-mystery.webp' },
  sceneRainAlley: { file: 'assets/scene-rain-alley-new.webp', name: 'ws-scene-rain-alley.webp' },
  sceneHerbShop: { file: 'assets/scene-herb-shop-new.webp', name: 'ws-scene-herb-shop.webp' },
  sceneRooftopDusk: { file: 'assets/scene-rooftop-dusk-new.webp', name: 'ws-scene-rooftop-dusk.webp' },
  sceneLanternMarket: { file: 'assets/scene-lantern-market.jpg', name: 'ws-scene-lantern-market.jpg' },
  sceneMountainCave: { file: 'assets/scene-mountain-cave.jpg', name: 'ws-scene-mountain-cave.jpg' },
  sceneWarehouse: { file: 'assets/scene-warehouse.jpg', name: 'ws-scene-warehouse.jpg' },
  propPocketWatch: { file: 'assets/prop-pocket-watch-new.jpg', name: 'ws-prop-pocket-watch.jpg' },
  propBrassKey: { file: 'assets/prop-brass-key-new.webp', name: 'ws-prop-brass-key.webp' },
  propOldPhoto: { file: 'assets/prop-old-photo-new.webp', name: 'ws-prop-old-photo.webp' },
};

// 1) 复制图片
let copied = 0;
for (const { file, name } of Object.values(IMAGES)) {
  const src = join(assetsDir, file);
  if (!existsSync(src)) { console.error('缺图:', src); process.exit(1); }
  copyFileSync(src, join(uploadDir, name));
  copied += 1;
}

// 2) 构造内容快照：把 demo 模块的图片 import 去掉，改用 /api/files URL 常量
let source = readFileSync(join(root, 'src', 'pages', 'workspaceDemo.js'), 'utf8');
source = source.replace(/^import[^\n]*\n/gm, '');
const constLines = Object.entries(IMAGES)
  .map(([id, { name }]) => `const ${id} = ${JSON.stringify('/api/files/' + name)};`)
  .join('\n');
const mod = await import('data:text/javascript;base64,' + Buffer.from(`${constLines}\n${source}`, 'utf8').toString('base64'));
const { PROJECT_METADATA, PRESET_SCRIPT, AI_SCRIPT_YAML, BREAKDOWN, ASSET_NODES, VIDEO_SHOTS } = mod;

// 3) 写库
const db = new DatabaseSync(dbPath);
const org = db.prepare("SELECT id FROM orgs WHERE name='绘梦平台'").get();
const user = db.prepare("SELECT id FROM users WHERE email='loganjian@outlook.com'").get();
if (!org || !user) { console.error('缺少组织(绘梦平台)或用户(loganjian)'); process.exit(1); }

const fo = db.prepare('INSERT OR REPLACE INTO file_owners(path,org_id,created_by) VALUES(?,?,?)');
for (const { name } of Object.values(IMAGES)) fo.run(name, org.id, user.id);

// 清掉上一轮插入的随机 id 同名项目，避免首页出现两个「雨巷迷踪」
db.prepare("DELETE FROM documents WHERE kind='projects' AND org_id=? AND json_extract(data,'$.name')=? AND id<>'proj-rain-alley'")
  .run(org.id, '《雨巷迷踪》第1季');

const d = new Date();
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const snapshot = {
  // 项目卡字段（首页 / 项目页 / 工作台 hub）
  name: '《雨巷迷踪》第1季',
  desc: '民国雨夜，女记者追查一桩失踪案，线索指向一只停走的怀表。',
  summary: '民国雨夜，女记者追查一桩失踪案，线索指向一只停走的怀表。',
  genre: '民国悬疑短剧',
  style: PROJECT_METADATA.visual_style,
  styleKey: 'noir',
  cover: '/api/files/ws-scene-rain-alley.webp',
  status: 'active',
  statusText: '进行中 · 资产图',
  stages: [true, false, false],
  stageIndex: 1,
  episode: 1,
  sessionsCount: 3,
  quotaUsed: 160,
  quotaLimit: 1000,
  updatedAt: '刚刚',
  date: today,
  type: '短剧漫剧',
  duration: '1 - 3 分钟',
  count: 3,
  channel: '绘梦中台',
  collaborators: [],
  // 工作台内容快照
  metadata: PROJECT_METADATA,
  script: { title: PRESET_SCRIPT.title, meta: PRESET_SCRIPT.meta, excerpt: PRESET_SCRIPT.excerpt, yaml: AI_SCRIPT_YAML },
  breakdown: BREAKDOWN,
  assets: ASSET_NODES,
  shots: VIDEO_SHOTS,
};

const now = Date.now();
db.prepare(`INSERT INTO documents(id,kind,data,created_at,updated_at,org_id,created_by) VALUES(?,?,?,?,?,?,?)
  ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at, org_id=excluded.org_id, created_by=excluded.created_by`)
  .run('proj-rain-alley', 'projects', JSON.stringify(snapshot), now, now, org.id, user.id);

console.log(`✔ 图片 ${copied} 张已复制到 server/uploads 并登记 file_owners`);
console.log('✔ 快照已写入 documents(id=proj-rain-alley)');
console.log(`  资产 ${ASSET_NODES.length} · 分镜 ${VIDEO_SHOTS.length} · 拆解场次 ${BREAKDOWN.scenes.length} · 角色 ${BREAKDOWN.characters.length}`);
db.close();
