# 0081：访客去场馆，广告位只靠路过

状态：已完成（服务端提交 09ebcae；页面不显示访客，未在浏览器里验证；有两处待用户确认，见交接）。

## 目标与依据

用户（2026-11-08）：谁会想看广告？广告位本身不吸引人；场馆才是主要吸引人的设施；普通游客也去场馆（之前只有路线游客去游戏厅）；广告位只靠路过获得浏览。起因是 AI 居民只建广告牌、不建场馆；提示词的问题已在服务端提交 686bd74 和 2eb1440 处理，本次改的是访客本身的规则。

页面上的可观察变化：没有（页面不显示访客）。AI 观察里的展示与收入会随之变化：广告位的 `people_seen` 只计路过的人，场馆有普通游客进门。

## 范围

- 服务端 `economy/visitors.py`：广告位不再是目的地。普通游客每一站从工作空间和展示着游戏的游戏厅里按多项 logit 选（`VENUE_KINDS`，同一套选法），进门付入场费，停留按场馆的 `DWELL`。路过广告位的展示规则不变（半径 10、至少 4 秒、120 秒内不重复计），场馆里的停留不再算广告浏览。删除广告位的停留时长（`MIN_DWELL`、`MAX_DWELL`、`DWELL["ad"]`）。路线游客不变（`ROUTE_SHARE` 0.3，先工作空间、再游戏厅）。
- 服务端 `core/visitors.py`、`economy/sponsors.py`、`economy/ads.py`、`core/land.py`、`agents/observation.py`：文档字符串与注释改成新规则。
- 服务端 AI 提示词（`agents/system_prompt.py`）和工具说明（`agents/tools.py` 的 `build_venue`、`place_content`）：说明广告位靠路过、访客去场馆、路线占比和门票。
- 服务端测试：`tests/unit/economy/test_visitors.py`、`test_working_tourists.py`、`tests/unit/agents/test_system_prompt.py`、`tests/integration/agents/test_scripted_brain.py`（见验证证据）。
- 设计文档：修改 [脚本访客](../docs/design/visitors.md)、[场所与入场费](../docs/design/venues.md)、[赞助商](../docs/design/sponsors.md) 的展示定义、[设计索引](../docs/design/README.md) 与[虚拟设施](../docs/design/facilities.md) 的一行说明；[状态](../docs/status.md) 更新。
- 不做：数值重调（访客数、路线占比、入场费、停留时长沿用首版）；脚本机器人改为建场馆（它现在只建广告牌，收入为 0）；页面显示访客；协议改动。

## 关键选择

- 广告位不是目的地，展示只算路过：用户决定，已在设计文档的争议讨论里记录，没有单独的决策记录，因为这是玩法设计而不是技术选型。
- 普通游客与工作游客用同一套选法：工作游客的路线只是固定的站序，不另写一套规则。

## 验收条件

- [x] 广告位不被选为目的地，哪怕展示的内容很多（单元测试 `test_an_ad_slot_is_never_somewhere_to_go_however_much_it_shows`）。
- [x] 普通游客去工作空间和展示游戏的游戏厅，并在门口付费（`test_a_workspace_is_a_venue_visitors_go_to_too`、`test_a_visitor_off_the_route_goes_to_a_venue_and_pays_the_fee_there`）。
- [x] 路过有内容的广告位计入展示；场馆里的停留不计（`test_a_visitor_who_stays_at_a_venue_stays_for_its_dwell_and_counts_no_view`、路过类测试保留）。
- [x] 没有可去的场馆时访客闲逛，不卡住（`test_visitors_roam_when_nothing_is_worth_seeing_and_stay_on_the_map`）。
- [x] 提示词与工具说明与新规则一致（`test_system_prompt.py` 中的新断言）。
- [x] 审查发现的“离开场馆后立即回去”已修复：排除刚离开的场馆（`test_a_visitor_does_not_go_straight_back_to_the_venue_it_has_just_left`）。

## 验证证据

- 服务端 `make verify`：通过（ruff、ruff format、mypy strict、1208 个 pytest）。
- 集成测试 `test_the_scripted_bots_tour_the_map_buy_a_parcel_and_build_ad_slots_nobody_passes`：断言从“赞助商付款 > 0”改为“= 0”。已单独核对：该场景里没有场馆，访客 51 个都在闲逛，浏览量 0，赞助商付款 0，与规则一致。
- 独立审查（子 Agent，只读，两轮）：发现 1 个确认的问题（同一场馆背靠背进门，200 个种子的模拟里 393 对相邻进门中 286 对，约 73%，每次都收门票），已修复；其余为 README 过时、提示词硬编码、两条空转断言和措辞，均已处理。修复后同一模拟里背靠背进门为 0，只去一个场馆的访客为 0（审查方的脚本重跑）。
- 未执行：客户端 `npm run verify`（本次没有改应用代码）；`python3 scripts/check_repo.py` 在文档改完后执行，结果见下方补充。

## 交接

- 脚本机器人只建广告牌，没有收入；是否让它也建工作空间或游戏厅，需要用户定。
- `docs/design/venues.md` 的快进模拟数字（入场费 8331、赞助商 11769）是旧规则下的，已标注过时；新规则下的数字尚未重跑。
- 服务端提交：09ebcae。它的提交说明写的是"三个行为问题"，实际是一个行为问题加几处描述问题；提交后不改已有提交，这里如实记录。
- 待用户确认：全城只有一个场馆时，普通游客离开它后闲逛，不回到同一场馆（`_pick` 没有候选，走闲逛分支，仍按 stops_left 结束）。是否接受这种行为？
- 测试区分力：停留场馆的测试放的广告位与场馆相邻，中心距离恰为 VIEW_RADIUS，在边界上不计入；这个测试对"停留时计入附近广告"不敏感，属于 P3，接受。
