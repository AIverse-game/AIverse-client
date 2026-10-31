# 仓库地图

包含总体游戏设计、通用开发基础和网页客户端。权威服务端是与本仓库同级的 Python 项目 `aiverse-server`。分层与数据流见 [应用架构](architecture.md)。

## 应用代码

| 文件/目录 | 用途 |
| --- | --- |
| `package.json` | npm workspaces 根配置与统一脚本（`dev`、`build`、`verify` 等） |
| `tsconfig.base.json` | 各包共享的 TypeScript 严格配置；共享包不含 DOM 类型 |
| `eslint.config.js` | 代码检查与分层规则 |
| `vitest.config.ts` | 测试入口，收集各包 `src/**/*.test.ts` |
| `packages/protocol/src/` | `view.ts` 地图、矿池、收购点、居民（含金币、出局、名次、token、采矿、行走、驱动它的 Agent 及模型）、对局、发言、报价、合约提议、合约与坐标视图及校验；`actions.ts` 操作原语类型；`messages.ts` 客户端与服务端消息（含交给 AI 的 `start_agent`、`stop_agent`、`agent_result` 与 `welcome` 中服务端覆盖的模型设置）、协议版本 |
| `apps/web/index.html`、`apps/web/vite.config.ts` | 网页入口与构建配置（相对资源路径、`/ws` 代理到服务端） |
| `apps/web/src/main.tsx` | 组装连接、状态与界面；唯一选择传输方式和服务端地址的地方 |
| `apps/web/src/vite-env.d.ts` | `VITE_SERVER_URL` 环境变量类型 |
| `apps/web/src/net/` | `GameConnection` 接口与 WebSocket 实现 |
| `apps/web/src/state/` | `GameStore` 客户端状态（快照、选中居民（选中时以 `view_as` 告诉服务端）、操作结果、交给或停止 AI 的结果、服务端覆盖的模型设置、本地截止时刻与收到快照的时刻）、按本地时钟的倒计时 `countdown`、发送原语、交给或停止 AI、能否行动、所在矿池与是否在收购点的判断、居民持有的最好芯片、当前收购价与估算收入；`market.ts` 按本地时钟推算市场价；`storeContext.tsx` 把 `GameStore` 交给 React 组件的 context（`StoreProvider`）与 hook（`useStore`、`useGameState`） |
| `apps/web/src/render/` | `layout.ts` 2.5D 透视投影及其反算、刻度与格式；`MapScene.ts` Phaser 地图场景（地块、矿池、收购点、居民、按真实时间的行走动画、指针坐标、点选与点击移动） |
| `apps/web/src/assets/` | 贴图：`chips/` 中用户提供的芯片原图 `mk*.png` 与页面使用的 64 px 小图 `mk*-icon.png`；`market/` 中用户提供的收购点原图 `market.png` 与地图使用的小图 `market-sprite.png`（裁到可见像素，高 192 px） |
| `apps/web/src/ui/` | React：顶栏（含倒计时）、地图容器、`RankingPanel.tsx` 金币排名、地图、居民（含 token 与芯片）、矿池与收购点（含随时间回升的现价与芯片价目）信息面板（可点选居民）、`ActionPanel.tsx` 手动操作面板（行走、采矿、卖 token、买芯片、退出游戏）、`AgentPanel.tsx` 把选中居民交给玩家配置的大模型（API 地址、key、模型，服务端覆盖的项置灰）或停止、`savedLLMSettings.ts` 按居民把模型设置记在 localStorage、`SpeechPanel.tsx` 对话记录（当众说的话与选中居民的私聊）与发言（当众说或私聊，显示消耗）、`DealsPanel.tsx` 选中居民的报价、合约提议与合约（只读，合约到期倒计时）、`dealText.ts` 报价与合约条款的中文描述、`ChipIcon.tsx` 按型号显示芯片贴图、`format.ts` 时长与价格格式、`useSecondTick.ts` 每秒重绘 |
| `.github/workflows/ci.yml` | 推送 `main` 或提交 PR 时运行仓库检查与 `npm run verify` |

测试与源码同目录，命名为 `*.test.ts`。命名与放置规则见 [文件命名与目录约定](../.agents/rules/conventions.md)，写法见 [测试约定](../.agents/rules/testing.md)。

## Python 服务端（`aiverse-server`）

源码分为 `core/`、`economy/`、`residents/`、`game/`、`server/`、`agents/` 六个子包，`tests/` 按同样的子包分组，各子包的职责见服务端 `README.md` 的“代码结构”。

| 文件 | 用途 |
| --- | --- |
| `pyproject.toml`、`uv.lock` | 依赖、启动脚本与 ruff/mypy/pytest 配置 |
| `src/aiverse_server/core/world.py` | 坐标、居民（含金币、是否出局、采矿任务（含所用芯片）、行走任务 `WalkJob`）、物品栏（`Inventory`）、事件队列字段、生效的合约（`Contract`、`ContractBook`）、矿池（`Pool`）、收购点（`Market`）、居民记忆（`Memory`、`PoolSighting`，长短期笔记 `Note` 及其上限）、活动日志（`ActivityLog`、`Activity`）、发言记录（`SpeechLog`、`Speech`）、地图与世界模型（含是否结束、游戏时间），越界、重复 id 与事件、采矿、行走、记忆、日志和发言一致性校验 |
| `src/aiverse_server/core/inventory.py` | 居民物品的存入、移出、计数、列出与清空，金币的收付（服务端内部接口，不是原语） |
| `src/aiverse_server/core/events.py` | 事件队列：事件种类基类 `EventPayload` 与其钩子，发送、同意、拒绝、撤回和收件箱查询 |
| `src/aiverse_server/economy/tokens.py` | token 体力：物品种类 `TOKEN`、拥有量、走路消耗、按数量扣除 `pay_tokens` |
| `src/aiverse_server/economy/chips.py` | 芯片：型号表 `CHIP_MODELS`（价格、每次产量）、携带的最好一块 `best_chip`、在收购点购买 `buy_chip` |
| `src/aiverse_server/economy/mining.py` | 矿池采矿：需要芯片、产量按最好的一块，开始、按游戏时间发放、取消、忙碌检查（含行走）、下一次完成时刻 |
| `src/aiverse_server/economy/market.py` | 收购点：定价常量、随时间回落的卖出压力 `pressure_at`、边际单价 `unit_price`、卖出收入 `quote`、卖出 `sell_tokens` |
| `src/aiverse_server/economy/trade.py` | 交易事件：`PurchaseOffer`、`SaleOffer`，条款校验、预留与互换，预留金币与物品统计 |
| `src/aiverse_server/economy/contracts.py` | 合约：提议事件 `ContractProposal`、交付 `deliver`、取消 `cancel_contract`、到期 `expire_contracts`、终止 `end_contracts`（押金按责任赔付或退回，并记入 `ContractBook.ended`），托管的货款与押金统计 `contract_coins` |
| `src/aiverse_server/residents/walking.py` | 行走：速度 `WALK_SPEED`、所需时间、途中位置 `position_at`、出发、到达、中途停下、下一次到达时刻 |
| `src/aiverse_server/residents/perception.py` | 感知与发现：感知半径、每轮开始时的 `begin_turn`（范围内的矿池、居民、新活动、收购点与现价、当前笔记、自上次以来说过和听到的话，更新记住的矿池）、`record_activity` 记录活动 |
| `src/aiverse_server/residents/memory.py` | 居民自选的记忆：`remember` 写入长期或短期笔记、`forget` 忘掉一条、`forget_expired` 清除过期的短期笔记，短期时长 `SHORT_TERM_SECONDS` |
| `src/aiverse_server/residents/speech.py` | 对话：听力半径 `HEARING_RADIUS`、每句消耗 `SPEECH_COSTS`、当众说或私聊的 `say`，听到的人在说话时定下 |
| `src/aiverse_server/game/actions.py` | 操作原语（`MoveTo`、`RespondToEvent`、`WithdrawEvent`、`OfferToBuy`、`OfferToSell`、`ProposeContract`、`Deliver`、`CancelContract`、`LeaveGame`、`Mine`、`SellTokens`、`BuyChip`、`Say`）及其规则校验与执行 `perform`，执行后记录活动 |
| `src/aiverse_server/game/lifecycle.py` | 一局的生命周期：能否行动、出局（含 token 耗尽，行走者到达后出局）、结束（停下采矿与行走、终止合约）、金币总额（含报价与合约中预留的）与排名、默认时长 |
| `src/aiverse_server/game/clock.py` | 游戏时间到点的事：`settle_due` 发放采矿、接回到达的行走者（花光 token 的出局）并记录活动、合约到期，`next_due` 下一个到点时刻 |
| `src/aiverse_server/game/layout.py` | 固定的初始地图与居民，初始金币与 token，地图中心的收购点，按种子随机放置矿池（离收购点至少 `MARKET_CLEARANCE`） |
| `src/aiverse_server/server/protocol.py` | 消息模型、客户端消息解析（错误信息不回显输入）、消息到原语与世界到视图的转换（私聊按连接选择的居民过滤，标出由 Agent 驱动的居民），`start_agent` 的模型设置 |
| `src/aiverse_server/server/config.py` | YAML 配置文件：`llm.override` 全局覆盖模型的地址、key、模型（`Config.llm_override`），拒绝未知的键，错误信息不含设置的值 |
| `src/aiverse_server/server/app.py` | FastAPI 应用与 WebSocket `/ws`：共享世界、对局计时（到点的事见 `clock.py`）、每轮开始的 `Game.begin_turn`、写入与忘掉笔记的 `Game.remember`、`Game.forget`、Agent 与网页共用的执行入口 `Game.act`、`Game.commit`、唤醒 Agent 的 `Game.subscribe`、运行中启动、更换与停止 Agent（`Game.start_agent`、`Game.start_llm_agent` 合并配置文件的覆盖项、`Game.stop_agent`）、握手、执行原语、回答 `start_agent`/`stop_agent`、广播状态 |
| `src/aiverse_server/agents/` | AI 居民：`runner.py` 事件驱动的循环、唤醒规则与每轮记录，`observation.py` 每轮的观察及其 JSON，`tools.py` 绑定居民的工具（pydantic 参数模型与 JSON Schema），`scripted_brain.py` 脚本机器人，`llm_brain.py` OpenAI 兼容接口的大模型大脑 `ChatCompletionsBrain` 与设置 `LLMSettings` 的合并和校验，`system_prompt.py` 给模型的系统提示（规则说明） |
| `src/aiverse_server/__main__.py` | `uv run aiverse-server` 启动入口（`--host`、`--port`、`--duration`、`--seed`、`--config`、`--agent`、`--agent-log`） |
| `aiverse.example.yml` | 配置文件示例；本地的 `aiverse.yml` 可能含 key，被 Git 忽略 |
| `tests/` | 世界模型、操作原语、物品栏与金币、事件、交易、合约、对局生命周期、token、采矿、收购点、行走、感知、记忆、对话、AI 居民、配置文件、交给与停止 AI 与 WebSocket 接口测试 |
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
| `.agents/rules/conventions.md` | 文件命名与目录约定（两个仓库共用） |
| `.agents/rules/testing.md` | 测试约定：分层与单个测试的结构（两个仓库共用） |
| `docs/architecture.md` | 应用分层、坐标系与数据流 |
| `docs/status.md` | 跨会话交接状态 |
| `docs/design/README.md` | 设计文档规则：何时新建、何时修改、写什么，以及索引 |
| `docs/design/game-overview.md` | AIverse 总体设计提案、最小玩法与待验证假设 |
| `docs/design/ai-residents.md` | AI 居民的设计：事件驱动循环、工具、两种大脑与暂未实现的功能 |
| `docs/decisions/` | 重要决策的说明与模板 |
| `changes/` | 单次变更说明、验收与证据 |
| `scripts/check_repo.py` | 无第三方依赖的仓库骨架检查；同级有 `aiverse-server` 时逐字比较两边的 `.agents/rules/` 与 `.agents/skills/` |
| `Makefile` | `check` 仓库检查；`verify` 仓库与应用检查 |
| `.editorconfig` | 基础文本编辑约定 |
| `.gitignore` | 本地环境、私密配置和生成产物的忽略规则 |

只记录真实存在的文件和命令。
