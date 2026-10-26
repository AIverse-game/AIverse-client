# 0001：网页端技术栈与分层

状态：采用，部分已被 [0002](0002-python-server-and-coordinate-map.md) 替代（共享 TypeScript 规则引擎、Web Worker 本地服务端、GitHub Pages 部署）。
日期：2026-10-25。

## 背景

用户要求：首版运行在网页并部署到 GitHub Pages；使用框架，便于扩展；适当分层；最终前后端分离，前端只渲染服务端的权威状态，现阶段先不写后端。

总体设计已约定：服务端决定动作合法性与结算，客户端不计算可信的经济结果；回合同步推进，2D 画面只做表现；模型调用经服务端代理。GitHub Pages 只能托管静态文件，没有服务端进程。

## 候选方案

- **语言**：TypeScript 能让规则引擎在浏览器和未来的 Node 服务端共用同一份代码，协议类型前后端共享。其他服务端语言需要维护两套规则或在静态托管阶段无法运行。
- **2D 渲染**：Phaser 提供场景、补间、输入、资源加载和相机，适合游戏开发新手；PixiJS 只负责渲染，其余需自建；纯 Canvas 成本最高。
- **界面**：游戏有大量面板（配置、市场、排行榜、日志、复盘），React 适合 DOM 界面；全部放进 Phaser 画布中实现表单和列表成本高。
- **构建**：Vite 原生支持 TypeScript、Web Worker 和静态构建。
- **包管理**：npm workspaces 随 Node 提供，无需额外安装；pnpm 需另行安装。
- **运行时校验**：模型输出和网络消息都是不可信输入，zod 同时给出类型和校验；手写校验随协议增长难以维护。

## 决定与依据

采用 TypeScript、npm workspaces、Vite、React（界面）、Phaser（2D 地图）、Vitest、ESLint 与 zod。版本以 `package-lock.json` 为准；TypeScript 固定在 6.0，因为当前 typescript-eslint 只支持到 6.0。

代码按职责分层，依赖只能自上而下：

| 层 | 位置 | 可依赖 | 禁止 |
| --- | --- | --- | --- |
| 协议 | `packages/protocol` | zod | 任何内部包 |
| 规则引擎 | `packages/engine` | 协议 | 时间、随机源、IO、DOM |
| 权威宿主 | `packages/host` | 协议、引擎 | DOM、直接使用全局计时器 |
| 规则 Agent | `packages/agents` | 协议 | 引擎、宿主 |
| 网页客户端 | `apps/web/src` | 协议 | 引擎、宿主、Agent |
| 本地服务端 | `apps/web/src/local-server` | 全部共享包 | 客户端界面代码 |

现阶段在浏览器中把宿主放进 Web Worker 充当“本地服务端”，与界面通过 JSON 消息通信，客户端只接收快照并渲染。以后新增 Node 服务端时，复用协议、引擎、宿主和 Agent，在客户端增加 WebSocket 连接实现，界面与渲染层无需改动。

## 影响

- 共享包直接以 TypeScript 源码导出，无构建步骤；Vite 与 Vitest 直接处理。将来的 Node 服务端需要打包或使用 TypeScript 运行器。
- 本地模式中规则代码会被下载到浏览器，可被玩家查看或篡改；这只适合单机演示，不能用于有排名意义的对局。接入真实模型后，API Key 也不应在纯前端模式中使用，见总体设计第 8 节。
- 分层规则由 ESLint 检查；引擎和宿主禁止访问全局时间与随机源，以保证相同种子和动作的结算可复现。
- 部署使用相对资源路径，不依赖仓库名。

重新评估条件：Phaser 或 React 无法满足性能或交互需求；需要非 TypeScript 服务端；typescript-eslint 支持更新的 TypeScript 后可升级。

## 关联

- [总体游戏设计](../design/game-overview.md) 第 7、10 节。
- [0004 网页端底层框架](../../changes/0004-web-foundation.md)。
