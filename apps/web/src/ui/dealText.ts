import type { ContractProposalView, OfferView, ResidentId } from '@aiverse/protocol';
import { formatDuration } from './format';

/** A resident's display name; the id when the resident is unknown. */
export type NameOf = (id: ResidentId) => string;

/** A lot of items as players read it: tokens by count, other kinds such as chip models by piece. */
export function formatItems(item: string, quantity: number): string {
  return item === 'token' ? `${quantity} token` : `${quantity} 个 ${item}`;
}

/** A trade offer, such as “乙 以 80 金币卖给 甲 5 token”. */
export function describeOffer(offer: OfferView, nameOf: NameOf): string {
  const items = formatItems(offer.item, offer.quantity);
  return offer.side === 'sell'
    ? `${nameOf(offer.fromId)} 以 ${offer.price} 金币卖给 ${nameOf(offer.toId)} ${items}`
    : `${nameOf(offer.fromId)} 出 ${offer.price} 金币买 ${nameOf(offer.toId)} 的 ${items}`;
}

type Terms = Pick<ContractProposalView, 'supplierId' | 'buyerId' | 'item' | 'quantity' | 'price'>;

/** What a contract settles, such as “乙 每交付 10 token，甲 付 100 金币”. */
export function describeTerms(terms: Terms, nameOf: NameOf): string {
  const items = formatItems(terms.item, terms.quantity);
  return `${nameOf(terms.supplierId)} 每交付 ${items}，${nameOf(terms.buyerId)} 付 ${terms.price} 金币`;
}

/** A contract proposal: its terms, how many deliveries and for how long once signed. */
export function describeProposal(proposal: ContractProposalView, nameOf: NameOf): string {
  const once = proposal.deliveries === 1 ? '一次性' : `最多 ${proposal.deliveries} 次`;
  return `${describeTerms(proposal, nameOf)}，${once}，签订后 ${formatDuration(proposal.durationSeconds)} 内有效`;
}
