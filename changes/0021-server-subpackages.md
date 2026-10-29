# 0021：服务端按领域分子包

状态：已完成。

## 目标与依据

服务端 `aiverse_server` 包根目录平铺了 20 个模块，测试同样平铺，新功能不断加入后难以看出哪些文件属于同一块。按领域把模块分进子包，让结构本身说明职责。只移动文件、改写导入，不改变任何行为、协议或启动方式。

## 范围

- `src/aiverse_server/` 分为 `core/`（world、inventory、events）、`economy/`（tokens、chips、mining、market、trade）、`residents/`（walking、perception、memory、speech）、`game/`（actions、lifecycle、clock、layout）、`server/`（app、protocol），`agents/` 与 `__main__.py` 不动。各子包有一个只含说明的 `__init__.py`，不做再导出。
- `tests/` 按同样的子包分组；`test_agents.py` 放在 `tests/agents/`。
- 更新服务端 `README.md` 的“代码结构”、本仓库 `docs/code-map.md`、`docs/architecture.md` 与 `packages/protocol` 注释中的路径。

设计文档：无。

## 关键选择

- 按领域而不是按技术层分组。`core/` 只依赖 `core/` 内的模块，`economy/` 只依赖 `core/`；`game/actions.py` 汇集所有原语，`server/` 与 `agents/` 在最上层。`residents/` 与 `game/` 互相引用（`residents/` 用 `game/lifecycle.py` 的 `check_can_act`，`game/lifecycle.py` 用 `residents/walking.py`），不是严格分层；要做到严格分层需要拆开 `lifecycle.py`，属于行为之外的另一次重构，本次不做。
- 包内导入保持相对导入的写法；模块的文件名都不变，文档字符串里“见 `mining.py`”一类的引用仍然唯一，不逐一改写。
- 测试子目录不加 `__init__.py`，沿用 pytest 默认导入方式；测试文件名全局唯一，不会冲突。

## 验收条件

- [x] `make verify`（ruff、ruff format --check、mypy strict、pytest）在服务端通过，测试数与改动前相同。
- [x] `uv run aiverse-server` 能启动，`--agent r1=scripted` 的居民照常行动。
- [x] 文档中的服务端文件路径与实际一致。

## 验证证据

- 服务端 `make verify`：ruff 与格式检查通过，mypy strict 无错误，pytest 503 项通过（与改动前相同）。
- `uv run aiverse-server --port 8765 --agent r1=scripted` 正常启动，控制台打印 `r1: move_to | going to the market`，关闭正常。
- 本仓库 `python3 scripts/check_repo.py` 通过；`packages/protocol` 两处注释里的服务端路径同步更新，`npm run verify` 通过。
- 独立审查：未发现影响行为或导入的问题（逐文件比对改动前后的导入与语法树，只有导入路径和一个 monkeypatch 字符串不同）；指出的两处 TS 注释旧路径、`core/` 依赖说法的歧义和一处多余空格已修正。

## 交接

无后续任务。若以后需要严格的包间依赖方向，可再考虑拆分 `game/lifecycle.py` 中的 `check_can_act`；更新了 `docs/status.md`。
