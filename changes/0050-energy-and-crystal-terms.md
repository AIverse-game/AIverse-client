# 0050：改用能量与晶核的名称

状态：已完成。

## 目标与依据

用户（2026-11-03）认为 AIverse 是一个比较虚拟的世界，不该出现“硅”“芯片”这类现实工业概念，token 也不必沿用。用户确认改用“能量与晶核”一套名称，并要求先单独改名、不动规则和数值，再实现晶矿与工坊（下一个变更）。

依据之外的考虑：驱动居民的大模型自己也有 token，同一个词容易让模型混淆；“走路和说话消耗能量”比“消耗 token”更直观。2026-11-03 的基线对局中，三名居民卖光 token 后困在收购点，改名后提示更贴近体力的含义。

可观察的变化：页面、协议、Agent 工具和系统提示都用新名字；规则、数值、贴图不变。

## 范围

| 原名 | 新名 | 代码与协议 |
| --- | --- | --- |
| token | 能量 | `energy`，物品种类 `"energy"`，`sell_energy` |
| 矿池 | 能量泉 | `spring`，`springId`；默认地图编号由 `p1` 改为 `s1` |
| 挖矿、采矿 | 汲取 | `harvest`，`harvesting` |
| 芯片 MK1/MK2/MK3 | 晶核 C1/C2/C3（一阶到三阶） | `crystal`，型号字段 `model` 改为 `tier`，`buy_crystal(tier)`、`install_crystal`、`remove_crystal` |
| 矿机 | 汲能塔 | `tower`，`build_tower`、`fund_tower`，`towers` |
| 电费 | 维护费 | `upkeep`，`upkeepPer100` |
| 金币、收购点 | 不变 | |

服务端（`aiverse-server`）：

- 文件改名（`git mv`）：`core/rigs.py` → `core/towers.py`，`economy/rigs.py` → `economy/towers.py`，`economy/tokens.py` → `economy/energy.py`，`economy/chips.py` → `economy/crystals.py`，`economy/mining.py` → `economy/harvesting.py`，以及对应的 6 个测试文件。
- 所有标识符、错误码、工具名与工具说明、系统提示、观察 JSON 的键、流水账渠道（`crystal_import`、`tower_build`、`upkeep`）、README。协议版本 17 → 18。
- 大模型自己的 token（`max_tokens`、用量统计等）保持原名。

客户端：

- `packages/protocol` 的视图、原语与协议版本 18；页面文字、组件与 CSS 类名。文件改名：`render/poolMarkerMotion(.test).ts` → `springMarkerMotion`，`ui/ChipIcon.tsx` → `CrystalIcon.tsx`，`ui/RigPanel.tsx` → `TowerPanel.tsx`，`ui/TokenIcon.tsx` → `EnergyIcon.tsx`。
- 设计文档改名：`chips.md` → `crystals.md`，`mining-rigs.md` → `towers.md`，`token-market.md` → `energy-market.md`，正文与其他当前文档（状态、代码地图、架构、README）统一用词；旧变更说明只改指向这三份设计文档的链接。

留给后续：

- 贴图文件（`assets/chips/`、`assets/pools/`、`assets/rigs/`、`assets/tokens/`）路径与画面不变，仍是芯片、矿池、矿机、token 的样子，等用户换图时再改名。
- [总体设计](../docs/design/game-overview.md)是最初的提案，只改链接，正文不改。
- 晶矿、工坊与计分折算在下一个变更中实现。

设计文档：只改名称，设计不变；名称的决定写进 [晶核](../docs/design/crystals.md) 的“争议讨论与决定”。

## 关键选择

- **名称成套替换**：能量既是体力又是产出，能量泉是来源，晶核决定汲取量，汲能塔托管晶核。三阶晶核用 `C1`～`C3` 作物品名，页面显示阶名和晶核贴图。
- **代码一起改名**：只改显示文字会让代码和游戏概念长期对不上，所以标识符、文件、协议和文档一起改，单独成一次重构提交。
- **晶核的“型号”改为“阶”**：代码里 `model` 已用来指大模型，晶核继续叫 `model` 容易混淆，改为 `tier`。
- **不改贴图**：贴图是用户画的，而且用户正在调整矿机贴图（未提交），改路径会打断这项工作。

## 验收条件

- [x] 服务端标识符、文件、工具名、错误码、系统提示、观察与协议都用新名字；大模型的 token 用量和上限仍叫 token。
- [x] 客户端协议与服务端一致（版本 18），页面显示能量、能量泉、晶核、汲能塔、维护费。
- [x] 规则与数值不变：服务端原有的 1001 项测试、客户端原有的 185 项测试在改名后全部通过，没有增删测试。
- [x] 文档链接有效。

## 验证证据

- 服务端 `make verify`：ruff、格式检查、mypy strict 通过，1001 项测试通过（原有 1 条 Starlette 弃用警告）。
- 客户端 `npm run typecheck`、`npm run lint`、`npx vitest run`（185 项）、`vite build` 通过；`python3 scripts/check_repo.py` 通过。
- 改名用脚本按词边界成批替换，保护大模型 token 与贴图路径；随后用脚本核对：同一文件中没有两个不同的旧标识符被改成同一个新名（测试里 `TOKEN` 与 `TOKENS` 撞名，后者改为 `STOCK`）；人工修正英语单复数、`mine`（意为“我的”）误改的变量、中文空格等。
- 浏览器实测：本机浏览器扩展未连接，改用无头 Chrome 截图。服务端用 3 个脚本机器人在空闲端口启动，页面用 `vite preview` 代理到该端口。第一次截图发现客户端协议版本仍为 17、页面报 `protocol_mismatch`，修正后截图确认：已连接；居民列表、能量泉（s1～s6）、收购点“金币 / 能量”、C1～C3 晶核价目、“汲取”按钮都显示新名字。居民列表的“308 energy”英文残留和“扣 能量”多余空格已修正并重新构建。汲能塔面板需要点选操作，无头截图无法覆盖，只靠测试与代码审阅。
- 客户端已有未提交修改（用户在调整矿机贴图 `assets/rigs/mining-rig.png` 与 `MapScene.ts` 中的贴图尺寸）不属于本次改动：贴图未暂存；`MapScene.ts` 只暂存改名部分，用户改的数值留在工作区。
- 独立审查（子 Agent，只读）：没有 P0、P1 问题。审查者用服务端 `world_view` 生成含汲能塔、汲取中居民与晶核价目的状态，再交给客户端 `parseServerMessage` 解析，结果通过，线上的键两边一致。确认的问题都已修复：
  - P2：大模型自身的 token 有几处被误改成能量，包括 `llm_brain.py` 的文档串、两个测试名与一个参数值、两份文档里“每次回复最多 8192 token”的说法。都已改回 token。
  - P3：几处文档指向不存在的文件或标识符（`harvesting-towers.md`、`CRYSTAL_MODELS`、`craft_crystal(model)`）。
  - P3：工具说明里漏改了能量泉编号示例 `p1` 和 “rent and power”；`last_energy` 的错误消息、系统提示和几个测试名里有英语单复数问题。
  - P3：中文里残留“energy”“台”“整机”“挖”“晶核型号”等旧词；客户端 `CrystalModelView` 改为 `CrystalTierView`；本说明里“页面显示为‘C1 晶核’”与实现不符，已改正。两份 `testing.md` 示例中的 token 改为能量，示例里的 524 金币在改名前就已失效，本次未修。
  - 保留的疑点：`crystals.md` 正文仍写硅、晶核厂，有意留给下一个变更改写。

## 交接

- 下一步：实现晶矿与工坊（[晶核](../docs/design/crystals.md)），以及结束时手里的能量和晶核折算计入排名。
- 已更新 `docs/status.md`。
