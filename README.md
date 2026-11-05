# AIverse

一款处于早期开发阶段的 2D 多人 AI 小镇经营游戏。玩家提供自己的大模型 API，由模型操控居民进行生产和交易，以对局结束时持有的金币决定胜负。

首版提案见 [总体游戏设计](docs/design/game-overview.md)：4–8 人、约 20 分钟一局，围绕采集、面包加工、市场交易和限量系统需求构建最小经济循环。人数、数值与节奏尚待原型验证。

当前已有 Python 权威服务端与网页客户端：服务端生成一张 150 × 150 的正方形连续坐标地图和 8 名居民，网页读取后按坐标渲染。移动、生产、交易、回合推进和真实模型接入尚未实现。

仓库已具备面向 Codex 与 Claude Code 的通用项目协作基础，用于统一开发约定、任务描述、验证方式和跨会话交接。

共同规则放在 `AGENTS.md`，开发与代码审查分别使用项目内 Skill。代码改动由开发 Agent 实现并验证，再调用独立审查 Agent 给出问题报告，由开发 Agent 修复并交回复核。

应用按“权威服务端 + 只渲染的客户端”分层。服务端是与本仓库同级的 Python 项目 `aiverse-server`（FastAPI、WebSocket）；本仓库是使用 TypeScript、React、Phaser 与 Vite 的网页客户端。详见 [应用架构](docs/architecture.md)、[决策 0001](docs/decisions/0001-web-stack-and-layering.md) 与 [决策 0002](docs/decisions/0002-python-server-and-coordinate-map.md)。

## 运行游戏

需要 Node.js 22.13 或更高版本，以及 [uv](https://docs.astral.sh/uv/)（会自动准备 Python 3.12）。先在 `aiverse-server` 目录启动服务端：

```sh
uv sync
uv run aiverse-server   # 监听 127.0.0.1:8000
```

再在本仓库启动网页：

```sh
npm install
npm run dev        # 本地开发服务器，打开终端提示的地址；/ws 自动代理到服务端
npm run build      # 生成 apps/web/dist 静态文件
npm run preview    # 预览生产构建，同样代理 /ws
```

服务端换了端口时，用 `AIVERSE_SERVER_PORT=9000 npm run dev` 让代理跟上。网页与服务端不在同一主机时，构建前设置 `VITE_SERVER_URL`（如 `ws://example.com:8000/ws`）。服务端尚无身份认证，只应在本机使用。

推送到 GitHub 的 `main` 分支或提交 PR 后，[CI 工作流](.github/workflows/ci.yml) 会运行仓库检查与 `npm run verify`。只有静态页面已无法单独演示，因此不再部署 GitHub Pages。

## 项目入口

| 文件 | 用途 |
| --- | --- |
| [总体游戏设计](docs/design/game-overview.md) | 游戏定位、首版规则、经济循环、AI 控制与原型验证顺序 |
| [设计文档](docs/design/README.md) | 每个功能一份设计文档的规则与索引 |
| [应用架构](docs/architecture.md) | 分层、依赖方向、坐标系与数据流 |
| [AGENTS.md](AGENTS.md) | Codex 入口及两个工具共用的开发规则 |
| [CLAUDE.md](CLAUDE.md) | Claude Code 入口，指向共同规则 |
| [开发 Skill](.agents/skills/implement-change/SKILL.md) | 实现、验证、审查交接与修复 |
| [审查 Skill](.agents/skills/review-change/SKILL.md) | 默认只读的代码审查与修复复核 |
| [开发流程](.agents/rules/development.md) | 理解任务、实现、验证、审查与交接 |
| [项目状态](docs/status.md) | 当前进展、实际可用命令与后续工作 |
| [代码地图](docs/code-map.md) | 文件职责与导航 |
| [变更模板](changes/TEMPLATE.md) | 单次任务的范围、验收条件与证据 |
| [决策记录](docs/decisions/README.md) | 重要技术选择的依据与影响 |

Codex 与 Claude Code 共用 `AGENTS.md`，避免维护两套规则。启动开发会话时，从项目根目录工作，并让 Agent 先阅读规则和当前状态。

## 验证入口

```sh
python3 scripts/check_repo.py   # 仓库骨架，需要 Python 3
npm run verify                  # 类型检查、ESLint（含分层规则）、测试、生产构建
make verify                     # 以上两者
```

服务端在 `aiverse-server` 目录用 `make verify` 检查（ruff、mypy、pytest）。仓库检查覆盖必需文件、本地 Markdown 链接目标、UTF-8/LF/尾随空白和补丁格式，不执行应用检查。CI 工作流运行本仓库的两组检查，不包括服务端。

## 如何开始一项任务

向 Agent 提供目标、范围和可观察的完成条件。小修可直接实现；较大任务先使用 `changes/TEMPLATE.md` 写简短说明，重要技术选择使用决策模板记录。

开发任务示例：

> 阅读 AGENTS.md 和 .agents/skills/implement-change/SKILL.md，完成以下任务：［目标］。范围：［范围］。验收条件：［可观察结果］。完成验证与独立审查，处理发现并更新交接状态，审查无误后提交。

单独审查任务示例：

> 阅读 AGENTS.md 和 .agents/skills/review-change/SKILL.md，只审查［文件或差异范围］。基线：［引用或快照］。需求：［预期行为］。报告有证据的问题、实际验证及限制，不修改文件。

Codex 可发现 `.agents/skills/`；未发现时可显式读取文件。Claude Code 通过入口和明确文件路径使用同一份指令。独立审查由主 Agent 调用；工具不支持时会明确报告降级为自查。纯文档小修默认自查。详见 [调用约定](.agents/rules/development.md)。

除 CI 工作流外，没有定时或后台 Agent 自动化；创建 Skill 不会自行触发任务。

本地 Git 分支为 `main`；未创建远程仓库或推送，CI 工作流尚未在 GitHub 上实际运行。
