import type { ContractProposalView, OfferView } from '@aiverse/protocol';
import { describe, expect, it } from 'vitest';
import { describeOffer, describeProposal, describeTerms, formatItems } from './dealText';

const names: Record<string, string> = { a: '甲', b: '乙' };
const nameOf = (id: string) => names[id] ?? id;

const offer: OfferView = { eventId: 1, side: 'sell', fromId: 'b', toId: 'a', item: 'token', quantity: 5, price: 80 };

const proposal: ContractProposalView = {
  eventId: 2,
  fromId: 'a',
  toId: 'b',
  supplierId: 'b',
  buyerId: 'a',
  item: 'token',
  quantity: 10,
  price: 100,
  deliveries: 3,
  durationSeconds: 90,
};

describe('deal text', () => {
  it('counts tokens and other items differently', () => {
    expect(formatItems('token', 30)).toBe('30 token');
    expect(formatItems('MK1', 1)).toBe('1 个 MK1');
  });

  it('says who sells or buys what for how much', () => {
    expect(describeOffer(offer, nameOf)).toBe('乙 以 80 金币卖给 甲 5 token');
    expect(describeOffer({ ...offer, side: 'buy', fromId: 'a', toId: 'b' }, nameOf)).toBe('甲 出 80 金币买 乙 的 5 token');
  });

  it('states contract terms from the supplier and buyer, whoever proposed them', () => {
    expect(describeTerms(proposal, nameOf)).toBe('乙 每交付 10 token，甲 付 100 金币');
    expect(describeProposal(proposal, nameOf)).toBe('乙 每交付 10 token，甲 付 100 金币，最多 3 次，签订后 1:30 内有效');
    expect(describeProposal({ ...proposal, deliveries: 1, item: 'MK2', quantity: 1 }, nameOf)).toBe(
      '乙 每交付 1 个 MK2，甲 付 100 金币，一次性，签订后 1:30 内有效',
    );
  });

  it('falls back to the id of a resident it does not know', () => {
    expect(describeOffer({ ...offer, fromId: 'z' }, nameOf)).toBe('z 以 80 金币卖给 甲 5 token');
  });
});
