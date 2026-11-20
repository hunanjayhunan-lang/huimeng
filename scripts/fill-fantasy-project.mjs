// 为「幻想还是现实？」项目填充剧本 + 元数据 + 拆解 + 资产
// 用法：node scripts/fill-fantasy-project.mjs
// 注意：直接写 SQLite（后端 WAL 模式），执行前请确认后端没有正在写这个项目。

import { DatabaseSync } from 'node:sqlite';

const DB = new URL('../server/data/tasks.db', import.meta.url);
const db = new DatabaseSync(DB.pathname);

const PROJECT_ID = 'e98a364e-96a5-4702-a060-eedcb844e975';

const name = '幻想还是现实？';

// ===== 角色 / 场景 / 道具定义 =====
const characters = [
  { id: 'C01', name: '咕咕嘎嘎', desc: '主角，6-7 岁小孩，圆脸短发，穿黄色小雨衣/亮色背带裤，天真、渴望被姐姐带着玩' },
  { id: 'C02', name: '姐姐', desc: '少女/青年，在梦中冷漠刻薄，现实中温柔体贴；双马尾或齐肩发，日常休闲装' },
  { id: 'C03', name: '奶奶', desc: '慈祥老人，家中草屋前，穿朴素布衣、戴头巾' },
];

const locations = [
  { id: 'L01', name: 'KFC 餐厅内', desc: '明亮快餐店，暖黄灯光，红白配色，塑料卡座' },
  { id: 'L02', name: '游乐场检票口', desc: '游乐场大门，彩色拱门与检票闸机，路旁街景' },
  { id: 'L03', name: '咕咕嘎嘎家（草屋）', desc: '乡村小屋，土墙草屋顶，温馨简朴，门前有院子' },
];

const props = [
  { id: 'P01', name: '甜筒', owner: 'C02 → C01', initial_state: '现实结尾姐姐带来的甜筒，象征姐姐的爱' },
  { id: 'P02', name: '小猫', owner: '路旁', initial_state: '路边偶遇的野猫（场景2转场出现）' },
];

// ===== 人类可读剧本（script.excerpt）=====
const excerpt = [
  '【剧集信息】《幻想还是现实？》｜ 温情反转短剧 ｜ 约 90 秒',
  '【出场人物】咕咕嘎嘎（6-7 岁小孩，天真）、姐姐（少女，梦中冷漠/现实温柔）、奶奶（慈祥老人）',
  '【主题】孩子对被冷落/被抛弃的焦虑，通过梦境具象化；结尾现实中姐姐的温柔打破幻想，反转治愈。',
  '',
  '第1场 ｜ KFC 餐厅内 · 日 / 内',
  '人物：咕咕嘎嘎、姐姐',
  '△【中景】快餐店内，咕咕嘎嘎坐在卡座上眼巴巴等着，姐姐坐在对面看手机。',
  '咕咕嘎嘎（小声）：姐姐，我的吃的什么时候好呀？',
  '姐姐（头也不抬，冷淡）：我根本就没有给你点。',
  '咕咕嘎嘎（愣了一下，垂下头）：哦，好吧，那我先出去等着你。',
  '姐姐（指着座位，语气嫌恶）：等一下。你坐过的椅子都脏了，赶紧过来擦擦再走。',
  '△【特写】咕咕嘎嘎抿着嘴，默默用袖子擦椅子，眼里有点委屈。',
  '',
  '第2场 ｜ 游乐场门口检票口 · 日 / 外',
  '人物：咕咕嘎嘎、姐姐',
  '△【全景】游乐场彩色拱门下，咕咕嘎嘎兴奋地小跑到检票口。',
  '咕咕嘎嘎（雀跃）：姐姐，我们终于可以进旅游景点啦！',
  '姐姐（晃了晃手里的票，冷漠）：我只买了我一个人的票，你一个人在外边等着我吧。',
  '咕咕嘎嘎（笑容僵住，小声）：好吧姐姐，我等着你。',
  '△【转场】检票口外，路边墙角蹲着一只小猫。咕咕嘎嘎蹲下来，轻轻舒了口气。',
  '咕咕嘎嘎（自言自语，摸摸小猫）：有小猫陪着我也挺好。',
  '姐姐（皱眉，挥手驱赶）：哪里来的野猫，赶紧给我滚！',
  '咕咕嘎嘎（抬头，小声）：姐姐，我有点渴了。',
  '姐姐（不耐烦）：渴了就受着，谁让你不带水？我先打车走了，你自己回家吧。',
  '△【远景】咕咕嘎嘎看着姐姐坐进出租车离开，独自站在路边，小小的身影。',
  '',
  '第3场 ｜ 咕咕嘎嘎家（草屋）· 日 / 内',
  '人物：咕咕嘎嘎、奶奶、姐姐',
  '△【中景】草屋前，奶奶在院子里忙活，见咕咕嘎嘎回来迎上去。',
  '奶奶（慈祥）：小咕嘎啊，今天玩得开心吗？',
  '咕咕嘎嘎（努力挤出笑）：今天玩得非常好，非常开心。奶奶，我先去屋子里睡觉了。',
  '△【转场】屋内，咕咕嘎嘎蜷在床上闭上眼，眼角还挂着泪。',
  '△【醒】咕咕嘎嘎猛地坐起来，喘着气，喃喃道：原来是梦啊……',
  '△【反转】门被推开，姐姐笑着走进来，手里举着一个甜筒。',
  '姐姐（温柔）：咕嘎，姐姐给你带了你爱吃的甜筒，咱们快出去玩吧。',
  '咕咕嘎嘎（眼睛一亮，破涕为笑）：好啊，姐姐！',
  '△【定格】姐妹俩牵着手出门，阳光洒下来，甜筒化了一点，暖意融融。',
].join('\n');

// ===== 结构化 YAML 剧本（script.yaml）=====
const yaml = `project:
  title: 幻想还是现实？
  aspect_ratio: "16:9"
  narrative_style: 温情反转 · 梦境寓言 · 治愈系
  visual_style: 前两场高对比冷调（梦境感），第三场暖调（现实感）
  global_constraints:
    - 梦境场景用偏冷 / 略过曝 / 抽离感；现实场景用暖色、柔和自然光
    - 角色造型跨镜头严格一致（绑定 C01/C02/C03 资产）

scenes:
  - id: E01-S01
    title: 没有点餐的姐姐
    function: 建立“被冷落”的压抑感，为结尾反转做铺垫
    location: L01
    time: day
    environment: interior
    characters: [C01, C02]
    props: []
    shots:
      - id: c01
        duration: 5
        shot_type: medium_shot
        camera_movement: static
        subject: C01
        action: 咕咕嘎嘎问吃的什么时候好，姐姐冷漠拒绝并要求擦椅子
        dialogue:
          - "咕咕嘎嘎：姐姐，我的吃的什么时候好呀？"
          - "姐姐：我根本就没有给你点。"
          - "咕咕嘎嘎：哦，好吧，那我先出去等着你。"
          - "姐姐：等一下。你坐过的椅子都脏了，赶紧过来擦擦再走。"

  - id: E01-S02
    title: 只有一张门票
    function: 压抑升级，孤独感外化（小猫），把咕嘎推到被抛弃边缘
    location: L02
    time: day
    environment: exterior
    characters: [C01, C02]
    props:
      - id: P02
        initial_state: 路边墙角蹲着的小猫
        final_state: 被姐姐驱赶离开
    shots:
      - id: c02
        duration: 8
        shot_type: long_shot
        camera_movement: dolly
        subject: C01
        action: 姐姐只买了一张票独自入园，咕嘎在门外与小猫相伴，之后被骂、渴了被拒，姐姐打车离开
        dialogue:
          - "咕咕嘎嘎：姐姐，我们终于可以进旅游景点啦！"
          - "姐姐：我只买了我一个人的票，你一个人在外边等着我吧。"
          - "咕咕嘎嘎：好吧姐姐，我等着你。"
          - "咕咕嘎嘎：有小猫陪着我也挺好。"
          - "姐姐：哪里来的野猫，赶紧给我滚！"
          - "咕咕嘎嘎：姐姐，我有点渴了。"
          - "姐姐：渴了就受着，谁让你不带水？我先打车走了，你自己回家吧。"

  - id: E01-S03
    title: 原来是梦
    function: 反转揭示——两场冷漠全是梦境，现实姐姐温柔，治愈收尾
    location: L03
    time: day
    environment: interior
    characters: [C01, C03, C02]
    props:
      - id: P01
        initial_state: 姐姐手中举着的甜筒
        final_state: 递给咕嘎，象征关爱
    shots:
      - id: c03
        duration: 6
        shot_type: medium_shot
        camera_movement: push_in
        subject: C01
        action: 咕嘎回家睡觉，醒来发现是梦；姐姐拿甜筒进来相邀，姐妹牵手出门
        dialogue:
          - "奶奶：小咕嘎啊，今天玩得开心吗？"
          - "咕咕嘎嘎：今天玩得非常好，非常开心。奶奶，我先去屋子里睡觉了。"
          - "咕咕嘎嘎（醒来）：原来是梦啊。"
          - "姐姐：咕嘎，姐姐给你带了你爱吃的甜筒，咱们快出去玩吧。"
          - "咕咕嘎嘎：好啊，姐姐！"
`;

const metadata = {
  title: name,
  synopsis: '小咕嘎在梦境里被姐姐一次次冷落拒绝：餐厅不点餐、游乐场只买一张票、被赶走、被骂走小猫、渴了也不给水。回到家中睡醒才发现“原来都是梦”——现实里的姐姐正温柔地举着甜筒等他出去玩。一场关于被冷落焦虑的梦境寓言，以温情反转治愈收尾。',
  aspect_ratio: '16:9',
  narrative_style: '温情反转 · 梦境寓言 · 治愈系',
  visual_style: '梦境两场高对比冷调、略抽离；现实一场暖色自然光，形成冷暖反差',
  characters,
  locations,
  props,
  global_constraints: [
    '梦境场景（餐厅/游乐场）用偏冷或略过曝的抽离感，现实场景（草屋）用暖色柔和光',
    '角色外貌与服饰跨镜头严格一致（绑定 C01/C02/C03 资产）',
    '结尾“甜筒”作为爱的道具需清晰呈现，光线转暖',
  ],
};

const script = { title: name, meta: '温情反转短剧 · 3 场 · 约 90 秒', excerpt, yaml };

const breakdown = {
  scenes: [
    { id: 'sc1', no: '第1场', place: 'KFC 餐厅内', time: '日 / 内', beat: '姐姐不点餐、要咕嘎擦椅子，奠定被冷落基调' },
    { id: 'sc2', no: '第2场', place: '游乐场门口检票口', time: '日 / 外', beat: '只买一张票，赶走小猫，打车离开，孤独感外化' },
    { id: 'sc3', no: '第3场', place: '咕咕嘎嘎家（草屋）', time: '日 / 内', beat: '醒来发现是梦，现实姐姐带甜筒，反转治愈' },
  ],
  characters: [
    { id: 'c1', name: '咕咕嘎嘎', alias: ['咕嘎', '小咕嘎'], role: '主角 · 小孩', look: '圆脸短发，亮色背带裤/黄色雨衣，天真' },
    { id: 'c2', name: '姐姐', role: '梦中的冷漠者 / 现实的温柔者', look: '齐肩发，日常休闲装，双面性' },
    { id: 'c3', name: '奶奶', role: '家中长辈', look: '朴素布衣、戴头巾，慈祥' },
  ],
  props: [
    { id: 'p1', name: '甜筒', scene: '第3场' },
    { id: 'p2', name: '小猫', scene: '第2场' },
  ],
  places: [
    { id: 'e1', name: 'KFC 餐厅内', scene: '第1场' },
    { id: 'e2', name: '游乐场门口', scene: '第2场' },
    { id: 'e3', name: '草屋家中', scene: '第3场' },
  ],
  // 高难度/需动作捕捉的动作：本故事以温情写实为主，仅“惊醒坐起”需动作捕捉表现力
  hardActions: [
    { id: 'h1', scene: '第3场', action: '从床上惊醒猛地坐起', level: '中', channel: '深度动作捕捉通道' },
  ],
};

// 角色资产（图片先用项目封面已有的图片或占位；asset 图片路径复用现有 /api/files 占位）
const assets = [
  { id: 'a-c1', group: 'character', name: '咕咕嘎嘎', sub: '人物三视图', img: '/api/files/ws-char-mystery.webp', prompt: '6-7 岁小孩，圆脸短发，黄色雨衣或亮色背带裤，天真烂漫，正/侧/背三视图，纯色背景' },
  { id: 'a-c2', group: 'character', name: '姐姐', sub: '人物三视图', img: '/api/files/ws-char-suwan.png', prompt: '少女，齐肩发，日常休闲装，表情可冷漠可温柔，正/侧/背三视图，纯色背景' },
  { id: 'a-c3', group: 'character', name: '奶奶', sub: '人物三视图', img: '/api/files/ws-char-shenyan.png', prompt: '慈祥老奶奶，朴素布衣、戴头巾，和蔼微笑，正/侧/背三视图，纯色背景' },
  { id: 'a-p1', group: 'prop', name: '甜筒', sub: '道具图', img: '/api/files/ws-prop-brass-key.webp', prompt: '奶油甜筒冰淇淋，暖色光线，独立成图' },
  { id: 'a-p2', group: 'prop', name: '小猫', sub: '道具图', img: '/api/files/ws-prop-old-photo.webp', prompt: '路边小猫，蹲坐，可爱温顺，独立成图' },
  { id: 'a-e1', group: 'place', name: 'KFC 餐厅内', sub: '场景底板', img: '/api/files/ws-scene-herb-shop.webp', prompt: '快餐店内景，明亮暖黄灯光，红白配色卡座，空镜' },
  { id: 'a-e2', group: 'place', name: '游乐场门口', sub: '场景底板', img: '/api/files/ws-scene-rooftop-dusk.webp', prompt: '游乐场大门彩色拱门与检票闸机，路旁街景，空镜' },
  { id: 'a-e3', group: 'place', name: '草屋家中', sub: '场景底板', img: '/api/files/ws-scene-rain-alley.webp', prompt: '乡村草屋小屋，土墙草顶，温馨简朴，暖色光，空镜' },
];

// ===== 合并写入：保留已有字段，补充剧本/资产 =====
const row = db.prepare('SELECT data FROM documents WHERE id = ?').get(PROJECT_ID);
if (!row) {
  console.error('项目不存在：', PROJECT_ID);
  process.exit(1);
}
const current = JSON.parse(row.data);
const next = {
  ...current,
  summary: metadata.synopsis,
  style: metadata.visual_style,
  episode: 1,
  date: '2026-11-20',
  type: '短剧漫剧',
  duration: '30 秒 - 1 分钟',
  count: 1,
  channel: '绘梦中台',
  collaborators: [],
  stages: [true, false, false],
  stageIndex: 0,
  statusText: '剧本已填充 · 待拆资产',
  metadata,
  script,
  breakdown,
  assets,
  shots: [
    {
      id: 'shot-1',
      scene: '第1场',
      title: '没有点餐 · 中景固定',
      duration: '5s',
      channel: '图生视频通道',
      modelApi: 'Jimeng-Video-Pro',
      traceId: 'tr_hx_8f01',
      mocap: false,
      assetIds: ['a-c1', 'a-c2', 'a-e1'],
      previewImg: '/api/files/ws-scene-herb-shop.webp',
      prompt: '【中景·固定】 @KFC 餐厅内 暖黄灯光，@咕咕嘎嘎 坐在卡座上眼巴巴等着，@姐姐 坐对面看手机。\n【台词】咕咕嘎嘎（小声）：姐姐，我的吃的什么时候好呀？\n【台词】姐姐（冷淡，头也不抬）：我根本就没有给你点。\n咕咕嘎嘎愣住垂下头：哦，好吧，那我先出去等着你。\n姐姐（指着座位）：等一下。你坐过的椅子都脏了，赶紧过来擦擦再走。\n【特写】咕咕嘎嘎抿着嘴，默默用袖子擦椅子，眼里有点委屈。',
    },
    {
      id: 'shot-2',
      scene: '第2场',
      title: '只有一张票 · 远景推移',
      duration: '8s',
      channel: '图生视频通道',
      modelApi: 'Seedance-LipSync',
      traceId: 'tr_hx_8f02',
      mocap: false,
      assetIds: ['a-c1', 'a-c2', 'a-e2', 'a-p2'],
      previewImg: '/api/files/ws-scene-rooftop-dusk.webp',
      prompt: '【远景·推移】 @游乐场门口 彩色拱门下，@咕咕嘎嘎 兴奋小跑到检票口。\n【台词】咕咕嘎嘎（雀跃）：姐姐，我们终于可以进旅游景点啦！\n【台词】姐姐（冷漠）：我只买了我一个人的票，你一个人在外边等着我吧。\n咕咕嘎嘎（笑容僵住）：好吧姐姐，我等着你。\n【转场】检票口外，路边墙角蹲着 @小猫 ，咕嘎蹲下轻摸：有小猫陪着我也挺好。\n姐姐（皱眉挥手）：哪里来的野猫，赶紧给我滚！\n咕咕嘎嘎（抬头）：姐姐，我有点渴了。\n姐姐（不耐烦）：渴了就受着，谁让你不带水？我先打车走了，你自己回家吧。\n【远景】咕嘎看着姐姐坐出租离开，独自站在路边，小小身影。',
    },
    {
      id: 'shot-3',
      scene: '第3场',
      title: '原来是梦 · 惊醒动捕',
      duration: '6s',
      channel: '深度动作捕捉通道',
      modelApi: 'Mocap-Engine-V2',
      traceId: 'tr_hx_8f03',
      mocap: true,
      assetIds: ['a-c1', 'a-c2', 'a-c3', 'a-e3', 'a-p1'],
      previewImg: '/api/files/ws-scene-rain-alley.webp',
      prompt: '【中景·推进】 @草屋家中 院子前，@奶奶 迎上 @咕咕嘎嘎 。\n【台词】奶奶（慈祥）：小咕嘎啊，今天玩得开心吗？\n【台词】咕咕嘎嘎（努力笑）：今天玩得非常好，非常开心。奶奶，我先去屋子里睡觉了。\n【转场】屋内，咕嘎蜷在床上闭眼，眼角挂泪。\n【动捕动作】 @咕咕嘎嘎 从床上惊醒猛地坐起，喘着气，喃喃：原来是梦啊……\n【反转】门被推开，@姐姐 笑着举着 @甜筒 进来：咕嘎，姐姐给你带了你爱吃的甜筒，咱们快出去玩吧。\n咕咕嘎嘎（眼睛亮起，破涕为笑）：好啊，姐姐！\n【定格】姐妹俩牵着手出门，阳光洒下，甜筒化了一点，暖意融融。',
    },
  ],
  config: {
    llmModel: 'doubao-seed-2-1-lite-260915',
    videoModel: 'Seedance 1.0 Pro',
    promptStrategy: '标准',
    shotDuration: '5',
    aspectRatio: '16:9',
    thinking: '关闭',
  },
};

db.prepare('UPDATE documents SET data = ?, updated_at = ? WHERE id = ?')
  .run(JSON.stringify(next), Date.now(), PROJECT_ID);

console.log('✅ 已写入项目', PROJECT_ID);
console.log('   名称:', next.name);
console.log('   剧本场次:', metadata.characters.length, '角色 /', breakdown.scenes.length, '场');
console.log('   资产:', assets.length, '项');
console.log('   excerpt 长度:', excerpt.length, '字符');
