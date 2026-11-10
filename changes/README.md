# 变更记录

实质功能、规则、协议或架构改动先写简短变更说明，完成后在同一文件记录实际证据。简单文档修订不要求另开记录。

复制 [TEMPLATE.md](TEMPLATE.md)，用递增编号与明确名称保存。不要把未执行的检查写成通过，也不要在模板里预填成功结果。

| 记录 | 状态 | 目的 |
| --- | --- | --- |
| [0001-agent-preparation](0001-agent-preparation.md) | 已完成 | 本次开发准备与验收证据 |
| [0002-development-review-skills](0002-development-review-skills.md) | 已完成 | 拆分开发与审查职责，明确调用和交接 |
| [0003-game-design](0003-game-design.md) | 已完成（设计文档） | AIverse 总体游戏设计与最小可玩版本提案 |
| [0004-web-foundation](0004-web-foundation.md) | 已完成 | 网页端底层框架、分层与 GitHub Pages 部署 |
| [0005-coordinate-map](0005-coordinate-map.md) | 已完成 | Python 服务端生成正方形坐标地图，网页按坐标渲染 |
| [0006-perspective-map](0006-perspective-map.md) | 已完成 | 参考《饥荒》的 2.5D 透视地图 |
| [0007-action-primitives](0007-action-primitives.md) | 已完成 | 操作原语系统，首个原语“移动到坐标”，页面可手动操作 |
| [0008-resident-inventory](0008-resident-inventory.md) | 已完成 | 居民持有物品：容量无限、只在局内有效，服务端内部的增删查接口 |
| [0009-event-queue](0009-event-queue.md) | 已完成 | 事件系统框架：居民之间的请求排队等待同意、拒绝或撤回，事件种类可扩展 |
| [0010-trade-offers](0010-trade-offers.md) | 已完成 | 购买与出售：任一方发起报价并预留自己的一份，对方同意后物品换金币 |
| [0011-coins-leaving-and-game-end](0011-coins-leaving-and-game-end.md) | 已完成 | 金币独立余额（开局 10000）、居民出局、一局定时结束与金币排名，协议 4 与页面展示 |
| [0012-tokens-and-mining](0012-tokens-and-mining.md) | 已完成 | token 体力：走路消耗、开局固定的随机矿池与定时采矿、可交易、耗尽出局，协议 5 与页面展示 |
| [0013-perception](0013-perception.md) | 已完成 | 感知与发现：每轮开始时注意到周围的矿池、居民和附近发生的活动，记住见过的矿池（服务端内部） |
| [0014-walking-speed](0014-walking-speed.md) | 已完成 | 行走速度：`move_to` 按每秒 2.5 单位走过去、途中忙碌并可见；`Game.begin_turn` 先推进时间再感知；协议 6 与页面行走动画 |
| [0015-memory](0015-memory.md) | 已完成 | 长期与短期记忆：Agent 自选记下的文字笔记，短期 120 秒后清除（服务端内部） |
| [0016-token-market](0016-token-market.md) | 已完成 | token 收购点：随卖出下跌、随时间回升的市场价，金币的新来源；协议 7 与页面卖出 |
| [0017-mining-chips](0017-mining-chips.md) | 已完成 | 芯片：采矿必须有芯片，三个型号在收购点用金币买，越好的产量越高，采矿期间守着芯片；协议 8 与页面贴图 |
| [0018-speech](0018-speech.md) | 已完成 | 对话：当众说给 20 单位内的人听，或不论远近私聊一名居民；感知附带听到的话，协议 9 与页面对话面板 |
| [0019-speech-cost-and-privacy](0019-speech-cost-and-privacy.md) | 已完成 | 发言消耗 token（当众 2、私聊 1）；页面以 `view_as` 告诉服务端选中的居民，服务端只发与其有关的私聊，协议 10 |
| [0020-agent-loop](0020-agent-loop.md) | 已完成 | AI 居民循环：事件驱动调度、绑定居民的工具、脚本机器人与 OpenRouter 模型大脑（服务端） |
| [0021-server-subpackages](0021-server-subpackages.md) | 已完成 | 服务端按领域分为 core、economy、residents、game、server 子包，测试同样分组；行为不变 |
| [0022-llm-config-from-page](0022-llm-config-from-page.md) | 已完成 | 页面配置任意 OpenAI 兼容的大模型接口并交给 AI，服务端 YAML 配置文件可以全局覆盖；协议 11 |
| [0023-naming-conventions](0023-naming-conventions.md) | 已完成 | 成文的文件命名与目录约定，两个仓库共用；不改现有文件名 |
| [0024-descriptive-module-names](0024-descriptive-module-names.md) | 已完成 | 改掉看不出内容的模块名：`llm_brain.py`、`scripted_brain.py`、`system_prompt.py`、`storeContext.tsx` |
| [0025-delivery-contracts](0025-delivery-contracts.md) | 已完成 | 交付合约：每次交付自动付款，单次或多次，签订时托管买方货款；只在服务端与 Agent 工具中 |
| [0026-deals-on-page](0026-deals-on-page.md) | 已完成 | 页面只读显示所选居民的报价、合约提议与合约，只给当事人看；协议 12 |
| [0027-supplier-deposits](0027-supplier-deposits.md) | 已完成 | 供货方押金：没交付的押金按责任赔给买方；合约结束记录与唤醒；协议 13 |
| [0028-testing-conventions](0028-testing-conventions.md) | 已完成 | 成文的测试约定：单元、集成、端到端分层，单个测试按准备、执行、断言三段写；不改现有测试 |
| [0029-agent-rules-in-both-repos](0029-agent-rules-in-both-repos.md) | 已完成 | 规则移到 `.agents/rules/`，两个仓库各存一份相同的规则与 Skill，客户端检查比较两边（已由 0030 改为各自独立） |
| [0030-independent-agent-rules](0030-independent-agent-rules.md) | 已完成 | 两个仓库的规则与 Skill 各自只描述本仓库，去掉跨仓库比较 |
| [0031-server-test-layers](0031-server-test-layers.md) | 已完成 | 服务端测试分到 `tests/unit/` 与 `tests/integration/`，现有测试按测试约定改写 |
| [0032-agent-timeline-and-strategy](0032-agent-timeline-and-strategy.md) | 已完成 | AI 行动时间线、真实资源变化与可选经营方针；协议 14 |
| [0033-per-resident-logs](0033-per-resident-logs.md) | 已完成 | 默认按角色记录当前对局的操作、时间、记忆与模型输出，每局覆盖 |
| [0034-mining-rigs](0034-mining-rigs.md) | 已完成 | 有限插槽矿机、芯片租用、预存租金与电费、出局停产，协议 15 |
| [0035-mining-rig-sprite](0035-mining-rig-sprite.md) | 已完成 | 用户提供的矿机贴图、透明机身点击与独立插槽状态灯 |
| [0036-market-and-rig-tuning](0036-market-and-rig-tuning.md) | 已完成 | 收购价跌得慢、久无人卖则涨价；矿机产量翻倍、租金降到 50；Agent 建机后得知编号；协议 16 |
| [0037-lock-hold-and-rig-price](0037-lock-hold-and-rig-price.md) | 已完成 | AI 卖出锁价只管 30 秒；矿机建造价 8000 |
| [0038-larger-map](0038-larger-map.md) | 已完成 | 地图扩大到 150 × 150，矿池间距加倍、离收购点更远；确认矿机只能建在矿池上 |
| [0039-price-history-chart](0039-price-history-chart.md) | 已完成 | 记录收购价历史（卖出时与无人卖出时每 5 秒），页面画折线图；协议 17 |
| [0040-information-selling](0040-information-selling.md) | 已完成 | 居民可把自己知道的信息报价出售，买方成交前只看摘要，卖方保留原信息；协议未改 |
| [0041-rig-price-9000](0041-rig-price-9000.md) | 已完成 | 矿机建造价从 8000 提到 9000 |
| [0042-pool-token-coin-sprites](0042-pool-token-coin-sprites.md) | 已完成 | 矿池地面贴图与旋转浮动的悬浮标记；页面的 token、金币图标 |
| [0043-resident-sprite](0043-resident-sprite.md) | 已完成 | 居民改用贴图，静止与移动时都上下浮动，颜色改为脚下圆盘 |
| [0044-cheaper-walking-and-ending-notice](0044-cheaper-walking-and-ending-notice.md) | 已完成 | 走路每单位耗 token 由 1 减半；结束前 60 秒服务端向居民公告；`remember` 的 `term` 可省略；提示词补充思考耗时与笔记长度；协议未改 |
| [0045-map-scale-and-rig-placement](0045-map-scale-and-rig-placement.md) | 已完成 | 地图显示相对角色放大约 18%；矿机底脚落在矿池内，同池多台合并显示数量 |
| [0046-threefold-scrollable-map](0046-threefold-scrollable-map.md) | 已完成 | 在 0045 的基础上把地图相对角色再放大 3 倍，固定视窗内滚动浏览 |
| [0047-model-output-limit-and-early-notice](0047-model-output-limit-and-early-notice.md) | 已完成 | 配置模型回复 token 上限，结束前 3 分钟增加公告 |
| [0048-configurable-game-timing](0048-configurable-game-timing.md) | 已完成 | 游戏时长和两次结束公告提前量在 `game/config/` 独立配置 |
| [0049-coin-ledger-and-economy-report](0049-coin-ledger-and-economy-report.md) | 已完成 | 金币流水账按渠道记下每次真实转手；对局结束写 `summary.json` 经济报告，含居民间流量占比 |
| [0050-energy-and-crystal-terms](0050-energy-and-crystal-terms.md) | 已完成 | token、矿池、挖矿、芯片、矿机、电费改称能量、能量泉、汲取、晶核、汲能塔、维护费，代码、协议与文档一起改，规则不变 |
| [0051-quarries-and-workshop](0051-quarries-and-workshop.md) | 已完成 | 晶矿挖晶砂、工坊按配方炼晶核（升级链、熟练度），进口价翻倍；服务端与 Agent 工具，页面未接入 |
| [0052-order-book-exchange](0052-order-book-exchange.md) | 已完成 | 收购点处的匿名挂单交易所：能量、晶砂、C1～C3 连续撮合；服务端与 Agent 工具，页面未接入 |
| [0053-crafts-and-exchange-on-page](0053-crafts-and-exchange-on-page.md) | 已完成 | 协议 19：页面显示晶矿、工坊、晶砂与挖砂炼制状态，可挖砂、炼制；交易所面板只读显示挂单簿、成交与所选居民的挂单 |
| [0054-score-counts-held-items](0054-score-counts-held-items.md) | 已完成，已由 0057 撤销 | 协议 20：排名按得分，即金币加能量（按收购价）与晶核（按进口价一半）的估值，对局中实时计算 |
| [0056-order-from-anywhere](0056-order-from-anywhere.md) | 已完成 | 交易所下单不必站在收购点，任何地方都可以；协议未改 |
| [0057-rank-by-coins-again](0057-rank-by-coins-again.md) | 已完成 | 协议 21：撤销 0054，排名回到只算金币；系统提示鼓励局中适时分批卖出 |
| [0058-eight-residents](0058-eight-residents.md) | 已完成 | 默认居民增至 8 名；能量泉与晶矿储量按人数成比例；协议未改 |
| [0059-llm-groups](0059-llm-groups.md) | 已完成 | 模型配置可按居民分组，各组用自己的接口、key 与模型；协议未改 |
| [0060-agent-trend-observation](0060-agent-trend-observation.md) | 已完成 | AI 每轮看到有界的收购价、匿名成交和亲眼所见储量历史，用短期笔记记录预测；协议未改 |
| [0061-virtual-world-terms](0061-virtual-world-terms.md) | 已完成 | 协议 22：能量、晶砂、晶矿、晶核、工坊、汲能塔改称算力、数据、数据矿、程序、工作室、采集节点，代码、协议与文档一起改，规则不变 |
| [0062-land-and-ad-slots](0062-land-and-ad-slots.md) | 已完成 | 买地块、工作室制作素材、在地块上建广告位，按访客流量收金币；服务端与 Agent 工具，页面未接入 |
| [0063-servers-and-meeting-rooms](0063-servers-and-meeting-rooms.md) | 已完成 | 服务器存算力承载附近设施、主人收承载费；会议室要服务器承载，按访客收金币；服务端与 Agent 工具，页面未接入 |
| [0064-remove-old-gameplay](0064-remove-old-gameplay.md) | 已完成 | 去掉旧玩法：算力、采集、收购点、程序、设施等服务端、协议 23 与页面一起删，行走只花时间 |
| [0065-compute-and-nodes](0065-compute-and-nodes.md) | 已完成 | 自带算力与订阅、按需的生成式节点，用工作在自己的地块上建广告位；计划加入传送 |
| [0066-subscription-tail](0066-subscription-tail.md) | 已完成 | 订阅到期时没做完的工作，剩下的部分按自带算力的速度做完 |
| [0067-content-and-revenue](0067-content-and-revenue.md) | 已完成 | 渲染式节点与渲染工作做内容，放进广告位，保鲜期，按流量和内容数付金币；服务端与 Agent 工具，页面和协议不变 |
| [0068-parcel-shares](0068-parcel-shares.md) | 已完成 | 每块地分 100 份，广告位收入按份额分给持有人，份额可以转让；服务端与 Agent 工具，页面和协议不变 |
| [0069-joint-purchase](0069-joint-purchase.md) | 已完成 | 两人合买地块：提议人写明对方出多少钱、拿多少份，买地人仍是提议人；服务端与 Agent 工具，页面和协议不变 |
| [0071-venues](0071-venues.md) | 已完成 | 游戏厅与工作空间：用生成式工作建出，游戏厅展示新的内容物品 `game_content`，首版不产生收入；服务端与 Agent 工具，页面和协议不变 |
| [0072-visitors](0072-visitors.md) | 已完成 | 脚本访客：200 个游客从中央入口进城，按偏好逛展示着内容的广告位，计入展示人数，走不走传送门自己选；不付钱，广告位收入仍是占位公式；服务端与 AI 观察，页面和协议不变 |
| [0073-sponsors](0073-sponsors.md) | 已完成 | 赞助商按展示付费：三个赞助商带预算，每 30 秒的付款日按脚本访客看到广告位的人数付钱，替换占位流量公式并去掉居民加流量；服务端与 AI 观察，页面和协议不变 |
| [0074-working-tourists](0074-working-tourists.md) | 已完成 | 工作游客与入场费：一部分游客走一条大致的路线，先去工作空间再去游戏厅，入场费系统统一定价，付款日按份额付给持有人；同时把设计文档按功能模块拆成独立的几份；服务端与 AI 观察，页面和协议不变 |
| [0075-facilities-page-foundation](0075-facilities-page-foundation.md) | 已完成 | 第 8 步首批：协议 24 与页面接入地块、设施、工作及内容，手动买地、建设、制作与放入；程序化方块居民及玻璃罩设施 |
| [0076-arcade-model-detail](0076-arcade-model-detail.md) | 已完成 | 放大游戏厅占地与玻璃罩，细化底座、地砖、灯带、角柱和入口；协议不变 |
| [0077-demo-models](0077-demo-models.md) | 已完成 | 把 `demos/` 的广告牌、共享办公空间、出生大厅、传送门和方块角色移植到页面，并把地图渲染从 Phaser 迁到 Three.js（决策 0007）；已在无头浏览器截图核对
| [0081-venue-visitors](0081-venue-visitors.md) | 已完成 | 访客去场馆，广告牌不吸引人：广告位只靠路过获得展示，普通游客也去工作空间和游戏厅并交门票；服务端、提示词与设计文档，页面和协议不变 |
| [0082-venue-footprint](0082-venue-footprint.md) | 已完成 | 游戏厅和工作空间占 20 × 20（2 × 2 块地）：服务端占地并拒绝重叠，页面收进岛内；协议 26 |
| [0084-income-coin-effect](0084-income-coin-effect.md) | 已完成 | 设施在付款日收到金币时，设施上方弹出像素金币特效和 `+金额`；协议 28 的设施 `income` |
| [0085-agent-robot](0085-agent-robot.md) | 已完成 | Agent 居民画成悬浮机器人，有待机、思考、说话、开心四个状态；服务端给 `agent.thinking` 和 `agent.cue`，协议版本不变 |
| [0086-build-commissions](0086-build-commissions.md) | 实现中 | 在别人授权的地块上建：地主与建造者任一方提议、对方同意，酬金预留、建成时支付；订阅节点改为最短 300 秒，按需雇用改为每工作量 15 金币；服务端与提示词，协议不变 |
| [0087-self-queue-and-shared-content](0087-self-queue-and-shared-content.md) | 已完成 | 自带算力减速为每秒 0.5 并可排队（最多排 2 件）；份额持有人也能放内容；观察里有居民间的转账笔数与金额；服务端与设计文档，协议不变 |
| [0088-arcade-machines](0088-arcade-machines.md) | 已完成 | 游戏厅里按游戏数摆 demo 的五台机台（街机、抓娃娃机、全息台、赛车、跳舞机），机台渲染独立成 `arcadeMachineModels.ts`；协议不变 |
| [0089-mall](0089-mall.md) | 已完成 | 商场：占 1 × 2 块的第三种场馆，不要内容，建造略便宜、入场费 2 金币、吸引力有限；demo 的雾蓝珊瑚夜景模型；协议 29 |
| [0090-mall-orientation](0090-mall-orientation.md) | 已完成 | 商场可横放（占本块和正东一块）或竖放，朝向由地主定：自己建时选，委托时地主提议写明或同意时指定，建造者照办；协议 30 |
| [0091-pixel-hud-and-world-log](0091-pixel-hud-and-world-log.md) | 已完成 | 地图铺满屏幕、面板浮在上面的科幻像素风界面与像素字体；服务端记录全镇的世界日志，页面以终端窗口逐行显示；协议 31 |
