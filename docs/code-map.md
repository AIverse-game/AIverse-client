# 仓库地图

包含总体游戏设计、通用开发基础和网页客户端。权威服务端是与本仓库同级的 Python 项目 `aiverse-server`。分层与数据流见 [应用架构](architecture.md)。

## 应用代码

| 文件/目录 | 用途 |
| --- | --- |
| `package.json` | npm workspaces 根配置与统一脚本（`dev`、`build`、`verify` 等） |
| `tsconfig.base.json` | 各包共享的 TypeScript 严格配置；共享包不含 DOM 类型 |
| `eslint.config.js` | 代码检查与分层规则 |
| `vitest.config.ts` | 测试入口，收集各包 `src/**/*.test.ts` |
| `packages/protocol/src/` | `mapGrid.ts` 地块、街区、大厅和场馆（含商场 1 × 2）在地图上的位置，以及岛的缩进（与服务端同一套算法）；`view.ts` 地块价格、产权份额、设施、工作、所选居民内容数量及交易所（挂单簿、匿名成交、所选居民的挂单）、居民（含金币、出局、名次、行走、驱动它的 Agent 及模型）、对局、发言、报价、合约提议、合约与坐标视图及校验；`actions.ts` 操作原语类型（含买地、建设施、制作与放入内容）；`messages.ts` 客户端与服务端消息（含交给 AI 的 `start_agent`、`stop_agent`、`agent_result` 与 `welcome` 中服务端覆盖的模型设置、每 2 秒推送的访客快照 `visitors`）、协议版本（设施视图带 `income`，上个付款日付给它的钱，协议 28） |
| `apps/web/index.html`、`apps/web/vite.config.ts` | 网页入口与构建配置（相对资源路径、`/ws` 代理到服务端） |
| `apps/web/src/main.tsx` | 组装连接、状态与界面；唯一选择传输方式和服务端地址的地方 |
| `apps/web/src/vite-env.d.ts` | `VITE_SERVER_URL` 环境变量类型 |
| `apps/web/src/net/` | `GameConnection` 接口与 WebSocket 实现 |
| `apps/web/src/state/` | `GameStore` 客户端状态（`gameSeconds()` 按快照的 `game.elapsedSeconds` 推算游戏时间，花园的季节与昼夜用它；快照、选中居民与地块、操作结果、服务端设置与本地倒计时；最新一份访客快照 `getVisitors` 不在状态里，不通知订阅者）；`facilityContents.ts` 按快照时钟计算未过期的展示内容；`storeContext.tsx` 提供 React context 与 hook |
| `apps/web/src/render/` | Three.js 地图（[决策 0007](decisions/0007-three-js-map-renderer.md)）：`MapRenderer.ts` 场景、相机、输入与射线点选、帧循环；`GroundLayer.ts` 每个街区的岛（地板顶面、边线）、产权着色、产权高亮与选中框，`islandModel.ts` 岛体（板、土层、体素岩层）与岛间的光桥（照 `demos/bare_islands_side_links.html` 移植，含动画）及邻岛连线的计算，`mapFloor.ts` 地面贴图的拼法；`FacilityLayer.ts` 各地块的设施模型与命中体积（只在种类或展示份数变化时重建），`plotShape.ts` 模型在地块（游戏厅和工作空间是 2 × 2 块的方块，商场是 1 × 2 或 2 × 1 块，并收进岛、横放时转 90°）上的尺寸，另有 `floorHeightAt`（某位置的底座地板高度，`FacilityLayer` 与 `GardenLayer` 的 `floorHeight` 用它，`MapRenderer` 连同出生台一起交给居民和访客层）；`ResidentLayer.ts` 居民（方块角色，Agent 居民换成机器人；行走、浮动、选中环、出局变淡），`agentRobot.ts` Agent 居民的悬浮机器人（照 `demos/floating_ai_agent_movement.html`，[设计](design/agent-robot.md)），`agentMood.ts` 机器人此刻的状态（待机、思考、说话、开心），`VisitorLayer.ts` 脚本访客（按 `visitors` 消息里的直线段走，每帧摆出全部访客，新进城的先在出生台上长出，穿过传送门时抖动、闪没并在进口留残影），`visitorWalk.ts` 某时刻的位置、朝向与是否在走及某段时间里穿过的传送门（`portalCrossing`）、这一帧是否穿门与从哪到哪（`portalHop`），`PortalGlitchLayer.ts` 访客穿门时在进口和出口撕开的粉青白横条与像素噪点（[设计](design/portals.md)），`portalGlitch.ts` 这段故障效果的时间线，`visitorEntry.ts` 访客进城时在出生台上长出、转动与光柱亮度的时间线，`characterCrowd.ts` 用实例化网格一次画出一群方块人（按衣色分组，不能淡出和点选），`LabelLayer.ts` 名字与坐标轴标签；`CoinBurstLayer.ts` 设施收到钱时屋顶上方的金币特效（[设计](design/income-effect.md)），`payoutWatch.ts` 判断哪些收入是新的，`coinBurst.ts` 特效的时间线，`coinSprites.ts` 像素金币与数字的贴图，`coinPixels.ts` 像素金币与像素数字在画布上的画法（不依赖 Three.js，排名面板也用）；`LobbyLandmark.ts` 出生大厅与 NPC 新来者，`lobbyPatrol.ts` 巡游路线；`mapCamera.ts` 相机姿态、平移、缩放、旋转的计算；`sceneKit.ts` 调色板、材质、画布贴图与按材质合并方块的 `ModelBuilder`；各模型（照 `demos/` 移植，带动画）：`billboardModel.ts` 广告位、`workspaceModel.ts` 工作空间、`portalModel.ts` 传送门、`lobbyModel.ts` 出生大厅、`arcadeModel.ts` 游戏厅（厅体无 demo，按变更 0076 重做；里面按游戏数摆机台），`arcadeMachineModels.ts` 街机、抓娃娃机、全息台、赛车、跳舞机五台机台（照 `demos/arcade_hall_machines_mecha.html` 移植，只依赖 `sceneKit.ts`，可单独取用，[变更 0088](../changes/0088-arcade-machines.md)）、`characterModel.ts` 方块角色（部位表 `CHARACTER_PARTS` 和材质 `characterMaterials` 也给人群用），`garden/` 小花园渲染层（[设计](design/garden.md)，照 `demos/voxel_floating_garden.html` 移植）：`GardenLayer.ts` 层本身（建花园、点选体积、特效锚点、按游戏时间更新）、`gardenClock.ts` 季节与昼夜的纯函数和网址覆盖 `?garden=`、`gardenPalette.ts` 季节配色表与夜色参数、`GardenMaterials.ts` 全图共用的材质（换季、昼夜、花草摇摆）、`gardenModel.ts` 模型（只建一次，与季节无关）；`mallModel.ts` 商场（照 `demos/voxel_mall_exterior_palettes.html` 的雾蓝珊瑚夜景移植，窄长底座 32 × 64，[设计](design/mall.md)），`modelProps.ts` 树、长椅、路灯、盆栽；`npcPose.ts` 走路姿态，`residentFloat.ts` 居民浮动的公式，`layout.ts` 刻度与坐标格式 |
| `apps/web/src/assets/` | 贴图：`residents/` 中用户提供的居民原图 `resident.png` 与旧小图 `resident-sprite.png`（当前地图使用程序化方块人）；`tokens/` 中用户提供的金币原图 `coin.png` 与 64 px 小图 `coin-icon.png`（排名改用程序画的像素金币后不再使用）；`floor/` 地面贴图。算力泉、算力、程序、收购点和采集节点的贴图随旧玩法删除，保留在 `legacy` 分支 |
| `apps/web/src/ui/` | React：`App.tsx` 全屏布局（地图铺满屏幕，顶栏、面板列与世界日志浮在上面，可收起面板列）、`TopBar.tsx` 顶栏（连接状态、倒计时、世界日志与面板列开关）、`WorldLogPanel.tsx` 终端式世界日志窗口与 `worldLogText.ts` 把世界日志记录写成中文句子、`MapView.tsx` 地图容器（创建与销毁渲染器）、`mapScroll.ts` 滚轮单位换算（给相机平移用）、`RankingPanel.tsx` 金币排名、`CoinAmount.tsx` 照金币特效画的金额（像素金币与数字，变化时跑动、增加时浮出红色增加额）与 `coinCountUp.ts` 它的时间线、`MapPanel.tsx` 地图与居民信息面板（可点选居民）、`FacilityPanel.tsx` 地块产权、设施及买地、建设和内容操作、`ActionPanel.tsx` 手动操作面板（行走、退出游戏）、`ExchangePanel.tsx` 交易所（按商品的挂单簿、成交价折线与最近成交、选中居民的挂单，只读；没有商品时说明暂无）与 `exchange.ts` 商品名（含广告内容、游戏内容）与按商品筛选成交、`AgentPanel.tsx` 把选中居民交给玩家配置的大模型（API 地址、key、模型，服务端覆盖的项置灰）或停止、`savedLLMSettings.ts` 按居民把模型设置记在 localStorage、`SpeechPanel.tsx` 对话记录（当众说的话与选中居民的私聊）与发言、`DealsPanel.tsx` 选中居民的报价、合约提议与合约（只读，合约到期倒计时）、`dealText.ts` 报价与合约条款的中文描述、`PriceChartPlot.tsx` 与 `priceChart.ts` 交易所成交价折线的 SVG 绘制与坐标布局、`format.ts` 时长格式、`useSecondTick.ts` 每秒重绘 |
| `.github/workflows/ci.yml` | 推送 `main` 或提交 PR 时运行仓库检查与 `npm run verify` |

测试与源码同目录，命名为 `*.test.ts`。命名与放置规则见 [文件命名与目录约定](../.agents/rules/conventions.md)，写法见 [测试约定](../.agents/rules/testing.md)。

## Python 服务端（`aiverse-server`）

源码分为 `core/`、`economy/`、`residents/`、`game/`、`server/`、`agents/` 六个子包。`tests/` 先按层分为 `unit/` 与 `integration/`，层内按同样的子包分组（[变更 0031](../changes/0031-server-test-layers.md)），各子包的职责见服务端 `README.md` 的“代码结构”。

| 文件 | 用途 |
| --- | --- |
| `pyproject.toml`、`uv.lock` | 依赖、启动脚本与 ruff/mypy/pytest 配置 |
| `src/aiverse_server/core/world.py` | 坐标、居民（含金币、是否出局、行走任务 `WalkJob`）、物品栏（`Inventory`）、事件队列字段、生效的合约（`Contract`、`ContractBook`）、居民记忆（`Memory`，长短期笔记 `Note` 及其上限）、活动日志（`ActivityLog`、`Activity`）、发言记录（`SpeechLog`、`Speech`）、世界日志（`WorldLog`、`WorldLogEntry`）、地图与世界模型（含是否结束、游戏时间），越界、重复 id 与事件、行走、记忆、日志和发言一致性校验 |
| `src/aiverse_server/core/inventory.py` | 居民物品的存入、移出、计数、列出与清空，金币的收付（服务端内部接口，不是原语） |
| `src/aiverse_server/core/events.py` | 事件队列：事件种类基类 `EventPayload` 与其钩子，发送、同意、拒绝、撤回和收件箱查询 |
| `src/aiverse_server/core/land.py`、`economy/land.py` | 地块（[地块](design/land.md)）：不可变的 `Parcel`（含设施 `Facility`，广告位、传送门、游戏厅或工作空间，与份额）、线路 `Link`；地块网格、按离地图中央远近定价、`buy_parcel`；场馆占的 2 × 2 方块（`venue_footprint`、`claimed`、`venue_room`、`facility_centre`） |
| `src/aiverse_server/core/compute.py`、`economy/compute.py` | 算力与节点：订阅的节点 `Node`、进行中的工作 `Job`、`ComputeBook`；速率与价格常量、`buy_node`（生成式、渲染式）、开工 `start_build_ad`、`start_build_portal`、`start_build_venue`（游戏厅、工作空间）、`start_make_content`（广告或游戏）、完工 `finish_jobs`、节点到期 `expire_nodes`、取消 `cancel_compute` |
| `src/aiverse_server/economy/ads.py` | 广告位、游戏厅与内容（[内容](design/content.md)）：内容物品 `ad_content` 与 `game_content`、`place_content`（保鲜期、每个广告位或游戏厅至多 5 份）；收入见[赞助商](design/sponsors.md)和[场所与入场费](design/venues.md) |
| `src/aiverse_server/game/world_log.py` | 世界日志（[设计](design/game-screen.md)，[变更 0091](../changes/0091-pixel-hud-and-world-log.md)）：`perform_logged` 执行原语并把做了什么写进 `World.world_log`（页面、`Game.act` 与 Agent 工具都用它），`record_finished_jobs` 记下设施建成与内容做好；保留最近 200 条，经协议 31 的 `worldLog` 发给所有页面 |
| `src/aiverse_server/game/cues.py` | Agent 居民的说话与开心提示（[设计](design/agent-robot.md)，[变更 0085](../changes/0085-agent-robot.md)）：按原语和设施建成算出，经 `agent.cue` 发给页面 |
| `src/aiverse_server/economy/payouts.py` | 设施上个付款日收到的钱（[设施收入的金币特效](design/income-effect.md)，[变更 0084](../changes/0084-income-coin-effect.md)）：`latest_payout` 合并赞助商与入场费两本账的 `last_paid`，带付款日时间 `at`，给协议里设施的 `income` 用 |
| `src/aiverse_server/economy/shares.py` | 地块份额（[虚拟设施](design/parcel-shares.md)第 4 步）：分账 `split_income`（凑不整的金币按小数部分大的先得）、份额报价事件 `ShareOffer`（持有人转让份额，可收费可白送）、已许诺份额统计 `reserved_shares` |
| `src/aiverse_server/core/admissions.py`、`economy/admissions.py` | 入场费（[场所与入场费](design/venues.md)，[变更 0074](../changes/0074-working-tourists.md)）：不可变的 `AdmissionBook`；工作空间 4、游戏厅 6 金币每人的价 `FEES`；`admit` 收费，`pay_admissions` 在付款日整枚硬币地按份额付给持有人，零头留到下次，渠道 `visitors` |
| `src/aiverse_server/core/sponsors.py`、`economy/sponsors.py` | 赞助商（[赞助商](design/sponsors.md)，[变更 0073](../changes/0073-sponsors.md)）：不可变的 `Sponsor`、`SponsorBook`；三个默认赞助商、每 30 秒的全局付款日 `pay_sponsors`（出价高的先买，预算不够按同一比例缩水，按份额分给持有人，渠道 `sponsors`）、预算上限、下一个付款日 |
| `src/aiverse_server/core/visitors.py`、`economy/visitors.py` | 脚本访客（[脚本访客](design/visitors.md)，[变更 0072](../changes/0072-visitors.md)、[变更 0074](../changes/0074-working-tourists.md)）：不可变的 `Visitor`（还要去的大致路线 `route`）、`Crowd`；访客（开局 200 个，随建成的设施增多，最多 600，见变更 0103）从中央入口进城，游客按带随机项的偏好依次逛展示着内容的广告位，工作游客先去工作空间再去游戏厅并付入场费，路过或停留够 4 秒算一次展示，累计到各地块，由赞助商付钱；随机用种子加编号的哈希；`remaining_legs` 算出还要走的直线段，给 `visitors` 消息用 |
| `src/aiverse_server/economy/portals.py` | 传送门与线路（[虚拟设施](design/portals.md)第 5 步）：线路提议事件 `LinkProposal`、`link_portals`、居民传送 `teleport`（规则层；AI 居民没有对应工具，变更 0098；过路费按份额分给两端的持有人，渠道 `toll`）、有效距离 `effective_distance`（线路让偏远地块离中央更近，备用，占位的流量暂不用）、访客用的路线 `Router`、门数与线路数与间距上限 |
| `src/aiverse_server/economy/joint_purchase.py` | 合买地块（[虚拟设施](design/parcel-shares.md)第 4 步补充）：提议事件 `JointPurchase`（对方出多少钱、拿多少份，提议人那份预留），同意时两人各付镇上、地块归提议人，预留的钱统计 `reserved_purchase_coins` |
| `src/aiverse_server/economy/trade.py` | 交易事件：`PurchaseOffer`、`SaleOffer`，条款校验、预留与互换，预留金币与物品统计 |
| `src/aiverse_server/economy/contracts.py` | 合约：提议事件 `ContractProposal`、交付 `deliver`、取消 `cancel_contract`、到期 `expire_contracts`、终止 `end_contracts`（押金按责任赔付或退回，并记入 `ContractBook.ended`），托管的货款与押金统计 `contract_coins` |
| `src/aiverse_server/residents/walking.py` | 行走：速度 `WALK_SPEED`、所需时间、途中位置 `position_at`、出发、到达、中途停下、下一次到达时刻；走路只花时间 |
| `src/aiverse_server/residents/perception.py` | 感知：感知半径、每轮开始时的 `begin_turn`（范围内的居民、新活动、当前笔记、自上次以来说过和听到的话与公告）、`record_activity` 记录活动 |
| `src/aiverse_server/residents/memory.py` | 居民自选的记忆：`remember` 写入长期或短期笔记、`forget` 忘掉一条、`forget_expired` 清除过期的短期笔记，短期时长 `SHORT_TERM_SECONDS` |
| `src/aiverse_server/residents/speech.py` | 对话：听力半径 `HEARING_RADIUS`、当众说或私聊的 `say`（不花东西），听到的人在说话时定下 |
| `src/aiverse_server/game/actions.py` | 操作原语（`MoveTo`、`RespondToEvent`、`WithdrawEvent`、`OfferToBuy`、`OfferToSell`、`OfferInformation`、`ProposeContract`、`Deliver`、`CancelContract`、`LeaveGame`、`BuyParcel`、`BuyNode`、`BuildAd`、`BuildPortal`、`LinkPortals`、`Teleport`、`PlaceOrder`、`CancelOrder`、`Say`）及其规则校验与执行 `perform`，执行后记录活动 |
| `src/aiverse_server/game/lifecycle.py` | 一局的生命周期：能否行动、是否忙碌、出局、结束（停下行走、终止合约）、金币总额（含报价与合约中预留的）与排名、默认时长 |
| `src/aiverse_server/game/clock.py` | 游戏时间到点的事：`settle_due` 接回到达的行走者并记录活动、完成到点的工作（记入世界日志）、让订阅的节点到期、合约与挂单到期，`next_due` 下一个到点时刻 |
| `src/aiverse_server/game/layout.py` | 固定的初始地图与居民，初始金币，全部出生在地图中央 |
| `src/aiverse_server/server/protocol.py` | 消息模型、客户端消息解析（错误信息不回显输入）、消息到原语与世界到视图的转换，访客的 `visitors_message`（私聊按连接选择的居民过滤，标出由 Agent 驱动的居民，含地块、设施、工作、内容及建设操作），`start_agent` 的模型设置 |
| `src/aiverse_server/server/config.py` | 读取大模型的 YAML 配置文件：`override` 全局覆盖模型的地址、key、模型（`Config.llm_override`），拒绝未知的键，错误信息不含设置的值 |
| `src/aiverse_server/server/app.py` | FastAPI 应用与 WebSocket `/ws`：共享世界、对局计时（到点的事见 `clock.py`）、每轮开始的 `Game.begin_turn`、写入与忘掉笔记的 `Game.remember`、`Game.forget`、Agent 与网页共用的执行入口 `Game.act`、`Game.commit`、唤醒 Agent 的 `Game.subscribe`、运行中启动、更换与停止 Agent（`Game.start_agent`、`Game.start_llm_agent` 合并配置文件的覆盖项、`Game.stop_agent`）、握手、执行原语、回答 `start_agent`/`stop_agent`、广播状态、每 2 秒推送访客（`run_visitors`）、每 2 秒推送访客 |
| `src/aiverse_server/agents/` | AI 居民：`runner.py` 事件驱动的循环、唤醒规则与每轮记录，`observation.py` 每轮的观察及其 JSON，`tools.py` 绑定居民的工具（pydantic 参数模型与 JSON Schema），`scripted_brain.py` 脚本机器人，`llm_brain.py` OpenAI 兼容接口的大模型大脑 `ChatCompletionsBrain` 与设置 `LLMSettings` 的合并和校验，`system_prompt.py` 给模型的系统提示（规则说明） |
| `src/aiverse_server/agents/config/` | 大模型配置示例 `llm.example.yml`；本地的 `llm.yml` 可能含 key，被 Git 忽略，也不打进构建产物 |
| `src/aiverse_server/__main__.py` | `uv run aiverse-server` 启动入口（`--host`、`--port`、`--duration`、`--config`、`--agent`、`--agent-log`） |
| `tests/unit/` | 单元测试：世界模型、操作原语、物品栏与金币、事件、交易、合约、对局生命周期、地块与访客流量、交易所、行走、感知、记忆、对话、AI 居民的工具、观察与设置、`Game` 的执行入口与发件箱、协议视图、配置文件、命令行参数 |
| `tests/integration/` | 集成测试：WebSocket 接口、交给与停止 AI、Agent 循环的唤醒、模拟 HTTP 的大模型大脑、脚本机器人的快进对局 |
| `Makefile` | `dev` 启动；`verify` 检查与测试 |

## 文档与协作

| 文件/目录 | 用途 |
| --- | --- |
| `README.md` | 使用方式与可运行命令 |
| `AGENTS.md` | Codex 入口及共同开发规则 |
| `CLAUDE.md` | Claude Code 入口，指向共同规则 |
| `.agents/skills/implement-change/SKILL.md` | 开发实现、验证与独立审查交接 |
| `.agents/skills/review-change/SKILL.md` | 默认只读的代码审查与修复复核 |
| `.agents/rules/development.md` | 通用任务闭环、审查与协作流程 |
| `.agents/rules/conventions.md` | 文件命名与目录约定 |
| `.agents/rules/testing.md` | 测试约定：分层与单个测试的结构 |
| `docs/architecture.md` | 应用分层、坐标系与数据流 |
| `docs/status.md` | 跨会话交接状态 |
| `docs/design/README.md` | 设计文档规则：何时新建、何时修改、写什么，以及索引 |
| `docs/design/game-overview.md` | AIverse 总体设计提案、最小玩法与待验证假设 |
| `docs/design/ai-residents.md` | AI 居民的设计：事件驱动循环、工具、两种大脑与暂未实现的功能 |
| `docs/decisions/` | 重要决策的说明与模板 |
| `changes/` | 单次变更说明、验收与证据 |
| `scripts/check_repo.py` | 无第三方依赖的仓库骨架检查 |
| `Makefile` | `check` 仓库检查；`verify` 仓库与应用检查 |
| `.editorconfig` | 基础文本编辑约定 |
| `.gitignore` | 本地环境、私密配置和生成产物的忽略规则 |

只记录真实存在的文件和命令。

AI 行动时间线入口：`apps/web/src/ui/AgentTimelinePanel.tsx`；经营方针输入在 `ui/AgentPanel.tsx`，保存由 `ui/savedLLMSettings.ts` 负责。

角色日志：服务端 `agents/turn_logger.py` 负责按居民写入当前对局 JSONL；对应单元测试为 `tests/unit/agents/test_turn_logger.py`，联动测试为 `tests/integration/agents/test_turn_logging.py`。
