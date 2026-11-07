# 测试约定

规则从现有测试整理而来，规定两件事：一项行为该在哪一层测（测试分层），以及一个测试内部怎么写（准备、执行、断言）。测试文件叫什么、放在哪里见 [文件命名与目录约定](conventions.md)；要跑哪些检查见 [开发流程](development.md#验证如何选择)。

新写或修改的测试遵循本文；不为符合本文批量改写现有测试。

## 测试分层

| 层 | 测什么 | 怎么测 | 示例 |
| --- | --- | --- | --- |
| 单元 | 一个模块的计算与转换：价格推算、坐标投影、格式化、协议消息校验，含边界与非法输入 | 直接调用模块导出的函数，不经网络、不依赖真实时间与浏览器存储 | `ui/priceChart.test.ts`、`render/layout.test.ts`、`packages/protocol/src/messages.test.ts` |
| 集成 | 几层经真实接口协作：服务端消息经连接进入 `GameStore` 后的状态、连接的排队与断线处理 | 用真实的 `GameStore` 与连接实现，只替换下文列出的边界 | `state/store.test.ts`、`net/websocket.test.ts` |
| 端到端 | 用户在浏览器里的完整流程，与真实服务端一起运行 | 目前人工：启动服务端，在浏览器实际操作一次，结果写进变更说明的验证证据 | 见 [开发流程](development.md#验证如何选择) |

- **放在能证明行为的最低一层**：计算与校验在单元层测全，含边界和非法输入；集成层只证明各部分接得上，不重复单元层已经测过的数值组合。
- **数量随层递减**：单元测试最多，集成测试覆盖每条入口和跨层流程，端到端只走关键用户流程。不设覆盖率数字。
- **协议改动**：在 `packages/protocol` 测新消息的校验，在 `GameStore` 测它对状态的影响。客户端按服务端规则推算的数值，用服务端测试里的同一组数字断言并注明来源。
- **缺陷修复**：在能复现缺陷的最低一层加回归测试。
- **自动化端到端**：目前没有。引入 Playwright 等工具属于新增依赖，先写决策记录。

## 一个测试的结构

每个测试按 **准备（Arrange）→ 执行（Act）→ 断言（Assert）** 三段写，也就是 Given / When / Then。

```ts
it('fails and closes the connection when the server speaks another version', () => {
  const { connection, deliver } = fakeConnection();
  let closed = false;
  connection.close = () => (closed = true);
  const store = new GameStore(connection);

  deliver({ type: 'welcome', protocolVersion: 2, llmOverrides: [] });

  expect(store.getState().connection).toBe('failed');
  expect(closed).toBe(true);
});
```

- **一个测试一个行为**：`it('<行为>')` 里写一句描述行为的英文句子，读名字就知道测的是什么、预期什么；`describe` 写被测的模块、类或功能。同一行为的几个方面可以一起断言；名字要用 `and` 连接两个互不相干的结论时，拆成两个测试。
- **三段按顺序，不交替**：不写“执行→断言→再执行→再断言”。行为本身是一段过程时（如收到欢迎、再收到状态），整段过程算作执行。中间只允许确认前提成立的断言；其余断言都放到最后。
- **用空行分段**：测试超过几行时，三段之间各空一行。执行与断言能写进一行时可以合并，例如 `expect(marketQuote(calm, 0, 30)).toBe(524)`。
- **准备**：几个测试共用的场景，放在模块顶部的常量和工厂函数里（如 `calm`、`fakeConnection()`），各测试用对象展开派生出自己的场景（`{ ...calm, pressure: 100 }`），不修改共用对象。只有一个测试用到的数据写在测试里。
- **执行**：调用公开入口，也就是模块导出的函数、`GameStore` 的方法或经假连接送达的服务端消息，不调未导出的函数。
- **断言**：断言可观察的结果，也就是返回值、`getState()` 的状态、发出的消息，不断言内部的中间状态。期望值是推导出来的时，写出推导过程或引用来源。浮点结果用 `toBeCloseTo`。
- **参数化边界**：同一行为在多组输入下成立时用 `it.each`，不复制多个测试。
- **只替换边界**：可以替换的只有浏览器 WebSocket（`FakeSocket`）、到服务端的连接（实现 `GameConnection` 的假连接）、浏览器存储（传入内存实现的 `Storage`），以及时间（作为参数传入）；测试预期会出错时，可以静默 `console.error`，免得输出刷屏。不 mock 本项目自己的模块；要替换时说明这个模块难以直接使用，先考虑改进它的接口。
- **不写只复述实现的测试**：测试说明行为应当如何，不逐行镜像实现代码。
