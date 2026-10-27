# 仓库地图

包含总体游戏设计、通用开发基础和网页客户端。权威服务端是与本仓库同级的 Python 项目 `aiverse-server`。分层与数据流见 [应用架构](architecture.md)。

## 应用代码

| 文件/目录 | 用途 |
| --- | --- |
| `package.json` | npm workspaces 根配置与统一脚本（`dev`、`build`、`verify` 等） |
| `tsconfig.base.json` | 各包共享的 TypeScript 严格配置；共享包不含 DOM 类型 |
| `eslint.config.js` | 代码检查与分层规则 |
| `vitest.config.ts` | 测试入口，收集各包 `src/**/*.test.ts` |
| `packages/protocol/src/` | `view.ts` 地图、居民与坐标视图及校验；`actions.ts` 操作原语类型；`messages.ts` 客户端与服务端消息、协议版本 |
| `apps/web/index.html`、`apps/web/vite.config.ts` | 网页入口与构建配置（相对资源路径、`/ws` 代理到服务端） |
| `apps/web/src/main.tsx` | 组装连接、状态与界面；唯一选择传输方式和服务端地址的地方 |
| `apps/web/src/vite-env.d.ts` | `VITE_SERVER_URL` 环境变量类型 |
| `apps/web/src/net/` | `GameConnection` 接口与 WebSocket 实现 |
| `apps/web/src/state/` | `GameStore` 客户端状态（快照、选中居民、操作结果）、发送原语，及 React 绑定 |
| `apps/web/src/render/` | `layout.ts` 2.5D 透视投影及其反算、刻度与格式；`MapScene.ts` Phaser 地图场景（地块、居民、指针坐标、点选与点击移动） |
| `apps/web/src/ui/` | React：顶栏、地图容器、地图与居民信息面板（可点选居民）、`ActionPanel.tsx` 手动操作面板 |
| `.github/workflows/ci.yml` | 推送 `main` 或提交 PR 时运行仓库检查与 `npm run verify` |

测试与源码同目录，命名为 `*.test.ts`。

## Python 服务端（`aiverse-server`）

| 文件 | 用途 |
| --- | --- |
| `pyproject.toml`、`uv.lock` | 依赖、启动脚本与 ruff/mypy/pytest 配置 |
| `src/aiverse_server/world.py` | 坐标、居民、物品栏（`Inventory`）、事件队列字段、地图与世界模型，越界与重复 id 校验 |
| `src/aiverse_server/layout.py` | 固定的初始地图与居民 |
| `src/aiverse_server/actions.py` | 操作原语（`MoveTo`、`RespondToEvent`、`WithdrawEvent`）及其规则校验与执行 `perform` |
| `src/aiverse_server/inventory.py` | 居民物品的存入、移出、计数、列出与清空（服务端内部接口，不是原语） |
| `src/aiverse_server/events.py` | 事件队列：事件种类基类 `EventPayload` 与其钩子，发送、同意、拒绝、撤回和收件箱查询 |
| `src/aiverse_server/protocol.py` | 消息模型、客户端消息解析、消息到原语与世界到视图的转换 |
| `src/aiverse_server/app.py` | FastAPI 应用与 WebSocket `/ws`：共享世界、握手、执行原语、广播状态 |
| `src/aiverse_server/__main__.py` | `uv run aiverse-server` 启动入口 |
| `tests/` | 世界模型、操作原语、物品栏、事件与 WebSocket 接口测试 |
| `Makefile` | `dev` 启动；`verify` 检查与测试 |

## 文档与协作

| 文件/目录 | 用途 |
| --- | --- |
| `README.md` | 使用方式与可运行命令 |
| `AGENTS.md` | Codex 入口及共同开发规则 |
| `CLAUDE.md` | Claude Code 入口，指向共同规则 |
| `.agents/skills/implement-change/SKILL.md` | 开发实现、验证与独立审查交接 |
| `.agents/skills/review-change/SKILL.md` | 默认只读的代码审查与修复复核 |
| `docs/architecture.md` | 应用分层、坐标系与数据流 |
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
