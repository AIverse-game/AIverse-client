# 应用架构

技术选型与依据见 [决策 0001](decisions/0001-web-stack-and-layering.md)。本文说明代码如何分层、数据如何流动，以及以后如何接入真正的服务端。

## 核心原则：权威服务端，客户端只渲染

游戏结果只由一处计算，即“权威方”。客户端发送意图（如“开始对局”），接收权威方推送的状态快照，然后把快照画出来。客户端不计算金币、库存或成交结果，因此改动客户端代码也无法作弊。

现阶段没有独立服务端。权威方以“本地服务端”的形式运行在浏览器的 Web Worker 里，通过 JSON 字符串与页面通信，行为上等同于一条网络连接。

```text
浏览器主线程（客户端，只依赖 protocol）
  ui/ React 面板、render/ Phaser 地图
      ↑ 读取快照            ↓ 发送意图
  state/ GameStore
      ↑                     ↓
  net/ GameConnection
      ↑ JSON 快照           ↓ JSON 意图
Web Worker（本地服务端，依赖全部共享包）
  local-server/worker.ts
      → host/GameHost：回合时钟、截止时间、按观察者裁剪
          → agents/：规则 Agent 做决策
          → engine/：规则结算
```

## 分层与职责

| 层 | 位置 | 职责 |
| --- | --- | --- |
| 协议 | `packages/protocol` | 双方共享的动作、决策、视图与消息类型；对不可信输入做运行时校验 |
| 规则引擎 | `packages/engine` | 纯函数：给定状态和动作，算出新状态和事件；不接触时间、随机源或 IO |
| 权威宿主 | `packages/host` | 一局对局的唯一权威：回合节奏、收集决策、超时与非法输出降级、按观察者裁剪并广播 |
| 规则 Agent | `packages/agents` | 调试用的固定策略决策者；以后的大模型适配层实现同一接口 |
| 传输 | `apps/web/src/net` | `GameConnection` 接口与本地 Worker 实现 |
| 客户端状态 | `apps/web/src/state` | 保存最近一次快照与行动记录，供渲染和界面读取 |
| 渲染 | `apps/web/src/render` | Phaser 场景，把快照画成地图并播放移动动画 |
| 界面 | `apps/web/src/ui` | React 面板：顶栏、我的居民、排行榜、行动记录 |
| 本地服务端 | `apps/web/src/local-server` | 在 Worker 中组装宿主、规则 Agent 和演示座位 |

依赖只能自上而下：协议不依赖任何内部包；引擎只依赖协议；Agent 只通过协议观察世界；客户端主线程只依赖协议。`npm run lint` 会拒绝越层导入，以及共享包中对全局计时器、`Math.random`、`Date` 的直接使用。

## 一个回合怎样运行

1. 宿主为每个座位生成该玩家可见的观察（`Observation`），并发调用其决策者。
2. 截止时间前未返回、抛错或输出不合协议的，本回合按等待处理，并在该玩家的 `AgentStatus` 中记录原因；迟到的结果被丢弃。
3. 宿主把合法动作交给引擎 `resolveRound`，引擎按种子决定的顺序结算，产生新状态与事件。
4. 宿主向每个连接推送按观察者裁剪过的 `state` 消息：自己的体力、背包和失败原因只发给自己。
5. 客户端 `GameStore` 更新快照，Phaser 场景和 React 面板随之重绘。

相同的初始种子与动作序列总能得到相同结算，这是以后实现回放和排查争议的基础。

## 以后接入服务端

1. 新增 `apps/server`（Node），用 WebSocket 接收连接；每条连接调用 `host.connect(link, { viewerId })`，`viewerId` 由登录或房间系统决定，不能由客户端自报。
2. 在 `apps/web/src/net` 中新增 WebSocket 版 `GameConnection`，在 `main.tsx` 里替换本地连接。
3. 大模型适配层实现 `Decider`，运行在服务端，持有玩家 API Key；不要在纯前端模式里使用真实 Key。

协议、引擎、宿主、渲染和界面在这一步都无需改写。共享包目前以 TypeScript 源码导出，Node 服务端需要打包或使用 TypeScript 运行器。
