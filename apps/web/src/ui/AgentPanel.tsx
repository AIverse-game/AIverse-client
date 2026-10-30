import type { LLMSettingName, LLMSettings, ResidentId } from '@aiverse/protocol';
import { useState, type FormEvent } from 'react';
import { useGameState, useStore } from '../state/react';
import type { ActionStatus } from '../state/store';
import { loadLLMSettings, saveLLMSettings } from './savedLLMSettings';

const FIELDS: { name: LLMSettingName; label: string; placeholder: string; type: 'url' | 'password' | 'text' }[] = [
  { name: 'baseUrl', label: 'API 地址', placeholder: 'https://…/v1', type: 'url' },
  { name: 'apiKey', label: 'API Key', placeholder: '只保存在本机浏览器', type: 'password' },
  { name: 'model', label: '模型', placeholder: '服务商的模型名', type: 'text' },
];

/**
 * Hands the selected resident to a language model the player chooses, or takes them back.
 * Any provider with an OpenAI-compatible chat completions API will do; none is built in.
 * Settings the server's config overrides need not be filled in.
 */
export function AgentPanel() {
  const store = useStore();
  const { world, selected, llmOverrides, agentRequests } = useGameState();
  // Edits per resident, until sent; before any, what this browser remembered for them.
  const [drafts, setDrafts] = useState<Record<ResidentId, LLMSettings>>({});
  if (!world) return null;
  const resident = world.residents.find((candidate) => candidate.id === selected) ?? null;
  if (!resident) {
    return (
      <section className="panel">
        <h2>AI 驱动</h2>
        <p className="muted small">先在居民列表或地图上点选一名居民，再把它交给大模型。</p>
      </section>
    );
  }
  const draft = drafts[resident.id] ?? loadLLMSettings(resident.id);
  const overridden = (name: LLMSettingName) => llmOverrides.includes(name);
  const canAct = store.canAct(resident.id);
  const filled = FIELDS.every(({ name }) => overridden(name) || Boolean(draft[name]?.trim()));
  const request = agentRequests[resident.id];
  const pending = request?.status === 'pending';

  const edit = (name: LLMSettingName, value: string) =>
    setDrafts((current) => ({ ...current, [resident.id]: { ...draft, [name]: value } }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canAct || !filled) return;
    saveLLMSettings(resident.id, draft);
    // Settings the server overrides are not sent at all; it would not use them.
    const settings: LLMSettings = {};
    for (const { name } of FIELDS) {
      const value = draft[name];
      if (!overridden(name) && value !== undefined) settings[name] = value;
    }
    store.startAgent(resident.id, settings);
  };

  return (
    <section className="panel">
      <h2>AI 驱动</h2>
      <p className="small selected">
        <span className="swatch" style={{ background: resident.color }} />
        {resident.name}：
        {resident.agent
          ? resident.agent.model
            ? `由模型 ${resident.agent.model} 驱动`
            : '由脚本机器人驱动'
          : '手动操作'}
      </p>
      <form className="agent-form" onSubmit={submit}>
        {FIELDS.map(({ name, label, placeholder, type }) => (
          <label key={name}>
            {label}
            <input
              type={type}
              autoComplete="off"
              spellCheck={false}
              disabled={!canAct || overridden(name)}
              placeholder={overridden(name) ? '由服务端配置指定' : placeholder}
              value={overridden(name) ? '' : (draft[name] ?? '')}
              onChange={(event) => edit(name, event.target.value)}
            />
          </label>
        ))}
        <div className="agent-buttons">
          <button type="submit" disabled={!canAct || !filled || pending}>
            {resident.agent ? '按此配置重新交给 AI' : '交给 AI'}
          </button>
          {resident.agent && (
            <button type="button" className="stop-agent" disabled={pending} onClick={() => store.stopAgent(resident.id)}>
              停止 AI，改为手动
            </button>
          )}
        </div>
      </form>
      {request && <AgentStatusLine status={request} />}
      <p className="muted small">
        接口需兼容 OpenAI 的 Chat Completions 并支持工具调用，API 地址填到 /v1 一级，服务端会在后面加 /chat/completions。
        配置保存在本机浏览器，key 会发给服务端用来调用接口，不会写进日志。由 AI 驱动时手动操作仍然有效。
      </p>
    </section>
  );
}

function AgentStatusLine({ status }: { status: ActionStatus }) {
  switch (status.status) {
    case 'pending':
      return <p className="muted small" role="status">提交中…</p>;
    case 'accepted':
      return <p className="muted small" role="status">已生效</p>;
    case 'rejected':
      return <p className="error small" role="alert">未生效：{status.reason}</p>;
  }
}
