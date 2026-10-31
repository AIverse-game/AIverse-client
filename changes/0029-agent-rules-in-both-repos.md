# 0029：Agent 规则目录与两仓库副本

状态：已完成。

## 目标与依据

用户指出两个问题：以后的开发者可能只 clone 服务端仓库，那里没有任何规则；`docs/` 应当放项目本身的文档，给 Agent 的规则应放在一个目录里。用户决定两个仓库各存一份规则，并采用 `.agents/rules/` 与 `.agents/skills/` 并列的划分。

## 范围

- 把 `docs/development.md`、`docs/conventions.md`、`docs/testing.md` 移到 `.agents/rules/`，路径和链接一并更新，单独提交。
- 改写这三份规则和两个 Skill，使其同时适用于两个仓库：不链接仓库独有的文件，检查命令改为指向各仓库的 `AGENTS.md`，加入“规则如何同步”。
- 服务端加入相同的 `.agents/rules/` 与 `.agents/skills/`，`AGENTS.md` 改为不依赖客户端仓库的完整入口，`CLAUDE.md`、`README.md` 随之调整。
- 客户端 `scripts/check_repo.py` 在两个仓库同级时比较共用文件，并检查服务端那份里的链接。
- 顺带更正 `docs/status.md` 中“未配置远程仓库”的过时描述。
- 状态、设计、变更说明与决策记录仍只在客户端仓库，不复制。

设计文档：无。

## 关键选择

见 [决策 0005](../docs/decisions/0005-shared-agent-rules-in-each-repo.md)。历史变更说明中的链接随移动更新，正文里用行内代码写的旧路径保持原样，作为当时的记录。

## 验收条件

- [x] 只 clone 服务端时，`AGENTS.md`、`CLAUDE.md` 与 `.agents/` 里的链接都能打开，能找到开发流程、命名、测试、提交约定和两个 Skill。
- [x] 两个仓库的共用文件逐字相同；不同、缺失或多出时客户端检查报错，隐藏的本地文件（如 `.DS_Store`）不算。
- [x] 共用文件里出现只在客户端存在的链接时，客户端检查报错。
- [x] 两个仓库没有残留的旧路径链接，仓库检查通过。

## 验证证据

- `python3 scripts/check_repo.py`：PASS，19 个准备文件、107 个文本文件，本地链接与文本格式无误，5 个共用文件与服务端一致。
- 在草稿目录复制两边的 `.agents/` 与检查脚本：服务端副本改动一个文件、多出一个文件、删去一个文件后，检查分别报 `differs from the aiverse-server copy`、`only in aiverse-server`、`missing from aiverse-server`。
- 审查修复后，在草稿目录复制两个完整仓库复测：一致时 PASS；服务端 `.agents/rules/` 多一个 `.DS_Store` 时 PASS；两边共用文件同时加入 `../../docs/status.md` 链接时报 `broken local link in aiverse-server`；服务端目录名为 `AIverse-server` 时照常比较；没有同级目录时输出 NOTE、退出码 0。本机文件系统不区分大小写，大小写敏感时查找 `AIverse-server` 的路径只按代码确认。
- 独立审查：无阻断问题，4 项 P3 均已修复——隐藏文件误报、同级目录名写死小写、服务端副本的链接未检查、共用 Skill 中 `changes/` 等路径未写明仓库。待确认疑点中，服务端 README 的“代码结构”补上了 `.agents/` 的说明。
- 复核：4 项修复确认；复核新发现服务端副本不是 UTF-8 时检查抛出异常（P3），已改为跳过该文件、由主循环报 `must be UTF-8`，草稿实测退出码 1、无异常。
- 用独立脚本检查服务端 `AGENTS.md`、`CLAUDE.md`、`README.md` 与 `.agents/` 中的本地链接和锚点，没有失效。
- 服务端只改文档，未运行 `make verify`。

## 交接

只有服务端的开发者仍读不到状态、设计与决策记录；如果需要，再考虑合并仓库（见决策 0005 的重新评估条件）。已在 `docs/status.md` 记录。
