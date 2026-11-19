/**
 * 演示数据 seed 脚本
 *
 * 目标：造一份能撑起演示的完整数据集——多组织、多成员、多项目、多任务、多调用。
 *
 * 设计原则——各表之间必须自洽：
 *
 * 1. 额度账
 *    org_quota_grants(period)  = 平台本月划拨给组织的额度
 *    quota_task_usage          = 每个任务预占/结算/释放的记录
 *    约束：Σsettled + Σreserved ≤ granted，否则任务创建会被 402 拒绝
 *    成员分配额度之和 ≤ granted - used - reserved（unallocated 池）
 *
 * 2. 任务
 *    tasks            = 主表，created_by 必须是该 org 的成员
 *    task_events      = 每个任务至少 submit 一条，done/failed 再补一条
 *    ai_calls         = 成功的图/视频任务各一条，task_id 指向 tasks.id
 *    quota_task_usage = 每个任务一条，done→settled，failed→released
 *    file_owners      = 有产物的任务登记一行，供 /api/files 鉴权
 *
 * 3. 文档
 *    documents(kind)  = scripts / projects / canvases / breakdowns / messages
 *    projects.stages  = 三步布尔数组，用于算进度
 *
 * 4. 账号
 *    org_members 每条必须指向真实 users；演示账号密码统一为 Demo@12345
 *
 * 用法：
 *   node scripts/seed-demo.mjs --reset     # 清空业务数据后重新生成（保留已有 orgs/users 之外的全新演示集）
 *   node scripts/seed-demo.mjs             # 只补缺失的部分
 */
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, createHash, randomBytes, scryptSync } from 'node:crypto';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dbPath = join(root, 'server', 'data', 'tasks.db');
const uploadDir = join(root, 'server', 'uploads');

if (!existsSync(dbPath)) {
  console.error(`找不到数据库：${dbPath}\n请先启动一次后端（pnpm server）让表结构建出来。`);
  process.exit(1);
}
mkdirSync(uploadDir, { recursive: true });

const reset = process.argv.includes('--reset');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON');

/* ---------------- 工具 ---------------- */

const DAY = 86400000;
const now = Date.now();
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = list => list[Math.floor(Math.random() * list.length)];
const daysAgo = days => now - Math.round(days * DAY);
const period = new Date().toISOString().slice(0, 7);

/** 演示账号统一密码 */
const DEMO_PASSWORD = 'Demo@12345';
const hashPassword = password => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
};

const png = (label, hue, size = [640, 360]) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size[0]}" height="${size[1]}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="hsl(${hue},48%,72%)"/><stop offset="100%" stop-color="hsl(${(hue + 46) % 360},44%,42%)"/>
</linearGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<text x="50%" y="50%" font-family="sans-serif" font-size="${Math.round(size[0] / 21)}" fill="#fff" text-anchor="middle" dominant-baseline="middle" opacity=".92">${label}</text>
</svg>`;
  const name = `demo-${randomUUID().slice(0, 8)}.svg`;
  writeFileSync(join(uploadDir, name), svg, 'utf8');
  return name;
};

const log = (...args) => console.log('  ', ...args);
const heading = text => console.log(`\n${text}`);

/* ---------------- 清空业务数据 ---------------- */

if (reset) {
  heading('清空业务数据…');
  for (const table of ['quota_task_usage', 'org_quota_grants', 'member_quota_allocations', 'ai_calls', 'task_events', 'file_owners', 'tasks', 'documents', 'org_audit_logs', 'org_invites']) {
    db.prepare(`DELETE FROM ${table}`).run();
  }
  // 清掉之前 seed 生成的演示账号（保留真实注册账号）
  const demoUsers = db.prepare("SELECT id, email FROM users WHERE email LIKE '%@demo.local' OR email LIKE '%@huimeng.demo'").all();
  for (const user of demoUsers) {
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
    db.prepare('DELETE FROM org_members WHERE user_id=?').run(user.id);
    db.prepare('DELETE FROM users WHERE id=?').run(user.id);
  }
  // 清掉之前生成的演示组织
  const demoOrgs = db.prepare(`SELECT o.id FROM orgs o
    WHERE o.id != 'bootstrap' AND NOT EXISTS (SELECT 1 FROM org_members m WHERE m.org_id = o.id)`).all();
  for (const org of demoOrgs) db.prepare('DELETE FROM orgs WHERE id=?').run(org.id);
  log(`清理 ${demoUsers.length} 个演示账号 / ${demoOrgs.length} 个空组织`);
}

/* ---------------- 1. 组织与成员 ---------------- */

/**
 * 演示组织定义。
 * adminEmail 若已存在于 users，则直接挂为管理员；否则创建新账号。
 */
const ORG_SPECS = [
  {
    name: '绘梦平台',
    quota: 60000,
    members: [
      { email: 'loganjian@outlook.com', role: 'org.admin', keep: true }, // 真实账号，不重建
      { email: 'lin.xiaoyu@huimeng.demo', role: 'org.admin', name: '林小雨' },
      { email: 'chen.yiming@huimeng.demo', role: 'org.user', name: '陈一鸣' },
      { email: 'zhao.qi@huimeng.demo', role: 'org.user', name: '赵琪' },
      { email: 'wang.hao@huimeng.demo', role: 'org.user', name: '王浩' },
      { email: 'liu.siyu@huimeng.demo', role: 'org.user', name: '刘思雨' },
      { email: 'sun.yue@huimeng.demo', role: 'org.user', name: '孙悦' },
    ],
  },
  {
    name: '大炮文化',
    quota: 36000,
    members: [
      { email: 'hunanjayhunan@gmail.com', role: 'org.admin', keep: true }, // 真实账号
      { email: 'admin@dapao.demo', role: 'org.admin', name: '周正' },
      { email: 'producer@dapao.demo', role: 'org.user', name: '吴敏' },
      { email: 'editor@dapao.demo', role: 'org.user', name: '郑凯' },
      { email: 'artist@dapao.demo', role: 'org.user', name: '何雨桐' },
    ],
  },
  {
    name: '星河影业',
    quota: 28000,
    members: [
      { email: 'owner@xinghe.demo', role: 'org.admin', name: '徐文博' },
      { email: 'director@xinghe.demo', role: 'org.admin', name: '马丽' },
      { email: 'producer@xinghe.demo', role: 'org.user', name: '郭涛' },
      { email: 'dop@xinghe.demo', role: 'org.user', name: '林晓' },
    ],
  },
  {
    name: '山海工作室',
    quota: 10000,
    status: 'suspended',
    members: [
      { email: 'owner@shanhai.demo', role: 'org.admin', name: '崔野' },
      { email: 'designer@shanhai.demo', role: 'org.user', name: '曲静' },
    ],
  },
  {
    name: '青鸟动画',
    quota: 12000,
    members: [
      { email: 'lead@qingniao.demo', role: 'org.admin', name: '曾黎' },
      { email: 'anim@qingniao.demo', role: 'org.user', name: '田甜' },
      { email: 'intern@qingniao.demo', role: 'org.user', name: '沈括' },
    ],
  },
];

const findUserByEmail = email => db.prepare('SELECT id, email FROM users WHERE lower(email)=lower(?)').get(email);
const createUser = (email, passwordHash, createdAt) => {
  const id = randomUUID();
  db.prepare('INSERT INTO users(id,email,password_hash,created_at) VALUES(?,?,?,?)').run(id, email.toLowerCase(), passwordHash, createdAt);
  return id;
};

const createdOrgs = [];

heading('创建组织与成员…');
for (const [orgIndex, spec] of ORG_SPECS.entries()) {
  let org = db.prepare("SELECT id, name, status FROM orgs WHERE name = ? AND id != 'bootstrap'").get(spec.name);
  const orgCreatedAt = daysAgo(120 - orgIndex * 15);

  if (!org) {
    const id = randomUUID();
    db.prepare("INSERT INTO orgs(id,name,status,created_at) VALUES(?,?,?,?)")
      .run(id, spec.name, spec.status || 'active', orgCreatedAt);
    org = { id, name: spec.name, status: spec.status || 'active' };
    log(`组织 +${spec.name}`);
  } else {
    db.prepare('UPDATE orgs SET status=? WHERE id=?').run(spec.status || 'active', org.id);
    log(`组织 =${spec.name}（已存在）`);
  }

  const members = [];
  for (const [memberIndex, member] of spec.members.entries()) {
    const joinedAt = orgCreatedAt + (memberIndex + 1) * DAY * 3;
    let user = findUserByEmail(member.email);

    if (!user) {
      const id = createUser(member.email, hashPassword(DEMO_PASSWORD), joinedAt);
      user = { id, email: member.email.toLowerCase() };
      db.prepare('INSERT INTO users(status) VALUES(?)').run; // noop guard
      db.prepare('UPDATE users SET last_login_at=?, last_seen_at=? WHERE id=?')
        .run(daysAgo(rnd(0, 12)), daysAgo(rnd(0, 3)), id);
      log(`  成员 +${member.email}（${member.name}）`);
    }

    const exists = db.prepare('SELECT 1 FROM org_members WHERE org_id=? AND user_id=?').get(org.id, user.id);
    if (!exists) {
      db.prepare('INSERT INTO org_members(org_id,user_id,role,created_at) VALUES(?,?,?,?)')
        .run(org.id, user.id, member.role, joinedAt);
    } else {
      db.prepare('UPDATE org_members SET role=? WHERE org_id=? AND user_id=?').run(member.role, org.id, user.id);
    }

    members.push({ ...user, role: member.role, name: member.name || user.email.split('@')[0], joinedAt });
  }

  createdOrgs.push({ ...org, quota: spec.quota, members, createdAt: orgCreatedAt });
}

/* ---------------- 2. 账号状态：一个停用样例 ---------------- */

const disabledDemo = db.prepare("SELECT id FROM users WHERE email='intern@qingniao.demo'").get();
if (disabledDemo) db.prepare("UPDATE users SET status='disabled' WHERE id=?").run(disabledDemo.id);

/* ---------------- 3. 额度划拨与分配 ---------------- */

heading('划拨额度与成员分配…');
const superadminRow = db.prepare(`SELECT u.id FROM users u JOIN org_members m ON m.user_id=u.id WHERE u.email='loganjian@outlook.com' LIMIT 1`).get();
const platformActorId = superadminRow?.id || null;

const insertGrant = db.prepare('INSERT INTO org_quota_grants(id,org_id,period,amount,actor_user_id,created_at) VALUES(?,?,?,?,?,?)');
const insertAlloc = db.prepare(`INSERT INTO member_quota_allocations(org_id,user_id,period,amount,actor_user_id,updated_at)
  VALUES(?,?,?,?,?,?) ON CONFLICT(org_id,user_id,period) DO UPDATE SET amount=excluded.amount, updated_at=excluded.updated_at`);

for (const org of createdOrgs) {
  const existing = db.prepare('SELECT COALESCE(SUM(amount),0) AS n FROM org_quota_grants WHERE org_id=? AND period=?').get(org.id, period).n;
  if (existing > 0) db.prepare('DELETE FROM org_quota_grants WHERE org_id=? AND period=?').run(org.id, period);
  insertGrant.run(randomUUID(), org.id, period, org.quota, platformActorId, daysAgo(28));
  db.prepare('DELETE FROM member_quota_allocations WHERE org_id=? AND period=?').run(org.id, period);
  log(`${org.name} 划拨 ${org.quota} 点`);
}

/* ---------------- 4. 文档：剧本 / 项目 / 画布 / 拆解 / 对话 ---------------- */

heading('生成项目与剧本…');
const insertDoc = db.prepare('INSERT INTO documents(id,kind,data,created_at,updated_at,org_id,created_by) VALUES(?,?,?,?,?,?,?)');

const PROJECT_TEMPLATES = [
  { name: '长安夜行', episodes: 3, style: '新国风雅金，电影级质感，暖黄路灯与雨夜青石板', status: 'active', stages: [true, true, false] },
  { name: '山海来信', episodes: 2, style: '青绿山水，水墨留白，云雾缭绕', status: 'review', stages: [true, true, true] },
  { name: '雨巷来客', episodes: 2, style: '极光淡紫，赛博都市，霓虹倒影', status: 'active', stages: [true, false, false] },
  { name: '天台日落', episodes: 1, style: '暖橙色调，写实胶片，城市天台', status: 'active', stages: [false, false, false] },
];

const SCRIPT_TEMPLATES = [
  { title: '雨夜巷口', content: '雨夜，长安城的旧巷口。女主握着一把油纸伞回头，灯影在积水里晃。远处马蹄声由远及近。她低声说：「你终于来了。」', shots: 5, scenes: 2 },
  { title: '云海扁舟', content: '青绿山水间，一叶扁舟。少年展开一封信，墨迹被雨水晕开。画外音：山高水长，信到人归。', shots: 4, scenes: 1 },
  { title: '霓虹来客', content: '霓虹倒影的窄巷，穿风衣的陌生人靠在墙边点烟。女主从便利店出来，两人视线交错。', shots: 6, scenes: 3 },
  { title: '天台最后一日', content: '城市天台，夕阳把玻璃幕墙染成橙色。两个年轻人背对镜头坐着，脚边是喝完的汽水罐。', shots: 3, scenes: 1 },
  { title: '灯笼连城', content: '长安城楼上，灯笼一盏接一盏亮起，从城头一直铺到护城河边。远处传来更鼓。', shots: 5, scenes: 2 },
  { title: '定妆初版', content: '女主素色襦裙立于窗前，晨光斜照。她抬手拢了拢鬓角，眼神落在远处。', shots: 2, scenes: 1 },
];

/** 每个组织产出的项目 / 剧本数量，按组织规模递减 */
const ORG_SCALE = { 绘梦平台: 1, 大炮文化: 0.8, 星河影业: 0.6, 山海工作室: 0.4, 青鸟动画: 0.4 };

const orgProjects = new Map();
const orgScripts = new Map();

for (const [orgIndex, org] of createdOrgs.entries()) {
  const scale = ORG_SCALE[org.name] ?? 0.5;
  const admins = org.members.filter(m => m.role === 'org.admin');
  const users = org.members;
  const projectCount = Math.max(1, Math.round(PROJECT_TEMPLATES.length * scale));
  const projects = [];
  const scripts = [];

  for (let p = 0; p < projectCount; p += 1) {
    const template = PROJECT_TEMPLATES[p % PROJECT_TEMPLATES.length];
    const id = randomUUID();
    const owner = users[p % users.length];
    const createdAt = org.createdAt + p * DAY * 4 + orgIndex * DAY;
    const stages = template.stages.map((value, index) => value && (index < 3 - (p % 2)));
    insertDoc.run(id, 'projects', JSON.stringify({
      name: `${template.name} · 第 ${(p % template.episodes) + 1} 集`,
      style: template.style,
      status: template.status,
      stages,
      episode: (p % template.episodes) + 1,
      summary: `${template.name} 的创作工程，画风：${template.style}`,
      collaborators: users.slice(0, 3).map(u => u.email),
    }), createdAt, daysAgo(rnd(1, 6)), org.id, owner.id);
    projects.push({ id, name: template.name, style: template.style, ownerId: owner.id });
  }

  const scriptCount = Math.max(2, Math.round(SCRIPT_TEMPLATES.length * scale) + 1);
  for (let s = 0; s < scriptCount; s += 1) {
    const template = SCRIPT_TEMPLATES[s % SCRIPT_TEMPLATES.length];
    const id = randomUUID();
    const author = users[(s + 1) % users.length];
    const project = projects[s % projects.length];
    const createdAt = org.createdAt + s * DAY * 2 + DAY * 3;
    insertDoc.run(id, 'scripts', JSON.stringify({
      title: `${template.title}${s >= SCRIPT_TEMPLATES.length ? ` v${Math.floor(s / SCRIPT_TEMPLATES.length) + 1}` : ''}`,
      content: template.content,
      wordCount: template.content.length,
      shotCount: template.shots,
      sceneCount: template.scenes,
      summary: `${template.content.slice(0, 36)}…`,
      projectId: project.id,
      projectName: project.name,
      author: author.name,
      shots: Array.from({ length: template.shots }, (_, i) => ({
        index: i + 1,
        start: i * 3,
        end: i * 3 + 3,
        description: `${template.title} 第 ${i + 1} 镜`,
      })),
    }), createdAt, daysAgo(rnd(0, 4)), org.id, author.id);
    scripts.push({ id, title: template.title, projectId: project.id, authorId: author.id });
  }

  // 画布：每个项目一张
  for (const [pi, project] of projects.entries()) {
    const scriptId = scripts[pi % scripts.length].id;
    insertDoc.run(randomUUID(), 'canvases', JSON.stringify({
      name: `${project.name} 画布`,
      projectId: project.id,
      nodes: [
        { id: 'n1', type: 'config', x: 80, y: 80, data: { scriptId, style: project.style } },
        { id: 'n2', type: 'split', x: 320, y: 80, data: {} },
        { id: 'n3', type: 'portrait', x: 560, y: 80, data: {} },
        { id: 'n4', type: 'shots', x: 800, y: 80, data: {} },
        { id: 'n5', type: 'video', x: 1040, y: 80, data: {} },
      ],
      edges: [
        { source: 'n1', target: 'n2' },
        { source: 'n2', target: 'n3' },
        { source: 'n3', target: 'n4' },
        { source: 'n4', target: 'n5' },
      ],
    }), org.createdAt + pi * DAY, daysAgo(rnd(0, 3)), org.id, project.ownerId);
  }

  // 拆解记录
  for (const [si, script] of scripts.slice(0, Math.min(3, scripts.length)).entries()) {
    const done = si < 2;
    insertDoc.run(randomUUID(), 'breakdowns', JSON.stringify({
      title: script.title,
      scriptId: script.id,
      projectId: script.projectId,
      status: done ? 'done' : 'running',
      progress: done ? 100 : rnd(30, 70),
      insights: done ? {
        formula: pick(['慢镜头特写 + 环境音先行 + 台词留白', '冷暖对冲打光 + 三段式悬念', '空镜起手 + 人物侧脸 + 声音钩子']),
        points: ['前三秒给出冲突', '雨夜/霓虹高对比', '人物只露侧脸制造悬念'],
      } : null,
    }), org.createdAt + si * DAY * 2, daysAgo(rnd(0, 2)), org.id, script.authorId);
  }

  // 智能体对话
  const chatTurns = Math.min(6, Math.ceil(scripts.length * 1.2));
  for (let c = 0; c < chatTurns; c += 1) {
    const speaker = users[c % users.length];
    const at = org.createdAt + DAY * (10 + c);
    insertDoc.run(randomUUID(), 'messages', JSON.stringify({
      skill: pick(['script', 'shot', 'style']),
      role: 'user',
      text: pick([
        '帮我把这个开头改得更有悬念',
        '第 3 镜改成从伞下仰拍',
        '这个场景的打光再冷一点',
        '台词的语气能不能更克制',
      ]),
      projectId: projects[c % projects.length].id,
    }), at, at, org.id, speaker.id);
    insertDoc.run(randomUUID(), 'messages', JSON.stringify({
      skill: 'script',
      role: 'assistant',
      text: '好的，我按这个方向调整：强化环境音与人物微表情，第 3 镜改为仰角构图，让悬念落在视线之外。',
      projectId: projects[c % projects.length].id,
    }), at + 2400, at + 2400, org.id, speaker.id);
  }

  orgProjects.set(org.id, projects);
  orgScripts.set(org.id, scripts);
  log(`${org.name}：${projects.length} 项目 / ${scripts.length} 剧本 / ${projects.length} 画布`);
}

/* ---------------- 5. 任务 + 事件 + 调用 + 额度消费 ---------------- */

heading('生成任务与调用记录…');
const insertTask = db.prepare(`INSERT INTO tasks
  (id,type,req_key,prompt,params,status,progress,attempts,run_id,remote_task_id,project_id,result_url,local_path,error,cost_ms,created_at,updated_at,org_id,created_by,demo)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`);
const insertEvent = db.prepare('INSERT INTO task_events(id,task_id,event,detail,created_at,org_id) VALUES(?,?,?,?,?,?)');
const insertCall = db.prepare(`INSERT INTO ai_calls
  (id,kind,provider,model,task_id,prompt_tokens,completion_tokens,total_tokens,reasoning_tokens,latency_ms,status,error,meta,created_at,cost_cny,org_id,created_by)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const insertUsage = db.prepare(`INSERT INTO quota_task_usage
  (task_id,org_id,user_id,period,amount,status,created_at,settled_at,cost_cny) VALUES(?,?,?,?,?,?,?,?,?)`);
const insertFile = db.prepare('INSERT OR REPLACE INTO file_owners(path,org_id,created_by) VALUES(?,?,?)');

const PRICE = { image: 0.12, video: 46 / 1e6, llmIn: 0.8 / 1e6, llmOut: 2.7 / 1e6 };
/** 1 积分 = ¥0.12，与 server/config.js 的 creditCny 默认值一致 */
const CREDIT_CNY = 0.12;
/** LLM 调用每 1000 tokens 计 1 积分 */
const llmQuota = totalTokens => Math.max(1, Math.ceil(Number(totalTokens || 0) / 1000));

const IMAGE_PROMPTS = [
  '雨夜旧城巷口，暖黄路灯，女主握伞回头，35mm 胶片颗粒',
  '长安城楼夜景，灯笼连成一线，远景俯拍，电影级打光',
  '青绿山水，一叶扁舟浮在云海之上，水墨留白',
  '霓虹倒影的窄巷，穿风衣的陌生人侧脸点烟，赛博都市',
  '天台上的日落，玻璃幕墙反射橙色光，两个背影',
  '古风定妆照，女主正面，素色襦裙，暖光棚拍',
  '古风定妆照，男主正面，深色劲装，侧逆光',
  '雨滴特写，浅景深，青石板积水倒影',
  '竹林深处，晨雾，逆光剪影',
  '雪夜长街，红灯笼与白雪对照，中景',
  '特写：手指摩挲信纸边缘，浅景深',
  '大全景：群山叠嶂，云海翻涌，水墨质感',
];
const VIDEO_PROMPTS = [
  '镜头缓慢推近，女主撑伞回眸，雨丝在灯光下可见',
  '马蹄声由远及近，镜头横移扫过巷口',
  '扁舟在云海中缓缓前行，雾气流动',
  '霓虹灯牌闪烁，陌生人吐出一口烟',
  '灯笼依次点亮，镜头缓缓拉升',
  '风起，衣袂与发丝飘动，慢动作',
];

let imageSeq = 0;
let videoSeq = 0;
let totalTasks = 0;

/**
 * 造一条完整任务，保证 tasks / task_events / ai_calls / quota_task_usage / file_owners 互相自洽
 */
function seedTask({ org, user, projectId, type, status, createdDayAgo }) {
  const id = randomUUID();
  const isVideo = type === 'video';
  const createdAt = daysAgo(createdDayAgo);
  const quotaAmount = isVideo ? 8 : 1;
  const prompt = isVideo
    ? VIDEO_PROMPTS[videoSeq++ % VIDEO_PROMPTS.length]
    : IMAGE_PROMPTS[imageSeq++ % IMAGE_PROMPTS.length];

  const done = status === 'done';
  const failed = status === 'failed';
  const costMs = done ? rnd(4200, 38000) : failed ? rnd(1200, 9000) : null;

  const fileName = done ? png(isVideo ? '视频封面' : prompt.slice(0, 10), isVideo ? 268 : (imageSeq * 47) % 360) : null;

  // 真实成本（与后端 poller 的算法保持一致），结算时写进 quota_task_usage.cost_cny
  const mediaTokens = isVideo ? rnd(95000, 125000) : 0;
  const mediaCost = done
    ? (isVideo ? Number((mediaTokens * PRICE.video).toFixed(4)) : PRICE.image)
    : 0;
  // 结算积分：按成本换算，1 积分 = ¥0.12；无成本时回落到预占值
  const settledQuota = done && mediaCost > 0 ? Math.max(1, Math.ceil(mediaCost / CREDIT_CNY)) : quotaAmount;

  insertTask.run(
    id, type,
    isVideo ? 'jimeng_t2v_v30' : 'jimeng_t2i_v40',
    prompt,
    JSON.stringify(isVideo ? { duration: 5, ratio: '16:9', fps: 24 } : { width: 1024, height: 1024, seed: rnd(1, 999999) }),
    status,
    done ? 100 : failed ? rnd(20, 80) : rnd(10, 70),
    failed ? 3 : 1,
    null,
    done || failed ? `remote-${randomUUID().slice(0, 12)}` : null,
    projectId || null,
    fileName ? `/api/files/${fileName}` : null,
    fileName,
    failed ? (isVideo ? '上游生成超时（task_timeout）' : '上游返回内容审核不通过') : null,
    costMs,
    createdAt,
    createdAt + (costMs || 5000),
    org.id,
    user.id,
  );

  insertEvent.run(randomUUID(), id, 'submit', JSON.stringify({ provider: 'mock', reqKey: isVideo ? 'jimeng_t2v_v30' : 'jimeng_t2i_v40' }), createdAt, org.id);
  if (done || failed) {
    insertEvent.run(randomUUID(), id, 'progress', JSON.stringify({ progress: 55 }), createdAt + 1500, org.id);
    insertEvent.run(randomUUID(), id, done ? 'done' : 'failed', done ? JSON.stringify({ file: fileName }) : JSON.stringify({ error: 'upstream_failed' }), createdAt + (costMs || 4000), org.id);
    if (failed) insertEvent.run(randomUUID(), id, 'retry', JSON.stringify({ attempt: 3 }), createdAt + (costMs || 4000) + 1000, org.id);
  } else {
    insertEvent.run(randomUUID(), id, 'progress', JSON.stringify({ progress: 40 }), createdAt + 1500, org.id);
  }

  if (done) {
    if (isVideo) {
      insertCall.run(randomUUID(), 'video', 'ark', 'Doubao-Seedance-2.5-flash', id, 0, 0, mediaTokens, 0, costMs,
        'ok', null, JSON.stringify({ duration: 5, ratio: '16:9' }),
        createdAt + costMs, mediaCost, org.id, user.id);
    } else {
      insertCall.run(randomUUID(), 'image', 'ark', 'Doubao-Seedream-5.0-flash', id, 0, 0, 0, 0, costMs,
        'ok', null, JSON.stringify({ width: 1024, height: 1024 }),
        createdAt + costMs, mediaCost, org.id, user.id);
    }
  }

  insertUsage.run(id, org.id, user.id, period,
    done ? settledQuota : quotaAmount,
    done ? 'settled' : failed ? 'released' : 'reserved',
    createdAt, done ? createdAt + costMs : null,
    done ? mediaCost : 0);

  if (fileName) insertFile.run(fileName, org.id, user.id);
  totalTasks += 1;
  return { id, type, status, orgId: org.id };
}

const insertLlmCall = (org, user, kind, tokensIn, tokensOut, ms, when, meta) => {
  const totalTokens = tokensIn + tokensOut;
  const cost = Number((tokensIn * PRICE.llmIn + tokensOut * PRICE.llmOut).toFixed(6));
  const callId = randomUUID();
  insertCall.run(callId, kind, 'ark', 'Doubao-Seed-2.1-lite', null,
    tokensIn, tokensOut, totalTokens, 0, ms,
    'ok', null, JSON.stringify(meta || {}), when, cost, org.id, user.id);
  // LLM 调用也计积分：复用 quota_task_usage，task_id 存 ai_calls.id
  insertUsage.run(callId, org.id, user.id, period, llmQuota(totalTokens), 'settled', when, when, cost);
  return cost;
};

/** 每个组织的任务数量，按规模递减 */
const TASK_SCALE = { 绘梦平台: 42, 大炮文化: 26, 星河影业: 18, 山海工作室: 6, 青鸟动画: 8 };

let llmCost = 0;
const statusPool = [
  ...Array(13).fill('done'),
  ...Array(2).fill('failed'),
  ...Array(2).fill('running'),
  ...Array(1).fill('queued'),
]; // done 占 ~72%

for (const org of createdOrgs) {
  const projects = orgProjects.get(org.id) || [];
  const scripts = orgScripts.get(org.id) || [];
  const users = org.members.filter(m => !(m.email.endsWith('intern@qingniao.demo')));
  const taskCount = TASK_SCALE[org.name] ?? 8;

  for (let i = 0; i < taskCount; i += 1) {
    const user = users[i % users.length];
    const status = statusPool[i % statusPool.length];
    const type = i % 4 === 0 ? 'video' : 'image';
    // 时间分布：越近越密
    const dayAgo = (i / taskCount) * 27 + rnd(0, 2) / 10 + (status === 'running' || status === 'queued' ? 0 : 0);
    seedTask({
      org,
      user,
      projectId: projects[i % Math.max(1, projects.length)]?.id,
      type,
      status,
      createdDayAgo: status === 'running' ? 0.03 : status === 'queued' ? 0.01 : dayAgo,
    });
  }

  // LLM 调用：拆分镜 / 拆解 / 对话
  const llmCount = Math.max(2, Math.round(taskCount * 0.25));
  for (let i = 0; i < llmCount; i += 1) {
    const user = users[i % users.length];
    const kind = pick(['script_split', 'breakdown', 'chat']);
    llmCost += insertLlmCall(
      org, user, kind,
      rnd(600, 2400), rnd(300, 1300), rnd(900, 4200),
      daysAgo(rnd(0, 14)),
      kind === 'script_split' ? { scriptId: scripts[i % Math.max(1, scripts.length)]?.id } : { skill: 'script' },
    );
  }

  log(`${org.name}：${taskCount} 任务 / ${llmCount} LLM 调用`);
}

/* ---------------- 5b. 成员额度分配（任务生成后校准） ---------------- */

heading('分配成员额度…');
{
  let count = 0;
  for (const org of createdOrgs) {
    const granted = db.prepare('SELECT COALESCE(SUM(amount),0) AS n FROM org_quota_grants WHERE org_id=? AND period=?').get(org.id, period).n;
    const used = db.prepare("SELECT COALESCE(SUM(amount),0) AS n FROM quota_task_usage WHERE org_id=? AND period=? AND status='settled'").get(org.id, period).n;
    const reserved = db.prepare("SELECT COALESCE(SUM(amount),0) AS n FROM quota_task_usage WHERE org_id=? AND period=? AND status='reserved'").get(org.id, period).n;
    const available = granted - used - reserved;

    const usageByUser = new Map(
      db.prepare(`SELECT user_id,
        COALESCE(SUM(CASE WHEN status='settled' THEN amount ELSE 0 END),0) AS used,
        COALESCE(SUM(CASE WHEN status='reserved' THEN amount ELSE 0 END),0) AS reserved
        FROM quota_task_usage WHERE org_id=? AND period=? GROUP BY user_id`).all(org.id, period)
        .map(row => [row.user_id, row]),
    );

    const admins = org.members.filter(m => m.role === 'org.admin');
    const admin = admins[0] || org.members[0];
    const regulars = org.members.filter(m => m.id !== admin.id);

    // 每人先占住“自己的实际用量”，再从剩余池子里发 bonus
    // 关键：人均 bonus 必须扣掉已用的 base，否则总和会超过 available
    const baseByUser = new Map(org.members.map(m => {
      const stat = usageByUser.get(m.id);
      return [m.id, stat ? stat.used + stat.reserved : 0];
    }));
    const baseTotal = [...baseByUser.values()].reduce((a, b) => a + b, 0);
    const spare = Math.max(0, available - baseTotal);

    // 剩余池按 60/40 分给管理员与普通成员，向下取整到 10 的倍数，保证不超
    const adminBonus = Math.floor((spare * 0.6) / 10) * 10;
    const perMemberBonus = regulars.length ? Math.floor((spare * 0.4) / regulars.length / 10) * 10 : 0;

    for (const member of org.members) {
      const base = baseByUser.get(member.id) || 0;
      const bonus = member.id === admin.id ? adminBonus : perMemberBonus;
      const amount = base + bonus;
      insertAlloc.run(org.id, member.id, period, amount, admin.id, daysAgo(26));
      count += 1;
    }

    const totalAllocated = db.prepare('SELECT COALESCE(SUM(amount),0) AS n FROM member_quota_allocations WHERE org_id=? AND period=?').get(org.id, period).n;
    log(`${org.name}：${org.members.length} 人共分配 ${totalAllocated} 点（用量 base=${baseTotal}，剩余池 ${spare}）`);
  }
  log(`共 ${count} 条分配记录`);
}

/* ---------------- 5b. 标记演示任务 ---------------- */

/**
 * poller 每 1.2s 扫一次 queued/running，mock provider 按 created_at 推进，
 * 超过 4s(图) / 9s(视频) 就会立刻 done —— 演示里的“进行中”会瞬间消失。
 *
 * 处理：给所有 seed 出来的任务打上 demo=1，activeTasks() 会跳过它们，
 * 于是 queued/running 能稳定停在演示状态，时间线也保持真实。
 */
{
  const pending = db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE demo=1 AND status IN ('queued','running')").get().n;
  const total = db.prepare('SELECT COUNT(*) AS n FROM tasks WHERE demo=1').get().n;
  log(`${total} 条演示任务已标记 demo=1（其中 ${pending} 条保持进行中）`);
}

/* ---------------- 6. 审计日志 ---------------- */

heading('生成审计日志…');
const insertAudit = db.prepare('INSERT INTO org_audit_logs(id,org_id,actor_user_id,action,target,details,created_at) VALUES(?,?,?,?,?,?,?)');
let auditCount = 0;

for (const org of createdOrgs) {
  const admins = org.members.filter(m => m.role === 'org.admin');
  const actor = admins[0];
  const events = [
    { action: 'quota.org.granted', target: org.id, details: { period, amount: org.quota }, ago: 28, by: platformActorId },
    { action: 'quota.member.allocated', target: admins[1]?.email || actor.email, details: { period, from: 0, to: Math.floor(org.quota * 0.2 / 10) * 10 }, ago: 25, by: actor.id },
    { action: 'invite.created', target: `guest-${auditCount}@demo.local`, details: { role: 'org.user' }, ago: 18, by: actor.id },
    { action: 'invite.revoked', target: `guest-${auditCount}@demo.local`, details: null, ago: 16, by: actor.id },
    { action: 'organization.renamed', target: org.name, details: { from: `${org.name}（旧）`, to: org.name }, ago: 11, by: actor.id },
  ];
  if (org.members.length > 2) {
    events.push({ action: 'member.role_changed', target: org.members[2].email, details: { from: 'org.user', to: 'org.admin' }, ago: 9, by: actor.id });
    events.push({ action: 'member.role_changed', target: org.members[2].email, details: { from: 'org.admin', to: 'org.user' }, ago: 8, by: actor.id });
  }
  if (org.status === 'suspended') {
    events.push({ action: 'organization.status_changed', target: org.name, details: { from: 'active', to: 'suspended' }, ago: 3, by: platformActorId });
  }
  if (disabledDemo && org.members.some(m => m.id === disabledDemo.id)) {
    events.push({ action: 'user.disabled', target: 'intern@qingniao.demo', details: null, ago: 2, by: platformActorId });
  }

  for (const event of events) {
    insertAudit.run(randomUUID(), org.id, event.by, event.action, event.target, event.details ? JSON.stringify(event.details) : null, daysAgo(event.ago));
    auditCount += 1;
  }
}
log(`${auditCount} 条审计日志`);

/* ---------------- 7. 待接受邀请 ---------------- */

const insertInvite = db.prepare('INSERT INTO org_invites(id,org_id,email,role,token_hash,created_at,expires_at) VALUES(?,?,?,?,?,?,?)');
let inviteCount = 0;
for (const org of createdOrgs.slice(0, 3)) {
  const admin = org.members.find(m => m.role === 'org.admin');
  const token = randomBytes(24).toString('base64url');
  insertInvite.run(randomUUID(), org.id, `newhire-${org.name.length}@demo.local`, 'org.user',
    createHash('sha256').update(token).digest('hex'), daysAgo(rnd(1, 4)), now + rnd(2, 6) * DAY);
  inviteCount += 1;
}
log(`${inviteCount} 条待接受邀请`);

/* ---------------- 8. 一致性校验 ---------------- */

heading('一致性校验：');
let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
};

for (const org of createdOrgs) {
  const granted = db.prepare('SELECT COALESCE(SUM(amount),0) AS n FROM org_quota_grants WHERE org_id=? AND period=?').get(org.id, period).n;
  const settled = db.prepare("SELECT COALESCE(SUM(amount),0) AS n FROM quota_task_usage WHERE org_id=? AND period=? AND status='settled'").get(org.id, period).n;
  const reserved = db.prepare("SELECT COALESCE(SUM(amount),0) AS n FROM quota_task_usage WHERE org_id=? AND period=? AND status='reserved'").get(org.id, period).n;
  const released = db.prepare("SELECT COALESCE(SUM(amount),0) AS n FROM quota_task_usage WHERE org_id=? AND period=? AND status='released'").get(org.id, period).n;
  const allocated = db.prepare('SELECT COALESCE(SUM(amount),0) AS n FROM member_quota_allocations WHERE org_id=? AND period=?').get(org.id, period).n;
  check(`${org.name} 额度未透支`, settled + reserved <= granted, `granted=${granted} settled=${settled} reserved=${reserved} released=${released}`);
  check(`${org.name} 成员分配 ≤ 可用`, allocated <= granted - settled - reserved, `allocated=${allocated} available=${granted - settled - reserved}`);
}

check('任务状态与额度记录一致', db.prepare(`
  SELECT COUNT(*) AS n FROM tasks t
  LEFT JOIN quota_task_usage q ON q.task_id=t.id
  WHERE t.org_id IN (${createdOrgs.map(() => '?').join(',')})
    AND (q.task_id IS NULL
      OR (t.status='done' AND q.status!='settled')
      OR (t.status='failed' AND q.status!='released')
      OR (t.status IN ('queued','running') AND q.status!='reserved'))
`).get(...createdOrgs.map(org => org.id)).n === 0);

check('已完成任务都有产物', db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE status='done' AND local_path IS NULL").get().n === 0);
check('产物都有归属记录', db.prepare("SELECT COUNT(*) AS n FROM tasks t LEFT JOIN file_owners f ON f.path=t.local_path WHERE t.status='done' AND f.path IS NULL").get().n === 0);
check('每个任务都有事件流', db.prepare('SELECT COUNT(*) AS n FROM tasks t LEFT JOIN task_events e ON e.task_id=t.id WHERE e.task_id IS NULL').get().n === 0);
check('已完成任务都有媒体调用记账', db.prepare("SELECT COUNT(*) AS n FROM tasks t LEFT JOIN ai_calls c ON c.task_id=t.id AND c.kind IN ('image','video') WHERE t.status='done' AND c.id IS NULL").get().n === 0);
check('任务创建人都属于对应组织', db.prepare(`SELECT COUNT(*) AS n FROM tasks t
  LEFT JOIN org_members m ON m.org_id=t.org_id AND m.user_id=t.created_by WHERE m.user_id IS NULL`).get().n === 0);
check('文档创建人都属于对应组织', db.prepare(`SELECT COUNT(*) AS n FROM documents d
  LEFT JOIN org_members m ON m.org_id=d.org_id AND m.user_id=d.created_by WHERE m.user_id IS NULL`).get().n === 0);

/* ---------------- 9. 汇总 ---------------- */

const summary = db.prepare(`SELECT
  (SELECT COUNT(*) FROM orgs WHERE id!='bootstrap') AS orgs,
  (SELECT COUNT(*) FROM users) AS users,
  (SELECT COUNT(*) FROM org_members) AS memberships,
  (SELECT COUNT(*) FROM tasks) AS tasks,
  (SELECT COUNT(*) FROM documents) AS documents,
  (SELECT COUNT(*) FROM ai_calls) AS calls,
  (SELECT COUNT(*) FROM task_events) AS events,
  (SELECT ROUND(COALESCE(SUM(cost_cny),0),2) FROM ai_calls) AS cost,
  (SELECT COUNT(*) FROM org_audit_logs) AS audits,
  (SELECT COUNT(*) FROM org_invites WHERE expires_at > ${now}) AS invites`).get();

heading('汇总：');
console.log(`  组织 ${summary.orgs} · 用户 ${summary.users} · 成员关系 ${summary.memberships}`);
console.log(`  任务 ${summary.tasks} · 文档 ${summary.documents} · 调用 ${summary.calls} · 事件 ${summary.events}`);
console.log(`  审计 ${summary.audits} · 邀请 ${summary.invites} · 累计成本 ¥${summary.cost}`);
console.log(`\n  演示账号密码：${DEMO_PASSWORD}`);
console.log(`  ${failures === 0 ? '全部校验通过 ✅' : `${failures} 项校验失败 ❌`}`);

db.close();
