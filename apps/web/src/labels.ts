import type {
  ActionType,
  DecisionOutcome,
  FailureReason,
  GameEvent,
  GamePhase,
  ItemId,
  PlayerId,
  ZoneId,
} from '@aiverse/protocol';

// Display text lives in the client; the protocol only carries identifiers.

export const ZONE_NAMES: Record<ZoneId, string> = {
  market: '中央集市',
  farm: '农田',
  forest: '林场',
  workshop: '工坊',
  home: '住宅区',
};

export const ITEM_NAMES: Record<ItemId, string> = { grain: '谷物', wood: '木材', bread: '面包' };

export const ACTION_NAMES: Record<ActionType, string> = {
  move: '移动',
  gather: '采集',
  craft: '制作',
  rest: '休息',
  wait: '等待',
};

const FAILURE_NAMES: Record<FailureReason, string> = {
  already_there: '已在目的地',
  wrong_zone: '不在对应区域',
  not_enough_stamina: '体力不足',
  missing_materials: '材料不足',
  inventory_full: '背包已满',
};

export const PHASE_NAMES: Record<GamePhase, string> = {
  lobby: '等待开局',
  running: '进行中',
  finished: '已结束',
  aborted: '已中止',
};

export const OUTCOME_NAMES: Record<DecisionOutcome, string> = {
  ok: '决策正常',
  timeout: '超时，本回合等待',
  invalid_decision: '输出无效，本回合等待',
  decider_error: '调用失败，本回合等待',
};

export function describeEvent(event: GameEvent, nameOf: (id: PlayerId) => string): string {
  switch (event.type) {
    case 'moved': {
      const via = event.to === event.destination ? '' : `（前往${ZONE_NAMES[event.destination]}）`;
      return `${nameOf(event.playerId)} 走到${ZONE_NAMES[event.to]}${via}`;
    }
    case 'gathered':
      return `${nameOf(event.playerId)} 采集了 ${event.quantity} ${ITEM_NAMES[event.item]}`;
    case 'crafted':
      return `${nameOf(event.playerId)} 制作了 ${event.quantity} ${ITEM_NAMES[event.item]}`;
    case 'rested':
      return `${nameOf(event.playerId)} ${event.usedBread ? '吃面包充分休息' : '简单休息'}`;
    case 'waited':
      return `${nameOf(event.playerId)} 等待`;
    case 'actionFailed':
      return `${nameOf(event.playerId)} ${ACTION_NAMES[event.action]}失败：${FAILURE_NAMES[event.reason]}`;
    case 'matchEnded':
      return '对局结束';
  }
}
