# 仓库地图

包含总体游戏设计、通用开发基础，以及网页端底层框架。分层与数据流见 [应用架构](architecture.md)。

## 应用代码

| 文件/目录 | 用途 |
| --- | --- |
| `package.json` | npm workspaces 根配置与统一脚本（`dev`、`build`、`verify` 等） |
| `tsconfig.base.json` | 各包共享的 TypeScript 严格配置；共享包不含 DOM 类型 |
| `eslint.config.js` | 代码检查与分层规则 |
| `vitest.config.ts` | 测试入口，收集各包 `src/**/*.test.ts` |
| `packages/protocol/src/` | `ids.ts` 区域与物品；`decision.ts` 动作与决策校验；`view.ts` 视图、事件、观察；`messages.ts` 客户端与服务端消息 |
| `packages/engine/src/` | `rules.ts` 默认数值；`state.ts` 对局状态；`resolve.ts` 回合结算；`view.ts` 按观察者裁剪；`map.ts` 寻路；`rng.ts` 种子随机数 |
| `packages/host/src/host.ts` | `GameHost`：回合时钟、决策截止、连接会话与广播、异常中止 |
| `packages/host/tsconfig.test.json` | 只给宿主测试引入 Node 类型，源码不可见 Node 全局 |
| `packages/agents/src/scripted.ts` | 调试用规则 Agent |
| `apps/web/index.html`、`apps/web/vite.config.ts` | 网页入口与构建配置（相对资源路径） |
| `apps/web/src/main.tsx` | 组装连接、状态与界面；唯一选择传输方式的地方 |
| `apps/web/src/net/` | `GameConnection` 接口与本地 Worker 实现 |
| `apps/web/src/local-server/` | Worker 中的本地服务端与演示座位 |
| `apps/web/src/state/` | `GameStore` 客户端状态与 React 绑定 |
| `apps/web/src/render/` | Phaser 小镇场景与画面布局 |
| `apps/web/src/ui/` | React 面板 |
| `apps/web/src/labels.ts` | 区域、物品、动作、事件的中文显示文本 |
| `.github/workflows/pages.yml` | 推送 `main` 时检查、构建并部署 GitHub Pages |

测试与源码同目录，命名为 `*.test.ts`。

## 文档与协作

| 文件/目录 | 用途 |
| --- | --- |
| `README.md` | 使用方式与可运行命令 |
| `AGENTS.md` | Codex 入口及共同开发规则 |
| `CLAUDE.md` | Claude Code 入口，指向共同规则 |
| `.agents/skills/implement-change/SKILL.md` | 开发实现、验证与独立审查交接 |
| `.agents/skills/review-change/SKILL.md` | 默认只读的代码审查与修复复核 |
| `docs/architecture.md` | 应用分层、依赖方向与回合数据流 |
| `docs/development.md` | 通用任务闭环、审查与协作流程 |
| `docs/status.md` | 跨会话交接状态 |
| `docs/design/game-overview.md` | AIverse 总体设计提案、最小玩法与待验证假设 |
| `docs/decisions/` | 重要决策的说明与模板 |
| `changes/` | 单次变更说明、验收与证据 |
| `scripts/check_repo.py` | 无第三方依赖的仓库骨架检查 |
| `Makefile` | `check` 仓库检查；`verify` 仓库与应用检查 |
| `.editorconfig` | 基础文本编辑约定 |
| `.gitignore` | 本地环境、私密配置和生成产物的忽略规则 |

只记录真实存在的文件和命令。
