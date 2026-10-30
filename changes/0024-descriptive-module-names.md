# 0024：看得出内容的模块名

状态：已完成。

## 目标与依据

用户指出 `llm.py`、`scripted.py` 看不出里面是什么。[变更 0023](0023-naming-conventions.md) 的约定只检查了大小写和分隔符，误判现有文件都符合“名字说明职责”。按同样的标准检查全部文件后，发现四个名字只写了技术、只有形容词，或和领域概念撞名。

## 范围

| 原名 | 新名 | 内容 |
| --- | --- | --- |
| `aiverse-server/.../agents/llm.py` | `agents/llm_brain.py` | 大模型大脑 `ChatCompletionsBrain` 与设置 `LLMSettings` |
| `aiverse-server/.../agents/scripted.py` | `agents/scripted_brain.py` | 脚本机器人 `ScriptedBrain` |
| `aiverse-server/.../agents/rules.py` | `agents/system_prompt.py` | 给模型的系统提示 `system_prompt()`，原名会被误认为游戏规则 |
| `apps/web/src/state/react.tsx` | `state/storeContext.tsx` | `StoreContext`、`StoreProvider`、`useStore`、`useGameState` |

- 只改文件名、导入和现行文档（代码地图、服务端 README、AI 居民设计文档、包文档字符串），行为不变。
- 历史变更说明与决策记录是当时的快照，保留旧文件名。
- [文件命名与目录约定](../docs/conventions.md) 补上不合格名字的类型和“与主要导出对应”的规则，单独提交。

设计文档：无（只更新 `docs/design/ai-residents.md` 中的文件名）。

## 关键选择

- 用后缀补出名词（`_brain`），不新建 `agents/brains/` 子目录：两个文件不值得多一层，平铺也便于搜索，并与类名 `ScriptedBrain`、`ChatCompletionsBrain` 对应。
- 以下名字有些宽泛，但能对上内容，这次不改，留给用户决定：服务端 `game/clock.py`（到点结算）、`game/layout.py`（开局布局），客户端 `render/layout.ts`（透视投影与刻度）、`state/market.ts`（本地推算市场价）。

## 验收条件

- [x] 四个文件以新名存在，用 `git mv` 保留历史，没有遗留对旧名的导入或现行文档引用。
- [x] 服务端与客户端检查全部通过，服务端入口能正常导入。

## 验证证据

- `aiverse-server`：`ruff check .` 通过（改名后 `app.py` 的导入超过行宽，用 `ruff check --select I --fix` 换行）；`mypy` 51 个文件无问题；`pytest` 549 个通过；`uv run aiverse-server --help` 正常。
- 本仓库：`npm run verify`（类型检查、ESLint、Vitest、生产构建）通过；`python3 scripts/check_repo.py` 通过。
- 用 `grep` 检查两个仓库，除历史变更说明外没有旧文件名。
- 本机磁盘剩余约 300 MB，部分命令输出被截断；以上结果是逐项重跑后的退出码与摘要。

## 交接

无后续任务；宽泛名字是否改名见“关键选择”。
