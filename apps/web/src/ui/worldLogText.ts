import type { ResidentId, WorldLogEntryView } from '@aiverse/protocol';
import { itemName } from './exchange';
import { formatDuration } from './format';

// Puts the server's structured world log entries into Chinese sentences, such as
// “甲 对 乙 说：卖你算力”. Residents stay as ids, so the panel can show each in their colour.

/** A piece of a sentence: plain words, or a resident to show by name. */
export type LogPart = string | { residentId: ResidentId };

const FACILITY_NAMES: Record<string, string> = {
  ad: '广告位', portal: '传送门', game_hall: '游戏厅', workspace: '工作空间', mall: '商场',
};
const CONTENT_NAMES: Record<string, string> = { ad: '广告', game: '游戏' };
const NODE_NAMES: Record<string, string> = { generative: '生成节点', render: '渲染节点' };

const facilityName = (kind: string | undefined) => (kind === undefined ? '设施' : FACILITY_NAMES[kind] ?? kind);
const contentName = (kind: string | undefined) => (kind === undefined ? '内容' : CONTENT_NAMES[kind] ?? kind);
const coins = (amount: number | undefined) => `${(amount ?? 0).toLocaleString('zh-CN')} 金币`;
const items = (entry: WorldLogEntryView) => `${entry.quantity ?? 0} 个${itemName(entry.item ?? '物品')}`;
const quote = (text: string | undefined) => `「${text ?? ''}」`;

/** The entry as a sentence, its actor first. */
export function describeWorldLogEntry(entry: WorldLogEntryView): LogPart[] {
  const actor = { residentId: entry.actorId };
  const other: LogPart = entry.otherId === undefined ? '某人' : { residentId: entry.otherId };
  switch (entry.verb) {
    case 'said':
      return entry.otherId === undefined
        ? [actor, ` 当众说（${entry.quantity ?? 0} 人听到）：${entry.text ?? ''}`]
        : [actor, ' 对 ', other, ` 说：${entry.text ?? ''}`];
    case 'walked':
      return [actor, ` 出发前往 (${Math.round(entry.position?.x ?? 0)}, ${Math.round(entry.position?.y ?? 0)})`];
    case 'teleported':
      return [actor, ` 从 ${entry.parcelId} 传送到 ${entry.otherParcelId}，付过路费 ${coins(entry.coins)}`];
    case 'left_game':
      return [actor, ' 退出了游戏'];
    case 'bought_parcel':
      return [actor, ` 花 ${coins(entry.coins)} 买下 ${entry.parcelId} 所在街区（${entry.quantity ?? 1} 块地）`];
    case 'bought_node':
      return [actor, ` 花 ${coins(entry.coins)} 订阅了${NODE_NAMES[entry.item ?? ''] ?? entry.item}，时长 ${formatDuration(entry.quantity ?? 0)}`];
    case 'started_building':
      return entry.otherId === undefined
        ? [actor, ` 开始在 ${entry.parcelId} 建${facilityName(entry.facility)}`]
        : [actor, ' 开始在 ', other, ` 的地块 ${entry.parcelId} 上建${facilityName(entry.facility)}`];
    case 'started_making':
      return [actor, ` 开始制作一份${contentName(entry.item)}`];
    case 'built':
      return entry.otherId === undefined
        ? [actor, ` 在 ${entry.parcelId} 的${facilityName(entry.facility)}建成了`]
        : [actor, ' 替 ', other, ` 在 ${entry.parcelId} 建成了${facilityName(entry.facility)}`];
    case 'made':
      return [actor, ` 制作完成一份${contentName(entry.item)}`];
    case 'placed_content':
      return [actor, ` 把一份内容放进了 ${entry.parcelId} 的${facilityName(entry.facility)}`];
    case 'offered':
      return [actor, ...offerSentence(entry, actor, other)];
    case 'accepted':
    case 'declined':
    case 'withdrew': {
      const verb = { accepted: ' 接受了 ', declined: ' 拒绝了 ', withdrew: ' 撤回了给 ' }[entry.verb];
      // The sender of the request: the one answered, or the one taking it back.
      const [sender, recipient] = entry.verb === 'withdrew' ? [actor, other] : [other, actor];
      return [
        actor, verb, other, ` 的${DEAL_NAMES[entry.deal ?? ''] ?? '提议'}：${dealTerms(entry)}`,
        ...supplierNote(entry, sender, recipient),
      ];
    }
    case 'delivered':
      return [actor, ' 按合约向 ', other, ` 交付了 ${items(entry)}，收到 ${coins(entry.coins)}`];
    case 'cancelled_contract':
      return [actor, ' 取消了与 ', other, ' 的合约'];
    case 'placed_order':
      return [actor, ` 在交易所挂${entry.side === 'buy' ? '买' : '卖'}单：${items(entry)}，每个 ${coins(entry.coins)}`];
    case 'cancelled_order':
      return [actor, ` 撤回了${itemName(entry.item ?? '物品')}的${entry.side === 'buy' ? '买' : '卖'}单`];
    case 'linked_portals':
      return [actor, ` 连通了传送门 ${entry.parcelId} 与 ${entry.otherParcelId}，每趟 ${coins(entry.coins)}`];
  }
}

const DEAL_NAMES: Record<string, string> = {
  purchase: '收购报价', sale: '出售报价', information: '信息报价', shares: '份额转让',
  contract: '合约提议', joint_purchase: '合买邀请', commission: '建造委托', link: '传送门连通请求',
};

/** What a request asks for, said the same way whether it is being made or answered. */
function dealTerms(entry: WorldLogEntryView): string {
  switch (entry.deal) {
    case 'purchase':
      return `出 ${coins(entry.coins)} 买 ${items(entry)}`;
    case 'sale':
      return `以 ${coins(entry.coins)} 卖出 ${items(entry)}`;
    case 'information':
      return `信息${quote(entry.text)}，要价 ${coins(entry.coins)}`;
    case 'shares':
      return `${entry.parcelId} 的 ${entry.quantity ?? 0} 份份额，要价 ${coins(entry.coins)}`;
    case 'contract': {
      const times = entry.deliveries === 1 ? '一次性' : `共 ${entry.deliveries ?? 0} 次`;
      return `每次交付 ${items(entry)} 付 ${coins(entry.coins)}，${times}`;
    }
    case 'joint_purchase':
      return `合买 ${entry.parcelId} 所在街区，受邀方出 ${coins(entry.coins)} 得 ${entry.quantity ?? 0} 份`;
    case 'commission':
      return `在 ${entry.parcelId} 建${facilityName(entry.facility)}，酬金 ${coins(entry.coins)}`;
    case 'link':
      return `连通 ${entry.parcelId} 与 ${entry.otherParcelId}，每趟 ${coins(entry.coins)}`;
    default:
      return '内容未知';
  }
}

/** Who is to deliver under a contract: the sender of the proposal when its side is `sell`. */
function supplierNote(entry: WorldLogEntryView, sender: LogPart, recipient: LogPart): LogPart[] {
  return entry.deal === 'contract' ? ['，由 ', entry.side === 'sell' ? sender : recipient, ' 供货'] : [];
}

/** Making a request, from the sender's side: who offers what to whom. */
function offerSentence(entry: WorldLogEntryView, actor: LogPart, other: LogPart): LogPart[] {
  switch (entry.deal) {
    case 'purchase':
      return [' 向 ', other, ` 出价：${dealTerms(entry)}`];
    case 'sale':
      return [' 向 ', other, ` 报价：${dealTerms(entry)}`];
    case 'information':
      return [' 向 ', other, ` 兜售信息${quote(entry.text)}，要价 ${coins(entry.coins)}`];
    case 'shares':
      return [' 向 ', other, ` 出让 ${dealTerms(entry)}`];
    case 'contract':
      return [' 向 ', other, ` 提议合约：${dealTerms(entry)}`, ...supplierNote(entry, actor, other)];
    case 'joint_purchase':
      return [' 邀请 ', other, ` 合买 ${entry.parcelId} 所在街区：对方出 ${coins(entry.coins)}，得 ${entry.quantity ?? 0} 份`];
    case 'commission':
      return entry.side === 'buy'
        ? [' 委托 ', other, ` 在自己的地块 ${entry.parcelId} 建${facilityName(entry.facility)}，酬金 ${coins(entry.coins)}`]
        : [' 申请在 ', other, ` 的地块 ${entry.parcelId} 建${facilityName(entry.facility)}，酬金 ${coins(entry.coins)}`];
    case 'link':
      return [' 请 ', other, ` ${dealTerms(entry)}`];
    default:
      return [' 向 ', other, ' 发出了一项提议'];
  }
}

/** The sentence as plain text, residents by name; unknown residents keep their id. */
export function worldLogPlainText(parts: readonly LogPart[], nameOf: (id: ResidentId) => string): string {
  return parts.map((part) => (typeof part === 'string' ? part : nameOf(part.residentId))).join('');
}
