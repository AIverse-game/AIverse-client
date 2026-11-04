# 仓库地图

包含总体游戏设计、通用开发基础和网页客户端。权威服务端是与本仓库同级的 Python 项目 `aiverse-server`。分层与数据流见 [应用架构](architecture.md)。

## 应用代码

| 文件/目录 | 用途 |
| --- | --- |
| `package.json` | npm workspaces 根配置与统一脚本（`dev`、`build`、`verify` 等） |
| `tsconfig.base.json` | 各包共享的 TypeScript 严格配置；共享包不含 DOM 类型 |
| `eslint.config.js` | 代码检查与分层规则 |
| `vitest.config.ts` | 测试入口，收集各包 `src/**/*.test.ts` |
| `packages/protocol/src/` | `view.ts` 地图、能量泉、收购点（含价格历史）、居民（含金币、出局、名次、能量、汲取、行走、驱动它的 Agent 及模型）、对局、发言、报价、合约提议、合约与坐标视图及校验；`actions.ts` 操作原语类型；`messages.ts` 客户端与服务端消息（含交给 AI 的 `start_agent`、`stop_agent`、`agent_result` 与 `welcome` 中服务端覆盖的模型设置）、协议版本 |
| `apps/web/index.html`、`apps/web/vite.config.ts` | 网页入口与构建配置（相对资源路径、`/ws` 代理到服务端） |
| `apps/web/src/main.tsx` | 组装连接、状态与界面；唯一选择传输方式和服务端地址的地方 |
| `apps/web/src/vite-env.d.ts` | `VITE_SERVER_URL` 环境变量类型 |
| `apps/web/src/net/` | `GameConnection` 接口与 WebSocket 实现 |
| `apps/web/src/state/` | `GameStore` 客户端状态（快照、选中居民（选中时以 `view_as` 告诉服务端）、操作结果、交给或停止 AI 的结果、服务端覆盖的模型设置、本地截止时刻与收到快照的时刻）、按本地时钟的倒计时 `countdown`、发送原语、交给或停止 AI、能否行动、所在能量泉与是否在收购点的判断、居民持有的最好晶核、当前收购价与估算收入；`market.ts` 按本地时钟推算市场价；`storeContext.tsx` 把 `GameStore` 交给 React 组件的 context（`StoreProvider`）与 hook（`useStore`、`useGameState`） |
| `apps/web/src/render/` | `layout.ts` 2.5D 透视投影及其反算、刻度与格式、汲能塔在能量泉内的落点；`springMarkerMotion.ts` 能量泉悬浮标记的旋转与浮动公式；`residentFloat.ts` 居民浮动的公式（静止与移动两种快慢及渐变）；`MapScene.ts` Phaser 地图场景（地块、能量泉及其旋转浮动的标记、汲能塔、收购点、浮动的居民贴图、按真实时间的行走动画、指针坐标、点选与点击移动） |
| `apps/web/src/assets/` | 贴图：`crystals/` 中用户提供的晶核原图 `mk*.png` 与页面使用的 64 px 小图 `mk*-icon.png`；`residents/` 中用户提供的居民原图 `resident.png` 与地图使用的小图 `resident-sprite.png`（128 px 高）；`springs/` 中用户提供的能量泉地面原图 `spring.png`、悬浮标记原图 `spring-marker.png` 与裁到可见像素的地图用图 `spring-sprite.png`（256 px 宽）、`spring-marker-sprite.png`（128 px 高）；`energy/` 中用户提供的能量与金币原图 `energy.png`、`coin.png` 与页面使用的 64 px 小图 `*-icon.png`；`market/` 中用户提供的收购点原图 `market.png` 与地图使用的小图 `market-sprite.png`（裁到可见像素，高 192 px） |
| `apps/web/src/ui/` | React：顶栏（含倒计时）、`MapView.tsx` 地图容器与视窗初始居中、滚轮导航及滚动后的点击坐标刷新、`mapScroll.ts` 滚轮单位换算、`RankingPanel.tsx` 金币排名、地图、居民（含能量与晶核）、能量泉与收购点（含随时间回升的现价与晶核价目）信息面板（可点选居民）、`ActionPanel.tsx` 手动操作面板（行走、汲取、卖能量、买晶核、退出游戏）、`AgentPanel.tsx` 把选中居民交给玩家配置的大模型（API 地址、key、模型，服务端覆盖的项置灰）或停止、`savedLLMSettings.ts` 按居民把模型设置记在 localStorage、`SpeechPanel.tsx` 对话记录（当众说的话与选中居民的私聊）与发言（当众说或私聊，显示消耗）、`DealsPanel.tsx` 选中居民的报价、合约提议与合约（只读，合约到期倒计时）、`dealText.ts` 报价与合约条款的中文描述、`CrystalIcon.tsx` 按阶显示晶核贴图、`EnergyIcon.tsx` 与 `CoinIcon.tsx` 能量与金币小图标、`PriceChartPanel.tsx` 收购价走势折线图（SVG）与 `priceChart.ts` 折线坐标布局、`format.ts` 时长与价格格式、`useSecondTick.ts` 每秒重绘 |
| `.github/workflows/ci.yml` | 推送 `main` 或提交 PR 时运行仓库检查与 `npm run verify` |

测试与源码同目录，命名为 `*.test.ts`。命名与放置规则见 [文件命名与目录约定](../.agents/rules/conventions.md)，写法见 [测试约定](../.agents/rules/testing.md)。

## Python 服务端（`aiverse-server`）

源码分为 `core/`、`economy/`、`residents/`、`game/`、`server/`、`agents/` 六个子包。`tests/` 先按层分为 `unit/` 与 `integration/`，层内按同样的子包分组（[变更 0031](../changes/0031-server-test-layers.md)），各子包的职责见服务端 `README.md` 的“代码结构”。

| 文件 | 用途 |
| --- | --- |
| `pyproject.toml`、`uv.lock` | 依赖、启动脚本与 ruff/mypy/pytest 配置 |
| `src/aiverse_server/core/world.py` | 坐标、居民（含金币、是否出局、汲取任务（含所用晶核）、行走任务 `WalkJob`）、物品栏（`Inventory`）、事件队列字段、生效的合约（`Contract`、`ContractBook`）、能量泉（`Spring`）、收购点（`Market`）、居民记忆（`Memory`、`SpringSighting`，长短期笔记 `Note` 及其上限）、活动日志（`ActivityLog`、`Activity`）、发言记录（`SpeechLog`、`Speech`）、地图与世界模型（含是否结束、游戏时间），越界、重复 id 与事件、汲取、行走、记忆、日志和发言一致性校验 |
| `src/aiverse_server/core/inventory.py` | 居民物品的存入、移出、计数、列出与清空，金币的收付（服务端内部接口，不是原语） |
| `src/aiverse_server/core/events.py` | 事件队列：事件种类基类 `EventPayload` 与其钩子，发送、同意、拒绝、撤回和收件箱查询 |
| `src/aiverse_server/economy/energy.py` | 能量体力：物品种类 `ENERGY`、拥有量、走路消耗、按数量扣除 `pay_energy` |
| `src/aiverse_server/economy/crystals.py` | 晶核：阶表 `CRYSTAL_TIERS`（价格、每次产量）、携带的最好一块 `best_crystal`、在收购点购买 `buy_crystal` |
| `src/aiverse_server/economy/harvesting.py` | 能量泉汲取：需要晶核、产量按最好的一块，开始、按游戏时间发放、取消、忙碌检查（含行走）、下一次完成时刻 |
| `src/aiverse_server/economy/market.py` | 收购点：定价常量、随时间回落的卖出压力 `pressure_at`、边际单价 `unit_price`、卖出收入 `quote`、卖出 `sell_energy` |
| `src/aiverse_server/economy/trade.py` | 交易事件：`PurchaseOffer`、`SaleOffer`，条款校验、预留与互换，预留金币与物品统计 |
| `src/aiverse_server/economy/contracts.py` | 合约：提议事件 `ContractProposal`、交付 `deliver`、取消 `cancel_contract`、到期 `expire_contracts`、终止 `end_contracts`（押金按责任赔付或退回，并记入 `ContractBook.ended`），托管的货款与押金统计 `contract_coins` |
| `src/aiverse_server/residents/walking.py` | 行走：速度 `WALK_SPEED`、所需时间、途中位置 `position_at`、出发、到达、中途停下、下一次到达时刻 |
| `src/aiverse_server/residents/perception.py` | 感知与发现：感知半径、每轮开始时的 `begin_turn`（范围内的能量泉、居民、新活动、收购点与现价、当前笔记、自上次以来说过和听到的话，更新记住的能量泉）、`record_activity` 记录活动 |
| `src/aiverse_server/residents/memory.py` | 居民自选的记忆：`remember` 写入长期或短期笔记、`forget` 忘掉一条、`forget_expired` 清除过期的短期笔记，短期时长 `SHORT_TERM_SECONDS` |
| `src/aiverse_server/residents/speech.py` | 对话：听力半径 `HEARING_RADIUS`、每句消耗 `SPEECH_COSTS`、当众说或私聊的 `say`，听到的人在说话时定下 |
| `src/aiverse_server/game/actions.py` | 操作原语（`MoveTo`、`RespondToEvent`、`WithdrawEvent`、`OfferToBuy`、`OfferToSell`、`ProposeContract`、`Deliver`、`CancelContract`、`LeaveGame`、`Harvest`、`SellEnergy`、`BuyCrystal`、`Say`）及其规则校验与执行 `perform`，执行后记录活动 |
| `src/aiverse_server/game/lifecycle.py` | 一局的生命周期：能否行动、出局（含能量耗尽，行走者到达后出局）、结束（停下汲取与行走、终止合约）、金币总额（含报价与合约中预留的）与排名、默认时长 |
| `src/aiverse_server/game/clock.py` | 游戏时间到点的事：`settle_due` 发放汲取、接回到达的行走者（花光能量的出局）并记录活动、合约到期，`next_due` 下一个到点时刻 |
| `src/aiverse_server/game/layout.py` | 固定的初始地图与居民，初始金币与能量，地图中心的收购点，按种子随机放置能量泉（离收购点至少 `MARKET_CLEARANCE`） |
| `src/aiverse_server/server/protocol.py` | 消息模型、客户端消息解析（错误信息不回显输入）、消息到原语与世界到视图的转换（私聊按连接选择的居民过滤，标出由 Agent 驱动的居民），`start_agent` 的模型设置 |
| `src/aiverse_server/server/config.py` | 读取大模型的 YAML 配置文件：`override` 全局覆盖模型的地址、key、模型（`Config.llm_override`），拒绝未知的键，错误信息不含设置的值 |
| `src/aiverse_server/server/app.py` | FastAPI 应用与 WebSocket `/ws`：共享世界、对局计时（到点的事见 `clock.py`）、每轮开始的 `Game.begin_turn`、写入与忘掉笔记的 `Game.remember`、`Game.forget`、Agent 与网页共用的执行入口 `Game.act`、`Game.commit`、唤醒 Agent 的 `Game.subscribe`、运行中启动、更换与停止 Agent（`Game.start_agent`、`Game.start_llm_agent` 合并配置文件的覆盖项、`Game.stop_agent`）、握手、执行原语、回答 `start_agent`/`stop_agent`、广播状态 |
| `src/aiverse_server/agents/` | AI 居民：`runner.py` 事件驱动的循环、唤醒规则与每轮记录，`observation.py` 每轮的观察及其 JSON，`tools.py` 绑定居民的工具（pydantic 参数模型与 JSON Schema），`scripted_brain.py` 脚本机器人，`llm_brain.py` OpenAI 兼容接口的大模型大脑 `ChatCompletionsBrain` 与设置 `LLMSettings` 的合并和校验，`system_prompt.py` 给模型的系统提示（规则说明） |
| `src/aiverse_server/agents/config/` | 大模型配置示例 `llm.example.yml`；本地的 `llm.yml` 可能含 key，被 Git 忽略，也不打进构建产物 |
| `src/aiverse_server/__main__.py` | `uv run aiverse-server` 启动入口（`--host`、`--port`、`--duration`、`--seed`、`--config`、`--agent`、`--agent-log`） |
| `tests/unit/` | 单元测试：世界模型、操作原语、物品栏与金币、事件、交易、合约、对局生命周期、能量、汲取、晶核、收购点、行走、感知、记忆、对话、AI 居民的工具、观察与设置、`Game` 的执行入口与发件箱、协议视图、配置文件、命令行参数 |
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

汲能塔入口：`apps/web/src/ui/TowerPanel.tsx` 提供建造、安装、预存充值、拆回退款、产量和费用估算；`render/MapScene.ts` 在能量泉旁绘制可点击的汲能塔与插槽灯，贴图为 `apps/web/src/assets/rigs/mining-rig.png`（用户提供的透明原图，运行时按有效区域取帧）。协议 `view.ts` 校验汲能塔、槽位与仍在局内的当事人；`carriedCrystals` 为手动汲取的可用晶核。

服务端新增 `core/towers.py`（不可变汲能塔与槽位）、`economy/towers.py`（建造、安装、生产、预存和清理）；`game/clock.py` 按实际事件时刻结算汲能塔、手动汲取、行走与合约。验证分别在 `tests/unit/economy/test_towers.py`、`tests/unit/agents/test_tower_tools.py` 与 `tests/integration/server/test_tower_websocket.py`。设计见 [汲能塔与晶核租用](design/towers.md)，本次记录见 [变更 0034](../changes/0034-mining-rigs.md)。
