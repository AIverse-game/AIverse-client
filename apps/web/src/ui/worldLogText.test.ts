import type { WorldLogEntryView } from '@aiverse/protocol';
import { describe, expect, it } from 'vitest';
import { describeWorldLogEntry, worldLogPlainText } from './worldLogText';

const NAMES: Record<string, string> = { a: '甲', b: '乙' };
const nameOf = (id: string) => NAMES[id] ?? id;

function sentence(entry: Omit<WorldLogEntryView, 'seq' | 'time'>): string {
  return worldLogPlainText(describeWorldLogEntry({ seq: 1, time: 0, ...entry }), nameOf);
}

describe('describeWorldLogEntry', () => {
  it('says who whispered what to whom', () => {
    expect(sentence({ verb: 'said', actorId: 'a', otherId: 'b', text: '卖你算力' })).toBe('甲 对 乙 说：卖你算力');
  });

  it('says how many heard words spoken aloud', () => {
    expect(sentence({ verb: 'said', actorId: 'a', text: '有人吗？', quantity: 2 })).toBe('甲 当众说（2 人听到）：有人吗？');
  });

  it('names the parcel and price of land bought', () => {
    const bought = sentence({ verb: 'bought_parcel', actorId: 'a', parcelId: 'L3-4', quantity: 9, coins: 2400 });

    expect(bought).toBe('甲 花 2,400 金币 买下 L3-4 所在街区（9 块地）');
  });

  it('names the facility started and finished', () => {
    expect(sentence({ verb: 'started_building', actorId: 'a', parcelId: 'L3-4', facility: 'game_hall' })).toBe('甲 开始在 L3-4 建游戏厅');
    expect(sentence({ verb: 'built', actorId: 'a', parcelId: 'L3-4', facility: 'mall' })).toBe('甲 在 L3-4 的商场建成了');
  });

  it('puts an offer and its answer in the same terms', () => {
    const deal = { deal: 'purchase', item: 'ad_content', quantity: 2, coins: 30 } as const;

    const offered = sentence({ verb: 'offered', actorId: 'a', otherId: 'b', ...deal });
    const accepted = sentence({ verb: 'accepted', actorId: 'b', otherId: 'a', ...deal });

    expect(offered).toBe('甲 向 乙 出价：出 30 金币 买 2 个广告内容');
    expect(accepted).toBe('乙 接受了 甲 的收购报价：出 30 金币 买 2 个广告内容');
  });

  it('names the supplier of a contract when it is proposed and when it is answered', () => {
    const terms = { deal: 'contract', side: 'sell', item: 'ad_content', quantity: 2, coins: 40, deliveries: 3 } as const;

    const proposed = sentence({ verb: 'offered', actorId: 'a', otherId: 'b', ...terms });
    const declined = sentence({ verb: 'declined', actorId: 'b', otherId: 'a', ...terms });

    expect(proposed).toBe('甲 向 乙 提议合约：每次交付 2 个广告内容 付 40 金币，共 3 次，由 甲 供货');
    expect(declined).toBe('乙 拒绝了 甲 的合约提议：每次交付 2 个广告内容 付 40 金币，共 3 次，由 甲 供货');
  });

  it('gives a node subscription as a length of time', () => {
    const bought = sentence({ verb: 'bought_node', actorId: 'a', item: 'generative', quantity: 300, coins: 3600 });

    expect(bought).toBe('甲 花 3,600 金币 订阅了生成节点，时长 5:00');
  });

  it('tells a commission from the owner apart from one asked for by the builder', () => {
    const terms = { verb: 'offered', actorId: 'a', otherId: 'b', deal: 'commission', parcelId: 'L1-1', facility: 'ad', coins: 50 } as const;

    expect(sentence({ ...terms, side: 'buy' })).toBe('甲 委托 乙 在自己的地块 L1-1 建广告位，酬金 50 金币');
    expect(sentence({ ...terms, side: 'sell' })).toBe('甲 申请在 乙 的地块 L1-1 建广告位，酬金 50 金币');
  });

  it('keeps residents apart from the words so the panel can colour them', () => {
    const parts = describeWorldLogEntry({ seq: 1, time: 0, verb: 'said', actorId: 'a', otherId: 'b', text: 'hi' });

    expect(parts).toEqual([{ residentId: 'a' }, ' 对 ', { residentId: 'b' }, ' 说：hi']);
  });
});
