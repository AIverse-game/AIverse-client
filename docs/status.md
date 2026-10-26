# 当前项目状态

更新：2026-10-26。阶段：权威逻辑改由 Python 服务端负责，已实现正方形坐标地图的生成与渲染；玩法规则尚未在新服务端中实现。

## 已具备

- [AIverse 总体设计 v0.1](design/game-overview.md)：以玩家自带模型 API 驱动居民，进行生产和交易，最终按金币排名。规则和数值尚待原型验证；地图部分已按决策 0002 调整。
- Python 服务端（与本仓库同级的 `aiverse-server` 目录，[决策 0002](decisions/0002-python-server-and-coordinate-map.md)）：FastAPI WebSocket `/ws`，生成固定布局的 100 × 100 连续坐标地图和 4 名居民，校验坐标与客户端消息。
- 网页客户端（[变更 0005](../changes/0005-coordinate-map.md)）：经 WebSocket 读取地图并校验，Phaser 绘制地图、刻度、居民及指针坐标，侧栏列出地图边长和居民坐标；服务端不可达时显示错误。见 [应用架构](architecture.md)。
- 2.5D 地图（[变更 0006](../changes/0006-perspective-map.md)）：参考《饥荒》的固定透视视角，地块转 45° 并露出土层，居民是带影子的站立小人，按远近缩放和遮挡。
- 只做检查的 CI 工作流（仓库检查与 `npm run verify`）。
- Codex 与 Claude Code 共用开发规则、开发与审查 Skill、变更与决策模板。
- 本地 Git 仓库，分支为 `main`，未配置远程仓库；`aiverse-server` 是独立的 Git 仓库，同样只在本地。

## 当前可用命令

```sh
# aiverse-server 目录
uv sync
uv run aiverse-server           # 启动服务端，127.0.0.1:8000
make verify                     # ruff、mypy、pytest

# 本仓库
npm install
npm run dev                     # 网页开发服务器，/ws 代理到服务端
npm run verify                  # 类型检查、ESLint（含分层规则）、Vitest、生产构建
python3 scripts/check_repo.py   # 仓库骨架检查
make verify                     # 仓库检查加 npm run verify
```

验证证据见 [变更 0005](../changes/0005-coordinate-map.md) 与 [变更 0006](../changes/0006-perspective-map.md)。

## 尚未实现或未验证

- 居民移动（速度、目标坐标）、回合时钟、地点与物品、生产与交易、系统收购、公开消息：五区域版本的 TypeScript 实现已删除，需要在 Python 服务端重新实现。旧代码见提交 `11d852a`。
- 房间、准备流程、身份认证、Origin 检查、消息大小限制、断线重连、真实大模型接入、事件记录与复盘、正式美术（当前地面和居民都是程序绘制）、镜头旋转与缩放。
- 尚无自动的跨语言协议契约测试，靠客户端运行时校验和端到端实测发现不一致。
- 浏览器实测覆盖 1400 px 与 520 px 宽度；390 px 手机宽度、鼠标悬停显示指针坐标、`vite preview` 代理未实测。
- CI 工作流尚未在 GitHub 上实际运行；服务端检查不在本仓库 CI 内。

## 待决定的设计问题

- **移动规则**：每回合可移动的最大距离、是否按直线移动、是否有障碍物，以及 AI 指定目标的方式（坐标还是地点）。
- **地点与经济的关系**：五个功能区域已取消，采集、制作、休息、交易在哪里进行需要重新设计，再决定地点如何放在地图上。
- **他人信息的可见粒度**与**开局权限**：沿用上一版的待定问题，接入回合和房间时需要决定。

## 后续工作

建议先定下移动规则和地点设计，再在 Python 服务端实现回合时钟与移动，然后恢复生产切片。这是建议，尚未执行。
