# 0084：设施收到金币时的金币特效

状态：已完成（服务端 `make verify` 和客户端 `npm run verify` 通过，已在浏览器实测，独立审查没有确认的问题）。

## 目标与依据

用户（2026-11-08）：给前端加金币特效，类似 `demos/arcade_owner_income_fx.html`，另一个例子是 pixelfx 的 `coin-collect.js`；每次设施获得金币，就在设施上方展示这个特效。

可观察的变化：广告位、游戏厅和工作空间在每个付款日收到钱时，屋顶上方弹出像素金币（1～5 枚，按金额），转动、悬停、收起并迸出火花，同时上浮并渐隐地显示 `+金额`。

## 范围

- 服务端（`aiverse-server`，单独提交）：协议 28，设施视图加 `income`（`at`、`coins`）；`economy/payouts.py` 的 `latest_payout` 从赞助商和入场费两本账的 `last_paid` 算出；README 的协议与代码结构同步。
- 客户端协议：`packages/protocol` 的 `income` 校验，`PROTOCOL_VERSION` 28。
- 页面：`render/payoutWatch.ts` 判断哪些收入是新的；`render/coinBurst.ts` 特效的时间线；`render/coinSprites.ts` 像素金币与数字的贴图；`render/CoinBurstLayer.ts` 摆放与回收；`FacilityLayer.anchor` 给出设施屋顶的位置与地块宽度；`MapRenderer` 接入。
- 设计文档：新建 [设施收入的金币特效](../docs/design/income-effect.md)。
- 不做：传送门过路费的特效；逐位访客进门的特效；声音；页面左上角的金币计数器。

## 关键选择

- 页面原先拿不到“哪座设施收到钱”，所以必须扩协议。选用设施视图加 `income`、靠 `at` 去重，理由和另外两个方案见设计文档的争议讨论。这是 Claude 的取舍，用户未逐项确认。
- 特效按付款日出现，每座设施每 30 秒至多一次，因为服务端只在付款日结算。

## 验收条件

- [x] 付款日付给设施钱后，页面在该设施上方播放金币特效，金额与 `income.coins` 一致（浏览器实测，见下）。
- [x] 同一笔收入不重复播放；页面刚打开时已有的收入不播放；新开一局（付款日倒退）不播放（`payoutWatch.test.ts`）。
- [x] 金额越大金币越多，分档与边界（`coinBurst.test.ts`）。
- [x] 服务端设施视图带 `income`，没付过款的省略；两本账同日相加、不同日取较晚的（`test_payouts.py`、`test_protocol.py`）。
- [x] 客户端拒绝格式不对的 `income`（`messages.test.ts`）。

## 验证证据

- 服务端 `make verify`：通过（ruff、ruff format、mypy strict、1242 个 pytest）。
- 客户端 `npm run verify`：通过（类型检查、ESLint、208 个测试、构建）。
- 浏览器：另起一个服务端（端口 8001，日志目录在临时目录）和 `npm run dev`，用无头 Chrome（swiftshader）经 CDP 驱动：页面里包一层 WebSocket，给真实服务端的 `state` 加上三座设施（广告位、工作空间、游戏厅），再触发一个付款日（`income.at` 加 30，金额 8、37、260）。截图依次拍到金币弹起、转动悬停、火花和渐隐，之后画面干净；三座设施的特效大小一致可读。这是用注入的数据核对页面，不是真实对局里的付款日。
- 独立审查（子 Agent，只读，一轮）：没有确认的问题。审查方核对了 `latest_payout` 与两本账 `last_paid`、`topped_up_at`/`paid_at` 的语义（同一设施只被一本账付钱，`at` 单调递增，`income=None` 经 `exclude_none` 不会序列化成 `null`），`PayoutWatch` 的首次快照、新开一局、income 消失又出现，以及材质的克隆与释放。留下的几点已处理：补了“income 消失后再出现”和“`at` 为负、为 0”的测试，改了一处测试注释和设计文档里“重连”的措辞。未处理的低影响疑点：`CoinSprites` 的金额贴图缓存按文字留到页面关闭才释放（金额种类有限）；`coins.update` 读的是上一帧的相机矩阵，横向展开方向慢一帧，肉眼看不出。
- 未执行：真实对局里赞助商和入场费实际付款时的特效（默认世界没有设施，这一条靠上面的注入数据核对）；真实 GPU 上的帧率；多座设施同时播放时的性能（每座设施的特效最多 26 个 Sprite，所有金币共用 8 个材质）。

## 交接

- 协议两边同时升到 28，旧服务端或旧页面会因版本不符而断开；本机原来在 8000 端口运行的服务端要重启才能带上 `income`。
- 设计文档、`docs/status.md`、`docs/code-map.md`、设计文档索引与本变更索引已更新。
- 已知限制见设计文档的“暂未实现的功能”。
