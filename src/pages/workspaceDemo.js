// /app/workspace 演示数据：纯前端，不接后端
import charSuwan from '../assets/people/suwan-new.png';
import charShenyan from '../assets/people/shenyan-new.png';
import charMystery from '../assets/people/mystery-new.webp';
import sceneRainAlley from '../assets/assets/scene-rain-alley-new.webp';
import sceneHerbShop from '../assets/assets/scene-herb-shop-new.webp';
import sceneRooftopDusk from '../assets/assets/scene-rooftop-dusk-new.webp';
import sceneLanternMarket from '../assets/assets/scene-lantern-market.jpg';
import sceneMountainCave from '../assets/assets/scene-mountain-cave.jpg';
import sceneWarehouse from '../assets/assets/scene-warehouse.jpg';
import propPocketWatch from '../assets/assets/prop-pocket-watch-new.jpg';
import propBrassKey from '../assets/assets/prop-brass-key-new.webp';
import propOldPhoto from '../assets/assets/prop-old-photo-new.webp';

// 五步生产阶段（Harness 里程碑）
export const STAGES = [
  { key: 'script', label: '剧本', desc: '拆场次 · 锁风格 · 标动捕' },
  { key: 'assets', label: '资产图', desc: '人物三视图 · 道具 · 场景底板' },
  { key: 'review', label: '审核', desc: '齐套 · 剧本贴合 · 风格统一' },
  { key: 'video', label: '生视频', desc: '仅图生视频 · 逐镜生成' },
  { key: 'publish', label: '发布', desc: '多平台文案 · 分发队列' },
];

// 8 种固定视觉风格（占位名称，可替换）
export const STYLES = [
  { key: 'fresh', name: '日系清新', tone: 'linear-gradient(135deg,#f6efe4,#bfe0e8)' },
  { key: 'noir', name: '暗调电影感', tone: 'linear-gradient(135deg,#1d2430,#5a4632)' },
  { key: 'ink', name: '国风水墨', tone: 'linear-gradient(135deg,#f3f1ea,#5b5f5c)' },
  { key: 'cyber', name: '赛博霓虹', tone: 'linear-gradient(135deg,#1b1240,#d23d9c)' },
  { key: 'film', name: '复古胶片', tone: 'linear-gradient(135deg,#e9d6ae,#8a5a3b)' },
  { key: 'comic', name: '美式漫画', tone: 'linear-gradient(135deg,#ffd84a,#e2412e)' },
  { key: 'soft', name: '韩系柔光', tone: 'linear-gradient(135deg,#fbe7ea,#e7d9f3)' },
  { key: 'docu', name: '写实纪实', tone: 'linear-gradient(135deg,#d9d6cf,#59615f)' },
];
export const RECOMMENDED_STYLE = 'noir';

export const PRESET_SCRIPT = {
  title: '《雨巷迷踪》EP01 · 停走的怀表',
  meta: '民国悬疑短剧 · 3 场 · 约 90 秒',
  excerpt: [
    '【剧集信息】《雨巷迷踪》第一集《停走的怀表》｜ 民国悬疑 ｜ 时长约 90 秒',
    '【出场人物】苏晚（25岁，女记者，米色风衣、短发）、沈砚（32岁，药铺账房，长衫、圆框眼镜）、神秘人（礼帽黑衣）',
    '',
    '第1场 ｜ 雨夜老街 · 夜 / 外',
    '人物：苏晚、神秘人',
    '△【全景·推镜头】深夜暴雨，雨夜老街青石板反着昏黄路灯光。',
    '△ 苏晚撑着油纸伞快步穿行在窄巷阴影里，左手紧攥着半张边角卷曲的泛黄旧照片，目光死死盯着前方十步外戴礼帽的神秘人。',
    '△【特写】雨水顺着伞骨滴落。神秘人闪身拐进挂着“济世堂”灯笼的药铺后门，门闩“咔嗒”一声从内落锁。',
    '△ 苏晚追到后门推了推，纹丝不动；她低头看了一眼泛黄旧照片背面褪色的墨字，收伞绕向药铺前门。',
    '苏晚（压低声音，自语）：照片背面画的就是济世堂……三点十五分，人怎么一转眼就不见了？',
    '',
    '第2场 ｜ 药铺内景 · 夜 / 内',
    '人物：苏晚、沈砚',
    '△【中景·摇镜头】几分钟后，药铺内景幽暗，满墙木质药柜，柜台上方一盏暖黄吊灯在浮尘中摇晃。',
    '△ 沈砚坐在柜台后拨着算盘，头也不抬。苏晚推开前门抖落雨水大步走近，把泛黄旧照片拍在台面上，目光扫向通往后院的布帘。',
    '苏晚（急切）：别装了！刚刚那个穿黑衣戴礼帽的人进了你们后门，我要见他。',
    '△ 沈砚停下算盘，抬眼透过圆框眼镜冷冷打量她，没往后院看，反而从抽屉里取出一只停走的怀表和一枚氧化的黄铜钥匙，推到灯光下。',
    '△【特写】怀表表盖弹开，指针死死停在 3:15；旁边的黄铜钥匙牌上刻着“07 · 钟楼天台”。',
    '沈砚（低沉，冷静）：后院只有死胡同。苏记者，别查了——照片上你要找的人，三天前就已经死了。这只停走的怀表和 07 号黄铜钥匙，是他临死前托我转交的最后一次警告。',
    '△ 苏晚猛地攥紧黄铜钥匙，抬头却见药铺后窗外闪过一道礼帽黑影；她顾不上追问，抓起桌上的旧照片转身冲出门去。',
    '',
    '第3场 ｜ 黄昏天台 · 黄昏 / 外',
    '人物：苏晚、神秘人',
    '△【大远景·跟拍】次日黄昏，苏晚凭着 07 号黄铜钥匙的线索找上老城钟楼旁的黄昏天台，晚霞压得很低，逆光剪影强烈。',
    '△ 苏晚刚推开天台铁门，只见神秘人正站在天台女儿墙边缘，脚边是被 07 号同款钥匙撬开的旧铁盒，手里举着另外半张刚好能拼齐的泛黄旧照片。',
    '苏晚（喘息，大喊）：站住！停走的怀表和这半张照片，到底是谁让你放在济世堂的？！',
    '△【高难动作·动捕】神秘人冷笑一声，将手里的半张旧照片朝空中一扬，转身纵身翻越屋顶，凌空翻滚落地后迅速消失在楼下晚高峰的人群中。',
    '△【定格特写】苏晚冲到护栏边伸手接住飘落的半张旧照片——两半照片合在一起，背面竟是一行完整的字：“明晚三点十五，天台见”。',
  ].join('\n'),
};

export const IDEA_EXAMPLE = '民国雨夜，女记者追查一桩失踪案，线索指向一只停走的怀表。';

// 一、项目级属性（Project Metadata · Agent Harness 全局上下文）
export const PROJECT_METADATA = {
  title: '《雨巷迷踪》EP01 · 停走的怀表',
  synopsis: '民国雨夜，女记者苏晚追查一桩失踪案，尾随神秘人至济世堂药铺，从账房沈砚手中拿到停在 3:15 的怀表与 07 号黄铜钥匙，次日黄昏追至钟楼天台揭开“明晚三点十五，天台见”的新悬念。',
  aspect_ratio: '16:9',
  narrative_style: '民国悬疑 · 强钩子快节奏',
  visual_style: '暗调电影感 · 低照度冷暖对比 · 35mm 胶片颗粒',
  characters: [
    { id: 'C01', name: '苏晚', desc: '25岁女记者，短发、米色风衣、手持油纸伞' },
    { id: 'C02', name: '沈砚', desc: '32岁药铺账房，深色长衫、圆框眼镜、神情冷峻' },
    { id: 'C03', name: '神秘人', desc: '反派黑衣人，黑色礼帽、立领长风衣、帽檐压低遮脸' },
  ],
  locations: [
    { id: 'L01', name: '雨夜老街', desc: '民国窄巷青石板、湿滑反光、济世堂后门红灯笼' },
    { id: 'L02', name: '药铺内景', desc: '幽暗中药铺、满墙木质药柜、柜台上方暖黄摇晃吊灯' },
    { id: 'L03', name: '黄昏天台', desc: '老城钟楼旁天台、低矮女儿墙、黄昏晚霞逆光剪影' },
  ],
  props: [
    { id: 'P01', name: '停走的怀表', owner: 'C02 → C01', initial_state: '表盖闭合，指针停在 3:15' },
    { id: 'P02', name: '黄铜钥匙', owner: 'C02 → C01', initial_state: '氧化黄铜质地，刻有“07 · 钟楼天台”' },
    { id: 'P03', name: '泛黄旧照片', owner: 'C01 / C03', initial_state: '撕成两半的民国合影，背面有褪色墨字' },
  ],
  global_constraints: [
    '全片锁定「暗调电影感」，中途不可切换风格',
    '人物外貌与服饰跨镜头严格一致（绑定 C01/C02/C03 过审资产）',
    '民国时代背景：严禁出现现代建筑、霓虹灯牌、现代手机或服饰',
  ],
};

// 二、最终给 AI 的结构化剧本（YAML）
export const AI_SCRIPT_YAML = `project:
  title: ${PROJECT_METADATA.title}
  aspect_ratio: "${PROJECT_METADATA.aspect_ratio}"
  visual_style: ${PROJECT_METADATA.visual_style}
  narrative_style: ${PROJECT_METADATA.narrative_style}
  global_constraints:
    - 严禁出现现代建筑、现代服饰
    - 人物与道具必须引用过审资产 ID（C01/C02/C03, P01/P02/P03, L01/L02/L03）

scenes:
  - id: E01-S01
    title: 雨夜尾随
    function: 建立悬疑氛围，引入女主角与济世堂线索
    location: L01
    time: night
    environment: exterior
    characters: [C01, C03]
    props:
      - id: P03
        initial_state: C01 左手紧攥半张边角卷曲的泛黄旧照片
        final_state: C01 低头查看照片背面“济世堂”墨字
    shots:
      - id: c01
        duration: 5
        shot_type: wide_shot
        camera_movement: push_in
        subject: C01
        action: 苏晚撑着油纸伞快步穿行窄巷，尾随拐进济世堂后门落锁的神秘人
        spatial_relationship:
          position: 画面中央偏左（前景苏晚，十步外远景 C03）
          background: L01 民国雨夜老街
        lighting:
          description: 暖黄色药铺灯笼与冷灰色暴雨夜形成强烈对比
        dialogue: "苏晚（压低声音，自语）：照片背面画的就是济世堂……三点十五分，人怎么一转眼就不见了？"
        constraints:
          - 不出现现代建筑
          - 不出现其他无关行人

  - id: E01-S02
    title: 药铺对峙
    function: 抛出死亡反转与 07 号黄铜钥匙新线索
    location: L02
    time: night
    environment: interior
    characters: [C01, C02]
    props:
      - id: P01
        initial_state: 置于柜台抽屉内，表盖闭合
        final_state: 推至灯光下弹开表盖，指针停在 3:15
      - id: P02
        initial_state: 刻有“07 · 钟楼天台”的氧化黄铜钥匙
        final_state: 被 C01 攥紧带离药铺
    shots:
      - id: c02
        duration: 8
        shot_type: medium_shot
        camera_movement: pan
        subject: C02
        action: 苏晚拍下旧照片质问，沈砚停下算盘推出停走的怀表与 07 号黄铜钥匙
        spatial_relationship:
          position: 柜台两侧双人对峙构图
          background: L02 满墙木质药柜与摇晃吊灯
        lighting:
          description: 柜台上方单盏暖黄吊灯照亮桌面道具，四周暗部压低
        dialogue:
          - "苏晚（急切）：别装了！刚刚那个穿黑衣戴礼帽的人进了你们后门，我要见他。"
          - "沈砚（低沉，冷静）：后院只有死胡同。苏记者，别查了——照片上你要找的人，三天前就已经死了。这只停走的怀表和 07 号黄铜钥匙，是他临死前托我转交的最后一次警告。"
        constraints:
          - 怀表指针必须清晰停在 3:15
          - 禁止现代照明灯具

  - id: E01-S03
    title: 天台追逐
    function: 高潮动作戏，拼齐照片留下集尾悬念
    location: L03
    time: dusk
    environment: exterior
    mocap_required: true
    characters: [C03, C01]
    props:
      - id: P03
        initial_state: C03 手持另半张泛黄旧照片
        final_state: C01 接住飘落照片并与前半张拼齐
    shots:
      - id: c03
        duration: 6
        shot_type: extreme_long_shot
        camera_movement: tracking
        routing_channel: Mocap-Engine-V2
        subject: C03
        action: 神秘人扬手甩出照片，纵身翻越屋顶、凌空翻滚落地逃脱
        spatial_relationship:
          position: 女儿墙边缘高处剪影与门口追赶的 C01 形成纵深
          background: L03 黄昏天台逆光晚霞
        lighting:
          description: 黄昏低角度逆光剪影，冷暖霞光交界
        dialogue: "苏晚（喘息，大喊）：站住！停走的怀表和这半张照片，到底是谁让你放在济世堂的？！"
        constraints:
          - 高难度翻越动作强制走深度动捕通道
          - 严禁文生视频直出`;

// 剧本拆解结果
export const BREAKDOWN = {
  scenes: [
    { id: 'sc1', no: '第1场', place: '雨夜老街', time: '夜 / 外', beat: '苏晚撑伞尾随神秘人进入窄巷' },
    { id: 'sc2', no: '第2场', place: '药铺内景', time: '夜 / 内', beat: '沈砚推出怀表，揭示失踪者已死' },
    { id: 'sc3', no: '第3场', place: '天台', time: '黄昏 / 外', beat: '神秘人翻越屋顶、落地翻滚逃脱', hard: true },
  ],
  characters: [
    { id: 'c1', name: '苏晚', role: '女主 · 记者', look: '短发、米色风衣、油纸伞' },
    { id: 'c2', name: '沈砚', role: '男二 · 药铺账房', look: '长衫、圆框眼镜、冷面' },
    { id: 'c3', name: '神秘人', role: '反派 · 黑衣礼帽', look: '黑色礼帽、立领长风衣、帽檐压低' },
  ],
  props: [
    { id: 'p1', name: '停走的怀表', scene: '第2场' },
    { id: 'p2', name: '黄铜钥匙', scene: '第2场' },
    { id: 'p3', name: '泛黄旧照片', scene: '第1场' },
  ],
  places: [
    { id: 'e1', name: '雨夜老街', scene: '第1场' },
    { id: 'e2', name: '药铺内景', scene: '第2场' },
    { id: 'e3', name: '黄昏天台', scene: '第3场' },
  ],
  hardActions: [
    { id: 'h1', scene: '第3场', action: '翻越屋顶 + 落地翻滚', level: '高', channel: '深度动作捕捉通道' },
  ],
};

// 第 2 步画布上的资产节点
// failFirst：首轮自检故意不过，演示自动重跑
export const ASSET_NODES = [
  { id: 'a-c1', group: 'character', name: '苏晚', sub: '人物三视图', img: charSuwan, prompt: '民国女记者，短发，米色风衣，手持油纸伞，正/侧/背三视图，纯色背景' },
  { id: 'a-c2', group: 'character', name: '沈砚', sub: '人物三视图', img: charShenyan, prompt: '民国药铺账房，长衫，圆框眼镜，神情冷峻，正/侧/背三视图，纯色背景' },
  { id: 'a-c3', group: 'character', name: '神秘人', sub: '人物三视图', img: charMystery, prompt: '民国黑衣神秘人，黑色礼帽、立领长风衣、帽檐压低遮脸，暗调剪影感，正/侧/背三视图' },
  { id: 'a-p1', group: 'prop', name: '停走的怀表', sub: '道具图', img: propPocketWatch, failFirst: true, failNote: '画面偏亮，与「暗调电影感」不符', fixNote: '追加约束：低照度、冷暖对比、暗部压低', prompt: '民国银质怀表，表盖微开，指针停在 3:15，独立成图' },
  { id: 'a-p2', group: 'prop', name: '黄铜钥匙', sub: '道具图', img: propBrassKey, prompt: '老式黄铜钥匙，表面氧化，独立成图' },
  { id: 'a-p3', group: 'prop', name: '泛黄旧照片', sub: '道具图', img: propOldPhoto, prompt: '民国泛黄合影照片，边角卷曲，独立成图' },
  { id: 'a-e1', group: 'place', name: '雨夜老街', sub: '场景底板', img: sceneRainAlley, prompt: '民国雨夜老街，湿石板反光，暖黄路灯，两侧高墙，空镜无人' },
  { id: 'a-e2', group: 'place', name: '药铺内景', sub: '场景底板', img: sceneHerbShop, prompt: '民国药铺内景，满墙药柜，柜台吊灯，浮尘，空镜无人' },
  { id: 'a-e3', group: 'place', name: '黄昏天台', sub: '场景底板', img: sceneRooftopDusk, prompt: '民国城市天台，黄昏逆光，远处屋檐剪影，空镜无人' },
];

export const GROUP_META = {
  character: { label: '人物', color: '#2f6fb0' },
  prop: { label: '道具', color: '#b5791c' },
  place: { label: '场景', color: '#2e8a5c' },
};

// 新建项目的预设封面（可在此基础上新增或上传自定义封面）
export const COVER_PRESETS = [
  { id: 'cover-rain', name: '雨夜老街', src: sceneRainAlley },
  { id: 'cover-herb', name: '药铺内景', src: sceneHerbShop },
  { id: 'cover-rooftop', name: '黄昏天台', src: sceneRooftopDusk },
  { id: 'cover-lantern', name: '灯会夜市', src: sceneLanternMarket },
  { id: 'cover-cave', name: '山洞', src: sceneMountainCave },
  { id: 'cover-warehouse', name: '仓库', src: sceneWarehouse },
];

// 工作台首页项目列表
export const DEMO_PROJECTS = [
  {
    id: 'proj-rain-alley',
    name: '《雨巷迷踪》第1季',
    desc: '民国雨夜，女记者追查一桩失踪案，线索指向一只停走的怀表。',
    genre: '民国悬疑短剧',
    styleKey: 'noir',
    cover: sceneRainAlley,
    sessionsCount: 3,
    stageIndex: 1,
    status: 'active',
    statusText: '进行中 · 资产图',
    favorite: false,
    quotaUsed: 160,
    quotaLimit: 1000,
    updatedAt: '刚刚',
  },
  {
    id: 'proj-herb-shop',
    name: '《济世堂秘闻》先导片',
    desc: '古风药铺里的奇闻异事，账房先生与女记者联手破局。',
    genre: '古风奇幻动画',
    styleKey: 'ink',
    cover: sceneHerbShop,
    sessionsCount: 1,
    stageIndex: 4,
    status: 'active',
    statusText: '已完成 · 待发布',
    favorite: false,
    quotaUsed: 90,
    quotaLimit: 600,
    updatedAt: '2 小时前',
  },
  {
    id: 'proj-rooftop',
    name: '《长夜将明》第1季',
    desc: '都市谍战，黄昏天台上的追逐与真相。',
    genre: '都市谍战短剧',
    styleKey: 'film',
    cover: sceneRooftopDusk,
    sessionsCount: 2,
    stageIndex: 2,
    status: 'review',
    statusText: '待审核',
    favorite: false,
    quotaUsed: 310,
    quotaLimit: 1000,
    updatedAt: '昨天',
  },
];

// 第 4 步：AI 根据剧本 + 已过审资产生成的分镜视频提示词（@资产名 会被渲染为资产链接标签）
export const VIDEO_SHOTS = [
  {
    id: 'shot-1',
    scene: '第1场',
    title: '雨夜尾随 · 全景推镜',
    duration: '5s',
    channel: '图生视频通道',
    modelApi: 'Jimeng-Video-Pro',
    traceId: 'tr_8f3a1c',
    mocap: false,
    assetIds: ['a-c1', 'a-c3', 'a-e1', 'a-p3'],
    previewImg: sceneRainAlley,
    prompt: [
      '【全景·推镜头】深夜暴雨， @雨夜老街 青石板反着昏黄路灯光。 @苏晚 撑着油纸伞快步穿行在窄巷阴影里，左手紧攥着半张边角卷曲的 @泛黄旧照片 ，目光死死盯着前方十步外戴礼帽的 @神秘人 。',
      '【特写】雨水顺着伞骨滴落。 @神秘人 闪身拐进挂着“济世堂”灯笼的药铺后门，门闩“咔嗒”一声从内落锁。 @苏晚 追到后门推了推纹丝不动，低头看了一眼 @泛黄旧照片 背面褪色的墨字，收伞绕向药铺前门。',
      '【台词】苏晚（压低声音，自语）：照片背面画的就是济世堂……三点十五分，人怎么一转眼就不见了？',
    ].join('\n'),
  },
  {
    id: 'shot-2',
    scene: '第2场',
    title: '药铺对峙 · 中景摇镜',
    duration: '8s',
    channel: '图生视频通道',
    modelApi: 'Seedance-LipSync',
    traceId: 'tr_8f3a2d',
    mocap: false,
    assetIds: ['a-c1', 'a-c2', 'a-e2', 'a-p1', 'a-p2', 'a-p3'],
    previewImg: sceneHerbShop,
    prompt: [
      '【中景·摇镜头】几分钟后， @药铺内景 幽暗，满墙木质药柜，柜台上方一盏暖黄吊灯在浮尘中摇晃。 @沈砚 坐在柜台后拨着算盘，头也不抬。 @苏晚 推开前门抖落雨水大步走近，把 @泛黄旧照片 拍在台面上，目光扫向通往后院的布帘。',
      '【台词】苏晚（急切）：别装了！刚刚那个穿黑衣戴礼帽的人进了你们后门，我要见他。',
      ' @沈砚 停下算盘，抬眼透过圆框眼镜冷冷打量她，从抽屉里取出 @停走的怀表 和氧化的 @黄铜钥匙 推到灯光下。【特写】怀表表盖弹开，指针死死停在 3:15；旁边的 @黄铜钥匙 牌上刻着“07 · 钟楼天台”。',
      '【台词】沈砚（低沉，冷静）：后院只有死胡同。苏记者，别查了——照片上你要找的人，三天前就已经死了。这只停走的怀表和 07 号黄铜钥匙，是他临死前托我转交的最后一次警告。',
      ' @苏晚 猛地攥紧 @黄铜钥匙 ，抬头见药铺后窗外闪过一道 @神秘人 黑影，抓起桌上的 @泛黄旧照片 转身冲出门去。',
    ].join('\n'),
  },
  {
    id: 'shot-3',
    scene: '第3场',
    title: '天台追逐 · 高难动捕',
    duration: '6s',
    channel: '深度动作捕捉通道',
    modelApi: 'Mocap-Engine-V2',
    traceId: 'tr_8f3a4e',
    mocap: true,
    assetIds: ['a-c3', 'a-c1', 'a-e3', 'a-p3', 'a-p1', 'a-p2'],
    previewImg: sceneRooftopDusk,
    prompt: [
      '【大远景·跟拍】次日黄昏， @苏晚 凭着 @黄铜钥匙 的线索找上老城钟楼旁的 @黄昏天台 ，晚霞压得很低，逆光剪影强烈。 @苏晚 推开天台铁门，只见 @神秘人 站在女儿墙边缘，脚边是被撬开的旧铁盒，手里举着另半张刚好能拼齐的 @泛黄旧照片 。',
      '【台词】苏晚（喘息，大喊）：站住！停走的怀表和这半张照片，到底是谁让你放在济世堂的？！',
      '【高难动作·动捕】 @神秘人 冷笑一声，将半张 @泛黄旧照片 朝空中一扬，转身纵身翻越屋顶，凌空翻滚落地后迅速消失在楼下晚高峰的人群中。【定格特写】 @苏晚 冲到护栏边接住飘落的半张 @泛黄旧照片 ——两半合在一起，背面竟是一行完整的字：“明晚三点十五，天台见”。',
    ].join('\n'),
  },
];
