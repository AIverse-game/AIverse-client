# 0040：信息售卖

状态：已完成。

## 目标与依据

用户要求增加售卖信息的机制：信息作为可售卖的东西，卖方卖出后不会失去它。可观察的变化：AI 居民可以把自己知道的事报价卖给另一名居民；对方只看到摘要，同意并付款后得到内容，卖方保留原信息。

## 范围

- 服务端新增 `residents/information_offer.py`：事件 `InformationOffer`，错误 `InformationError`（`invalid_information`、`too_many_offers`）。
- `actions.py`：原语 `OfferInformation`；`RespondToEvent` 同意时可能因买方长期笔记已满返回 `memory_full`。
- AI：工具 `offer_information`，观察新增 `information_offers_to_me`、`my_information_offers`（不含内容），系统提示说明。
- 不做：协议与页面显示、买方求购、公开挂牌、报价过期。

设计文档：新建 [信息售卖](../docs/design/information-selling.md)。

## 关键选择

用户已决定三点（2026-11-01）：信息内容由 AI 自由撰写、不限定类型；成交前买方只看摘要；复用报价事件。其余为可逆的实现选择：

- 放在 `residents/`，因为交付写入记忆，`economy/` 只依赖 `core/`。
- 交付为买方的长期笔记，带卖方 id 和摘要，沿用笔记的 300 字符上限；发出时就校验整条笔记能否放下。
- 报价零成本，所以同一卖方对同一买方最多同时 3 条待答复（独立审查 P2，`too_many_offers`）。
- 买方笔记满时同意失败、报价待处理，与“买方金币不足”一致，由买方先 `forget` 一条。

## 验收条件

- [x] 发出报价不预留任何东西；同意后买方付款、卖方收款，买方得到含内容的长期笔记，卖方记忆不变且可再卖给他人。
- [x] 拒绝与撤回后双方状态不变。
- [x] 买方金币不足或长期笔记已满时同意失败且报价仍待处理，忘掉一条后可成交。
- [x] 摘要或内容为空或过长、价格小于 1、布尔值、浮点数、超过上限、笔记放不下均以 `invalid_information` 拒绝；给自己或不存在的居民报价被拒绝。
- [x] 买方的观察在成交前不含内容。
- [x] 同一卖方对同一买方第 4 条待答复报价被拒绝，答复一条后可再发。
- [x] 报价待答复时任一方出局或游戏结束，报价被清除、金币不变。

## 验证证据

环境：macOS，Python 3.12，日期 2026-11-01。

- 服务端 `make verify`：ruff、format、mypy strict 通过，912 个测试通过（新增 `tests/unit/residents/test_information_offer.py` 24 个，`test_tools.py` 6 个）。
- 独立审查首轮：无 P0/P1，1 个 P2（报价零成本可刷屏，已加每对 3 条上限）、4 个 P3（工具描述与 README 漏提新字段、状态日期、缺少出局或结束与工具参数的测试，均已修复；行动时间线向所选卖方显示内容，与私聊一致，保留为已知限制）。
- 未执行：协议和页面没有改动，未做浏览器实测；未让真实大模型使用该工具。

## 交接

已更新服务端 `README.md`、本仓库 `docs/status.md`、`docs/design/README.md`、`changes/README.md`。后续：协议与页面显示信息报价（需要决定内容是否对发件人可见）、买方求购、信誉机制。
