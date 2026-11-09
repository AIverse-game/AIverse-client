# 0085：Agent 居民的机器人形象与四个状态

状态：已完成（服务端 `make verify` 和客户端 `npm run verify` 通过，独立审查没有确认的缺陷；浏览器核对了待机、思考、说话，开心状态没有截图）。

## 目标与依据

用户（2026-11-08）：前端给 Agent 居民增加建模和特效，移植 `demos/floating_ai_agent_movement.html`，只对 Agent 居民生效，游客仍是方块人；有待机、思考、说话、开心四个状态（待机是原地不动，思考是等大模型，说话是和别人交流含报价，开心是报价被同意、建筑成功之类）；机器人比游客稍大。范围由用户选定为前后端都改。

## 范围

- 服务端（`aiverse-server`，单独提交）：`AgentView` 加可选 `thinking`、`cue`；`game/cues.py`；`Game` 记提示与思考，`runner.py` 设置思考；README；测试。协议版本不变。
- 客户端协议：`packages/protocol` 的 `agent.thinking`、`agent.cue` 校验与测试。
- 页面：`render/agentRobot.ts`、`render/agentMood.ts`（及测试）、`ResidentLayer.ts` 接入。
- 设计文档：新建 [Agent 居民的机器人形象](../docs/design/agent-robot.md)。
- 不做：见设计文档“暂未实现的功能”。

## 验收条件

- [x] 有 `agent` 的居民画成机器人，其他居民仍是方块人；机器人比方块人大（浏览器截图）。
- [x] 思考：服务端在大脑一轮期间带 `thinking`（`test_app.py`）；页面显示思考姿态（截图）。
- [x] 说话与开心：说话、报价算说话，同意报价双方开心，设施建成主人开心（`test_cues.py`）；页面按新 `seq` 播放、不重播旧提示（`agentMood.test.ts`）。
- [x] 说话姿态在截图里看到；开心姿态没有截图。
- [x] 旧页面不受影响：新字段可选，`thinking` 为假时省略，原有集成测试不变。

## 验证证据

- 服务端 `make verify`：通过（ruff、ruff format、mypy strict、1248 个 pytest）。
- 客户端 `npm run verify`：通过（类型检查、ESLint、测试、构建）。
- 浏览器：服务端用临时脚本（放在会话临时目录，不入库）让四名 Agent 居民分别一直思考、每 6 秒说话、每 6 秒开心、待机，`vite` 连到它，用无头 Chrome（swiftshader）截图：看到思考（一圈方块绕头、手托下巴）和说话（脸上声波）的机器人，大小比旁边的方块人略大，名字标签位置合适。开心的机器人被树挡住，重拍时无头 Chrome 卡住，没有再拍。
- 独立审查（子 Agent，只读，一轮）：没有确认的缺陷。确认项是测试缺口（开心提示和停止后清除思考没有经 `Game` 测到），已补测试。留下的疑点未处理：思考标记按居民 id 而不是按 runner 记，替换 Agent 时若旧大脑的取消清理很慢，旧 runner 的清除可能晚于新 runner 的设置（现有大脑没有这种清理，不会发生）；`_cues` 也给非 Agent 居民记提示，不会显示，数量受居民数限制；慢连接上合并掉的快照可能让很短的演出看不到，只影响观感。
- 未执行：开心姿态的截图；真实大模型对局里的状态；多个机器人同时存在时的帧率（每个机器人约 60 个网格，没有点光源）。

## 交接

- 协议版本不变，新字段可选；服务端要重启才带上它们。
- 设计文档、`docs/status.md`、`docs/code-map.md`、设计文档索引和本变更索引已更新。
