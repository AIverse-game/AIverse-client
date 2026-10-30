# 应用架构

技术选型与依据见 [决策 0001](decisions/0001-web-stack-and-layering.md) 与 [决策 0002](decisions/0002-python-server-and-coordinate-map.md)。本文说明代码如何分层、数据如何流动。

## 核心原则：权威服务端，客户端只渲染

游戏状态只由一处计算，即 Python 服务端（与本仓库同级的 `aiverse-server` 目录）。客户端发送意图，接收服务端推送的状态快照，然后把快照画出来。客户端不计算可信的游戏结果，因此改动客户端代码也无法作弊。

```text
浏览器（本仓库，只依赖 protocol）
  ui/ React 面板、render/ Phaser 地图
      ↑ 读取快照             ↓ 选中居民、发起操作
  state/ GameStore
      ↑                     ↓ hello、action
  net/ GameConnection（WebSocket，校验每条消息）
      ↑ JSON 文本帧          ↓ JSON 文本帧
Python 服务端（aiverse-server）
  server/     对外接口
    app.py      WebSocket /ws：收消息、回复、向所有连接广播新状态，启动、更换与停止 Agent
    protocol.py 消息模型、输入校验、消息与原语/视图的转换
    config.py   YAML 配置文件：全局覆盖模型的地址、key、模型
  agents/     AI 居民：事件驱动的循环、绑定居民的工具、脚本机器人与 OpenAI 兼容接口的模型大脑
  game/       一局的规则与调度
    actions.py  操作原语：玩家与 AI 改变世界的唯一入口
    lifecycle.py 能否行动、出局（含 token 耗尽）、结束、金币排名
    clock.py    游戏时间到点的事：发放采矿、行走到达
    layout.py   固定的地图、居民与地图中心的收购点，按种子随机放置的矿池
  residents/  居民的行动与认知
    walking.py  行走：速度、途中位置、到达
    perception.py 感知与发现：每轮开始时看到的周围与新动态
    memory.py   Agent 自选的长短期笔记
    speech.py   对话：当众说给附近的人听，或私聊一名居民
  economy/    经济
    tokens.py   token 体力：物品种类、拥有量、走路消耗
    chips.py    芯片：采矿必须携带，三个型号在收购点按定价出售
    mining.py   矿池采矿：开始、按游戏时间发放、取消
    market.py   收购点：按随卖出下跌、随时间回升的市场价用金币收购 token
    trade.py    购买与出售报价：事件种类，物品换金币
  core/       世界模型与共用机制，只依赖 core/ 内的模块
    world.py    世界模型（含物品栏、金币、出局与结束标记、事件队列、矿池、收购点、游戏时间）与坐标校验
    inventory.py 居民物品的存入、移出、计数、列出与清空（服务端内部，不是原语）
    events.py   事件队列：居民之间的请求，等待同意、拒绝或撤回
```

开发与预览时，Vite 把页面的 `/ws` 代理到 `127.0.0.1:8000`，客户端不需要写死地址；其他部署方式可在构建时设置 `VITE_SERVER_URL`。

## 坐标系

- 地图是边长为 `size` 个地图单位的正方形（当前 100）。
- 原点 (0, 0) 在左上角（西北角），x 向右（东）增大，y 向下（南）增大，与屏幕方向一致。
- 两轴取值为闭区间 [0, size] 内的实数，不是网格。居民有坐标；以后的地点和物品也使用同一坐标系。
- 服务端拒绝构造越界或 id 重复的世界；客户端收到不满足这些条件的消息会报错，不会渲染。
- 渲染时，地图是一块从斜上方透视俯视的地块（参考《饥荒》）：转 45°，原点在最远的顶角，x 向右下、y 向左下；俯仰 40°，远小近大。居民是脚底对准坐标的竖直图形，按远近缩放和遮挡。投影只是表现，不改变坐标；地图大小变化时刻度和画面自动调整，见 [变更 0006](../changes/0006-perspective-map.md)。

## 分层与职责

| 层 | 位置 | 职责 |
| --- | --- | --- |
| 协议 | `packages/protocol` | 客户端与服务端之间的消息与视图类型；对服务端消息做运行时校验。Python 对应定义在 `aiverse_server/server/protocol.py` |
| 传输 | `apps/web/src/net` | `GameConnection` 接口与 WebSocket 实现：发送前排队、校验收到的消息、报告连接失败 |
| 客户端状态 | `apps/web/src/state` | 保存最近一次快照、连接状态、本地选中的居民与最近一次操作结果；发送操作原语 |
| 渲染 | `apps/web/src/render` | 坐标换算与刻度（`layout.ts`）、Phaser 地图场景（含点选居民、点击地面移动、按真实时间播放行走） |
| 界面 | `apps/web/src/ui` | React：顶栏、地图容器、地图与居民信息、手动操作面板 |

依赖只能自上而下：协议不依赖任何内部包，也不直接访问运行环境；客户端只依赖协议。`npm run lint` 会拒绝越层导入。

## 一次连接如何进行

1. 页面创建 WebSocket 连接，`GameStore` 立即发送 `hello`（连接打开前排队）。
2. 服务端校验 `hello` 和协议版本，回复 `welcome`，再回复 `state`，其中包含地图、矿池、收购点（位置、半径与定价参数、卖出压力）、居民（含金币、出局、名次、token、采矿与行走状态）、对局状态（是否结束、剩余时间）和最近的发言。
3. 连接层用 zod 校验每条消息；不合协议时断开并在界面报错。
4. `GameStore` 更新快照，Phaser 场景和 React 面板随之重绘。

非法消息得到 `error` 回复，连接保持可用。所有连接共享服务端的同一个世界。

## 操作原语

玩家与 AI 改变世界的唯一方式是操作原语，定义在服务端 `actions.py`：每个原语是一个不可变的请求，`perform(world, action)` 按规则校验后返回新的世界，或抛出 `ActionRejected` 且不改动任何东西。玩家手动操作和以后的 AI 使用同一组原语与同一个 `perform`；规则只写在这里，不靠调用方保证。目前把新世界写回共享状态并广播的代码还在 `app.py` 的 WebSocket 处理中，接入 AI 时需要把它收进 `Game` 共用。

客户端可用的原语有 `move_to`（让一名居民按固定速度沿直线走到地图内的目标坐标，到达前忙碌，见下文“行走”；每回合距离待移动规则确定后加入）、`leave_game`（退出游戏，见下文“一局的生命周期”）、`mine`（在矿池采矿，见下文“token 与矿池”）、`sell_tokens`（在收购点卖 token，见下文“收购点与市场价”）、`buy_chip`（在收购点买芯片，见下文“芯片”）和 `say`（说话，见下文“对话”）。交易与答复事件的原语已在服务端实现，尚未进入协议。其余原语（采集、制作等）按同样方式增加。

居民物品由服务端内部的 `inventory.py` 管理（存入、移出、计数、列出、清空），这些函数同样返回新的世界，但不对客户端和 AI 开放；以后的原语调用它们，并把 `InventoryError` 转成 `ActionRejected`。

## 事件

居民之间需要对方同意的操作（例如 A 向 B 请求购买物品）抽象为事件，像消息队列一样工作，见服务端 `events.py` 与 [变更 0009](../changes/0009-event-queue.md)：

1. 发件人的原语调用 `send_event`。事件种类的 `on_send` 钩子校验请求并预留它承诺的东西（例如冻结金币），事件获得一个递增且不复用的 id，排进世界中的 `World.events` 队列。
2. 收件人从 `pending_for` 看到发给自己的事件，用原语 `RespondToEvent` 同意或拒绝；发件人可以用 `WithdrawEvent` 撤回尚未答复的事件。只有收件人能答复、只有发件人能撤回，对别人的事件一律报告 `unknown_event`。
3. 同意时事件离开队列并执行 `on_accept`；拒绝或撤回时执行 `on_decline`，释放预留。钩子失败时世界与队列整体不变，事件仍待处理。

每种事件是 `EventPayload` 的一个子类（冻结的 dataclass），只覆盖需要的钩子，新增种类不改动框架。队列和物品栏一样属于不可变世界，提交与广播沿用现有路径。事件尚未进入协议。

第一批具体种类是交易，见服务端 `trade.py` 与 [变更 0010](../changes/0010-trade-offers.md)：买方用原语 `OfferToBuy` 向卖方发出 `PurchaseOffer`，或卖方用 `OfferToSell` 向买方发出 `SaleOffer`。发件人承诺的那一份（买方的金币或卖方的物品）在发送时预留，收件人同意时交出自己的一份并完成互换；拒绝或撤回时预留退回。金币是居民的独立余额，价格是整批的总价。

## 一局的生命周期

见服务端 `lifecycle.py` 与 [变更 0011](../changes/0011-coins-leaving-and-game-end.md)：

- `perform` 先调用 `check_can_act`：游戏结束后一律 `game_over`，出局的居民一律 `resident_left`。
- 出局（原语 `LeaveGame`，或服务端直接调用 `leave_game`）：撤销与该居民有关的报价并退回双方预留，清空物品，保留金币，标记 `left`。居民留在世界和排名中，游戏照常进行。
- 结束：`app.py` 的 `Game` 在创建时记下开局时刻（单调时钟，一局默认 `GAME_DURATION` 即 20 分钟）。应用 lifespan 中的计时任务到点调用 `end_game` 并广播；每帧处理前也检查一次（`Game.tick`）。`end_game` 停止所有采矿、撤销所有报价并设 `World.ended`，世界从此不变。
- 视图：每名居民带公开的金币总额（余额加待处理购买报价中的预留）、`left` 与 `rank`（相同并列）；世界带 `game.ended` 与发送时的 `remainingSeconds`。客户端以收到状态的本地时刻为起点倒计时，不比较两台机器的时钟。

一次手动操作：

1. 玩家在侧栏或地图上选中居民（只存在本地 `GameStore`），填写坐标或点击地面。
2. `GameStore.act()` 发送 `{"type": "action", "action": {"type": "move_to", ...}}`；连接未就绪时不发送。
3. 服务端要求该连接已完成 `hello`，把消息转换成原语并执行，回复发送者 `action_result`（`ok`，拒绝时附 `code` 与 `message`）。
4. 世界有变化时，服务端把新的 `state` 放进每个已握手连接的发送队列；各页面按同样的顺序收到更新，地图播放移动动画；行走中的居民按快照中的位置、目标与剩余时间，用真实时间逐帧算出位置（不用 Phaser 补间，它的时钟会随帧率变慢），到达时服务端再推送一次。状态快照是完整的，每个连接只保留最新一份待发，别人移动得再多也不会让它的队列变长；对自己操作的回复最多积压 256 条，发得比读得快的连接超过就以 1008 关闭。

以后加入回合推进时，原语改为在回合结算时统一执行，结算后同样推送 `state`，客户端这一侧的流程不需要改变。

## token 与矿池

见服务端 `tokens.py`、`mining.py` 与 [变更 0012](../changes/0012-tokens-and-mining.md)：

- token 是居民的体力，也是物品种类 `"token"`，因此用现有的买卖报价交易。视图中的 `tokens` 是拥有量：携带的加出售报价中预留的。
- `MoveTo` 先按直线距离扣 token（每单位 1，向上取整），不够时以 `not_enough_tokens` 拒绝。
- `perform` 执行原语后调用 `knock_out_exhausted`：这次原语让其拥有量由正变零的居民按 `leave_game` 出局；判断时进行中的采矿已挖出的 token 也算拥有。
- 矿池在创建世界时由 `layout.scatter_pools(seed)` 放置，之后不移动、不增减，只有储量下降。`Mine` 要求居民站在矿池半径内，开始时从矿池扣出 token，`MINE_SECONDS` 后发放；期间居民忙碌，除 `LeaveGame` 外以 `busy` 拒绝。出局时 token 退回矿池，游戏结束时任务作废。
- 游戏时间是 `World.time`。`Game.tick` 在每帧处理前和计时任务醒来时推进它，用 `clock.settle_due` 发放到期的采矿、接回到达的行走者并记录活动，到点时结束游戏，有变化就广播；计时任务等待对局结束和最早一个采矿或行走结束中较早的那个。

## 收购点与市场价

见服务端 `market.py` 与 [变更 0016](../changes/0016-token-market.md)：

- 除开局资金外，金币唯一的新来源。地图中心有一个收购点（`World.market`），矿池离它至少 `MARKET_CLEARANCE`。`SellTokens` 要求居民站在收购点半径内，卖出携带的 token，按市场价得到金币；卖光拥有的 token 照常出局。
- 价格由“近期卖出压力” S 决定：边际单价 `基准价 × 深度 / (深度 + S)`，一次卖出的收入是从 S 到 S + q 的积分并向下取整，S 按半衰期指数回落。`Market` 只记录压力和测得压力的游戏时刻，任意时刻的价格由公式算出，不需要计时器。
- 视图中的 `market` 带定价参数和发送时的压力；客户端按收到状态的本地时刻推算当前单价和估算收入（`apps/web/src/state/market.ts`），只用于显示。

## 芯片

见服务端 `chips.py` 与 [变更 0017](../changes/0017-mining-chips.md)：

- 芯片是以型号命名的物品（`"MK1"`、`"MK2"`、`"MK3"`），型号表 `CHIP_MODELS` 给出价格和每次采矿的产量。`BuyChip` 要求居民站在收购点半径内，用携带的金币按定价买一块。
- `Mine` 用 `best_chip` 找出携带的最好一块，没有时以 `no_chip` 拒绝；产量取该型号的 `tokens_per_job`，型号记在 `MiningJob.chip`。世界校验采矿中的居民必须携带这块芯片；采矿期间的忙碌规则让它既不能走开也不能被报价卖出。
- 视图中的 `chips` 是拥有的芯片（含报价中预留的），`market.chips` 是价目。页面用 `GameStore.bestChip` 显示将要用的芯片，贴图见 `apps/web/src/ui/ChipIcon.tsx`。

## 对话

见服务端 `speech.py`、[变更 0018](../changes/0018-speech.md) 与 [变更 0019](../changes/0019-speech-cost-and-privacy.md)：

- 原语 `Say` 不带 `to` 时当众说：说话那一刻 `HEARING_RADIUS`（20，与感知半径相同）内仍在局中的其他居民听到，行走者按途中位置；带 `to` 时只有那名居民听到，不论远近。谁听到记在发言的 `listeners` 里，之后走近的人听不到。
- 说话像退出游戏一样不受忙碌限制，不进活动日志。每句从携带的 token 中扣 `SPEECH_COSTS`：当众说 2 个、私聊 1 个，花掉最后一个照常出局。世界保留最近 `SPEECH_LIMIT`（200）句，`Memory.speech_seen` 记着居民看过的最后一句。
- `begin_turn` 的 `Perception.speech` 是自上次查看以来自己说的和听到的话。
- 视图因连接而异：每个连接有一个 `view_as` 选择的居民（`Outbox.viewer`），`world_view` 只放进当众说的话和该居民发出或收到的私聊，取其中最近 50 句；`Game.broadcast_world` 按不同的选择各编码一次。页面在 `GameStore.select` 时发送 `view_as`，所以不相关的私聊不会到达浏览器。页面的“对话”面板见 `apps/web/src/ui/SpeechPanel.tsx`。

## 行走

见服务端 `walking.py` 与 [变更 0014](../changes/0014-walking-speed.md)：

- `MoveTo` 出发时按直线距离扣 token，然后开始一次行走（`WalkJob`：目标、出发与到达时刻），速度 `WALK_SPEED` = 每秒 2.5 地图单位。行走期间居民忙碌，除 `LeaveGame` 外以 `busy` 拒绝；`Resident.position` 仍是出发点，`walking.position_at` 给出途中位置，感知与视图都用它。
- 到达由 `Game.tick` 处理；花光最后一个 token 的行走者到达后才出局（`lifecycle.knock_out_arrivals`），`knock_out_exhausted` 跳过仍在路上的居民。中途出局或游戏结束时停在当时的位置。
- 视图中行走者的 `position` 是发送时的途中位置，另有 `walking`（`target`、`remainingSeconds`）。

## 每轮开始的感知

AI 每轮开始时调用 `Game.begin_turn(resident_id)`：先 `tick` 把世界推进到此刻，再调用 `perception.begin_turn` 并把更新了记忆的世界存回 `Game`，返回这一轮的感知。记忆不在协议中，所以不广播。见 [变更 0013](../changes/0013-perception.md) 与 [变更 0014](../changes/0014-walking-speed.md)。

## 由 AI 驱动居民

页面“AI 驱动”面板把选中的居民交给玩家配置的大模型：发送 `start_agent`（API 地址、key、模型），服务端用配置文件 `llm.override` 中给出的项覆盖页面的值，校验后为该居民启动一个 Agent 循环，回复 `agent_result`，并向所有连接广播带 `agent` 标记的新状态；`stop_agent` 停止它。`welcome` 只告诉页面哪些设置被覆盖，不发送值；key 只在服务端内存中用来调用接口。设置按居民存在本机 localStorage，由 `ui/savedLLMSettings.ts` 读写。设计见 [AI 居民](design/ai-residents.md)，选型见 [决策 0004](decisions/0004-player-configured-llm-endpoints.md)。

## 协议改动

协议在两种语言中各有一份。改动时同时修改 `packages/protocol` 与服务端的 `protocol.py`，两边的测试一起更新；不兼容的改动要同时提升两边的 `PROTOCOL_VERSION`。
