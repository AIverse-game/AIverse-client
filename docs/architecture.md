# 应用架构

技术选型与依据见 [决策 0001](decisions/0001-web-stack-and-layering.md) 与 [决策 0002](decisions/0002-python-server-and-coordinate-map.md)。本文说明代码如何分层、数据如何流动。

## 核心原则：权威服务端，客户端只渲染

游戏状态只由一处计算，即 Python 服务端（与本仓库同级的 `aiverse-server` 目录）。客户端发送意图，接收服务端推送的状态快照，然后把快照画出来。客户端不计算可信的游戏结果，因此改动客户端代码也无法作弊。

```text
浏览器（本仓库，只依赖 protocol）
  ui/ React 面板、render/ Phaser 地图
      ↑ 读取快照
  state/ GameStore
      ↑                     ↓ hello
  net/ GameConnection（WebSocket，校验每条消息）
      ↑ JSON 文本帧          ↓ JSON 文本帧
Python 服务端（aiverse-server）
  app.py      WebSocket /ws：收消息、回复
  protocol.py 消息模型、输入校验、视图转换
  world.py    世界模型与坐标校验
  layout.py   固定的初始布局
```

开发与预览时，Vite 把页面的 `/ws` 代理到 `127.0.0.1:8000`，客户端不需要写死地址；其他部署方式可在构建时设置 `VITE_SERVER_URL`。

## 坐标系

- 地图是边长为 `size` 个地图单位的正方形（当前 100）。
- 原点 (0, 0) 在左上角（西北角），x 向右（东）增大，y 向下（南）增大，与屏幕方向一致。
- 两轴取值为闭区间 [0, size] 内的实数，不是网格。居民有坐标；以后的地点和物品也使用同一坐标系。
- 服务端拒绝构造越界或 id 重复的世界；客户端收到不满足这些条件的消息会报错，不会渲染。
- 渲染时，屏幕位置 = 边距 + 坐标 × 缩放，坐标轴不翻转；地图大小变化时刻度和缩放自动调整。

## 分层与职责

| 层 | 位置 | 职责 |
| --- | --- | --- |
| 协议 | `packages/protocol` | 客户端与服务端之间的消息与视图类型；对服务端消息做运行时校验。Python 对应定义在 `aiverse_server/protocol.py` |
| 传输 | `apps/web/src/net` | `GameConnection` 接口与 WebSocket 实现：发送前排队、校验收到的消息、报告连接失败 |
| 客户端状态 | `apps/web/src/state` | 保存最近一次快照与连接状态，供渲染和界面读取 |
| 渲染 | `apps/web/src/render` | 坐标换算与刻度（`layout.ts`）、Phaser 地图场景 |
| 界面 | `apps/web/src/ui` | React：顶栏、地图容器、地图与居民信息 |

依赖只能自上而下：协议不依赖任何内部包，也不直接访问运行环境；客户端只依赖协议。`npm run lint` 会拒绝越层导入。

## 一次连接如何进行

1. 页面创建 WebSocket 连接，`GameStore` 立即发送 `hello`（连接打开前排队）。
2. 服务端校验 `hello` 和协议版本，回复 `welcome`，再回复 `state`，其中包含地图和居民。
3. 连接层用 zod 校验每条消息；不合协议时断开并在界面报错。
4. `GameStore` 更新快照，Phaser 场景和 React 面板随之重绘。

非法消息得到 `error` 回复，连接保持可用。以后加入回合推进时，服务端在每回合结算后主动推送新的 `state`，客户端这一侧的流程不需要改变。

## 协议改动

协议在两种语言中各有一份。改动时同时修改 `packages/protocol` 与服务端的 `protocol.py`，两边的测试一起更新；不兼容的改动要同时提升两边的 `PROTOCOL_VERSION`。
