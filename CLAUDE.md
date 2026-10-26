# 项目入口

请先阅读并遵循 [AGENTS.md](AGENTS.md)。它是本项目唯一的通用 Agent 规则来源。

再读 [项目状态](docs/status.md)，如本次任务已有 `changes/` 文档，一并阅读。
此文件只提供 Claude Code 入口，与 Codex 共用规则，避免多份约定漂移。

按共同规则的任务路由，开发时读取 [.agents/skills/implement-change/SKILL.md](.agents/skills/implement-change/SKILL.md)，审查时读取 [.agents/skills/review-change/SKILL.md](.agents/skills/review-change/SKILL.md)。这里使用显式文件读取，不依赖原生 Skill 注册或快捷命令。
