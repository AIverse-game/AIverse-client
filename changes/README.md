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
