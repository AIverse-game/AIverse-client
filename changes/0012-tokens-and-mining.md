# 0012：token 体力、走路消耗与矿池

状态：已完成。

## 目标与依据

用户要求（2026-10-27）：实现 Agent 角色的体力值 token；走路消耗 token；地面上随机刷新 token 矿池，但必须在开局时就固定；角色可以耗费时间在矿池补充 token；token 是可以交易的物品，允许角色之间买卖；token 耗尽的角色出局。

未向用户确认、由本次自行决定的部分（数值都是可调的常量，见“关键选择”）：

- 开局每人 200 token；走路每地图单位 1 token，按直线距离向上取整；token 不够的移动被拒绝（`not_enough_tokens`），不会走一半。
- 矿池开局时随机放 6 个，彼此至少相距 15、离地图边缘至少 10，半径 4，储量 150–400 随机且有限；采完的矿池留在地图上，不能再采。
- 采矿一次 10 秒（游戏时间），得 30 token（矿池剩余不足时得剩余量）；采矿期间居民忙碌，除退出游戏外的一切原语以 `busy` 拒绝。

可观察的变化：页面上居民列表显示每人的 token；地图上画出矿池（青色圆圈即可采范围，中间一块晶石，标注 id 与剩余储量），侧栏列出矿池；选中居民后，站在矿池圆圈内可点“在矿池 pN 采矿”，10 秒后 token 增加；走路后 token 减少；token 用完的居民变为“已出局”。

## 范围

服务端（`aiverse-server`）：

- `world.py`：新增 `Pool`（id、位置、半径、储量）与 `MiningJob`（矿池、结束时刻、数量）；`Resident.mining`；`World.pools` 与 `World.time`（开局以来的游戏秒数）；校验矿池 id 唯一、在地图内，采矿任务指向已知矿池、出局或结束后不再采矿。
- 新增 `tokens.py`：`TOKEN` 物品种类、`token_total`（携带加出售报价中预留的）、`walk_cost`、`pay_for_walk`，错误代码 `not_enough_tokens`。
- 新增 `mining.py`：`MINE_SECONDS`、`MINE_YIELD`、`start_mining`、`finish_mining`、`cancel_mining`、`next_finish`、`check_not_busy`，错误代码 `unknown_pool`、`not_at_pool`、`pool_empty`、`busy`。
- `trade.py`：`reserved_items`（出售报价中预留的某种物品）。
- `lifecycle.py`：`knock_out_exhausted`，比较执行前后的世界，把 token 由正变零（含进行中的采矿）的居民按 `leave_game` 出局；`leave_game` 先停止采矿并把 token 退回矿池；`end_game` 停止所有采矿，不发放。
- `actions.py`：新原语 `Mine`；`MoveTo` 先扣走路的 token；`perform` 拒绝忙碌居民除 `LeaveGame` 外的原语，执行后调用 `knock_out_exhausted`。
- `layout.py`：`STARTING_TOKENS`；`scatter_pools(seed)` 按种子放置矿池；`create_default_world(seed)`。
- `app.py`：`Game.expire` 改为 `Game.tick`：推进 `World.time`（截止时刻封顶）、发放到期的采矿、到点结束游戏，有变化时广播；计时任务等到“对局结束”与“最早的采矿结束”中较早的一个，世界每次广播后重新计算。
- `__main__.py`：`--seed`。
- `protocol.py`：协议版本 5。居民视图增加 `tokens` 与可选的 `mining`（`poolId`、`amount`、`remainingSeconds`）；世界视图增加 `pools`；客户端可发送 `mine`。

客户端：

- `packages/protocol`：对应的视图校验（矿池在地图内、id 唯一，采矿指向已知矿池）、`MineAction`、协议版本 5。
- `GameStore`：`isFree`（能行动且不在采矿）与 `poolInReach`（居民所在的矿池，只用于界面提示，服务端仍会校验）。
- 界面：`MapScene` 画矿池、采矿中的居民名字后加“采矿中”；点击地面移动改用 `isFree`。`MapPanel` 显示每名居民的 token、采矿标签和矿池列表。`ActionPanel` 显示持有 token、采矿按钮与采矿状态，采矿时移动按钮禁用、退出按钮可用。

留给后续：交易与答复事件的原语进入协议和页面（token 的买卖目前只能经服务端 `actions.perform` 进行，AI 接入后即可使用，页面上还不能操作）；向客户端公开规则数值（每单位走路消耗、采矿时长与产量），以便显示移动预估消耗；采矿进度的本地倒计时；中途取消采矿；矿池储量是否随时间恢复。

## 关键选择

- **token 是物品种类 `"token"`，不是像金币那样的独立余额**：用户要求 token“作为可以交易的物品”。放进物品栏后，现有的 `OfferToBuy`、`OfferToSell` 无需任何改动即可买卖 token，预留、退回、出局清零的规则也全部沿用。视图中单独给出 `tokens`，因为物品栏尚未进入协议。
- **“耗尽”按拥有量算**：拥有量 = 携带 + 出售报价中预留。把全部 token 挂出去卖不算耗尽（撤回后就回来了），但预留的 token 不能用来走路；买方同意后才归零出局。判断是否耗尽时，进行中的采矿已从矿池挖出的 token 也算拥有（独立审查发现：否则正在采矿的居民卖光携带的 token 会被判出局，丢掉即将到手的产出）；视图中的 `tokens` 不含这部分，采矿完成后才计入。
- **出局只看“由正变零”**：`knock_out_exhausted` 比较原语执行前后的世界，只处理这一次原语让其 token 归零的居民，覆盖走路、卖出（自己发起或同意别人的购买报价）等所有途径；从未有过 token 的居民（测试中构造的世界）不受影响。出局沿用 `leave_game`：撤销报价并退回预留，清空物品，金币保留并参与排名。
- **走不起就拒绝**：不实现“走到 token 用完为止”，避免 AI 一次输错坐标就出局；规则简单，结果可预测。
- **矿池开局固定**：位置、半径在创建世界时由种子决定，此后不会移动、增加或删除，只有储量下降。默认每局随机，`--seed` 可复现同一布局。
- **采矿是定时任务，token 开始时就从矿池扣出**：两个人同时采同一个矿池不会采到同一批 token；中途出局时退回矿池，游戏结束时任务作废。完成依靠服务端时钟：`World.time` 由 `Game.tick` 推进，原语和视图都读取它，世界本身仍是不可变、可测试的纯数据。
- **采矿期间忙碌**：“耗费时间”体现为这段时间不能做别的事；只允许退出游戏，保证居民总能离开。

## 验收条件

- [x] 默认世界每人 200 token、6 个矿池；同一种子得到相同矿池，矿池在地图内、互不重叠、储量在范围内。
- [x] 走路按距离向上取整扣 token；站着不动免费；token 不够的移动以 `not_enough_tokens` 拒绝、世界不变。
- [x] 走路或卖出花掉最后一个 token 后居民出局（报价撤销、物品清空、金币保留）；挂单预留全部 token 不出局，撤回后 token 回来。
- [x] token 能以现有买卖原语交易，买方得到 token、卖方得到金币。
- [x] 站在矿池半径内（含边缘）才能采矿；未知矿池、不在范围、矿池采空、正在采矿时分别以 `unknown_pool`、`not_at_pool`、`pool_empty`、`busy` 拒绝；采矿期间移动、报价、撤回都以 `busy` 拒绝，退出游戏可以，且 token 退回矿池。
- [x] 采矿到时自动发放并推送状态，无需任何操作；截止后到达的帧先发放再处理；游戏结束时进行中的采矿作废。
- [x] 协议 5：状态中有 `pools`、`tokens`、`mining`；`mine` 可经 WebSocket 发送，字段缺失或类型错误回复 `bad_message`；客户端拒绝不符合的状态。
- [x] 页面：显示 token 与矿池、采矿按钮与状态、采矿时禁用移动、出局标记，两页面同步。
- [x] 服务端 `make verify`、客户端 `npm run verify` 与 `python3 scripts/check_repo.py` 通过。

## 验证证据

环境：macOS，Python 3.12，Node 22.19，Chrome 无头模式（swiftshader），经 DevTools 协议驱动。日期 2026-10-27。

- 服务端 `make verify`：ruff、`ruff format --check`、mypy strict 通过；pytest 255 个测试通过（新增 `tests/test_tokens.py`、`tests/test_mining.py`，`tests/test_app.py` 新增 WebSocket 下的走路、采矿、计时发放、截止前后的发放与作废、计时器为新任务提前醒来及拒绝测试；原有测试的世界给居民补上 token）。
- 变异检查（审查修复后）：在源码副本上分别去掉截止封顶、把 `end_game` 挪到发放之前，`test_a_frame_after_the_deadline_pays_jobs_due_before_it_and_voids_the_rest` 失败；去掉广播中唤醒计时器的 `_changed.set()`，`test_the_timer_wakes_for_a_job_started_while_it_waits` 约 3 秒后断言失败（该测试用 3 秒的短对局，并断言发放先于结束到达）。
- 客户端 `npm run verify`：tsc、ESLint、Vitest 5 个文件 68 个测试、`vite build` 通过；`python3 scripts/check_repo.py` 通过。
- 端到端：`uv run aiverse-server --port 8765 --seed 7` 加 Vite 开发服务器（`AIVERSE_SERVER_PORT=8765`），同时打开页面 A、B，1400 × 1000：
  - 开局两页显示 6 个矿池（p1 (35.9, 22.1) 储量 316 等）和每人 200 token；阿青不在矿池内时采矿按钮禁用。
  - A 让阿青走到 p1 中心，token 200 → 183（距离 16.16，取整 17），B 同步。按钮变为“在矿池 p1 采矿（剩余 316）”；点击后 A 显示“正在矿池 p1 采矿，完成后获得 30 token”，移动按钮禁用、退出按钮可用；B 的列表显示“采矿中”，p1 剩余 286。
  - 10.5 秒后无需任何操作，两页的阿青都变为 213 token，采矿状态消失。
  - B 让白露走到 (0, 0)，200 → 82；再走到 (100, 100)，显示“未执行：not_enough_tokens: … the walk costs 142”。
  - B 让小麦走到 (0, 100)，200 → 90；再走到 (0, 10)，恰好花完 90，小麦在两页都标“已出局”、0 token，金币 10,000 保留并参与排名，操作面板显示“小麦 已出局，不能再操作”。
  - 390 px 宽度截图：矿池列表、token 列、采矿按钮排版正常。
- 实测中的现象：两个页面同在一个无头 Chrome 中时，后台页的 requestAnimationFrame 被节流，移动动画停在途中；单独前台打开同一状态时居民正确站在矿池上。属于无头环境的现象，与本次无关。
- 未执行：token 的买卖在页面上无法操作（交易原语不在协议中），只有服务端测试覆盖；触屏操作。

## 交接

已更新 `docs/status.md`、`docs/architecture.md`、`docs/code-map.md`、`docs/design/game-overview.md`、`changes/README.md` 与服务端 `README.md`。

独立审查首轮：无 P0/P1，1 个 P2、5 个 P3，均已处理。

- P2：计时相关的三项行为（截止封顶、计时器为新任务提前醒来、截止后的帧先发放再结束）没有测试，变异后 251 个测试照样通过。已补两个 WebSocket 测试和 `end_game` 退回储量的断言，变异检查见上。
- P3：正在采矿的居民卖光携带的 token 会被判出局、产出作废。改为判断耗尽时把进行中的采矿计入拥有量，补了测试。
- P3：`Game.tick` 读两次时钟，截止前的微秒窗口内可能先作废本该发放的任务。改为只读一次。
- P3：`scatter_pools` 的 `for … else` 在第 10000 次恰好放满时仍会抛错。改为循环后检查数量。
- P3：服务端 README 第 5 行没有提到 `mine`。已改。
- P3：忙碌测试未覆盖 `RespondToEvent`。已补。

保留的疑点（审查列为待确认，交给用户决定）：

- token 的买卖只有服务端原语，协议和页面都还不能发起；用户的“允许角色之间买卖”在 AI 或页面接入交易原语之前只在服务端成立。
- “走不起就拒绝”下，token 很少又离矿池太远的居民会卡住但不出局；恰好花光最后一个 token 走到矿池上的居民会直接出局，来不及采矿。
- 页面显示的 token 含出售报价中预留的部分，但走路只能用携带的部分；交易进入页面后可能需要分开显示。

复核：6 项修复均成立，未引入新缺陷；复核另指出计时器唤醒测试在默认 20 分钟对局下回归时只会卡住、到点后还会误通过（P3），已改为 3 秒对局并断言发放时游戏尚未结束，变异后约 3 秒即失败。
