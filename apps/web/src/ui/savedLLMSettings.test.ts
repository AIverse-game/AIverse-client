import { describe, expect, it } from 'vitest';
import { loadLLMSettings, saveLLMSettings } from './savedLLMSettings';

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const items = new Map(Object.entries(initial));
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  };
}

describe('saved model settings', () => {
  it('remembers settings per resident and offers the latest to others', () => {
    const storage = memoryStorage();
    expect(loadLLMSettings('a', storage)).toEqual({});
    saveLLMSettings('a', { baseUrl: 'https://x/v1', apiKey: 'k', model: 'm1' }, storage);
    saveLLMSettings('b', { baseUrl: 'https://y/v1', apiKey: 'k2', model: 'm2' }, storage);
    expect(loadLLMSettings('a', storage)).toEqual({ baseUrl: 'https://x/v1', apiKey: 'k', model: 'm1' });
    expect(loadLLMSettings('c', storage)).toEqual({ baseUrl: 'https://y/v1', apiKey: 'k2', model: 'm2' });
  });

  it.each([['not json'], ['[1, 2]'], ['{"latest": {"apiKey": 7, "model": "m"}, "byResident": "x"}']])(
    'survives a broken entry: %s',
    (stored) => {
      const storage = memoryStorage({ 'aiverse.llmSettings': stored });
      const loaded = loadLLMSettings('a', storage);
      expect(loaded.apiKey).toBeUndefined();
      saveLLMSettings('a', { model: 'm' }, storage);
      expect(loadLLMSettings('a', storage)).toEqual({ model: 'm' });
    },
  );

  it('does nothing without storage', () => {
    expect(loadLLMSettings('a', null)).toEqual({});
    expect(() => saveLLMSettings('a', { model: 'm' }, null)).not.toThrow();
  });

  it('keeps going when storage refuses to save', () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new Error('quota exceeded');
    };
    expect(() => saveLLMSettings('a', { model: 'm' }, storage)).not.toThrow();
  });
});

it('restores a different strategy for each resident after saving', () => {
  const storage = memoryStorage();

  saveLLMSettings('a', { model: 'm', strategy: '稳健经营' }, storage);
  saveLLMSettings('b', { model: 'm', strategy: '抢泉优先' }, storage);

  expect(loadLLMSettings('a', storage).strategy).toBe('稳健经营');
  expect(loadLLMSettings('b', storage).strategy).toBe('抢泉优先');
});
