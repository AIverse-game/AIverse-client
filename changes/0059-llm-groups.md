# 0059：按居民分组的模型接口

状态：已完成。

## 目标与依据

用户 2026-11-04 要求：“能不能在测试的时候支持用两个 api，分别给一半的居民用”。以前服务端配置文件只有一套 `override`，对所有由模型驱动的居民生效，没法让不同居民用不同的接口。居民增至 8 名（[0058](0058-eight-residents.md)）后，一个免费接口也更容易被限流。

可观察的变化：

- 服务端 `llm.yml` 新增可选的 `groups`。每组用 `residents` 列出居民 id，再填任意几项 `base_url`、`api_key`、`model`。组里填了的项代替 `override` 的同名项，只对所列居民生效；没填的项仍用 `override`，没进任何组的居民照旧。
- 命令行 `--agent 居民=llm[:模型]` 和页面“交给 AI”都按居民所在的组取设置。
- 页面 `welcome` 的 `llmOverrides` 只列对每名居民都固定了的设置。两组和 `override` 合起来把三项都填全时，页面上只需点“交给 AI”。
- 组里只换了 `base_url`、没写 `api_key` 时，会用 `override` 的 key 发到组的地址；两组是不同服务商时要各写各的 key。
- 一名居民被列了不止一次（同组或不同组）、组里写了未知的设置名、`residents` 为空，都会让启动报错；组里列了地图上没有的居民，启动时也报错。错误信息不显示 key。

```yaml
override:
  max_tokens: 8192
groups:
  - residents: [r1, r2, r3, r4]
    base_url: https://openrouter.ai/api/v1
    api_key: sk-...
    model: nvidia/nemotron-3.5-super-vl:free
  - residents: [r5, r6, r7, r8]
    base_url: https://other.example/v1
    api_key: sk-...
    model: other-model
```

## 范围

服务端（`aiverse-server`）：

- `server/config.py`：`LLMGroup`、`Config.groups`（不能重复列同一名居民）、`Config.resident_overrides`（每名居民在组里的设置，叠在 `override` 上）。
- `server/app.py`：`Game` 和 `create_app` 多一个 `resident_llm_overrides` 参数，`Game.llm_override_for` 按居民取设置，`Game.fixed_llm_settings` 给 `welcome`；列了未知居民时 `create_app` 报错。
- `__main__.py`：`--agent` 按居民取设置，组里列了未知居民时报错。
- `agents/config/llm.example.yml`：注释掉的分组示例。
- 测试：`tests/unit/server/test_config.py`（分组读取、key 不进 repr、各种错误），`tests/integration/server/test_agent_control.py`（两组居民各用自己的接口、`welcome` 只列对每人都固定的设置、每人都在组里且 `override` 不填连接项时三项都算固定、未知居民报错）。
- `README.md`：配置文件一节。

客户端：页面不用改。文档：本说明、[AI 居民](../docs/design/ai-residents.md)、`docs/status.md`。

协议未改。

设计文档：修改 [AI 居民](../docs/design/ai-residents.md)的服务端配置文件一条。

## 关键选择

- **按名单分组，不自动对半分**：Claude 决定。组里明确列出居民，可以任意比例分，也能给个别居民换模型做对比；自动对半分的规则说不清奇数人数或以后人数变化时怎么办。
- **组叠在 `override` 上**：共用的项（比如 `max_tokens`，或两组同一个模型）只写一次。`max_tokens` 仍是全局共用，不按组设，与“所有请求共用一个上限”的现有约定一致。
- **`welcome` 取交集**：页面只知道一份“哪些项已固定”。取所有居民都固定了的项，页面不会把某名居民实际还需要填的项置灰。交集按每名居民实际的设置算，所以每个人都在组里时 `override` 不填连接项也行；出局的居民也算在内，结果整局不变。

## 验收条件

- [x] 两组居民交给模型时，各自用自己组的地址、key 和模型；不在组里的居民用 `override`。
- [x] 重复列出居民、未知设置名、空名单、未知居民都会报错，错误信息不显示 key。
- [x] `welcome` 只列对每名居民都固定的设置。
- [ ] 用两套真实接口跑一局 8 人对局。

## 验证证据

- 服务端 `make verify`：ruff、mypy strict、pytest 1151 个全部通过。
- 客户端 `npm run verify`（代码未改）与 `python3 scripts/check_repo.py` 通过。
- 示例配置仍不覆盖任何设置；本机现有的 `llm.yml` 仍能读取（没有 `groups`）。

## 交接

- 本机的 `llm.yml` 含 key、被 Git 忽略，没有替用户改。要用时照 `llm.example.yml` 的注释加 `groups`。
- 没有用两套真实接口跑过对局。
