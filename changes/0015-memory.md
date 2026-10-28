# 0015：长期记忆与短期记忆

状态：已完成。

## 目标与依据

用户要求（2026-10-28）：实现记忆机制，分为长期记忆和短期记忆。长期记忆在一局游戏内不会消失，短期记忆在一定时间后清除；记什么、记成长期还是短期，由 Agent 自行决定。

现状：尚无 AI 循环和回合时钟。居民已有一份自动的记忆（变更 0013：见过的矿池、看过的活动序号），但那是感知自动写入的，Agent 不能决定记什么。

本次沿用感知的做法，未逐项向用户确认，都是可调的常量或可逆的实现：

- **做成服务端接口**，由日后的 AI 循环调用，不改协议和页面。
- **记忆单位是一条文字笔记**（`Note`）。Agent 每次写入时自己选择 `long_term` 或 `short_term`，也可以主动忘掉任意一条。
- **长期笔记**整局保留，直到 Agent 忘掉。新开一局即为新的世界，笔记自然清空。
- **短期笔记**在写入 120 秒游戏时间后清除（`SHORT_TERM_SECONDS`），约为设计稿中 6 个 20 秒的回合。
- **上限**：每条最多 300 字符（去掉首尾空白后计算）；长期最多 30 条，短期最多 20 条（`NOTE_LIMITS`）。满了以后再写会被拒绝，Agent 要先忘掉一条，“留什么”仍由 Agent 决定，系统不替它挤掉旧的。依据：每轮都要把全部笔记交给模型，最多约 1.5 万字符，控制在可接受的上下文内。
- **不是原语**：不消耗 token，行走或采矿中也能写，不广播。出局者、不存在的居民、结束后的对局以 `GameError` 拒绝，与感知相同。
- **过期的清除是惰性的**：写入、忘掉和每轮 `begin_turn` 时先丢掉已过期的短期笔记，Agent 不会看到过期的笔记。不放进时钟（`clock.settle_due`），因为那会让计时器为不可见的变化醒来并广播。
- 笔记 id 在一名居民的整局内唯一、递增，长短期共用，忘掉后不复用。

## 范围

服务端（`aiverse-server`）：

- `world.py`：`Note`、`NoteTerm`、`NOTE_LENGTH_LIMIT`、`NOTE_LIMITS`；`Memory.long_term`、`Memory.short_term`、`Memory.next_note_id`，校验 id 唯一且小于 `next_note_id`、文字非空且不超长、条数不超上限、长期没有过期时刻而短期有且晚于写入时刻，按 id 排序。
- 新增 `memory.py`：`SHORT_TERM_SECONDS`、`NoteError`（`empty_note`、`note_too_long`、`memory_full`、`unknown_note`）、`remember`、`forget`、`forget_expired`。
- `perception.py`：`begin_turn` 重建记忆时保留笔记并清除过期的，`Perception` 新增 `long_term`、`short_term`。
- `app.py`：`Game.remember`、`Game.forget`，先 `tick` 再写入，不广播。
- 测试 `tests/test_memory.py`；README 的功能说明和代码结构。

不做：协议与页面展示、AI 循环与给模型的工具定义、笔记的分类或检索、按重要性自动遗忘、Agent 自定短期时长、长短期之间的直接转换（可先忘再写）。

## 验收条件

- [x] Agent 写入时选择长期或短期；每轮 `begin_turn` 返回两类笔记，按写入先后排列。
- [x] 短期笔记在写入后 120 秒（含）消失，之前仍在；长期笔记到很久以后仍在。
- [x] 可以忘掉任一类笔记；忘掉不存在、已过期或别人的笔记，以及 id 不是整数（含 `True`、`1.0`）时以 `unknown_note` 拒绝；id 不复用。
- [x] 空白、超长的笔记被拒绝，去掉首尾空白后正好 300 字符的可以写入。
- [x] 某类满了以后再写以 `memory_full` 拒绝，另一类不受影响；忘掉一条或短期过期后可以再写。
- [x] 行走、采矿中可以写；出局者、不存在的居民、结束后的对局不能写也不能忘。
- [x] 感知不会丢掉笔记，写笔记不会丢掉记住的矿池。
- [x] `Game.remember` 按当前游戏时间计时，不推送状态。
- [x] 世界拒绝不一致的记忆（重复或超前的 id、过期时刻与类别不符、空或超长文字、超过上限）。

## 验证证据

- `make verify`（`aiverse-server` 目录）：ruff check、ruff format --check、mypy strict 通过；pytest 335 项通过（原有 293 项加新增 42 项）。
- 独立审查（只读子 Agent，review-change）：未发现 P0–P2 缺陷。提出 3 条 P3，均已处理：
  - `forget` 收到 `True`、`1.0` 会删掉笔记 1，`remember` 收到非字符串文字或不可哈希的类别会抛出意料之外的异常。现在 id 不是整数时以 `unknown_note` 拒绝，文字不是字符串、类别无效时抛 `ValueError`，已补测。
  - `Perception.long_term`、`Memory.next_note_id` 缺字段说明，已补。
  - 短期超上限、写入或过期时刻非有限值的校验缺测试，已补。
- 协议与客户端未改动，未做浏览器实测。

## 交接

- AI 接入时：每轮开始调用 `Game.begin_turn`，把 `Perception.long_term`、`short_term` 连同感知一起交给模型，并把 `Game.remember(resident_id, text, term)`、`Game.forget(resident_id, note_id)` 作为模型可调用的工具；模型给出的 `term` 须为 `long_term` 或 `short_term`、`text` 须为字符串，否则是 `ValueError`，AI 层应先校验或把它转成给模型的错误，`NoteError` 的代码和消息可以原样回给模型。
- **记忆的归属由调用方保证**：`remember`、`forget`、`begin_turn` 只改或返回传入的那名居民的记忆，以 A 的身份忘不掉 B 的笔记（`unknown_note`）；但它们不知道是谁在调用，任何服务端代码传入 `"b"` 都能读、写、删 B 的记忆。目前记忆不在协议中，外部碰不到。AI 接入时，每个 Agent 必须在循环里与它的居民绑定，给模型的工具不带 `resident_id` 参数，由循环填入绑定的居民；不得采用模型输出中的居民 id。以后若把记忆开放到协议，需先有“玩家拥有哪名居民”的权限检查。
- 短期时长、条数与长度上限都未经试玩调参。
- 已更新 `docs/status.md` 与 `docs/code-map.md`。
