# 0092：游戏放进游戏厅后不过期

状态：已完成（服务端）。

## 目标与依据

用户（2026-11-10）：游戏上架后应该不会过期，而且制作一个游戏要比广告更贵。

可观察的变化：游戏放进游戏厅后一直展示，不再 300 秒后消失；游戏厅里的份数只因容量（5 份）而无法再放。广告内容仍按 300 秒过期。

## 范围

- 服务端 `economy/ads.py`：新增 `GAME_LIFETIME = 1e9`（游戏秒，远长于一局）与 `LIFETIME_FOR`（广告 300 秒，游戏厅 `GAME_LIFETIME`）；`place_content` 按设施种类取保鲜期。
- 服务端 `agents/tools.py`、`agents/system_prompt.py`：工具说明与系统提示改为“游戏不过期，但游戏厅最多 5 份”。
- 观察：`LandView.content_lasts` 改名为 `ad_content_lasts`（只适用于广告位，游戏厅不过期），审查发现它在整块地的视图里会让智能体误以为游戏也 300 秒过期。
- 测试：`test_venues.py`（游戏不过期、广告仍过期）、`test_venue_tools.py`、`test_system_prompt.py`、`test_content_tools.py` 随之更新。
- 客户端文档：`docs/design/content.md`、`docs/design/venues.md`。
- 不做：游戏制作成本的数值调整（见下）；游戏厅的容量；撤回已放进去的游戏。

## 决定与取舍

- 用有限大数而不是 `math.inf`：`core/land.py` 要求设施的时间必须是有限数，而且协议与观察都是 JSON 数字。1e9 游戏秒远超一局（约 20 分钟），效果等同永久。
- 制作成本：`GAME_WORKLOAD = 90`，广告内容 `CONTENT_WORKLOAD = 60`，游戏已比广告内容贵；建广告位 `AD_WORKLOAD = 180` 比制作游戏贵。用户说的“广告”若指建广告位，则与当前数值相反，本次没有改数值，待用户确认。

## 验证

- 服务端 `make verify`（ruff、ruff format --check、mypy strict、pytest）通过，1328 项测试。
- 独立审查（只读子 Agent）：确认过期分支、有限数校验、f-string 与导入、测试断言均正确；发现观察字段 `content_lasts` 误导，已改名修复。
- 协议：客户端 `packages/protocol/src/view.ts` 的 `expiresIn` 用 `z.number().positive()` 校验，1e9 能通过解析；页面如何显示这个数，未检查。

## 已知限制

- 游戏厅最多 5 份，满了之后永远放不进新游戏，也无法撤回旧游戏，游戏厅会一直停在 5 份。是否需要提高容量或允许替换，待用户决定。
- 协议与观察里游戏的剩余时间显示为约 10 亿秒。客户端协议能解析，但页面若按这个数显示倒计时会不合适，需要在页面侧处理（本次未改页面）。
- 游戏的访客吸引力与收入不变，仍取决于份数，不随时间衰减。
