# 决策记录

用于记录会影响后续维护的重要选择，例如运行时、依赖边界、协议兼容、数据存储或部署方式。普通实现细节无需单独写记录。

使用 [模板](TEMPLATE.md)，保存为 `NNNN-short-title.md`。状态明确标为提议、采用、替代或撤销。更改已采用决定时，保留原依据并链接替代记录。

| 记录 | 状态 | 主题 |
| --- | --- | --- |
| [0001-web-stack-and-layering](0001-web-stack-and-layering.md) | 采用，部分已替代 | 网页端技术栈、分层与依赖方向 |
| [0002-python-server-and-coordinate-map](0002-python-server-and-coordinate-map.md) | 采用 | Python 权威服务端与连续坐标地图 |
| [0003-event-driven-agents-and-openrouter](0003-event-driven-agents-and-openrouter.md) | 采用，部分已替代 | 事件驱动的 AI 居民与 OpenRouter 模型接入 |
| [0004-player-configured-llm-endpoints](0004-player-configured-llm-endpoints.md) | 采用 | 玩家在页面配置任意 OpenAI 兼容的模型接口，服务端配置文件可以覆盖 |
| [0005-shared-agent-rules-in-each-repo](0005-shared-agent-rules-in-each-repo.md) | 已替代 | 两个仓库各存一份 Agent 规则，放在 `.agents/rules/`，由客户端检查比较 |
| [0006-independent-agent-rules-per-repo](0006-independent-agent-rules-per-repo.md) | 采用 | 每个仓库有自己的 Agent 规则，通用内容可以一致但不强制同步 |

仓库检查脚本使用 Python，与服务端使用 Python 无关，两者各自独立。
