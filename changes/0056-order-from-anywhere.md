# 0056：任何地方都能下单

状态：已完成。

## 目标与依据

用户 2026-11-04 要求“不要下单/挂单必须在收购点”。当天的真实模型对局（服务端 `logs/`）里，交易所全局只有 5 次下单、1 笔成交。最缺能量的阿青、小麦被困在收购点以外，剩下的能量不够走回去，下不了单，只能向具体的人发点对点报价（阿青发了 21 次求购）。

可观察的变化：

- 交易所下单（原语 `PlaceOrder`、工具 `place_order`）不再要求站在收购点范围内，在地图上任何地方都可以，不再以 `not_at_market` 拒绝。
- 其余规则不变：下单仍要不在忙碌中（行走、汲取、挖砂、炼制时以 `busy` 拒绝），撤单忙碌时也可以；卖能量、买晶核仍要到收购点。
- 系统提示和工具说明改为任何地方都能下单。

## 范围

服务端（`aiverse-server`）：

- `economy/exchange.py`：去掉地点检查和 `not_at_market` 错误码。
- `game/actions.py`（`PlaceOrder` 说明）、`agents/system_prompt.py`、`agents/tools.py`（`place_order` 说明）。
- `server/protocol.py`：交易所视图的注释。
- 测试：`tests/unit/economy/test_exchange.py` 去掉离收购点太远被拒绝的用例，新增远处下单照常成交、走路途中下单以 `busy` 拒绝的用例。
- `README.md`：交易所一段。

客户端：`ui/ExchangePanel.tsx` 的说明文字与注释、`packages/protocol` 的注释（协议版本不变）；文档（本说明、[挂单交易所](../docs/design/order-book.md)、[设计文档索引](../docs/design/README.md)、`docs/status.md`）。

协议未改：页面还不能下单（0055 计划）。

设计文档：修改 [挂单交易所](../docs/design/order-book.md)“范围与地点”和“在哪下单”的决定。

## 关键选择

- **只去掉地点，保留忙碌限制**：用户只提了地点。走路途中下单要另行决定，撤单本来就不受限制。
- **页面仍只在有收购点时显示交易所**：真实对局的世界都有收购点，这里不改。

## 验收条件

- [x] 离收购点很远、空闲的居民能下单，并与簿上的挂单成交。
- [x] 其他拒绝原因（未知商品、数量、单价、有效期、金币或物品不足、`self_cross`、`busy`）不变。
- [x] 系统提示与工具说明不再说要站在收购点。

## 验证证据

- 服务端 `make verify`：ruff、mypy strict、pytest 1143 个全部通过。
- 客户端 `npm run verify`：类型检查、ESLint、212 个测试与生产构建通过；`python3 scripts/check_repo.py` 通过。

## 交接

- 未在浏览器实测：页面只改了一句说明文字。
- 下一次真实模型对局时观察交易所成交量是否上升，以及被困居民会不会改用挂单。
