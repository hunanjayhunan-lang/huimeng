import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  ImagePlus,
  Music2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Star,
  X,
} from 'lucide-react';
import './AssetsPage.css';
import { ASSET_NODES, DEMO_PROJECTS, GROUP_META } from './workspaceDemo.js';
import girlDog from '../assets/people/girl-dog.png';
import p1 from '../assets/people/p1.jpg';
import p2 from '../assets/people/p2.jpg';
import p3 from '../assets/people/p3.jpg';
import p4 from '../assets/people/p4.jpg';
import p5 from '../assets/people/p5.jpg';
import p6 from '../assets/people/p6.jpg';
import p7 from '../assets/people/p7.jpg';
import p8 from '../assets/people/p8.jpg';
import p9 from '../assets/people/p9.jpg';
import p10 from '../assets/people/p10.jpg';

// 场景 / 道具素材：由 preview/gen-scenes.py、gen-props.py、gen-props2.py 程序化生成
import sceneRainAlley from '../assets/assets/scene-rain-alley.jpg';
import sceneMountainCave from '../assets/assets/scene-mountain-cave.jpg';
import sceneLanternMarket from '../assets/assets/scene-lantern-market.jpg';
import sceneHerbShop from '../assets/assets/scene-herb-shop.jpg';
import sceneRooftopDusk from '../assets/assets/scene-rooftop-dusk.jpg';
import sceneWarehouse from '../assets/assets/scene-warehouse.jpg';
import propPocketWatch from '../assets/assets/prop-pocket-watch.png';
import propOldPhoto from '../assets/assets/prop-old-photo.png';
import propBrassKey from '../assets/assets/prop-brass-key.png';
import propPouch from '../assets/assets/prop-pouch.png';
import propClapperBoard from '../assets/assets/prop-clapper-board.png';
import propWoodenDoor from '../assets/assets/prop-wooden-door.png';

const CATEGORIES = ['人物', '场景', '道具'];
const COLLECTION_TABS = ['人物', '场景', '道具'];
const ROLES = ['主角', '配角', '反派', '龙套'];
const GENDERS = ['男', '女', '其他'];
const AGES = ['幼年', '少年', '青年', '中年', '老年'];
const SCRIPT_OPTIONS = ['未关联剧本', '《后山洞口》', '《雨巷迷踪》', '《长夜将明》'];
// 场景 / 道具的标签与剧本选项从数据里实时收敛，避免出现筛不出结果的死选项
const EXTRA_SCRIPT_OPTIONS = ['《天台誓约》'];
const SORT_OPTIONS = [
  { value: 'recent', label: '最近' },
  { value: 'oldest', label: '最早' },
  { value: 'name', label: '名称' },
];
const CREATOR_OPTIONS = ['罗剑', '丁向豪', 'Aa112233..'];
const TAG_OPTIONS = ['主角', '配角', '反派', '男', '女', '老年', '幼年', '有图'];

const INITIAL_ASSETS = {
  人物: [
    { id: 'p-5', name: '小女孩', alias: '丫丫', tags: ['配角', '女'], badges: ['剧本拆出'], creator: 'Aa112233..', time: '21 小时前', script: '', cover: girlDog, rank: 0 },
    { id: 'p-6', name: '李守真', alias: '守真', tags: ['主角', '男', '青年', '执着', '守墓人'], badges: [], creator: '罗剑', time: '1 天前', script: '《后山洞口》', cover: p1, rank: 1 },
    { id: 'p-7', name: '沈砚', alias: '砚哥', tags: ['配角', '男', '中年', '冷面', '账房'], badges: [], creator: '罗剑', time: '1 天前', script: '《雨巷迷踪》', cover: p2, rank: 2 },
    { id: 'p-8', name: '苏晚', alias: '阿晚', tags: ['主角', '女', '青年', '敏锐', '记者'], badges: [], creator: '丁向豪', time: '2 天前', script: '《雨巷迷踪》', cover: p3, rank: 3 },
    { id: 'p-9', name: '阿绫', alias: '绫子', tags: ['配角', '女', '少年', '灵气', '学徒'], badges: [], creator: '罗剑', time: '2 天前', script: '未关联剧本', cover: p4, rank: 4 },
    { id: 'p-10', name: '周掌柜', alias: '老周', tags: ['配角', '男', '老年', '圆滑', '掌柜'], badges: [], creator: 'Aa112233..', time: '3 天前', script: '《长夜将明》', cover: p5, rank: 5 },
    { id: 'p-11', name: '老陈', alias: '陈伯', tags: ['配角', '男', '老年', '木讷', '守夜人'], badges: [], creator: '罗剑', time: '3 天前', script: '《后山洞口》', cover: p6, rank: 6 },
    { id: 'p-12', name: '阿梨', alias: '梨儿', tags: ['配角', '女', '青年', '温柔', '药铺'], badges: [], creator: '丁向豪', time: '4 天前', script: '《长夜将明》', cover: p7, rank: 7 },
    { id: 'p-13', name: '二狗', alias: '狗子', tags: ['龙套', '男', '青年', '莽撞', '跟班'], badges: [], creator: '罗剑', time: '5 天前', script: '《雨巷迷踪》', cover: p8, rank: 8 },
    { id: 'p-14', name: '王嫂', alias: '王婶', tags: ['配角', '女', '中年', '热心', '邻里'], badges: [], creator: 'Aa112233..', time: '6 天前', script: '未关联剧本', cover: p9, rank: 9 },
    { id: 'p-15', name: '小满', alias: '满满', tags: ['主角', '女', '少年', '胆大', '学徒'], badges: [], creator: '罗剑', time: '上周', script: '《长夜将明》', cover: p10, rank: 10 },
  ],
  场景: [
    { id: 's-1', name: '雨夜老街', alias: '雨巷', tags: ['雨夜', '外景', '民国', '阴冷'], badge: '雨巷迷踪', creator: '丁向豪', time: '2 小时前', script: '《雨巷迷踪》', prompt: '民国雨夜老街，湿石板反光，暖黄路灯，两侧高墙夹道，35mm 胶片颗粒，低机位', cover: sceneRainAlley, rank: 0 },
    { id: 's-2', name: '后山洞口', alias: '山洞', tags: ['山洞', '外景', '夜', '神秘'], badge: '后山洞口', creator: '罗剑', time: '5 小时前', script: '《后山洞口》', prompt: '荒山夜，藤蔓覆盖的洞口，洞内深处泛青绿幽光，冷色打光，写实国风', cover: sceneMountainCave, rank: 1 },
    { id: 's-3', name: '长夜灯市', alias: '灯市', tags: ['夜景', '外景', '古风', '热闹'], badge: '长夜将明', creator: 'Aa112233..', time: '1 天前', script: '《长夜将明》', prompt: '长夜古街灯市，成排暖橙灯笼纵深排列，两侧飞檐屋檐剪影，雨雾弥漫', cover: sceneLanternMarket, rank: 2 },
    { id: 's-4', name: '药铺内景', alias: '药铺', tags: ['内景', '古风', '暖光', '灯烛'], badge: '长夜将明', creator: '罗剑', time: '1 天前', script: '《长夜将明》', prompt: '古风药铺内景，满墙木质药柜抽屉，柜台上方暖黄吊灯，浮尘可见，偏黄暖调', cover: sceneHerbShop, rank: 3 },
    { id: 's-5', name: '天台晚霞', alias: '天台', tags: ['黄昏', '外景', '都市', '温柔'], badge: '天台誓约', creator: '丁向豪', time: '2 天前', script: '未关联剧本', prompt: '城市天台黄昏，橙紫渐变晚霞，远景楼群剪影，天台围栏前景，柔和逆光', cover: sceneRooftopDusk, rank: 4 },
    { id: 's-6', name: '旧仓库', alias: '仓库', tags: ['内景', '悬疑', '侧光', '尘埃'], badge: '旧仓库回眸', creator: 'Aa112233..', time: '3 天前', script: '未关联剧本', prompt: '旧仓库内景，高窗冷光斜射形成光柱，货架木箱剪影，空气浮尘颗粒感', cover: sceneWarehouse, rank: 5 },
  ],
  道具: [
    { id: 'o-1', name: '旧怀表', alias: '祖传表', tags: ['金属', '黄铜', '信物', '特写'], badge: '后山洞口', creator: '罗剑', time: '4 小时前', script: '《后山洞口》', prompt: '老式黄铜怀表，奶白表盘，链条自然垂落，桌面柔光，浅景深微距', cover: propPocketWatch, rank: 0 },
    { id: 'o-2', name: '泛黄旧照片', alias: '全家福', tags: ['纸质', '年代感', '回忆', '手部道具'], badge: '后山洞口', creator: '丁向豪', time: '4 小时前', script: '《后山洞口》', prompt: '泛黄老照片，相纸边缘卷曲，轻微折痕与污渍，特写手持视角', cover: propOldPhoto, rank: 1 },
    { id: 'o-3', name: '铜钥匙', alias: '旧钥匙', tags: ['金属', '黄铜', '线索', '特写'], badge: '雨巷迷踪', creator: 'Aa112233..', time: '20 小时前', script: '《雨巷迷踪》', prompt: '老式黄铜钥匙，环头带花纹，桌面柔光投影，金属高光', cover: propBrassKey, rank: 2 },
    { id: 'o-4', name: '牛皮钱袋', alias: '钱袋子', tags: ['皮革', '手作', '交易', '道具'], badge: '长夜将明', creator: '罗剑', time: '1 天前', script: '《长夜将明》', prompt: '牛皮钱袋，束口拉绳，铜扣装饰，鼓鼓囊囊，暖色侧光', cover: propPouch, rank: 3 },
    { id: 'o-5', name: '打板器', alias: '场记板', tags: ['剧组', '工具', '片头', '现代'], badge: '', creator: '丁向豪', time: '2 天前', script: '未关联剧本', prompt: '黑色场记板，黑白斜条纹，打开状态，剧组工作台面，顶部柔光', cover: propClapperBoard, rank: 4 },
    { id: 'o-6', name: '老木门', alias: '门板', tags: ['木质', '古风', '场景件', '铜环'], badge: '后山洞口', creator: 'Aa112233..', time: '3 天前', script: '《后山洞口》', prompt: '古旧木门，双开铜环把手，中央挂锁，门缝透出暖光，木纹清晰', cover: propWoodenDoor, rank: 5 },
  ],
};

// 工作区（画布）产出的资产图：人物三视图 / 道具图 / 场景底板
// 资产库默认展示工作区里生成的这些资产，而非内置的演示数据。
const GROUP_TO_CATEGORY = { character: '人物', prop: '道具', place: '场景' };
const workspaceAssets = () => {
  const result = { 人物: [], 场景: [], 道具: [] };
  const cursor = { 人物: 0, 场景: 0, 道具: 0 };
  ASSET_NODES.forEach(node => {
    const category = GROUP_TO_CATEGORY[node.group];
    if (!category) return;
    result[category].push({
      id: node.id,
      name: node.name,
      alias: GROUP_META[node.group]?.label || '',
      tags: [node.sub],
      badges: ['工作区'],
      badge: node.sub,
      creator: '工作区',
      time: '刚刚',
      script: '《雨巷迷踪》',
      projectId: 'proj-rain-alley',
      prompt: node.prompt,
      cover: node.img,
      rank: cursor[category]++,
    });
  });
  return result;
};

const GENERATION_GROUPS = [
  {
    id: 'today',
    label: '今天生成',
    note: '09:00 之后',
    items: [
      { id: 'g-1', name: '雨夜老街 · 分镜 01', image: sceneRainAlley, style: '国风 · 电影感', size: '1024 × 1024', model: '绘梦 3.0', time: '今天 09:42', count: 4, kind: '场景', tags: ['雨夜', '外景', '民国'], script: '《雨巷迷踪》', prompt: '民国雨夜老街，湿石板反光，暖黄路灯，35mm 胶片颗粒' },
      { id: 'g-2', name: '苏晚 · 定妆照', image: p3, style: '写实 · 人像', size: '768 × 1024', model: '绘梦 3.0', time: '今天 09:18', count: 2, kind: '人物', tags: ['主角', '女', '青年', '写实'], script: '《雨巷迷踪》', prompt: '苏晚定妆照，冷静眼神，侧逆光，浅景深，电影质感' },
      { id: 'g-3', name: '旧怀表 · 特写', image: propPocketWatch, style: '微距 · 道具', size: '1024 × 1024', model: '绘梦 3.0', time: '今天 08:56', count: 1, kind: '道具', tags: ['金属', '黄铜', '特写'], script: '《后山洞口》', prompt: '老式黄铜怀表，奶白表盘，链条自然垂落，桌面柔光' },
      { id: 'g-4', name: '药铺内景 · 试光', image: sceneHerbShop, style: '古风 · 内景', size: '1280 × 720', model: '绘梦 3.0', time: '今天 08:30', count: 3, kind: '场景', tags: ['内景', '古风', '暖光'], script: '《长夜将明》', prompt: '古风药铺内景，满墙木质药柜，暖黄吊灯，浮尘可见' },
    ],
  },
  {
    id: 'earlier',
    label: '更早',
    note: '昨天及以前',
    items: [
      { id: 'g-5', name: '长夜灯市 · 俯拍', image: sceneLanternMarket, style: '古风 · 夜景', size: '1024 × 768', model: '绘梦 3.0', time: '昨天 22:10', count: 4, kind: '场景', tags: ['夜景', '外景', '古风'], script: '《长夜将明》', prompt: '长夜古街灯市，成排暖橙灯笼纵深排列，雨雾弥漫，俯拍' },
      { id: 'g-6', name: '天台晚霞 · 空镜', image: sceneRooftopDusk, style: '都市 · 胶片', size: '1280 × 720', model: '绘梦 2.5', time: '昨天 19:34', count: 2, kind: '场景', tags: ['黄昏', '外景', '都市'], script: '未关联剧本', prompt: '城市天台黄昏，橙紫渐变晚霞，远景楼群剪影，柔和逆光' },
      { id: 'g-7', name: '阿绫 · 三视图', image: p4, style: '角色设定', size: '768 × 1024', model: '绘梦 2.5', time: '2 天前', count: 1, kind: '人物', tags: ['配角', '女', '少年', '设定'], script: '未关联剧本', prompt: '阿绫角色三视图，正面 / 侧面 / 背面，白底，干净线条' },
      { id: 'g-8', name: '后山洞口 · 夜', image: sceneMountainCave, style: '国风 · 悬疑', size: '1024 × 1024', model: '绘梦 2.5', time: '2 天前', count: 3, kind: '场景', tags: ['山洞', '外景', '夜'], script: '《后山洞口》', prompt: '荒山夜，藤蔓覆盖的洞口，洞内深处泛青绿幽光，冷色打光' },
    ],
  },
];

const INITIAL_TASK_GROUPS = [
  {
    id: 'active',
    label: '进行中',
    note: '实时更新',
    items: [
      { id: 't-1', name: '长夜灯市 · 分镜 12', image: sceneLanternMarket, status: 'running', progress: 68, eta: '预计 40 秒', model: '绘梦 3.0', size: '1024 × 768', created: '今天 10:12', prompt: '长夜古街灯市，成排暖橙灯笼纵深排列，雨雾弥漫' },
      { id: 't-2', name: '阿绫 · 表情 6 连', image: p4, status: 'queued', queue: 2, model: '绘梦 3.0', size: '768 × 1024', created: '今天 10:08', prompt: '阿绫六种情绪表情，白底半身，统一光线，保持角色一致性' },
    ],
  },
  {
    id: 'finished',
    label: '已结束',
    note: '近 7 天',
    items: [
      { id: 't-3', name: '雨夜老街 · 分镜 01', image: sceneRainAlley, status: 'done', resultCount: 4, duration: '42 秒', model: '绘梦 3.0', size: '1024 × 1024', created: '今天 09:42', prompt: '民国雨夜老街，湿石板反光，暖黄路灯，35mm 胶片颗粒' },
      { id: 't-4', name: '沈砚 · 定妆照', image: p2, status: 'done', resultCount: 3, duration: '58 秒', model: '绘梦 3.0', size: '768 × 1024', created: '今天 09:05', prompt: '沈砚定妆照，冷面账房，深色长衫，硬光勾勒轮廓' },
    ],
  },
];

const BGM_GROUPS = [
  {
    id: 'recommended',
    label: '推荐配乐',
    note: '按最近使用推荐',
    items: [
      { id: 'b-1', title: '雨巷独白', mood: ['悬疑', '民国'], desc: '钢琴 · 弦乐 · 慢速', duration: '02:14', uses: 3 },
      { id: 'b-2', title: '长夜将至', mood: ['古风', '史诗'], desc: '大鼓 · 弦乐 · 中速', duration: '03:02', uses: 5 },
      { id: 'b-3', title: '天台的风', mood: ['都市', '温柔'], desc: '木吉他 · 环境声 · 慢速', duration: '01:48', uses: 2 },
    ],
  },
  {
    id: 'favorites',
    label: '我的收藏',
    note: '手动收藏',
    items: [
      { id: 'b-4', title: '旧梦一场', mood: ['回忆', '大提琴'], desc: '大提琴 · 钢琴 · 极慢', duration: '02:36', uses: 1 },
      { id: 'b-5', title: '灯市夜行', mood: ['热闹', '古风'], desc: '琵琶 · 笛子 · 快板', duration: '01:52', uses: 0 },
    ],
  },
];

function AssetCloud() {
  return (
    <svg className="asset-cloud" viewBox="0 0 64 38" width="54" height="32" fill="none" aria-hidden="true">
      <path
        d="M14 27.5C8.2 27.5 3.8 23.6 3.8 18.4c0-4.5 3.5-8.2 8-8.8C13.2 5 17.9 1.8 23.4 1.8c6.3 0 11.5 4.4 12.5 10.2 3.8.5 6.8 3.7 6.8 7.6 0 4.4-3.9 7.9-8.6 7.9H14Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="rgba(248, 238, 206, 0.22)"
      />
      <path d="M39.5 30.5c4.5 1.9 9.6 1.2 13.3-1.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M33 34c5.2 1.8 11 1.3 15.8-1.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".7" />
      <circle cx="36" cy="13" r="2" fill="currentColor" />
    </svg>
  );
}

function deriveChips(tags = []) {
  return {
    role: ROLES.find(item => tags.includes(item)) || '',
    gender: GENDERS.find(item => tags.includes(item)) || '',
    age: AGES.find(item => tags.includes(item)) || '',
  };
}

const uniq = list => list.filter((item, index) => item && list.indexOf(item) === index);

function ModuleHead({ title, count, desc, meta, metaIcon }) {
  return <section className="assets-section module-section">
    <div className="assets-section-head">
      <h2>{title} <span className="asset-count">{count}</span></h2>
      <p>{desc}</p>
    </div>
    {meta && <div className="module-summary">{metaIcon}{meta}</div>}
  </section>;
}

function ModuleGroupHead({ label, note, count }) {
  return <div className="module-group-head">
    <h3>{label}<span>{count}</span></h3>
    <i aria-hidden="true" />
    <em>{note}</em>
  </div>;
}

function GenerationModule({ groups, onSave, onRegenerate }) {
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  return <>
    <ModuleHead
      title="生图记录"
      count={total}
      desc="按生成批次归档的结果，挑一张存成人物、场景或道具资产，就能直接进分镜。"
      meta="本周 12 张 · 已存资产 3 个"
    />
    {groups.map(group => <section className="module-group" key={group.id}>
      <ModuleGroupHead label={group.label} note={group.note} count={group.items.length} />
      <div className="gen-grid">
        {group.items.map(item => <article className="gen-card" key={item.id}>
          <div className={`gen-thumb ${item.kind === '人物' ? 'portrait' : ''}`}>
            <img src={item.image} alt={item.name} loading="lazy" />
            <span className="gen-count">{item.count} 张</span>
            <div className="gen-actions">
              <button type="button" onClick={() => onSave(item)}><Download size={13} />存为资产</button>
              <button type="button" onClick={() => onRegenerate(item)}><RefreshCw size={13} />再生成</button>
            </div>
          </div>
          <div className="gen-info">
            <h4 title={item.name}>{item.name}</h4>
            <p>{item.style} · {item.size}</p>
            <div className="gen-meta">
              <span>{item.model}</span>
              <i aria-hidden="true" />
              <span>{item.time}</span>
            </div>
          </div>
        </article>)}
      </div>
    </section>)}
  </>;
}

function TaskModule({ groups, onCancel, onView }) {
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  const activeCount = groups.find(group => group.id === 'active')?.items.length || 0;
  return <>
    <ModuleHead
      title="生图任务"
      count={total}
      desc="排队中的任务按提交顺序执行，进行中的进度实时刷新，完成后自动归档到生图记录。"
      meta={`${activeCount} 个进行中 · 平均 52 秒`}
      metaIcon={<Clock3 size={13} />}
    />
    {groups.map(group => <section className="module-group" key={group.id}>
      <ModuleGroupHead label={group.label} note={group.note} count={group.items.length} />
      {group.items.length === 0
        ? <div className="module-inline-empty">队列已清空，暂时没有进行中的任务。</div>
        : <div className="task-list">
          {group.items.map(task => <article className="task-row" key={task.id}>
            <img className="task-thumb" src={task.image} alt="" loading="lazy" />
            <div className="task-main">
              <div className="task-title">
                <h4>{task.name}</h4>
                {task.status === 'running' && <span className="task-badge running"><i />生成中</span>}
                {task.status === 'queued' && <span className="task-badge queued">排队中</span>}
                {task.status === 'done' && <span className="task-badge done"><CheckCircle2 size={11} />已完成</span>}
              </div>
              <p className="task-prompt" title={task.prompt}>{task.prompt}</p>
              <div className="task-meta">
                <span>{task.model}</span>
                <i aria-hidden="true" />
                <span>{task.size}</span>
                <i aria-hidden="true" />
                <span>{task.created}</span>
              </div>
            </div>
            <div className="task-side">
              {task.status === 'running' && <>
                <div className="task-progress"><i style={{ width: `${task.progress}%` }} /></div>
                <span className="task-status-text">{task.progress}% · {task.eta}</span>
              </>}
              {task.status === 'queued' && <span className="task-status-text">前面还有 {task.queue} 个任务</span>}
              {task.status === 'done' && <span className="task-status-text done">产出 {task.resultCount} 张 · 用时 {task.duration}</span>}
              {task.status === 'done'
                ? <button type="button" className="task-action" onClick={() => onView(task)}>查看结果</button>
                : <button type="button" className="task-action ghost" onClick={() => onCancel(task.id)}><X size={12} />取消</button>}
            </div>
          </article>)}
        </div>}
    </section>)}
  </>;
}

function BgmModule({ groups, playing, favorites, onPlay, onFavorite }) {
  const allTracks = groups.flatMap(group => group.items);
  const total = allTracks.length;
  const displayGroups = groups.map(group => group.id === 'favorites'
    ? { ...group, items: allTracks.filter(track => favorites.includes(track.id)) }
    : group);
  return <>
    <ModuleHead
      title="BGM 库"
      count={total}
      desc="按情绪和场景归档的背景音乐，先在这里试听，选中后可直接挂到成片或分镜。"
      meta="5 首 · 11 分 32 秒"
      metaIcon={<Music2 size={13} />}
    />
    {displayGroups.map(group => <section className="module-group" key={group.id}>
      <ModuleGroupHead label={group.label} note={group.note} count={group.items.length} />
      {group.items.length === 0
        ? <div className="module-inline-empty">还没有收藏的配乐，点右侧星标就能收进来。</div>
        : <div className="bgm-list">
          {group.items.map(track => {
          const isPlaying = playing === track.id;
          const isFavorite = favorites.includes(track.id);
          return <article className={`bgm-row ${isPlaying ? 'playing' : ''}`} key={track.id}>
            <button type="button" className="bgm-play" onClick={() => onPlay(track.id)} aria-label={isPlaying ? `暂停 ${track.title}` : `播放 ${track.title}`}>
              {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
            </button>
            <div className="bgm-main">
              <div className="bgm-title">
                <h4>{track.title}</h4>
                {isPlaying && <span className="bgm-eq" aria-hidden="true">
                  {[0, 1, 2, 3].map(index => <i key={index} style={{ animationDelay: `${index * 0.13}s` }} />)}
                </span>}
              </div>
              <div className="bgm-mood">
                {track.mood.map(mood => <span key={mood}>{mood}</span>)}
                <em>{track.desc}</em>
              </div>
            </div>
            <span className="bgm-uses">{track.uses ? `已用于 ${track.uses} 条成片` : '尚未使用'}</span>
            <span className="bgm-duration">{track.duration}</span>
            <button
              type="button"
              className={`bgm-star ${isFavorite ? 'favorite' : ''}`}
              onClick={() => onFavorite(track.id)}
              aria-label={isFavorite ? `取消收藏 ${track.title}` : `收藏 ${track.title}`}
            >
              <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          </article>;
        })}
        </div>}
    </section>)}
  </>;
}

export default function AssetsPage({ projectId }) {
  const [category, setCategory] = useState('人物');
  const [assets, setAssets] = useState(() => ({ ...INITIAL_ASSETS, ...workspaceAssets() }));
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [projectFilter, setProjectFilter] = useState(projectId || '');

  useEffect(() => {
    setProjectFilter(projectId || '');
  }, [projectId]);
  const [creatorFilter, setCreatorFilter] = useState('');
  const [scriptFilter, setScriptFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [openMenu, setOpenMenu] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', role: '', gender: '', age: '', tags: '', script: '', prompt: '', cover: null });
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [taskGroups, setTaskGroups] = useState(INITIAL_TASK_GROUPS);
  const [playingBgm, setPlayingBgm] = useState('');
  const [bgmFavorites, setBgmFavorites] = useState(['b-4', 'b-5']);

  const toolbarRef = useRef(null);
  const fileRef = useRef(null);

  const isCollection = COLLECTION_TABS.includes(category);
  const isPerson = category === '人物';
  const list = (assets[category] || []).filter(item => !projectFilter || item.projectId === projectFilter);
  const filtersActive = Boolean(query.trim() || projectFilter || creatorFilter || scriptFilter || tagFilter);

  // 剧本下拉：固定选项 + 各分类数据里实际出现过的剧本（去重）
  const scriptChoices = useMemo(() => {
    const used = [...(assets.人物 || []), ...(assets.场景 || []), ...(assets.道具 || [])]
      .map(item => item.script)
      .filter(Boolean);
    return [...new Set([...SCRIPT_OPTIONS, ...EXTRA_SCRIPT_OPTIONS, ...used])];
  }, [assets]);

  // 标签下拉：人物用固定词表，场景 / 道具从数据里收敛
  const tagChoices = useMemo(() => {
    if (isPerson) return TAG_OPTIONS;
    const used = new Set();
    [...(assets.场景 || []), ...(assets.道具 || [])].forEach(item => (item.tags || []).forEach(tag => used.add(tag)));
    return ['有图', ...[...used].slice(0, 12)];
  }, [assets, isPerson]);

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const filtered = list.filter(item => {
      if (keyword) {
        const haystack = [item.name, item.alias, ...(item.tags || [])].join(' ').toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      if (creatorFilter && item.creator !== creatorFilter) return false;
      if (scriptFilter && (item.script || '') !== scriptFilter) return false;
      if (tagFilter === '有图' && !item.cover) return false;
      if (tagFilter && tagFilter !== '有图' && !(item.tags || []).includes(tagFilter)) return false;
      return true;
    });
    if (sort === 'oldest') return [...filtered].sort((a, b) => b.rank - a.rank);
    if (sort === 'name') return [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
    return [...filtered].sort((a, b) => a.rank - b.rank);
  }, [list, query, creatorFilter, scriptFilter, tagFilter, sort]);

  const countLabel = filtersActive || projectId ? String(visible.length) : category === '人物' ? '30+' : String(list.length);

  useEffect(() => {
    let cancelled = false;
    api.list('assets', 500, projectId).then(({ items }) => {
      if (cancelled) return;
      setAssets(previous => {
        const next = { ...previous };
        for (const item of items) {
          const categoryItems = next[item.category] || [];
          next[item.category] = [
            { ...item, time: '已保存', rank: item.rank || 0, tags: item.tags || [], badges: item.badges || [] },
            ...categoryItems.filter(existing => existing.id !== item.id),
          ];
        }
        return next;
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!openMenu) return undefined;
    const onPointerDown = event => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target)) setOpenMenu('');
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [openMenu]);

  useEffect(() => {
    if (!modalOpen) return undefined;
    const onKeyDown = event => {
      if (event.key === 'Escape') closeModal();
    };
    document.body.classList.add('assets-modal-open');
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.classList.remove('assets-modal-open');
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [modalOpen]);

  const resetFilters = () => {
    setQuery('');
    setProjectFilter('');
    setCreatorFilter('');
    setScriptFilter('');
    setTagFilter('');
    setOpenMenu('');
  };

  const switchCategory = next => {
    if (next === category) return;
    setCategory(next);
    resetFilters();
    setError('');
  };

  const saveGeneration = generation => {
    const targetList = assets[generation.kind] || [];
    const minRank = targetList.reduce((min, item) => Math.min(min, item.rank), 0);
    const nextItem = {
      id: `${generation.kind}-gen-${Date.now()}`,
      name: generation.name,
      alias: '',
      tags: generation.tags,
      badges: ['生图'],
      creator: '罗剑',
      time: '刚刚',
      script: generation.script,
      prompt: generation.prompt,
      cover: generation.image,
      rank: minRank - 1,
    };
    setAssets(previous => ({ ...previous, [generation.kind]: [nextItem, ...previous[generation.kind]] }));
    setToast(`已存入${generation.kind}资产，可继续补标签`);
  };

  const regenerate = generation => {
    const activeCount = taskGroups.find(group => group.id === 'active')?.items.length || 0;
    const nextTask = {
      id: `task-${Date.now()}`,
      name: `${generation.name} · 再生成`,
      image: generation.image,
      status: 'queued',
      queue: activeCount + 1,
      model: generation.model,
      size: generation.size,
      created: '刚刚',
      prompt: generation.prompt,
    };
    setTaskGroups(previous => previous.map(group => group.id === 'active'
      ? { ...group, items: [nextTask, ...group.items] }
      : group));
    setToast('已加入生图队列，可在「生图任务」里看进度');
  };

  const cancelTask = taskId => {
    setTaskGroups(previous => previous.map(group => group.id === 'active'
      ? { ...group, items: group.items.filter(task => task.id !== taskId) }
      : group));
    setToast('已取消该生图任务');
  };

  const viewGeneration = () => {
    switchCategory('生图');
    setToast('已切换到生图记录');
  };

  const toggleBgm = trackId => {
    setPlayingBgm(previous => (previous === trackId ? '' : trackId));
  };

  const toggleBgmFavorite = trackId => {
    setBgmFavorites(previous => (previous.includes(trackId)
      ? previous.filter(id => id !== trackId)
      : [...previous, trackId]));
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', role: category === '人物' ? '配角' : '', gender: category === '人物' ? '女' : '', age: category === '人物' ? '青年' : '', tags: '', script: '', prompt: '', cover: null });
    setError('');
    setModalOpen(true);
    setOpenMenu('');
  };

  const openEdit = item => {
    const chips = deriveChips(item.tags);
    const extra = (item.tags || []).filter(tag => !ROLES.includes(tag) && !GENDERS.includes(tag) && !AGES.includes(tag));
    setEditing(item);
    setForm({
      name: item.name,
      role: chips.role,
      gender: chips.gender,
      age: chips.age,
      tags: extra.join(' '),
      script: item.script || '',
      prompt: item.prompt || '',
      cover: item.cover,
    });
    setError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setError('');
  };

  const patchForm = patch => {
    setForm(previous => ({ ...previous, ...patch }));
    if (error) setError('');
  };

  const pickCover = file => {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      setError('形象图只支持图片文件');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => patchForm({ cover: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    const name = form.name.trim();
    if (!name) {
      setError('先给这张资产起个名字');
      return;
    }
    const extraTags = form.tags.split(/[\s,，、/]+/).filter(Boolean);
    const nextTags = category === '人物'
      ? uniq([form.role, form.gender, form.age, ...extraTags])
      : uniq(extraTags);
    const script = form.script || '';

    const prompt = form.prompt.trim();
    // shortcut: covers stay inline for this local prototype; move them to object storage before production.
    const saved = {
      ...(editing || {}), category, name, alias: editing?.alias || '', tags: nextTags,
      badges: editing?.badges || [], creator: '罗剑', time: '刚刚', script, prompt,
      cover: form.cover, rank: editing?.rank ?? Date.now(), projectId,
    };

    if (editing) {
      if (editing.projectId !== undefined) {
        try { await api.patch('assets', editing.id, saved); }
        catch (err) { setError(err.message); return; }
      }
      setAssets(previous => ({
        ...previous,
        [category]: previous[category].map(item => (item.id === editing.id
          ? { ...item, ...saved }
          : item)),
      }));
      setToast(`已保存「${name}」的资料`);
    } else {
      const minRank = list.reduce((min, item) => Math.min(min, item.rank), 0);
      let nextItem = { ...saved, rank: minRank - 1 };
      try { nextItem = await api.create('assets', nextItem); }
      catch (err) { setError(err.message); return; }
      setAssets(previous => ({ ...previous, [category]: [nextItem, ...previous[category]] }));
      setToast(`已新建「${name}」，可以继续补形象图`);
    }

    resetFilters();
    if (sort !== 'recent') setSort('recent');
    setModalOpen(false);
    setEditing(null);
  };

  return <div className="ws-shell">
    <header className="ws-header">
      <div className="ws-header-left">
        <span className="ws-project"><ImagePlus size={14} /> 资产库</span>
      </div>
      <div className="ws-header-right">
        {isCollection && (
          <>
            <input
              className="ws-hub-search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="搜索名称 / 别名 / 标签…"
              aria-label="搜索资产"
            />
            <button type="button" className="ws-btn primary" onClick={openCreate}>
              <Plus size={14} /> 新建{category}
            </button>
          </>
        )}
      </div>
    </header>
    <div className="ws-page-body">
    <main className="assets-page">
      <div className="ws-hub-head">
        <div>
          <h2>我的资产</h2>
        </div>
        <div className="ws-hub-filters">
          <div className="ws-hub-tabs" role="tablist" aria-label="资产分类">
            {CATEGORIES.map(name => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={category === name}
                className={category === name ? 'active' : ''}
                onClick={() => switchCategory(name)}
              >
                {name}
              </button>
            ))}
          </div>
          {isCollection && (
            <>
              <select
                className="ws-hub-style-select"
                value={projectFilter}
                onChange={e => setProjectFilter(e.target.value)}
                aria-label="按项目筛选"
              >
                <option value="">全部项目</option>
                {DEMO_PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select
                className="ws-hub-style-select"
                value={sort}
                onChange={e => setSort(e.target.value)}
                aria-label="排序方式"
              >
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <span className="ws-hub-count">共 {countLabel}</span>
            </>
          )}
        </div>
      </div>

    {isCollection ? <>
      

      {visible.length > 0 ? <div className="asset-grid">
        {visible.map(item => <article
          key={item.id}
          className="asset-card"
          role="button"
          tabIndex={0}
          aria-label={`${item.name}，点击编辑`}
          onClick={() => openEdit(item)}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openEdit(item);
            }
          }}
        >
          <div className={`asset-cover ${item.cover ? 'has-image' : ''}`}>
            {item.cover
              ? <img src={item.cover} alt={`${item.name}的形象图`} loading="lazy" />
              : <div className="asset-cover-empty">
                <AssetCloud />
                <span>还没有图</span>
              </div>}
            {(item.badges?.length > 0 || item.badge) && <div className="asset-badges">
              {(item.badges || [item.badge]).filter(Boolean).map(badge => <span key={badge} className="asset-badge">{badge}</span>)}
            </div>}
            <span className="asset-edit-hint">编辑资料</span>
          </div>
          <div className="asset-info">
            <h3 className="asset-name" title={item.name}>{item.name}</h3>
            <div className="asset-tags">
              {(item.tags || []).slice(0, item.tagLimit || 6).map(tag => <span key={tag} className={`asset-tag ${ROLES.includes(tag) ? 'is-role' : ''}`}>{tag}</span>)}
              {(item.tags || []).length > (item.tagLimit || 6) && <span className="asset-tag asset-tag-more">…</span>}
            </div>
            {!isPerson && item.prompt && <p className="asset-prompt" title={item.prompt}>{item.prompt}</p>}
            <p className="asset-meta">
              <span className="asset-meta-main">
                <span className="asset-creator">{item.creator}</span>
                <i aria-hidden="true" />
                <span className="asset-time">{item.time}</span>
              </span>
              {item.script && item.script !== '未关联剧本' && <span className="asset-meta-script">{item.script}</span>}
            </p>
          </div>
        </article>)}
      </div> : <section className="asset-empty-panel">
        <AssetCloud />
        <h2>{filtersActive ? `没有找到匹配的${category}` : `还没有${category}资产`}</h2>
        <p>{filtersActive ? '换个关键词或清掉筛选条件再试试。' : `从剧本拆出来的${category}会出现在这里，也可以先手动建一张。`}</p>
        <div className="asset-empty-actions">
          {filtersActive
            ? <button type="button" className="asset-ghost" onClick={resetFilters}>清除筛选</button>
            : <button type="button" className="asset-primary small" onClick={openCreate}><Plus size={15} /> 新建{category}</button>}
        </div>
      </section>}
    </> : category === '生图' ? (
      <GenerationModule groups={GENERATION_GROUPS} onSave={saveGeneration} onRegenerate={regenerate} />
    ) : category === '生图任务' ? (
      <TaskModule groups={taskGroups} onCancel={cancelTask} onView={viewGeneration} />
    ) : (
      <BgmModule
        groups={BGM_GROUPS}
        playing={playingBgm}
        favorites={bgmFavorites}
        onPlay={toggleBgm}
        onFavorite={toggleBgmFavorite}
      />
    )}

    {modalOpen && <div className="asset-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeModal(); }}>
      <div className="asset-modal" role="dialog" aria-modal="true" aria-labelledby="asset-modal-title">
        <header className="asset-modal-head">
          <div>
            <h2 id="asset-modal-title">{editing ? `编辑${category}` : `新建${category}`}</h2>
            <p>{editing ? '改完保存，所有引用这张卡的分镜会一起更新。' : '先建一张卡，形象图和提示词可以之后再补。'}</p>
          </div>
          <button type="button" className="asset-modal-close" aria-label="关闭" onClick={closeModal}><X size={18} /></button>
        </header>

        <div className="asset-form">
          <label className="asset-field">
            <span>名称 <i>*</i></span>
            <input
              value={form.name}
              onChange={event => patchForm({ name: event.target.value })}
              placeholder={category === '人物' ? '比如：妈妈 / 小女孩 / 周掌柜' : `比如：${category === '场景' ? '雨夜老街' : '旧怀表'}`}
              maxLength={40}
              autoFocus
            />
          </label>

          <label className="asset-field">
            <span>关联剧本</span>
            <div className="asset-select">
              <select value={form.script} onChange={event => patchForm({ script: event.target.value })}>
                <option value="">未关联剧本</option>
                {scriptChoices.filter(option => option !== '未关联剧本').map(option => <option key={option} value={option}>{option}</option>)}
              </select>
              <ChevronDown size={16} />
            </div>
          </label>

          {category === '人物' && <>
            <div className="asset-field">
              <span>角色定位</span>
              <div className="chip-row">
                {ROLES.map(role => <button
                  key={role}
                  type="button"
                  className={`chip ${form.role === role ? 'selected' : ''}`}
                  onClick={() => patchForm({ role: form.role === role ? '' : role })}
                >{role}</button>)}
              </div>
            </div>

            <div className="asset-form-row">
              <div className="asset-field">
                <span>性别</span>
                <div className="chip-row">
                  {GENDERS.map(gender => <button
                    key={gender}
                    type="button"
                    className={`chip ${form.gender === gender ? 'selected' : ''}`}
                    onClick={() => patchForm({ gender: form.gender === gender ? '' : gender })}
                  >{gender}</button>)}
                </div>
              </div>
              <div className="asset-field">
                <span>年龄段</span>
                <div className="chip-row">
                  {AGES.map(age => <button
                    key={age}
                    type="button"
                    className={`chip ${form.age === age ? 'selected' : ''}`}
                    onClick={() => patchForm({ age: form.age === age ? '' : age })}
                  >{age}</button>)}
                </div>
              </div>
            </div>
          </>}

          <label className="asset-field">
            <span>补充标签</span>
            <input
              value={form.tags}
              onChange={event => patchForm({ tags: event.target.value })}
              placeholder={category === '人物' ? '空格或逗号分隔，如：老年 坚韧 家庭' : '空格或逗号分隔，如：夜景 外景 古风'}
              maxLength={80}
            />
          </label>

          <label className="asset-field">
            <span>画面提示词</span>
            <textarea
              className="asset-textarea"
              rows={3}
              value={form.prompt}
              onChange={event => patchForm({ prompt: event.target.value })}
              placeholder={category === '人物'
                ? '体型 / 面部 / 服装 / 光线，例如：清瘦，剑眉，青色长衫，侧逆光'
                : '时间 / 天气 / 机位 / 色调，例如：雨夜，低机位，暖黄路灯，胶片颗粒'}
              maxLength={200}
            />
          </label>

          <div className="asset-field">
            <span>形象图</span>
            <div className="asset-upload-row">
              <button
                type="button"
                className={`asset-upload ${form.cover ? 'has-cover' : ''}`}
                onClick={() => fileRef.current?.click()}
                aria-label={form.cover ? '更换形象图' : '上传形象图'}
              >
                {form.cover ? <img src={form.cover} alt="形象图预览" /> : <>
                  <ImagePlus size={21} />
                  <em>上传图片</em>
                </>}
              </button>
              <div className="asset-upload-copy">
                <p>支持 JPG / PNG，建议竖版 3:4。</p>
                {form.cover && <button type="button" className="asset-link" onClick={() => patchForm({ cover: null })}>移除形象图</button>}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={event => {
                  pickCover(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </div>
          </div>
        </div>

        {error && <p className="asset-form-error" role="alert">{error}</p>}

        <footer className="asset-modal-foot">
          <p>{category === '人物' ? '标签会按「定位 / 性别 / 年龄 / 补充标签」的顺序保存。' : '主图之后可以随时替换，不影响已经引用的分镜。'}</p>
          <div>
            <button type="button" className="asset-ghost" onClick={closeModal}>取消</button>
            <button type="button" className="asset-primary" onClick={submit}>{editing ? '保存修改' : `创建${category}`}</button>
          </div>
        </footer>
      </div>
    </div>}

    {toast && <div className="asset-toast" role="status"><Check size={16} />{toast}</div>}
  </main>
  </div>
  </div>;
}
