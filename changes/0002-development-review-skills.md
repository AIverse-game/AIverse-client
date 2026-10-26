# 0002：拆分开发与代码审查 Skill

状态：已完成。日期：2026-10-25。

## 目标与依据

用户希望将共同规则与开发、审查两种职责分开，使仓库内的工作方法可以重复调用，并明确独立审查如何交接。

## 范围

- 在 `.agents/skills/` 添加 `implement-change` 与 `review-change`，共用现有规则和检查入口。
- 将 `AGENTS.md` 收敛为共同约束和 Skill 路由；Claude Code 通过明确文件路径读取同一份 Skill。
- 明确实现、独立审查、修复与复核的调用关系，区分自查与独立审查。
- 更新使用说明、代码地图、状态与仓库必需文件检查。
- 不引入应用技术栈、CI、定时任务、额外 Agent 框架或自动提交。

## 关键选择

Skill 是可读的工作指令，不会自行启动另一个 Agent。代码、可执行脚本或构建配置改动由主 Agent 调用独立审查 Agent；纯文档小修默认自查。工具不支持子 Agent 时报告降级，不把自查写成独立审查。审查 Agent 默认只读，修复由开发 Agent 完成。

## 验收条件

- [x] 两个 Skill 含有效的名称和触发描述，开发与审查输入、职责和输出明确。
- [x] 共同规则能路由到两个 Skill，审查任务不会递归启动审查。
- [x] 未跟踪文件、无首次提交、已有用户修改的场景有明确审查范围约定。
- [x] 代码改动的独立审查有明确交接与修复流程；无法独立执行时如实报告。
- [x] 说明区分 Codex 发现机制与 Claude Code 的显式文件读取，不声称已配置后台自动化。
- [x] 仓库检查和 Skill 校验通过，并记录实际审查结果与未验证项。

## 验证证据

- `make check`：通过，检查 17 个必需文件、18 个文本文件及本地 Markdown 链接目标。
- 分别对 `.agents/skills/implement-change` 与 `.agents/skills/review-change` 运行 `quick_validate.py`：均返回 `Skill is valid!`。
- 校验器位于 `/Users/dingzhaorui/.codex/skills/.system/skill-creator/scripts/quick_validate.py`。系统 Python 和 bundled Python 初次执行均因缺少 PyYAML 失败；随后将 PyYAML 6.0.3 仅安装到 `/private/tmp/aiverse-skill-validation-deps-20261025`，以 `PYTHONPATH=/private/tmp/aiverse-skill-validation-deps-20261025 python3` 执行校验器后通过。未增加仓库或全局 Python 依赖。
- 在临时仓库副本中分别删除两个 Skill 文件：检查均返回退出码 1，并报告对应的 `missing required file`；没有修改真实仓库文件。
- 自查与独立审查均使用任务开始前临时快照比较，覆盖全部 11 个本次改动文件。原有工作区文件尚未跟踪，不使用空 `git diff` 代替差异审阅。
- 独立子 Agent 显式读取 `review-change/SKILL.md` 完成只读审查：在本次范围内未发现可确认的问题，重新运行 `make check` 与两个 Skill 校验均通过；未修改文件或再次委派。本次实际验证了显式读取 Skill 与独立审查交接。
- 未验证全新 Codex 会话的原生 Skill 发现、Claude Code 实际调用、发现缺陷后的修复复核分支或应用端到端开发；没有应用源码及相应测试、类型检查或构建配置。格式校验和本次审查不代表全部工作流行为已经验证。
- 未提交、推送或配置远程服务；临时快照与校验依赖不属于交付文件。

## 交接

见 [当前状态](../docs/status.md)。
