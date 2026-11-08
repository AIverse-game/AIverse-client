# 文件命名与目录约定

规则从现有代码整理而来，不符合的文件已在 [变更 0024](../../changes/0024-descriptive-module-names.md) 中改名；新增、移动或重命名文件时遵循本文。分层与依赖方向见 [应用架构](../../docs/architecture.md)，本文只管文件叫什么、放在哪里。

## 通用原则

- **名字说明内容是什么**：用领域名词或名词短语，只看路径就能说出里面主要是什么，例如 `ui/RankingPanel.tsx`、`render/layout.ts`、`ui/savedLLMSettings.ts`。以下几种名字不合格：
  - **只写用了什么技术**：`react.tsx`、`http.ts` 只说明依赖，没说明是什么东西；应按内容写成 `storeContext.tsx`。
  - **只有形容词或限定词**：`saved.ts` 缺少被修饰的名词；应写成 `savedLLMSettings.ts`。
  - **和领域概念撞名**：名字已经是游戏里的一个概念（如居民、合约、收购点）时，不用它命名别的东西。
  - **泛名**：`utils`、`helpers`、`common`、`misc`、`manager`、`stuff`；确实是共用的小函数，按它们服务的主题命名，例如 `format.ts`。
- **与主要导出对应**：文件以一个类、组件或函数为主时，文件名与它同名，例如 `MapRenderer` 在 `render/MapRenderer.ts`、`RankingPanel` 在 `ui/RankingPanel.tsx`。自检方法：不打开文件，能否从路径说出里面主要的类或函数。
- **不带版本和状态**：不用 `new`、`old`、`v2`、`temp`、`final`、`backup` 等后缀，历史交给 Git。
- **字符**：只用 ASCII 字母、数字、`-`、`_` 和 `.`，不用空格、中文和其他符号。大写只用于下文列出的情况（组件与类、camelCase 中的词首、约定文件名）。
- **跟随邻居**：本文没覆盖的情况，按同一目录现有文件的写法；同一目录里不混用两种风格。
- **一个文件一个职责**：一个文件放一个组件、一个类或一组紧密相关的函数。文件明显承担了两件事，或长到难以通读（经验上超过约 500 行）时，考虑按职责拆分，不按行数机械切割。

## 命名规则

### TypeScript（`apps/`、`packages/`）

| 内容 | 规则 | 示例 |
| --- | --- | --- |
| React 组件 | PascalCase，与导出的组件同名，扩展名 `.tsx` | `ui/RankingPanel.tsx` 导出 `RankingPanel` |
| 主要导出是类的模块 | PascalCase，与类同名 | `render/MapRenderer.ts` 导出 `MapRenderer` |
| React hook | `use` 开头的 camelCase，与 hook 同名 | `ui/useSecondTick.ts` |
| 其他模块 | camelCase 名词或名词短语；含 JSX 时用 `.tsx`，否则用 `.ts` | `render/layout.ts`、`ui/savedLLMSettings.ts`、`state/storeContext.tsx` |
| 测试 | 与被测模块同目录，`<模块名>.test.ts` | `state/store.test.ts` |
| 包入口 | `src/index.ts`，只做再导出 | `packages/protocol/src/index.ts` |
| 环境类型声明 | `*.d.ts`，只用于声明运行环境 | `vite-env.d.ts` |
| 样式 | kebab-case `.css` | `styles.css` |
| 包 | 包名 `@aiverse/<kebab-case>`，目录名与包名后缀相同 | `packages/protocol` 即 `@aiverse/protocol` |

缩写在名字中保持全大写（`LLMSettings`、`savedLLMSettings`）；位于 camelCase 开头时整体小写（`llmSettings`）。

### 仓库脚本

`scripts/` 中的工具脚本用 Python 写，文件名 snake_case、动词开头，例如 `scripts/check_repo.py`。

### 资源与配置

| 内容 | 规则 | 示例 |
| --- | --- | --- |
| 贴图等资源 | kebab-case，按用途分子目录；同一资源的派生版本加后缀 | `assets/chips/mk1.png` 与小图 `mk1-icon.png` |
| 工具规定名称的文件 | 按工具要求，不改名 | `package.json`、`Makefile`、`vite.config.ts`、`eslint.config.js` |

### 文档

| 内容 | 规则 | 示例 |
| --- | --- | --- |
| 一般文档 | kebab-case `.md` | `docs/code-map.md` |
| 约定文件 | 全大写，名称固定 | `README.md`、`AGENTS.md`、`CLAUDE.md`、`TEMPLATE.md`、`SKILL.md` |
| 变更说明、决策记录 | `NNNN-short-title.md`：四位编号在所在目录内递增，不跳号、不复用；标题用两到五个英文单词的 kebab-case | `changes/0021-server-subpackages.md` |
| 设计文档 | `short-title.md`，不编号，以功能命名，随功能持续修改 | `docs/design/ai-residents.md` |
| Agent 规则 | `.agents/rules/<主题>.md`，kebab-case | `.agents/rules/testing.md` |
| Skill | `.agents/skills/<动词-名词>/SKILL.md` | `implement-change/SKILL.md` |

编号记录一经建立不改名、不改号：其他文档和提交说明都按文件名引用它们。

## 目录结构

### 顶层

| 位置 | 内容 |
| --- | --- |
| `apps/<应用>/` | 可运行的应用，目前只有 `apps/web` |
| `packages/<包>/` | 被应用使用的共享包，目前只有跨端协议 `packages/protocol` |
| `docs/` | 项目本身的知识：架构、状态、代码地图；`docs/design/` 功能设计，`docs/decisions/` 决策记录 |
| `changes/` | 单次变更说明与证据 |
| `scripts/` | 仓库工具脚本，不放应用代码 |
| `.agents/rules/` | 给 Agent 的工作规则：开发流程、命名与目录、测试 |
| `.agents/skills/` | Codex 与 Claude Code 共用的 Skill |

### 新文件放在哪里

1. **先找已有目录**：按层放进 `apps/web/src/` 的 `net/`、`state/`、`render/`、`ui/`、`assets/`；与服务端之间的消息与视图类型只放 `packages/protocol`。归属以 [应用架构](../../docs/architecture.md) 为准。
2. **新建目录要有理由**：已有目录的职责明显不符，且新主题会有不止一个文件时才新建，不为单个文件建目录。新建应用或共享包时，同时更新 [应用架构](../../docs/architecture.md) 和 [代码地图](../../docs/code-map.md)；改变分层或依赖方向时先写决策记录。
3. **测试跟着源码**：测试与被测模块放在同一目录。
4. **有索引的文档目录**：`changes/`、`docs/decisions/`、`docs/design/` 各有 `README.md`（规则与索引）和 `TEMPLATE.md`；新增文档时在同一次改动中更新索引。
5. **不进仓库的东西**：构建产物（`dist/`、`build/`）、缓存、日志、本地配置与密钥，由 `.gitignore` 排除；新增此类产物时同步补忽略规则。

## 新增、移动与重命名

- 新增、移动或重命名文件时，在同一次改动中更新 [代码地图](../../docs/code-map.md)，以及引用该路径的架构说明、README 和注释；`python3 scripts/check_repo.py` 会报告失效的本地链接，但不检查行内代码中的路径。
- 重命名属于重构：单独成一次提交，不与功能或缺陷修复混在一起；用 `git mv` 保留历史，导入与引用一并改完，检查照常通过。
- 不为符合本文而批量改名现有文件；确有必要时作为单独的重构任务处理。

## 代码中的名字（摘要）

文件名之外，代码标识遵循 TypeScript 惯例与现有代码：

| 场景 | 规则 | 示例 |
| --- | --- | --- |
| 变量、函数 | camelCase | `loadLLMSettings` |
| 类型、类、组件 | PascalCase | `GameConnection`、`MapRenderer` |
| 模块级常量 | UPPER_SNAKE_CASE | `CANVAS_WIDTH` |
| 协议 JSON 键 | camelCase，与服务端约定一致 | `protocolVersion` |
| 协议中的消息与原语类型值 | snake_case，与服务端约定一致 | `move_to`、`start_agent` |

## 检查方式

目前没有自动检查文件命名；ESLint 未启用命名规则。开发时按本文自查，审查时把违反本文的新文件名或位置作为问题提出。
