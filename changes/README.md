# 变更记录

实质功能、规则、协议或架构改动先写简短变更说明，完成后在同一文件记录实际证据。简单文档修订不要求另开记录。

复制 [TEMPLATE.md](TEMPLATE.md)，用递增编号与明确名称保存。不要把未执行的检查写成通过，也不要在模板里预填成功结果。

| 记录 | 状态 | 目的 |
| --- | --- | --- |
| [0001-agent-preparation](0001-agent-preparation.md) | 已完成 | 本次开发准备与验收证据 |
| [0002-development-review-skills](0002-development-review-skills.md) | 已完成 | 拆分开发与审查职责，明确调用和交接 |
| [0003-game-design](0003-game-design.md) | 已完成（设计文档） | AIverse 总体游戏设计与最小可玩版本提案 |
| [0004-web-foundation](0004-web-foundation.md) | 已完成 | 网页端底层框架、分层与 GitHub Pages 部署 |
| [0005-coordinate-map](0005-coordinate-map.md) | 已完成 | Python 服务端生成正方形坐标地图，网页按坐标渲染 |
| [0006-perspective-map](0006-perspective-map.md) | 已完成 | 参考《饥荒》的 2.5D 透视地图 |
| [0007-action-primitives](0007-action-primitives.md) | 已完成 | 操作原语系统，首个原语“移动到坐标”，页面可手动操作 |
| [0008-resident-inventory](0008-resident-inventory.md) | 已完成 | 居民持有物品：容量无限、只在局内有效，服务端内部的增删查接口 |
| [0009-event-queue](0009-event-queue.md) | 已完成 | 事件系统框架：居民之间的请求排队等待同意、拒绝或撤回，事件种类可扩展 |
| [0010-trade-offers](0010-trade-offers.md) | 已完成 | 购买与出售：任一方发起报价并预留自己的一份，对方同意后物品换金币 |
