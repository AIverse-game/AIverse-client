# 0061：改用虚拟世界的资源名称

状态：已完成。

## 目标与依据

用户（2026-11-07）决定把玩法改为在虚拟世界里建造设施赚钱（[虚拟设施](../docs/design/facilities.md)），要求资源换成更符合虚拟世界的名字。用户确认改名的范围，并同意和 [变更 0050](0050-energy-and-crystal-terms.md) 一样先单独改名、不动规则和数值，再实现地块与设施。

可观察的变化：页面、协议、Agent 工具和系统提示都用新名字；规则、数值、贴图不变。

## 范围

| 原名 | 新名 | 代码与协议 |
| --- | --- | --- |
| 能量 | 算力 | `compute`，物品种类 `"compute"`，`sell_compute` |
| 能量泉 | 算力泉 | 仍为 `spring` |
| 汲取 | 采集 | 仍为 `harvest` |
| 晶砂 | 数据 | `data`，物品种类 `"data"` |
| 晶矿 | 数据矿 | `mine`，编号 `q1` 改为 `m1` |
| 挖砂 | 采集数据 | `gather`，`gather_data`、`GatherJob` |
| 晶核 C1～C3 | 程序 v1～v3 | `program`，物品种类 `"v1"`～`"v3"`，`buy_program`、`install_program`、`remove_program` |
| 工坊 | 工作室 | `studio` |
| 炼制 | 编写 | `write`，`write_program`，`programs_written` |
| 汲能塔 | 采集节点 | `collector`，`build_collector`、`fund_collector` |
| 维护费、收购点、金币 | 不变 | |

服务端（`aiverse-server`）：

- 文件改名（`git mv`）：`core/towers.py` → `core/collectors.py`，`economy/crystals.py` → `programs.py`，`economy/energy.py` → `compute.py`，`economy/shards.py` → `gathering.py`，`economy/towers.py` → `collectors.py`，`economy/workshop.py` → `studio.py`，以及对应的 9 个测试文件。
- 标识符、错误码、工具名与说明、系统提示、观察 JSON 的键、流水账渠道（`program_import`、`collector_build`）、README。协议版本 21 → 22。

客户端：

- `packages/protocol` 的视图、原语与协议版本 22；页面文字、组件与 CSS 类名。文件改名：`ui/CrystalIcon.tsx` → `ProgramIcon.tsx`，`ui/EnergyIcon.tsx` → `ComputeIcon.tsx`，`ui/TowerPanel.tsx` → `CollectorPanel.tsx`。
- 设计文档改名：`crystals.md` → `programs.md`，`towers.md` → `collectors.md`，`energy-market.md` → `compute-market.md`，正文与其他当前文档统一用词；旧变更说明只改指向这三份设计文档的链接。新建 [虚拟设施](../docs/design/facilities.md) 设计文档，记下整个重构的方案和用户的决定。

留给后续：

- 贴图文件路径与画面不变。
- [总体设计](../docs/design/game-overview.md) 只改链接，正文不改。
- 地块、素材、广告位等新玩法在下一个变更中实现。

## 关键选择

- **代码一起改名**：理由同变更 0050，代码和游戏概念长期对不上会误导以后的修改。
- **算力泉、采集保留 `spring`、`harvest`**：英文本来就对得上新名字，不必改。
- **数据矿用 `mine`**：`data` 太常见，`data_mine` 太长；原来两处表示“我的”的局部变量 `mine` 改成 `own`、`own_fills`。
- **采集数据用 `gather`**：`collect` 会和 `collector`（采集节点）撞名。
- **程序的阶改称版本**：物品种类 `v1`～`v3`，代码字段仍叫 `tier`。

## 验收条件

- [x] 服务端标识符、文件、工具名、错误码、系统提示、观察与协议都用新名字。
- [x] 客户端协议与服务端一致（版本 22），页面显示算力、算力泉、数据、数据矿、程序、工作室、采集节点。
- [x] 规则与数值不变：服务端原有的 1167 项测试、客户端原有的 212 项测试在改名后全部通过，没有增删测试。
- [x] 文档链接有效。

## 验证证据

- 服务端 `make verify` 的各项：`ruff check`、`ruff format --check`、`mypy` 通过，`pytest` 1167 项通过（原有 1 条 Starlette 弃用警告）。测试函数数改名前后都是 654。
- 客户端 `npm run verify`（类型检查、ESLint、Vitest 212 项、生产构建）通过；`python3 scripts/check_repo.py` 通过。测试用例数改名前后都是 107。
- 改名用脚本按大小写成批替换，再人工修正：Zod 的 `.refine`、`.superRefine` 被误改为 `write` 后改回；英语单复数与冠词（`an v1`、`writement`、测试名里的 `digs`、`compute ... are`）；中文的“阶”“塔主”“挖”“汲干”等词；两段讲变更 0050 改名历史的文字恢复原文。
- 浏览器实测：无头 Chrome 截图，服务端用 3 个脚本机器人在空闲端口启动（`--log-dir` 指向临时目录），页面用 `vite preview` 代理。确认已连接，排名、居民列表、算力泉、数据矿与工作室配方、收购点程序价目、交易所商品都显示新名字。第一次截图发现数据矿编号仍是 `q1`（`layout.py` 用 f-string 生成，脚本没匹配到），改为 `m1` 后重新截图确认；默认地图测试补了编号断言。
- 独立审查（子 Agent，只读）：没有 P0、P1。审查者统计三份 diff 中数字的增删次数，除协议版本外完全一致；用服务端生成的状态交给客户端解析器检查，双端键名、动作类型、物品种类、错误码一致。确认的问题都已修复并复核：
  - P2：[总体设计](../docs/design/game-overview.md) 的正文被批量替换，其中最早小镇经济示例里的“工坊”（做面包）被误改成“工作室”。已用改名前的版本恢复，只保留三处链接。
  - P3：代码地图里的贴图路径与实际目录不符（改名前就不对），改为实际路径；英文语法（`written` 缺 `has`、`an v1`、把 compute 当可数名词、采集算力误写成 gathers）；数据矿绘图注释误称 programs；程序的量词由“块”改为“个”，“程序绘制”改为“代码绘制”；测试里表示未知版本与大小写的 `"C4"`、`"c1"` 改为 `"v4"`、`"V1"`，`C1_RECIPE` 等测试常量改名。
  - 保留的疑点：报价与合约文字里数据显示为“5 个 data”（`ui/dealText.ts` 只把 compute 译成中文），改名前是“5 个 shard”，属于已有问题，本次不改；流水账渠道名改了，与旧对局的报告对比时渠道名对不上，属于预期。
- 客户端已有用户未提交的修改（`assets/rigs/mining-rig.png` 与 `MapScene.ts` 中的贴图尺寸）不属于本次改动：贴图未暂存；`MapScene.ts` 只暂存改名部分，用户改的数值留在工作区。

## 交接

- 下一步：[虚拟设施](../docs/design/facilities.md) 第 2 步，地块、素材与广告位。
- 已更新 `docs/status.md`。
