# 0028：测试约定

状态：已完成。

## 目标与依据

用户要求为测试的两种“三层结构”都建立规范：测试分层（单元、集成、端到端），以及单个测试内部的准备、执行、断言。此前只有测试文件的命名与放置规则（[变更 0023](0023-naming-conventions.md)），写法靠模仿已有测试。

## 范围

- 新增 [测试约定](../docs/testing.md)：每层测什么、怎么测、如何选层，协议改动与缺陷修复的测法；单个测试的三段结构、准备数据、替身边界与断言方式。
- 在 `AGENTS.md`、`docs/development.md`、`docs/code-map.md`、`docs/status.md`、`implement-change` 与 `review-change` Skill、`aiverse-server/AGENTS.md` 中引用它，不复制内容。
- 不改现有测试，不加自动检查，不引入端到端测试工具。

设计文档：无。

## 关键选择

- 规则从现有测试归纳：模块级不可变场景加工厂函数、少用 fixture、只替换外部 HTTP、时钟与浏览器 WebSocket、行为句式的测试名、参数化边界。
- 现有测试大体符合分层，但单个测试的结构并不统一：服务端 314 个测试中约 21% 在一个测试里交替执行和断言，只有约 7% 用空行分段。约定只约束新写或修改的测试，与命名约定的做法一致。
- 行为本身是一段过程时，整段过程算执行，中间只允许类型收窄和前提断言。这样既不必把一个过程拆成多个测试，又能避免“执行→断言”反复串联。
- 端到端维持人工浏览器实测；引入自动化工具属于新增依赖，留待决策记录。

## 验收条件

- [x] 约定写明三层各测什么、如何选层，以及单个测试的三段结构；每条规则都有仓库中真实存在的示例。
- [x] 开发与审查入口都能找到这份约定。
- [x] 仓库检查通过。

## 验证证据

- 示例与替身逐项核对存在：`test_market.py` 中的 `WORLD`、`resident()`、`test_selling_pays_the_price_summed_over_the_sale`，`test_agents.py`/`test_app.py` 中的 `FakeClock` 与 `httpx.MockTransport`，`test_app.py` 中的 `monkeypatch`，`websocket.test.ts` 中的 `FakeSocket`，以及两端都断言的卖 30 token 得 524 金币。
- 现有测试中有两处访问私有成员（`tests/residents/test_walking.py` 的 `game._until_next()`、`tests/agents/test_agents.py` 的 `brain._client`），按约定不追溯修改。
- `python3 scripts/check_repo.py` PASS，17 个准备文件、105 个文本文件，本地链接与文本格式无误。
- 纯文档改动，按规则自查；未启动独立审查。

## 交接

后续可以按需加入自动化端到端测试（需先写决策记录），以及跨语言的协议契约测试。已在 `docs/status.md` 记录。
