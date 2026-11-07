import {
  PROTOCOL_VERSION,
  type Action,
  type ProgramTierView,
  type LLMSettings,
  type MineView,
  type RecipeView,
  type SpringView,
  type ResidentId,
  type ServerMessage,
  type WorldView,
} from '@aiverse/protocol';
import type { GameConnection } from '../net/connection';
import { marketPrice, marketQuote } from './market';

/** Outcome of the latest operation primitive this client sent. */
export type ActionStatus = { status: 'pending' } | { status: 'accepted' } | { status: 'rejected'; reason: string };

export interface ClientState {
  connection: 'connecting' | 'ready' | 'failed';
  world: WorldView | null;
  error: string | null;
  /**
   * The resident manual operations apply to. The server is told, so this page's states carry
   * that resident's whispers and no one else's.
   */
  selected: ResidentId | null;
  lastAction: ActionStatus | null;
  /** Outcome of the latest request to start or stop each resident's agent. */
  agentRequests: Readonly<Record<ResidentId, ActionStatus>>;
  /** Language model settings the server's config fixes, so they need not be filled in. */
  llmOverrides: readonly string[];
  /**
   * When the game ends on this client's clock (see `now`), from the latest snapshot's
   * remaining time; a local time, so the two machines' clocks need not agree.
   */
  deadline: number | null;
  /** When the latest snapshot arrived on this client's clock, to follow the market price since. */
  receivedAt: number | null;
}

const INITIAL_STATE: ClientState = {
  connection: 'connecting',
  world: null,
  error: null,
  selected: null,
  lastAction: null,
  agentRequests: {},
  llmOverrides: [],
  deadline: null,
  receivedAt: null,
};

/**
 * Client-side mirror of the latest authoritative state. Besides what the server
 * sent, it only keeps local UI choices; rendering and UI read from here. Changes to
 * the world go out as operation primitives and come back as a new snapshot.
 */
export class GameStore {
  private state = INITIAL_STATE;
  private readonly listeners = new Set<() => void>();
  private readonly detach: (() => void)[];

  /** `now` is a monotonic clock in milliseconds, replaceable in tests. */
  constructor(
    private readonly connection: GameConnection,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.detach = [
      connection.onMessage((message) => this.apply(message)),
      // No result can arrive any more, so a pending action is dropped rather than left spinning.
      connection.onFailure((reason) =>
        this.update({ connection: 'failed', error: reason, lastAction: null, agentRequests: {} }),
      ),
    ];
    connection.send({ type: 'hello', protocolVersion: PROTOCOL_VERSION });
  }

  getState = (): ClientState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Sends an operation primitive. The world changes only when the server's new state arrives. */
  act(action: Action): void {
    if (this.state.connection !== 'ready') return;
    this.connection.send({ type: 'action', action });
    this.update({ lastAction: { status: 'pending' } });
  }

  /**
   * Hands the resident to a language model with these settings, replacing any agent driving
   * them. Blank settings are left out, for the server's config to fill in.
   */
  startAgent(residentId: ResidentId, settings: LLMSettings, strategy = ''): void {
    if (this.state.connection !== 'ready') return;
    const llm: LLMSettings = {};
    for (const name of ['baseUrl', 'apiKey', 'model'] as const) {
      const value = settings[name]?.trim();
      if (value) llm[name] = value;
    }
    this.connection.send({ type: 'start_agent', residentId, llm, ...(strategy.trim() ? { strategy: strategy.trim() } : {}) });
    this.setAgentRequest(residentId, { status: 'pending' });
  }

  /** Stops the agent driving the resident, leaving them to manual control. */
  stopAgent(residentId: ResidentId): void {
    if (this.state.connection !== 'ready') return;
    this.connection.send({ type: 'stop_agent', residentId });
    this.setAgentRequest(residentId, { status: 'pending' });
  }

  /**
   * Whether a primitive for this resident is worth sending: connected, the game still on and
   * the resident still in it. The server checks again; this only spares a certain rejection.
   */
  canAct(id: ResidentId): boolean {
    const { connection, world } = this.state;
    const resident = world?.residents.find((candidate) => candidate.id === id);
    return connection === 'ready' && !world?.game.ended && resident !== undefined && !resident.left;
  }

  /**
   * Like `canAct`, and the resident is not busy harvesting, gathering, writing or walking: then only
   * talking and leaving go through.
   */
  isFree(id: ResidentId): boolean {
    const resident = this.state.world?.residents.find((candidate) => candidate.id === id);
    return (
      this.canAct(id) &&
      resident !== undefined &&
      [resident.harvesting, resident.gathering, resident.writing, resident.walking].every((job) => job === undefined)
    );
  }

  /** The spring the resident stands within reach of, the nearest if several; null if none. */
  springInReach(id: ResidentId): SpringView | null {
    const { world } = this.state;
    const resident = world?.residents.find((candidate) => candidate.id === id);
    if (!world || !resident) return null;
    const distance = (spring: SpringView) =>
      Math.hypot(spring.position.x - resident.position.x, spring.position.y - resident.position.y);
    const reachable = world.springs.filter((spring) => distance(spring) <= spring.radius);
    return reachable.sort((a, b) => distance(a) - distance(b))[0] ?? null;
  }

  /** The mine the resident stands within reach of, the nearest if several; null if none. */
  mineInReach(id: ResidentId): MineView | null {
    const { world } = this.state;
    const resident = world?.residents.find((candidate) => candidate.id === id);
    if (!world || !resident) return null;
    const distance = (mine: MineView) =>
      Math.hypot(mine.position.x - resident.position.x, mine.position.y - resident.position.y);
    const reachable = world.mines.filter((mine) => distance(mine) <= mine.radius);
    return reachable.sort((a, b) => distance(a) - distance(b))[0] ?? null;
  }

  /** Whether the resident stands within reach of the studio. */
  atStudio(id: ResidentId): boolean {
    const { world } = this.state;
    const resident = world?.residents.find((candidate) => candidate.id === id);
    const studio = world?.studio;
    if (!resident || !studio) return false;
    return Math.hypot(studio.position.x - resident.position.x, studio.position.y - resident.position.y) <= studio.radius;
  }

  /**
   * Game seconds writing `recipe` would take the resident, quicker for every program they have
   * written before; only for display, the server times the job.
   */
  writeSeconds(id: ResidentId, recipe: RecipeView): number | null {
    const { world } = this.state;
    const resident = world?.residents.find((candidate) => candidate.id === id);
    const studio = world?.studio;
    if (!resident || !studio) return null;
    const share = Math.max(1 - studio.speedupPerProgram * resident.programsWritten, studio.fastestShare);
    return recipe.seconds * share;
  }

  /**
   * Whether the resident surely lacks what `recipe` uses up: owned data and compute count those
   * set aside too, so having them is no promise the server accepts, but lacking them is a sure
   * refusal. The lower program must be carried.
   */
  lacksMaterials(id: ResidentId, recipe: RecipeView): boolean {
    const resident = this.state.world?.residents.find((candidate) => candidate.id === id);
    if (!resident) return true;
    return (
      resident.data < recipe.data ||
      resident.compute < recipe.compute ||
      (recipe.consumes !== undefined && !resident.carriedPrograms[recipe.consumes])
    );
  }

  /** Whether the resident stands within reach of the market. */
  atMarket(id: ResidentId): boolean {
    const { world } = this.state;
    const resident = world?.residents.find((candidate) => candidate.id === id);
    const market = world?.market;
    if (!resident || !market) return false;
    return Math.hypot(market.position.x - resident.position.x, market.position.y - resident.position.y) <= market.radius;
  }

  /** The best program currently carried; installed and offered programs cannot harvest manually. */
  bestProgram(id: ResidentId): ProgramTierView | null {
    const { world } = this.state;
    const resident = world?.residents.find((candidate) => candidate.id === id);
    const owned = (world?.market?.programs ?? []).filter((tier) => (resident?.carriedPrograms[tier.tier] ?? 0) > 0);
    return owned.reduce<ProgramTierView | null>(
      (best, tier) => (best === null || tier.computePerJob > best.computePerJob ? tier : best),
      null,
    );
  }

  /** Coins one more compute fetches right now by the local clock, or null without a market. */
  marketPrice(): number | null {
    const market = this.state.world?.market;
    return market ? marketPrice(market, this.sinceSnapshot()) : null;
  }

  /** Coins selling `quantity` compute would fetch right now; an estimate, the server decides. */
  marketQuote(quantity: number): number | null {
    const market = this.state.world?.market;
    return market ? marketQuote(market, this.sinceSnapshot(), quantity) : null;
  }

  /** Seconds left in the game by the local clock; only for display, the server ends it. */
  remainingSeconds(): number | null {
    const { deadline } = this.state;
    return deadline === null ? null : Math.max(0, (deadline - this.now()) / 1000);
  }

  /**
   * Seconds left by the local clock on a timer the latest snapshot gave as `remainingSeconds`,
   * such as a contract's; only for display, the server decides when it runs out.
   */
  countdown(remainingSeconds: number): number {
    return Math.max(0, remainingSeconds - this.sinceSnapshot());
  }

  select(id: ResidentId | null): void {
    if (id === this.state.selected) return;
    this.connection.send({ type: 'view_as', residentId: id });
    this.update({ selected: id });
  }

  dispose(): void {
    for (const detach of this.detach) detach();
    this.connection.close();
    this.listeners.clear();
  }

  private apply(message: ServerMessage): void {
    switch (message.type) {
      case 'welcome':
        if (message.protocolVersion !== PROTOCOL_VERSION) {
          this.fail(`protocol_mismatch: 服务端协议版本 ${message.protocolVersion}，客户端为 ${PROTOCOL_VERSION}`);
          return;
        }
        this.update({ connection: 'ready', error: null, llmOverrides: message.llmOverrides });
        return;
      case 'state': {
        const { selected } = this.state;
        const stillThere = message.world.residents.some((resident) => resident.id === selected);
        if (selected !== null && !stillThere) this.connection.send({ type: 'view_as', residentId: null });
        const receivedAt = this.now();
        const deadline = receivedAt + message.world.game.remainingSeconds * 1000;
        this.update({ world: message.world, selected: stillThere ? selected : null, deadline, receivedAt });
        return;
      }
      case 'action_result':
        this.update({
          lastAction: message.ok
            ? { status: 'accepted' }
            : { status: 'rejected', reason: `${message.code ?? 'rejected'}: ${message.message ?? ''}` },
        });
        return;
      case 'agent_result':
        this.setAgentRequest(
          message.residentId,
          message.ok
            ? { status: 'accepted' }
            : { status: 'rejected', reason: `${message.code ?? 'rejected'}: ${message.message ?? ''}` },
        );
        return;
      case 'error': {
        const error = `${message.code}: ${message.message}`;
        // The server keeps the socket open, but nothing useful can follow a version mismatch.
        if (message.code === 'protocol_mismatch') this.fail(error);
        else {
          // An error answers a pending request instead of a result; the top bar shows why. Which
          // one is unknown, so every pending request is given up on; a result still on its way
          // names its resident and sets it again.
          const { lastAction, agentRequests } = this.state;
          this.update({
            error,
            lastAction: lastAction?.status === 'pending' ? null : lastAction,
            agentRequests: Object.fromEntries(
              Object.entries(agentRequests).filter(([, status]) => status.status !== 'pending'),
            ),
          });
        }
        return;
      }
    }
  }

  /** Seconds since the latest snapshot arrived; prices stand still once the game is over. */
  private sinceSnapshot(): number {
    const { receivedAt, world } = this.state;
    if (receivedAt === null || world?.game.ended) return 0;
    return (this.now() - receivedAt) / 1000;
  }

  private setAgentRequest(residentId: ResidentId, status: ActionStatus): void {
    this.update({ agentRequests: { ...this.state.agentRequests, [residentId]: status } });
  }

  private fail(error: string): void {
    this.update({ connection: 'failed', error, lastAction: null, agentRequests: {} });
    this.connection.close();
  }

  private update(patch: Partial<ClientState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
}
