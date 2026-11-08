# 0083：页面画出脚本访客

状态：已完成（服务端 `make verify` 和客户端 `npm run verify` 通过，已在浏览器实测，独立审查没有确认的问题）。

## 目标与依据

用户（2026-11-08）：实现游客的前端渲染，仍然复用现在的方块人建模。此前访客只在服务端，页面和协议里没有访客，设计文档里写明“访客的走动不广播”，所以要先让页面拿到访客；用户在三个方案里选了“服务端新增 `visitors` 消息”（另两个是塞进 `state` 快照，和页面本地模拟）。

可观察的变化：地图上出现在城里走动的方块人游客，衣色不一，走路时摆臂，站着时只转头；入城时出现在入口（地图中央的大厅），出城时消失。

## 范围

- 服务端（`aiverse-server`，单独提交）：协议 27，新消息 `visitors`（`speed` 与每个在城里的访客的 `id`、`position`、剩余的 `legs`）；`economy/visitors.py` 的 `remaining_legs`；`server/protocol.py` 的 `visitors_message`；`server/app.py` 的 `Outbox.put_visitors`（只留最新一份，排在 `state` 之后）、`Game.run_visitors` 每 2 秒推送、握手后补发一份；世界里没有访客时不发。README 的协议与代码结构同步。
- 客户端协议：`packages/protocol` 的 `visitors` 消息校验，`PROTOCOL_VERSION` 27。
- 客户端状态：`GameStore.getVisitors()` 保存最新一份和收到的时刻；不放进 `ClientState`，也不通知订阅者，因为每 2 秒一次、只有地图每帧读。
- 客户端渲染：`render/visitorWalk.ts` 按剩余的直线段算出某时刻的位置、朝向和是否在走；`render/VisitorLayer.ts` 每帧摆出所有访客；`render/characterCrowd.ts` 用实例化网格画一群方块人；`render/characterModel.ts` 把六个部位抽成 `CHARACTER_PARTS` 与 `characterMaterials`，单个角色和人群共用，外观不变；`MapRenderer` 接入。
- 设计文档：修改 [脚本访客](../docs/design/visitors.md)。
- 不做：访客数与展示数的文字显示；入城出城的淡入淡出；点选访客；访客名字；区分工作游客的外观。

## 关键选择

- 消息方案由用户选定；推送间隔、衣色与实例化绘制是 Claude 的取舍，记在设计文档的争议讨论里。
- 实例化而不是每人一个 `createCharacter`：一个角色是 6 个盒子、每个 6 面材质，约 36 次绘制；150 个访客就是五千多次，所以按衣色把同一部位合成一个实例化网格，约 200 次绘制。

## 验收条件

- [x] 地图上能看到游客在城里走，和居民用同一套方块人建模（浏览器实测，两次截图位置不同）。
- [x] 位置按剩余的直线段推算，过桥转弯和走传送门的断点正确（`visitorWalk.test.ts`、服务端 `test_visitors.py` 的 `remaining_legs` 测试）。
- [x] 握手后收到 `welcome`、`state`、`visitors`；没有访客的世界不发 `visitors`（集成测试与协议测试）。
- [x] 发件箱只留最新一份访客，且排在 `state` 之后（`test_app.py`）。
- [x] 客户端拒绝格式不对的 `visitors` 消息（`messages.test.ts`）。

## 验证证据

- 服务端 `make verify`：通过（ruff、ruff format、mypy strict、1235 个 pytest）。
- 客户端 `npm run verify`：通过（类型检查、ESLint、179 个测试、构建）。
- 浏览器：本机启动服务端（`uv run aiverse-server`）和 `npm run dev`，用无头 Chrome（swiftshader）打开页面截图两次，游客在大厅里的位置不同，衣色各异，有摆臂的姿态。另用一个 WebSocket 脚本连上服务端，握手后依次收到 `welcome`、`state`、`visitors`，之后约每 2 秒一份，28～33 个访客时每份约 4.6～5.6 KB。
- 独立审查（子 Agent，只读，一轮）：没有确认的问题。审查方用数值脚本核对了实例矩阵与 `createCharacter` 的层级变换等价（六个部位最大差 4e-16），并核对了重构前后的部位表、材质面顺序和姿态符号。其中一条疑点已处理：`remaining_legs` 与 `visitor_position` 在恰好走完一段的瞬间边界不同，`visitors_message` 的 `position` 现在直接取第一段的起点。
- 未执行：真实 GPU 上的帧率测量（无头 Chrome 用软件渲染）；访客满员（约 150 个在城里）时的消息大小。

## 交接

- 默认世界里没有场馆，访客只在各自的岛上闲逛，所以截图里都挤在大厅一带；建了场馆和桥后的走法没有在页面上看过。
- 访客进出城在入口处直接出现和消失，没有淡入淡出。
- 审查留下的低影响疑点，没有处理：发件箱里 `visitors` 排在 `state` 之后，`state` 持续被填满时会推迟（下一份会覆盖，影响只是访客站住）；`run_visitors` 没有异常保护（`run_clock` 也一样）；游戏结束后新连接仍会收到一份访客，会从冻结的位置再走完剩下的腿；访客的地面高度不像居民那样平滑，大厅出生台边缘可能跳一下；快照替换时以收到时刻为起点，网络抖动会让位置有小跳变。
- 没有自动测试的部分：`characterModel` 重构后的外观不变、`characterCrowd` 的实例矩阵、`VisitorLayer`、`Game.run_visitors`，靠人工和截图。
- 服务端和客户端各自提交；协议版本两边同时升到 27，旧服务端或旧页面会因版本不符而断开。
- 已更新 `docs/status.md`、`docs/code-map.md`。
