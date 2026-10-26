import {
  createMatch,
  isFinished,
  isVisibleTo,
  resolveRound,
  viewFor,
  type MatchState,
  type PlayerProfile,
  type Rules,
} from '@aiverse/engine';
import {
  PROTOCOL_VERSION,
  parseClientMessage,
  parseDecision,
  type Action,
  type AgentStatus,
  type Decision,
  type GameEvent,
  type GamePhase,
  type Observation,
  type PlayerId,
  type PrivatePlayer,
  type ServerMessage,
} from '@aiverse/protocol';

/** Time source injected by the runtime (browser worker, Node server, or tests). */
export interface Scheduler {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

/** Chooses actions for one seat. Output is untrusted and validated by the host. */
export interface Decider {
  decide(observation: Observation): unknown;
}

export interface Seat {
  profile: PlayerProfile;
  decider: Decider;
}

export interface HostOptions {
  seed: number;
  seats: Seat[];
  rules?: Rules;
  scheduler: Scheduler;
  roundDurationMs: number;
  /** Measured from round start; later answers are discarded. */
  decisionTimeoutMs: number;
  /** Receives faults that aborted the match. */
  onError?: (error: unknown) => void;
}

/** Outgoing half of a connection; the transport decides how messages travel. */
export interface ClientLink {
  /** May throw (e.g. a closed socket); the host then drops this session only. */
  send(message: ServerMessage): void;
  /** Called once if the host drops the session, so the transport can close it. */
  close?(): void;
}

export interface SessionOptions {
  /** Whose private view this connection gets. Decided by the transport/auth layer, never by the client. */
  viewerId: PlayerId | null;
}

export interface Session {
  receive(message: unknown): void;
  close(): void;
}

type Outcome =
  | { kind: 'ok'; decision: Decision }
  | { kind: 'timeout' }
  | { kind: 'invalid_decision'; error: string }
  | { kind: 'decider_error' };

interface SeatRuntime {
  seat: Seat;
  status: AgentStatus;
  memory: string | null;
}

interface SessionRecord {
  link: ClientLink;
  viewerId: PlayerId | null;
  greeted: boolean;
}

const WAIT: Action = { type: 'wait' };

/**
 * The single authority for one match: owns the clock, asks deciders for actions,
 * resolves rounds with the engine and pushes per-viewer state to connected clients.
 */
export class GameHost {
  private state: MatchState;
  private phase: GamePhase = 'lobby';
  private lastEvents: GameEvent[] = [];
  private readonly seats: Map<PlayerId, SeatRuntime>;
  private readonly sessions = new Set<SessionRecord>();
  private timer: unknown = null;
  private stopped = false;

  constructor(private readonly options: HostOptions) {
    this.state = createMatch({
      seed: options.seed,
      players: options.seats.map((s) => s.profile),
      ...(options.rules ? { rules: options.rules } : {}),
    });
    this.seats = new Map(
      options.seats.map((seat) => [
        seat.profile.id,
        { seat, status: { lastOutcome: null, lastError: null, note: null }, memory: null },
      ]),
    );
  }

  get currentPhase(): GamePhase {
    return this.phase;
  }

  connect(link: ClientLink, { viewerId }: SessionOptions): Session {
    if (viewerId !== null && !this.seats.has(viewerId)) throw new Error(`unknown viewer: ${viewerId}`);
    const record: SessionRecord = { link, viewerId, greeted: false };
    this.sessions.add(record);
    return {
      receive: (message) => this.handle(record, message),
      close: () => {
        this.sessions.delete(record);
      },
    };
  }

  /** Returns false if the match is not waiting to start. */
  start(): boolean {
    if (this.phase !== 'lobby' || this.stopped) return false;
    this.phase = 'running';
    this.broadcast();
    this.scheduleRound(0);
    return true;
  }

  /** Stops scheduling; in-flight decisions are ignored. */
  stop(): void {
    this.stopped = true;
    if (this.timer !== null) this.options.scheduler.clearTimeout(this.timer);
    this.timer = null;
  }

  private handle(record: SessionRecord, raw: unknown): void {
    const parsed = parseClientMessage(raw);
    if (!parsed.ok) {
      this.deliver(record, { type: 'error', code: 'bad_message', message: parsed.error });
      return;
    }
    const message = parsed.value;
    switch (message.type) {
      case 'hello':
        if (message.protocolVersion !== PROTOCOL_VERSION) {
          this.deliver(record, {
            type: 'error',
            code: 'protocol_mismatch',
            message: `server speaks protocol ${PROTOCOL_VERSION}`,
          });
          return;
        }
        record.greeted = true;
        this.deliver(record, {
          type: 'welcome',
          protocolVersion: PROTOCOL_VERSION,
          viewerId: record.viewerId,
          roundDurationMs: this.options.roundDurationMs,
        });
        this.sendState(record);
        return;
      case 'start':
        if (!record.greeted) {
          this.deliver(record, { type: 'error', code: 'not_ready', message: 'send hello first' });
        } else if (!this.start()) {
          this.deliver(record, { type: 'error', code: 'already_started', message: 'match is not in lobby' });
        }
        return;
    }
  }

  private scheduleRound(delay: number): void {
    this.timer = this.options.scheduler.setTimeout(() => {
      this.timer = null;
      this.playRound().catch((error: unknown) => this.abort(error));
    }, delay);
  }

  private async playRound(): Promise<void> {
    const { scheduler, roundDurationMs } = this.options;
    const startedAt = scheduler.now();
    const runtimes = [...this.seats.values()];
    const outcomes = await Promise.all(runtimes.map((r) => this.collect(r)));
    if (this.stopped) return;

    const actions = new Map<PlayerId, Action>();
    runtimes.forEach((runtime, i) => {
      const outcome = outcomes[i]!;
      actions.set(runtime.seat.profile.id, outcome.kind === 'ok' ? outcome.decision.action : WAIT);
      this.record(runtime, outcome);
    });

    const result = resolveRound(this.state, actions);
    this.state = result.state;
    this.lastEvents = result.events;
    if (isFinished(this.state)) this.phase = 'finished';

    this.broadcast();
    if (this.phase !== 'running') return;
    this.scheduleRound(Math.max(0, startedAt + roundDurationMs - scheduler.now()));
  }

  /** A fault mid-round leaves no trustworthy result; the match ends without a ranking. */
  private abort(error: unknown): void {
    this.phase = 'aborted';
    this.stop();
    this.broadcast();
    this.options.onError?.(error);
  }

  private collect(runtime: SeatRuntime): Promise<Outcome> {
    const observation = this.observe(runtime);
    const { scheduler, decisionTimeoutMs } = this.options;
    return new Promise((resolve) => {
      let settled = false;
      const finish = (outcome: Outcome) => {
        if (settled) return;
        settled = true;
        scheduler.clearTimeout(timer);
        resolve(outcome);
      };
      const timer = scheduler.setTimeout(() => finish({ kind: 'timeout' }), decisionTimeoutMs);
      Promise.resolve()
        .then(() => runtime.seat.decider.decide(observation))
        .then(
          (raw) => {
            const parsed = parseDecision(raw);
            finish(parsed.ok ? { kind: 'ok', decision: parsed.value } : { kind: 'invalid_decision', error: parsed.error });
          },
          () => finish({ kind: 'decider_error' }),
        );
    });
  }

  private observe(runtime: SeatRuntime): Observation {
    const id = runtime.seat.profile.id;
    const world = viewFor(this.state, id);
    return {
      decidingRound: this.state.round + 1,
      world: { ...world, self: world.self as PrivatePlayer },
      recentEvents: this.lastEvents.filter((e) => isVisibleTo(e, id)),
      agent: { ...runtime.status },
      memory: runtime.memory,
    };
  }

  private record(runtime: SeatRuntime, outcome: Outcome): void {
    if (outcome.kind === 'ok') {
      runtime.status = { lastOutcome: 'ok', lastError: null, note: outcome.decision.note ?? null };
      if (outcome.decision.memory !== undefined) runtime.memory = outcome.decision.memory;
    } else {
      runtime.status = {
        lastOutcome: outcome.kind,
        lastError: outcome.kind === 'invalid_decision' ? outcome.error : null,
        note: null,
      };
    }
  }

  private broadcast(): void {
    for (const record of this.sessions) {
      if (record.greeted) this.sendState(record);
    }
  }

  /** One failing connection must not stall the match or starve other viewers. */
  private deliver(record: SessionRecord, message: ServerMessage): void {
    if (!this.sessions.has(record)) return;
    try {
      record.link.send(message);
    } catch {
      this.sessions.delete(record);
      try {
        record.link.close?.();
      } catch {
        // Already broken; nothing more to release.
      }
    }
  }

  private sendState(record: SessionRecord): void {
    const { viewerId } = record;
    this.deliver(record, {
      type: 'state',
      phase: this.phase,
      world: viewFor(this.state, viewerId),
      events: this.lastEvents.filter((e) => isVisibleTo(e, viewerId)),
      agent: viewerId === null ? null : { ...this.seats.get(viewerId)!.status },
    });
  }
}
