# AIverse

一款处于早期开发阶段的 2D 多人 AI 小镇经营游戏。玩家提供自己的大模型 API，由模型操控居民进行生产和交易，以对局结束时持有的金币决定胜负。

首版提案见 [总体游戏设计](docs/design/game-overview.md)：4–8 人、约 20 分钟一局，围绕采集、面包加工、市场交易和限量系统需求构建最小经济循环。人数、数值与节奏尚待原型验证。

当前已有网页端底层框架：浏览器里能运行一局演示，4 名由调试规则控制的居民在小镇中移动、采集、制作和休息。市场交易、系统收购、真实模型接入和联机尚未实现。

仓库已具备面向 Codex 与 Claude Code 的通用项目协作基础，用于统一开发约定、任务描述、验证方式和跨会话交接。

共同规则放在 `AGENTS.md`，开发与代码审查分别使用项目内 Skill。代码改动由开发 Agent 实现并验证，再调用独立审查 Agent 给出问题报告，由开发 Agent 修复并交回复核。

应用使用 TypeScript、React、Phaser 与 Vite，按“权威服务端 + 只渲染的客户端”分层；现阶段服务端以 Web Worker 形式运行在浏览器内，可部署到 GitHub Pages。详见 [应用架构](docs/architecture.md) 与 [决策 0001](docs/decisions/0001-web-stack-and-layering.md)。Python 仅用于仓库检查脚本。

## 运行游戏

需要 Node.js 22.13 或更高版本：

```sh
npm install
npm run dev        # 本地开发服务器，打开终端提示的地址
npm run build      # 生成 apps/web/dist 静态文件
npm run preview    # 预览生产构建
```

推送到 GitHub 的 `main` 分支后，[部署工作流](.github/workflows/pages.yml) 会检查、构建并发布到 GitHub Pages。首次使用需在仓库 Settings → Pages 中把 Source 设为 GitHub Actions。

## 项目入口

| 文件 | 用途 |
| --- | --- |
| [总体游戏设计](docs/design/game-overview.md) | 游戏定位、首版规则、经济循环、AI 控制与原型验证顺序 |
| [应用架构](docs/architecture.md) | 分层、依赖方向、回合数据流与接入服务端的路径 |
| [AGENTS.md](AGENTS.md) | Codex 入口及两个工具共用的开发规则 |
| [CLAUDE.md](CLAUDE.md) | Claude Code 入口，指向共同规则 |
| [开发 Skill](.agents/skills/implement-change/SKILL.md) | 实现、验证、审查交接与修复 |
| [审查 Skill](.agents/skills/review-change/SKILL.md) | 默认只读的代码审查与修复复核 |
| [开发流程](docs/development.md) | 理解任务、实现、验证、审查与交接 |
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

仓库检查覆盖必需文件、本地 Markdown 链接目标、UTF-8/LF/尾随空白和补丁格式，不执行应用检查。部署工作流在构建前运行同样两组检查。

## 如何开始一项任务

向 Agent 提供目标、范围和可观察的完成条件。小修可直接实现；较大任务先使用 `changes/TEMPLATE.md` 写简短说明，重要技术选择使用决策模板记录。

开发任务示例：

> 阅读 AGENTS.md 和 .agents/skills/implement-change/SKILL.md，完成以下任务：［目标］。范围：［范围］。验收条件：［可观察结果］。完成验证与独立审查，处理发现并更新交接状态。

单独审查任务示例：

> 阅读 AGENTS.md 和 .agents/skills/review-change/SKILL.md，只审查［文件或差异范围］。基线：［引用或快照］。需求：［预期行为］。报告有证据的问题、实际验证及限制，不修改文件。

Codex 可发现 `.agents/skills/`；未发现时可显式读取文件。Claude Code 通过入口和明确文件路径使用同一份指令。独立审查由主 Agent 调用；工具不支持时会明确报告降级为自查。纯文档小修默认自查。详见 [调用约定](docs/development.md)。

除 GitHub Pages 部署工作流外，没有定时或后台 Agent 自动化；创建 Skill 不会自行触发任务。

当前仅初始化本地 Git，分支为 `main`；未创建远程仓库、提交或推送，部署工作流尚未在 GitHub 上实际运行。
