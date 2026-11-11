# 0098：传送门的 AI 玩法：自动出现的建门、不传送、份额持有人能建

状态：已完成（服务端 `make verify` 通过；协议与页面不变）。

## 目标与依据

上一局真实对局（8 位 AI 居民，服务端 `logs/` 的 r1～r8）没有人建传送门：`build_portal` 只能靠 `discover_tools("transport")` 调出来，而系统提示又劝人别调；提示里也没告诉居民传送门替自己赚什么。用户（2026-11-10）要求：

1. AI 居民不允许传送，只允许走路。
2. `build_portal` 在居民有空地块和空闲的生成式节点时自动出现，像 `build_ad` 那样。
3. 系统提示里写居民自己的收益：谁的门是访客的必经之路，谁就能分到过路费；不要例子，直接给过路费规则。

用户（2026-11-11）又要求：只持份额的地块也能建传送门。

可观察的变化：AI 居民没有 `teleport` 工具；有可建的地块和空闲的生成式节点时 `build_portal` 出现在工具里；份额持有人可以在地块上建门；系统提示写明访客的过路费规则。

## 范围

服务端（`aiverse-server`，提交 `d1a80f0`、本变更的第二个提交）：

- `agents/tools.py`：删 `teleport` 工具；`link_portals` 的过路费参数默认 0；`build_portal`、`link_portals` 的说明。
- `agents/tool_selection.py`：`build_portal` 按状态自动出现（两个选择器共用 `portal_room`）；`transport` 组去掉 `teleport`。
- `economy/compute.py`：`start_build_portal` 允许份额持有人建；新增 `portal_room`；`economy/portals.py`：`portal_count` 按地块主人算。
- `agents/observation.py`：`land.mine[].portal_room`。
- `agents/system_prompt.py`：过路费规则一句。
- README、测试。

不做：删掉规则层的 `Teleport` 原语和居民过路费（没有入口调用它，待用户定）；让份额持有人连线；协议与页面。

设计文档：修改 [交通：传送](../docs/design/portals.md)。

## 关键选择

- **提示只写规则，措辞按规则写**：访客每过一条线路付 1 金币，线路两端的门的持有人各分一半；写成“线路两端的门”而不是“必经之路”，因为访客自己选择走不走线路（独立审查指出）。
- **过路费参数默认 0**（Claude）：居民不传送后没人付主人定的价，不该让模型硬填一个数。
- **份额持有人能建门，上限跟着地块主人走**（用户 2026-11-11 决定能建；上限的计法是 Claude 的取舍）：一个地主名下的地块上至多 4 座，建好和在建的合计，不论谁建。起初按建造者算，独立审查指出持有人能让地主超过 4 座，已改。连线仍只有地主能做。
- `build_portal` 要“空闲的生成式节点”才自动出现，没有节点时仍可用自带算力或雇节点建，只是要经 `discover_tools("transport")`（用户的要求，Claude 照办）。

## 验收条件

- [x] AI 没有 `teleport` 工具，调用返回 `unknown_tool`，位置不变。
- [x] 有自有或持份额的空地块、空闲的生成式节点、地主名下不到 4 座时，两个选择器都给出 `build_portal`；没有节点、节点是渲染式或忙、地块被占用、被许可或场馆占用、没份额、地主已满，都不给，且真实调用被拒的原因相符。
- [x] 份额持有人能建门，外人不能；地主已满时持有人也不能建；持有人建的门算地主的数。
- [x] 不填过路费也能连线（默认 0）。
- [x] 系统提示不超上限（`test_the_base_prompt_stays_compact`）。

## 验证证据

2026-11-11，macOS，服务端：

- `make verify`（ruff、ruff format、mypy strict、pytest）通过，1396 项；新增和改写的用例在 `tests/unit/agents/test_transport_tools.py`、`tests/unit/economy/test_portals.py`。
- 变异检查（各自改动后跑相关测试，恢复后通过）：去掉在建的传送门工作的计数、去掉“节点空闲”的要求、把上限改回按建造者算，都有测试失败；起初的“排除只持份额的地块”和“按许可占用的整个范围判断”两处修复也各撤回试过，同样有测试失败（前一处后来随规则改为份额持有人可建而不再存在）。
- 独立审查（独立子 Agent，只读）三轮：第一轮发现 `selected_tool_names` 对只持份额的地块给出必被拒的 `build_portal`（P2）、`last_request_tool_names` 没算场馆许可占的整个范围（P3），已修；第二轮（份额持有人可建后）发现持有人能绕过每人 4 座上限（P2），已改成按地块主人算并加 `portal_room`；第三轮没有确认的缺陷，审查员用探针脚本核对了两个选择器与真实调用在 13 种情形下一致。
- 审查留下的疑点，不当缺陷：有别的工作在跑的地块两个选择器都隐藏 `build_portal`，真实调用其实允许（和 `build_ad`、`build_garden` 一致）；同一地块上几个门工作各算一座，计数偏高但不会让地主超过 4 座。
- 未做：没有用真实模型试玩，不知道这些改动会不会让居民真的建传送门；页面不变，没有浏览器验证。

## 交接

- 已更新 `docs/design/portals.md`、`docs/status.md`、服务端 `README.md`。
- 规则层的 `Teleport`、居民过路费、渠道 `toll`、世界日志的 `teleported` 还在，没有入口调用，是否彻底删待用户定。
- 份额持有人建好的门不在他自己的 `transport.mine` 里，也不能由他连线。
- 服务端重启后生效。
