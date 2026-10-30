import type { ContractProposalView, ContractView, OfferView, ResidentId } from '@aiverse/protocol';
import { useGameState, useStore } from '../state/storeContext';
import { describeOffer, describeProposal, describeTerms, type NameOf } from './dealText';
import { formatDuration } from './format';
import { useSecondTick } from './useSecondTick';

type Pending = { kind: 'offer'; offer: OfferView } | { kind: 'proposal'; proposal: ContractProposalView };

/**
 * The selected resident's trade offers, contract proposals and contracts in force, which the
 * server sends only for that resident. Read-only: pages cannot make or answer deals yet.
 */
export function DealsPanel() {
  const store = useStore();
  const { world, selected } = useGameState();
  // Only contracts count down; they are cleared once the game ends.
  useSecondTick((world?.contracts.length ?? 0) > 0 && !world?.game.ended);
  if (!world) return null;
  const resident = world.residents.find((candidate) => candidate.id === selected) ?? null;
  const names = new Map(world.residents.map((candidate) => [candidate.id, candidate.name]));
  const nameOf: NameOf = (id) => names.get(id) ?? id;
  // The server sends only the selected resident's deals; filtering again keeps a state sent for
  // an earlier selection honest, as the speech panel does.
  const involved = (...ids: ResidentId[]) => resident !== null && ids.includes(resident.id);
  const contracts = world.contracts.filter((contract) => involved(contract.supplierId, contract.buyerId));
  const pending: Pending[] = [
    ...world.offers.filter((offer) => involved(offer.fromId, offer.toId)).map((offer) => ({ kind: 'offer' as const, offer })),
    ...world.contractProposals
      .filter((proposal) => involved(proposal.fromId, proposal.toId))
      .map((proposal) => ({ kind: 'proposal' as const, proposal })),
  ].sort((a, b) => eventOf(a).eventId - eventOf(b).eventId);

  return (
    <section className="panel">
      <h2>交易与合约</h2>
      {!resident ? (
        <p className="muted small">先选中一名居民，查看该居民参与的报价与合约。</p>
      ) : (
        <>
          <h3 className="deals-heading">生效的合约</h3>
          {contracts.length === 0 ? (
            <p className="muted small">没有生效的合约。</p>
          ) : (
            <ol className="deals">
              {contracts.map((contract) => (
                <ContractItem
                  key={contract.id}
                  contract={contract}
                  supplies={contract.supplierId === resident.id}
                  // The game ending ends every contract, so it never runs past the game's clock.
                  remaining={Math.min(store.countdown(contract.remainingSeconds), store.remainingSeconds() ?? Infinity)}
                  nameOf={nameOf}
                />
              ))}
            </ol>
          )}
          <h3 className="deals-heading">等待答复</h3>
          {pending.length === 0 ? (
            <p className="muted small">没有等待答复的报价或合约提议。</p>
          ) : (
            <ol className="deals">
              {pending.map((item) => (
                <PendingItem key={eventOf(item).eventId} item={item} incoming={eventOf(item).toId === resident.id} nameOf={nameOf} />
              ))}
            </ol>
          )}
        </>
      )}
      <p className="muted small">
        合约签订时，买方的全部货款托管在合约里，供货方每交付一次就自动得到一次的价款；到期、取消、出局或游戏结束时余款退回买方。
        页面还不能发起或答复报价与合约，目前只有 AI 居民能用。这里只显示所选居民参与的部分。
      </p>
    </section>
  );
}

function eventOf(item: Pending): OfferView | ContractProposalView {
  return item.kind === 'offer' ? item.offer : item.proposal;
}

function ContractItem({
  contract,
  supplies,
  remaining,
  nameOf,
}: {
  contract: ContractView;
  supplies: boolean;
  remaining: number;
  nameOf: NameOf;
}) {
  return (
    <li>
      <span className="tag">合约 #{contract.id}</span>
      <span className="tag">{supplies ? '供货方' : '买方'}</span>
      <p className="text">{describeTerms(contract, nameOf)}</p>
      <span className="muted">
        还剩 {contract.deliveriesLeft} 次 · 托管 {contract.escrow.toLocaleString('zh-CN')} 金币 · {formatDuration(remaining)} 后到期
      </span>
    </li>
  );
}

function PendingItem({ item, incoming, nameOf }: { item: Pending; incoming: boolean; nameOf: NameOf }) {
  return (
    <li className={incoming ? 'incoming' : undefined}>
      <span className="tag">{incoming ? '收到' : '发出'}</span>
      <span className="tag">{item.kind === 'offer' ? '报价' : '合约提议'}</span>
      <p className="text">
        {item.kind === 'offer' ? describeOffer(item.offer, nameOf) : describeProposal(item.proposal, nameOf)}
      </p>
    </li>
  );
}
