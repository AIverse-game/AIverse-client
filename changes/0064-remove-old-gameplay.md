# 0064：去掉旧玩法

状态：已完成。

## 目标与依据

[虚拟设施](../docs/design/facilities.md)的实施步骤第 1 步，用户（2026-11-07）要求开始做：算力、算力泉、采集、采集节点、收购点、数据与数据矿、程序、工作室、素材、服务器与会议室、广告位这些旧玩法都去掉，服务端、协议和页面一起删；算力不再是物品，行走只花时间。旧版本在两个仓库的 `legacy` 分支。

可观察的变化：地图上只剩地面和居民；居民没有算力、程序、数据，不会因算力耗尽出局；走路和说话不花东西；页面没有采集、卖算力、买程序、采集节点和收购价折线图；交易所没有商品。局里暂时没有收入来源，这是预期的，第 2、3 步补上。

## 范围

服务端（`aiverse-server`）：

- 删除 `core/collectors.py`，`economy/` 下的 `collectors`、`compute`、`gathering`、`harvesting`、`market`、`programs`、`studio`、`facilities`；世界模型、居民、记忆、活动日志里与它们有关的字段和任务；流水账渠道 `market`、`program_import`、`collector_build`、`upkeep`、`rent`、`hosting`。
- 原语只剩 `MoveTo`、`RespondToEvent`、`WithdrawEvent`、`OfferToBuy`、`OfferToSell`、`OfferInformation`、`ProposeContract`、`Deliver`、`CancelContract`、`LeaveGame`、`BuyParcel`、`PlaceOrder`、`CancelOrder`、`Say`；出局不再因算力耗尽；“忙碌”只有行走，检查移到 `lifecycle.check_not_busy`（错误码 `busy` 不变）。
- 地块去掉设施和“保留地块”，地价和流量的中心改为地图中央（`land.town_centre`）；访客流量模型留在新的 `economy/footfall.py`；居民都出生在地图中央、没有初始物品；去掉 `--seed`。
- 交易所商品表 `EXCHANGE_ITEMS` 为空。
- Agent：删掉对应的工具、观察、工具组、系统提示、脚本机器人策略；观察的 `land` 改为地块价格、主人和流量；资源变化只记金币。
- 协议 23：删掉 `harvest`、`sell_compute`、`buy_program`、`gather_data`、`write_program`、`build_collector`、`install_program`、`fund_collector`、`remove_program`；`state` 删掉 `springs`、`mines`、`studio`、`market`、`collectors`、`collectorRules`，居民删掉 `collectorBalance`、`compute`、`programs`、`carriedPrograms`、`data`、`programsWritten`、`harvesting`、`gathering`、`writing`；AI 时间线的资源变化只有金币。

客户端：协议类型与校验、`GameStore`、地图场景（只画地面和居民）、各面板，以及算力泉、算力、程序、收购点、采集节点的贴图和对应的组件、测试。用户尚未提交的采集节点贴图改动与 `MapScene.ts` 里采集节点的参数调整随采集节点一起删除，已备份。

文档：设计文档、代码地图、架构说明、状态、两个仓库的说明。

留给后续：第 2～6 步，见设计文档。

设计文档：修改 [虚拟设施](../docs/design/facilities.md)（第 1 步完成、实现时的取舍）；采集节点、算力收购点、程序三份设计标为已删除。

## 关键选择

- 实现时的取舍（说话免费、交易所暂无商品、访客模型保留但无人调用、去掉保留地块和 `--seed`、脚本机器人只花钱）记在设计文档的“争议讨论与决定”，用户尚未逐项确认。
- 去掉的玩法不留兼容层：协议升到 23，旧客户端连新服务端会因版本不符被拒绝。
- 删除的代码和测试不另存，需要时从 `legacy` 分支取。

## 验收条件

- [x] 服务端和客户端不再有旧玩法的代码、协议字段、页面元素、贴图和测试。
- [x] 服务端启动后居民从地图中央出生，能走路、说话、买地、报价、挂单、签合约；走路和说话不花东西，不会因算力出局。
- [x] 旧原语收到后得到 `bad_message`。
- [x] 客户端的协议校验接受真实服务端的 `welcome` 与 `state`。
- [ ] 在浏览器中实际打开页面操作：未做，见下。

## 验证证据

2026-11-07，macOS：

- 服务端 `make verify`（ruff、ruff format --check、mypy strict、pytest）通过，805 项测试。
- 客户端 `npm run verify`（类型检查、ESLint、Vitest 135 项、生产构建）通过；`python3 scripts/check_repo.py` 通过。
- 脚本机器人冒烟：`uv run aiverse-server --port 8765 --duration 25 --agent r1=scripted --agent r2=scripted` 跑完一局，r1、r2 各买了一块地，局末写出 `summary.json`（`land` 渠道 2 笔、4340 金币）。
- 协议实测：临时 Vitest 用例通过 WebSocket 连上运行中的服务端，`parseServerMessage` 接受它的 `welcome` 与 `state`（用例已删除，没有入库）。
- 独立审查（服务端、客户端各一名独立子 Agent）：未发现 P0/P1。处理了：已删除的测试示例引用、两处死代码（价格折线的参考线）、`ITEM_NAMES` 的原型取值、文档与注释中的过时说法、系统提示检查的词表；`ai-residents.md`、`economy-metrics.md` 加了状态说明。保留未处理：免费说话（见上）、没有物品时仍展示的工具、`reserved_items`/`order_items` 两个暂时无人调用的通用函数（第 3 步内容成为物品时会用到）。
- 未做：没有在浏览器里点过页面（当前会话没有可用的浏览器工具），页面只靠类型检查、单元测试、构建和上面的协议实测验证。

## 交接

- 已更新 `docs/status.md`、`docs/code-map.md`、`docs/architecture.md`、设计文档索引与服务端 `README.md`。`docs/status.md` 里更早的条目按当时的状态写成，仍提到被删除的玩法，已在开头注明。
- 已知限制：局里没有收入来源，排名只会随买地下降；说话没有冷却；`economy/footfall.py` 只用于观察里的地块流量，没有设施用它付钱；说话免费且没有冷却，页面或脚本可以刷屏并唤醒所有 AI 居民（独立审查指出，未处理，见设计文档）；没有物品时下单、报价、合约的工具仍会展示给 Agent 但必然失败；`docs/design/economy-metrics.md`、`order-book.md` 里以算力等为例的数字是删除前的基线。
- 下一步：第 2 步，算力与节点。
