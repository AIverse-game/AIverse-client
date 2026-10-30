# 0022：页面配置任意大模型接口与服务端覆盖配置

状态：已完成。

## 目标与依据

变更 0020 只接了 OpenRouter：服务端的大脑叫 `OpenRouterBrain`，地址写死，key 只从环境变量 `OPENROUTER_API_KEY` 读，模型只能由启动参数指定。用户指出玩家可能接入任何厂商的大模型 API，并决定（2026-10-29）：

- 不内置任何厂商的预设；
- 在页面上接收用户的配置：选中一名居民，填写 API 地址、key 和模型，交给 AI 驱动（目前没有多玩家，由一个人在页面上模拟）；
- 服务端增加一个 YAML 配置文件，可以指定覆盖用的 API 地址、key 和模型，填了的项全局代替页面上填的；
- 页面上填的 key 记在本机浏览器的 localStorage；
- 启动参数保留 `--agent 居民=scripted`，模型改为 `--agent 居民=llm[:模型]`，地址和 key 来自配置文件。

## 范围

- 服务端：`agents/openrouter.py` 改为通用的 `agents/llm.py`（OpenAI 兼容的 Chat Completions 接口，地址、key、模型都由调用方给出）；新增 `server/config.py` 读取 YAML 配置文件（`--config`，默认当前目录的 `aiverse.yml`，可以没有）；`Game` 可以在运行中为居民启动、更换、停止 Agent；协议增加 `start_agent`、`stop_agent`、`agent_result`，`welcome` 告知哪些项被服务端覆盖，居民视图标出由 Agent 驱动及其模型。
- 客户端：协议包同步；`GameStore` 发送启动与停止请求、保存覆盖项和最近一次结果；新增“AI 驱动”面板。
- 不做：玩家归属与鉴权、经营方针输入、页面上的 AI 行动日志、从页面启动脚本机器人、不兼容 OpenAI 接口的服务商。

设计文档：修改 [AI 居民](../docs/design/ai-residents.md)。

## 关键选择

见 [决策 0004](../docs/decisions/0004-player-configured-llm-endpoints.md)，它替代决策 0003 中“模型接入用 OpenRouter”的部分。

## 验收条件

- [x] 页面选中居民，填写任意 OpenAI 兼容接口的地址、key、模型后点“交给 AI”，该居民由模型驱动；所有页面看到它由 AI 驱动及其模型；“停止 AI”后回到手动。
- [x] 配置文件填了覆盖项时，页面上对应的输入框显示“由服务端配置指定”，可以留空；服务端用覆盖值，不用页面填的。
- [x] 合并后缺少地址、key 或模型，或地址不是 http(s) 时拒绝并说明原因；居民不存在、已出局或游戏结束时拒绝。
- [x] key 不出现在状态、日志、`--agent-log` 记录和错误信息中；配置文件 `aiverse.yml` 不进仓库，仓库里只有示例文件。
- [x] 刷新页面后，key 等配置从 localStorage 自动填回。
- [x] `--agent r2=llm[:模型]` 用配置文件中的地址和 key；缺项时启动报错。
- [x] 服务端 `make verify`、客户端 `npm run verify` 通过；用本地模拟的 OpenAI 兼容服务在浏览器中走一遍完整流程。

## 验证证据

- 服务端 `make verify`：ruff、ruff format --check 通过，mypy strict 无错误，pytest 549 项通过。新增测试：`tests/server/test_agent_control.py`（页面启动、广播、全局与部分覆盖、各种拒绝、游戏结束、替换与停止时关闭大脑、出局后移除、命令行的 Agent、未握手、畸形输入不回显、请求的 repr 不含 key）、`tests/server/test_config.py`（读取、空文件与空节、示例文件、错误不含值、文件不存在），`tests/agents/test_agents.py` 中设置的合并与校验、只关闭自己创建的客户端、停止的循环关闭大脑、失败日志不含 key（把 `from None` 改回 `from error` 时这项失败）、服务商回显的 key 被打码、重启 Agent 不重置请求计数。
- 客户端 `npm run verify`：类型检查、ESLint、Vitest 114 项、生产构建通过；`python3 scripts/check_repo.py` 通过。
- 端到端（本机，无头 Chrome 经 DevTools 协议驱动页面；Python 写的本地模拟 OpenAI 兼容服务；服务端 8765、页面 5180，避开本机已占用的 8000、5173）：
  - 页面选中“阿青”，填写地址 `http://127.0.0.1:9100/v1`、key、模型 `fake/model-1` 后交给 AI：显示“已生效”“由模型 fake/model-1 驱动”，居民列表标出“AI”。模拟服务收到 `POST /v1/chat/completions`，带 `Bearer <页面 key>`、该模型和 11 个工具；居民按模型的 `move_to` 走向 (70, 70)。控制台与 `--agent-log` 中查不到 key。
  - 刷新页面后，设置从 localStorage 填回；没配置过的居民填上最近一次的设置。“停止 AI，改为手动”后显示手动操作，“AI”标记消失。
  - 用 `--config` 覆盖地址和 key：这两项输入框置灰，显示“由服务端配置指定”；只填模型就能交给 AI，模拟服务收到的是服务端 key 和页面填的模型。
  - `agent_result` 加上 `residentId` 后重测：交给 AI 的结果只显示在对应居民下，切换居民后不显示；停止后回到手动。
  - 命令行：`--agent r1=llm:cli/model --config x.yml` 启动后即向模拟服务发请求；缺项、YAML 中 key 不是字符串、配置文件不存在时启动报错，信息中不含值。
- 独立审查：首轮无阻断问题，确认 1 个 P2、4 个 P3，均已修复：
  - P2：停止或更换 Agent 会重置请求额度，改为由 `Game` 按居民累计；
  - P3：带换行的 key 会随 httpx 异常进日志，改为校验 key 字符且异常不串链；
  - P3：页面请求的 repr 带 key，已隐藏；
  - P3：AI 请求的结果状态不区分居民，改为按居民记录；
  - P3：设计文档索引仍写 OpenRouter，已更新。

  另外处理了两条疑点：服务商回显的 key 打码；httpx 请求日志调到 WARNING。复核确认以上修复都成立。复核又发现一个 P3：收到 `error` 后，迟到的结果可能显示在别的居民下。处理方式是让 `agent_result` 带上 `residentId`，客户端按 id 对应。
- 未执行：没有用真实的模型服务跑过；`AgentPanel` 没有组件级的自动化测试，只做了上面的浏览器实测。

## 交接

- 已知限制：
  - 没有鉴权与玩家归属，任何连接都能接管任何居民，也能让服务端用配置文件里的 key 发请求；key 在 WebSocket 上明文传输。不要监听公网地址。
  - 页面不能填经营方针，也不能从页面启动脚本机器人。
  - 不兼容 OpenAI 接口的厂商不能用。
  - 配置文件里拼错但值为空的键会被当成未填，不报错（没有实际后果）。
- 审查中记下、没有处理的极端时序（影响很小）：
  - Agent 任务还没开始运行就被取消时，它创建的 HTTP 客户端不会关闭，只会产生一条资源警告；
  - 被替换下来的旧 Agent 在服务端关闭时不被等待。
- 已更新 `docs/status.md`、代码地图、架构、AI 居民设计文档、决策 0003 与 0004，以及服务端 README。
