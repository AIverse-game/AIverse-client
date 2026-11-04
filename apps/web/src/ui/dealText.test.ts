import type { ContractProposalView, OfferView } from '@aiverse/protocol';
import { describe, expect, it } from 'vitest';
import { describeDeposit, describeOffer, describeProposal, describeTerms, formatItems } from './dealText';

const names: Record<string, string> = { a: '甲', b: '乙' };
const nameOf = (id: string) => names[id] ?? id;

const offer: OfferView = { eventId: 1, side: 'sell', fromId: 'b', toId: 'a', item: 'energy', quantity: 5, price: 80 };

const proposal: ContractProposalView = {
  eventId: 2,
  fromId: 'a',
  toId: 'b',
  supplierId: 'b',
  buyerId: 'a',
  item: 'energy',
  quantity: 10,
  price: 100,
  deliveries: 3,
  durationSeconds: 90,
  deposit: 20,
};

describe('deal text', () => {
  it('counts energy and other items differently', () => {
    expect(formatItems('energy', 30)).toBe('30 能量');
    expect(formatItems('C1', 1)).toBe('1 个 C1');
  });

  it('says who sells or buys what for how much', () => {
    expect(describeOffer(offer, nameOf)).toBe('乙 以 80 金币卖给 甲 5 能量');
    expect(describeOffer({ ...offer, side: 'buy', fromId: 'a', toId: 'b' }, nameOf)).toBe('甲 出 80 金币买 乙 的 5 能量');
  });

  it('states contract terms from the supplier and buyer, whoever proposed them', () => {
    expect(describeTerms(proposal, nameOf)).toBe('乙 每交付 10 能量，甲 付 100 金币');
    expect(describeProposal(proposal, nameOf)).toBe('乙 每交付 10 能量，甲 付 100 金币，共 3 次，签订后 1:30 内交完，乙 每次押 20 金币');
    expect(describeProposal({ ...proposal, deliveries: 1, item: 'C2', quantity: 1, deposit: 0 }, nameOf)).toBe(
      '乙 每交付 1 个 C2，甲 付 100 金币，一次性，签订后 1:30 内交完，无押金',
    );
  });

  it('names the supplier staking a deposit, or says there is none', () => {
    expect(describeDeposit({ supplierId: 'a', deposit: 5 }, nameOf)).toBe('甲 每次押 5 金币');
    expect(describeDeposit({ supplierId: 'a', deposit: 0 }, nameOf)).toBe('无押金');
  });

  it('falls back to the id of a resident it does not know', () => {
    expect(describeOffer({ ...offer, fromId: 'z' }, nameOf)).toBe('z 以 80 金币卖给 甲 5 能量');
  });
});
