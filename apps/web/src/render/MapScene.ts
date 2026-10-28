import type { MarketView, PoolView, Position, ResidentId, ResidentView } from '@aiverse/protocol';
import * as Phaser from 'phaser';
import type { GameStore } from '../state/store';
import {
  axisTicks,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  formatCoordinate,
  projectMap,
  SLAB_DEPTH,
  type MapProjection,
} from './layout';

const FONT = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
const MOVE_TWEEN_MS = 400;
const BACKGROUND = '#1b1712';
const INK = 0x1d1a16;
/** Alternating turf colours of the cells between ticks. */
const TURF_LIGHT = 0x687b3d;
const TURF_DARK = 0x5b6d36;
const TUFT_COLOR = 0x8b9c50;
const EDGE_COLOR = 0xe2d3a8;
const EARTH_LIT = 0x5c4331;
const EARTH_SHADED = 0x433022;
const SKIN = 0xf4ead2;
const SELECTION_COLOR = 0xfdf8ee;
const LABEL_STYLE = { fontFamily: FONT, fontSize: '12px', color: '#c9b99a' };
const NAME_STYLE = { fontFamily: FONT, fontSize: '13px', color: '#fdf8ee', stroke: '#1d1a16', strokeThickness: 3 };
/** How far outside the map edge the tick labels sit, as a fraction of the map side. */
const LABEL_OFFSET = 0.04;
/** Grass tufts scattered over the ground for texture; they are not game objects. */
const TUFT_COUNT = 240;
const TUFT_SEED = 7;
/** Residents who left the game stay on the map, faded. */
const LEFT_ALPHA = 0.35;
/** Token pools: a glowing patch of ground the size of their reach, with a crystal in the middle. */
const POOL_FILL = 0x4fc3d9;
const POOL_EDGE = 0xb8f0fa;
const POOL_CRYSTAL = 0xdff8fc;
/** Pools with nothing left stay on the map, faded. */
const EMPTY_POOL_ALPHA = 0.35;
const POOL_LABEL_STYLE = { fontFamily: FONT, fontSize: '12px', color: '#dff8fc', stroke: '#1d1a16', strokeThickness: 3 };
/** The market: a patch of ground the size of its reach, with a stall in the middle. */
const MARKET_FILL = 0xe0a93b;
const MARKET_EDGE = 0xf7dc8a;
const MARKET_WALL = 0x8a5a33;
const MARKET_ROOF = 0xc8462f;
const MARKET_COIN = 0xf7dc8a;
const MARKET_LABEL_STYLE = { fontFamily: FONT, fontSize: '12px', color: '#f7dc8a', stroke: '#1d1a16', strokeThickness: 3 };

/** Height of a resident's figure, in the units `drawFigure` uses. */
const FIGURE_HEIGHT = 46;
/** Canvas pixels per figure unit at the map centre. */
const RESIDENT_SCALE = 1.25;

interface Resident {
  root: Phaser.GameObjects.Container;
  /** Ring on the ground marking the selected resident. */
  ring: Phaser.GameObjects.Graphics;
  figure: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  color: string;
  /** Latest position from the server. */
  position: Position;
  /** Where the resident is drawn; trails `position` while a move tween runs or along a walk. */
  shown: Position;
  walk: Walk | null;
}

/**
 * A walk the server reported, drawn from the wall clock rather than tweened: Phaser's clock
 * slows down with the frame rate, and the resident must arrive when the server says.
 */
interface Walk {
  from: Position;
  to: Position;
  /** `performance.now()` when the walk was reported from `from`, and the milliseconds left then. */
  start: number;
  duration: number;
}

/** Pools lie on the ground, above the turf and below every resident. */
const POOL_DEPTH = 0.5;

/**
 * Residents get depths in [1, 2) by how far down the canvas they stand, so nearer
 * ones cover farther ones. All of them stay above the ground and axis labels and
 * below the pointer readout.
 */
const RESIDENT_DEPTH = 1;
const CURSOR_DEPTH = 10;

/**
 * Draws the map as a tilted ground slab, its token pools, market and residents from the latest
 * snapshot in the store.
 * Clicking a resident selects it; clicking the ground then asks the server to move it there.
 */
export class MapScene extends Phaser.Scene {
  private readonly residents = new Map<ResidentId, Resident>();
  private ground: Phaser.GameObjects.Graphics | null = null;
  private pools: Phaser.GameObjects.Graphics | null = null;
  private poolLabels: Phaser.GameObjects.Text[] = [];
  private market: Phaser.GameObjects.Graphics | null = null;
  private marketLabel: Phaser.GameObjects.Text | null = null;
  /** Where the market was last drawn, so it is redrawn only when that changes. */
  private drawnMarket = '';
  /** What the pools were last drawn from, so they are redrawn only when that changes. */
  private drawnPools = '';
  private axisLabels: Phaser.GameObjects.Text[] = [];
  private cursor: Phaser.GameObjects.Text | null = null;
  private projection: MapProjection | null = null;
  private drawnSize: number | null = null;

  constructor(private readonly store: GameStore) {
    super('map');
  }

  create(): void {
    // Created first so the ground stays underneath everything else.
    this.ground = this.add.graphics();
    this.pools = this.add.graphics().setDepth(POOL_DEPTH);
    this.market = this.add.graphics().setDepth(POOL_DEPTH);
    this.cursor = this.add.text(16, 16, '', LABEL_STYLE).setDepth(CURSOR_DEPTH);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => this.showCursor(pointer));
    this.input.on(Phaser.Input.Events.GAME_OUT, () => this.cursor?.setText(''));
    this.input.on(
      Phaser.Input.Events.POINTER_DOWN,
      (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => this.click(pointer, over),
    );

    const unsubscribe = this.store.subscribe(() => this.sync());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    this.events.once(Phaser.Scenes.Events.DESTROY, unsubscribe);
    this.sync();
  }

  private sync(): void {
    const { world, selected } = this.store.getState();
    if (!world) return;
    const resized = world.map.size !== this.drawnSize;
    if (resized) this.drawMap(world.map.size);
    const pools = JSON.stringify([world.map.size, world.pools]);
    if (pools !== this.drawnPools) {
      this.drawPools(world.pools);
      this.drawnPools = pools;
    }
    // Only the place is drawn: the price moves with time, so the side panel shows it.
    const market = JSON.stringify([world.map.size, world.market?.position, world.market?.radius]);
    if (market !== this.drawnMarket) {
      this.drawMarket(world.market);
      this.drawnMarket = market;
    }
    this.syncResidents(world.residents, resized);
    for (const [id, resident] of this.residents) resident.ring.setVisible(id === selected);
  }

  /** Input only expresses intent: selection stays local, a move goes to the server as a primitive. */
  private click(pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    // Primary button only; touches count as the primary button too.
    if (!pointer.leftButtonDown()) return;
    for (const [id, resident] of this.residents) {
      if (over.includes(resident.root)) {
        this.store.select(id);
        return;
      }
    }
    const { selected } = this.store.getState();
    const target = this.projection?.toMap(pointer.x, pointer.y);
    if (selected && target && this.store.isFree(selected)) {
      this.store.act({ type: 'move_to', residentId: selected, target });
    }
  }

  private drawMap(size: number): void {
    const projection = projectMap(size);
    const ground = this.ground!;
    const point = (x: number, y: number, height = 0) => {
      const { x: sx, y: sy } = projection.toScreen({ x, y }, height);
      return new Phaser.Math.Vector2(sx, sy);
    };
    const corners: [number, number][] = [
      [0, 0],
      [size, 0],
      [size, size],
      [0, size],
    ];
    ground.clear();

    // Earth under the turf. The camera is fixed, so only the two near sides, the
    // east and south edges, are ever visible; the south one faces the light.
    const bottom = -SLAB_DEPTH * size;
    const nearSides: [number, number, number, number, number][] = [
      [size, 0, size, size, EARTH_SHADED],
      [size, size, 0, size, EARTH_LIT],
    ];
    for (const [x0, y0, x1, y1, color] of nearSides) {
      const side = [point(x0, y0), point(x1, y1), point(x1, y1, bottom), point(x0, y0, bottom)];
      ground.fillStyle(color, 1);
      ground.fillPoints(side, true);
      ground.lineStyle(2, INK, 0.9);
      ground.strokePoints(side, true);
    }

    // Turf: a checkerboard of the cells between ticks, which also marks the scale.
    const ticks = axisTicks(size);
    const bounds = ticks.at(-1)! < size ? [...ticks, size] : ticks;
    const spans = bounds.slice(1).map((end, i): [number, number] => [bounds[i]!, end]);
    for (const [i, [x0, x1]] of spans.entries()) {
      for (const [j, [y0, y1]] of spans.entries()) {
        ground.fillStyle((i + j) % 2 ? TURF_DARK : TURF_LIGHT, 1);
        ground.fillPoints([point(x0, y0), point(x1, y0), point(x1, y1), point(x0, y1)], true);
      }
    }

    const random = seededRandom(TUFT_SEED);
    for (let n = 0; n < TUFT_COUNT; n++) {
      const at = { x: (0.02 + 0.96 * random()) * size, y: (0.02 + 0.96 * random()) * size };
      const { x, y } = projection.toScreen(at);
      const blade = 5 * projection.scaleAt(at);
      ground.lineStyle(1.5, TUFT_COLOR, 0.7);
      ground.lineBetween(x, y, x - blade * 0.6, y - blade);
      ground.lineBetween(x, y, x, y - blade * 1.3);
      ground.lineBetween(x, y, x + blade * 0.6, y - blade);
    }

    ground.lineStyle(1, INK, 0.2);
    for (const tick of ticks) {
      if (tick === 0 || tick === size) continue;
      ground.lineBetween(...xy(point(tick, 0)), ...xy(point(tick, size)));
      ground.lineBetween(...xy(point(0, tick)), ...xy(point(size, tick)));
    }
    ground.lineStyle(2, EDGE_COLOR, 0.8);
    ground.strokePoints(
      corners.map(([x, y]) => point(x, y)),
      true,
    );

    // Tick labels sit just outside the two far edges, the x axis and the y axis.
    for (const label of this.axisLabels) label.destroy();
    this.axisLabels = [];
    const offset = LABEL_OFFSET * size;
    for (const tick of ticks) {
      const text = formatCoordinate(tick);
      const onX = point(tick, -offset);
      const onY = point(-offset, tick);
      this.axisLabels.push(
        this.add.text(onX.x, onX.y, text, LABEL_STYLE).setOrigin(0.5),
        this.add.text(onY.x, onY.y, text, LABEL_STYLE).setOrigin(0.5),
      );
    }
    // Axis names beside the middle of each edge, arrows pointing the way the value grows.
    const xName = point(size / 2, -2.5 * offset);
    const yName = point(-2.5 * offset, size / 2);
    this.axisLabels.push(
      this.add.text(xName.x, xName.y, 'x ↘', LABEL_STYLE).setOrigin(0.5),
      this.add.text(yName.x, yName.y, '↙ y', LABEL_STYLE).setOrigin(0.5),
    );

    this.projection = projection;
    this.drawnSize = size;
  }

  private drawPools(pools: PoolView[]): void {
    const projection = this.projection!;
    const graphics = this.pools!;
    graphics.clear();
    for (const label of this.poolLabels) label.destroy();
    this.poolLabels = [];
    for (const pool of pools) {
      const alpha = pool.reserve > 0 ? 1 : EMPTY_POOL_ALPHA;
      // The reach is a circle on the ground, so it is drawn through the projection.
      const rim = Array.from({ length: 48 }, (_, i) => {
        const angle = (i / 48) * 2 * Math.PI;
        const at = {
          x: pool.position.x + pool.radius * Math.cos(angle),
          y: pool.position.y + pool.radius * Math.sin(angle),
        };
        const { x, y } = projection.toScreen(at);
        return new Phaser.Math.Vector2(x, y);
      });
      graphics.fillStyle(POOL_FILL, 0.35 * alpha);
      graphics.fillPoints(rim, true);
      graphics.lineStyle(2, POOL_EDGE, 0.8 * alpha);
      graphics.strokePoints(rim, true);

      const { x, y } = projection.toScreen(pool.position);
      const size = 7 * projection.scaleAt(pool.position);
      const crystal = [
        new Phaser.Math.Vector2(x, y - 2.4 * size),
        new Phaser.Math.Vector2(x + size, y - size),
        new Phaser.Math.Vector2(x, y),
        new Phaser.Math.Vector2(x - size, y - size),
      ];
      graphics.fillStyle(POOL_CRYSTAL, alpha);
      graphics.fillPoints(crystal, true);
      graphics.lineStyle(1.5, INK, 0.8 * alpha);
      graphics.strokePoints(crystal, true);

      const label = this.add
        .text(x, y + 4, `${pool.id} · ${pool.reserve}`, POOL_LABEL_STYLE)
        .setOrigin(0.5, 0)
        .setDepth(POOL_DEPTH)
        .setAlpha(alpha);
      this.poolLabels.push(label);
    }
  }

  private drawMarket(market: MarketView | undefined): void {
    const projection = this.projection!;
    const graphics = this.market!;
    graphics.clear();
    this.marketLabel?.destroy();
    this.marketLabel = null;
    if (!market) return;
    const rim = Array.from({ length: 48 }, (_, i) => {
      const angle = (i / 48) * 2 * Math.PI;
      const { x, y } = projection.toScreen({
        x: market.position.x + market.radius * Math.cos(angle),
        y: market.position.y + market.radius * Math.sin(angle),
      });
      return new Phaser.Math.Vector2(x, y);
    });
    graphics.fillStyle(MARKET_FILL, 0.3);
    graphics.fillPoints(rim, true);
    graphics.lineStyle(2, MARKET_EDGE, 0.85);
    graphics.strokePoints(rim, true);

    // A stall: a wall with a coin sign under a pitched roof, standing on the centre.
    const { x, y } = projection.toScreen(market.position);
    const unit = 6 * projection.scaleAt(market.position);
    graphics.fillStyle(MARKET_WALL, 1);
    graphics.fillRect(x - 2 * unit, y - 2.4 * unit, 4 * unit, 2.4 * unit);
    graphics.lineStyle(1.5, INK, 0.9);
    graphics.strokeRect(x - 2 * unit, y - 2.4 * unit, 4 * unit, 2.4 * unit);
    const roof = [
      new Phaser.Math.Vector2(x - 2.6 * unit, y - 2.4 * unit),
      new Phaser.Math.Vector2(x, y - 4 * unit),
      new Phaser.Math.Vector2(x + 2.6 * unit, y - 2.4 * unit),
    ];
    graphics.fillStyle(MARKET_ROOF, 1);
    graphics.fillPoints(roof, true);
    graphics.strokePoints(roof, true);
    graphics.fillStyle(MARKET_COIN, 1);
    graphics.fillCircle(x, y - 1.2 * unit, 0.7 * unit);
    graphics.strokeCircle(x, y - 1.2 * unit, 0.7 * unit);

    this.marketLabel = this.add
      .text(x, y + 4, '收购点', MARKET_LABEL_STYLE)
      .setOrigin(0.5, 0)
      .setDepth(POOL_DEPTH);
  }

  private syncResidents(views: ResidentView[], resized: boolean): void {
    const present = new Set<ResidentId>();
    for (const view of views) {
      present.add(view.id);
      const resident = this.residents.get(view.id);
      if (!resident) {
        const created = this.createResident(view);
        created.root.setAlpha(view.left ? LEFT_ALPHA : 1);
        this.residents.set(view.id, created);
        this.place(created);
        this.startWalk(created, view);
        continue;
      }
      if (resident.color !== view.color) {
        resident.color = view.color;
        drawFigure(resident.figure, view.color);
      }
      resident.label.setText(residentLabel(view));
      resident.root.setAlpha(view.left ? LEFT_ALPHA : 1);
      const moved = resident.position.x !== view.position.x || resident.position.y !== view.position.y;
      resident.position = view.position;
      if (view.walking) {
        // Every snapshot restarts the walk from where the server says the resident is.
        this.tweens.killTweensOf(resident.shown);
        this.startWalk(resident, view);
        continue;
      }
      resident.walk = null;
      if (resized) {
        this.tweens.killTweensOf(resident.shown);
        resident.shown = { ...view.position };
        this.place(resident);
      } else if (moved) {
        // Tween on the ground, not on the canvas, so size and overlap follow the walk.
        this.tweens.killTweensOf(resident.shown);
        this.tweens.add({
          targets: resident.shown,
          x: view.position.x,
          y: view.position.y,
          duration: MOVE_TWEEN_MS,
          ease: 'Sine.easeInOut',
          onUpdate: () => this.place(resident),
        });
      }
    }
    for (const [id, resident] of this.residents) {
      if (!present.has(id)) {
        this.tweens.killTweensOf(resident.shown);
        resident.root.destroy();
        this.residents.delete(id);
      }
    }
  }

  override update(): void {
    const now = performance.now();
    for (const resident of this.residents.values()) this.stepWalk(resident, now);
  }

  private startWalk(resident: Resident, view: ResidentView): void {
    if (!view.walking) return;
    const { target, remainingSeconds } = view.walking;
    const start = performance.now();
    resident.walk = { from: { ...view.position }, to: target, start, duration: remainingSeconds * 1000 };
    this.stepWalk(resident, start);
  }

  /** Puts a walking resident where it is by now: steadily along the line, stopping at the target. */
  private stepWalk(resident: Resident, now: number): void {
    const { walk } = resident;
    if (!walk) return;
    const share = walk.duration > 0 ? Math.min(Math.max((now - walk.start) / walk.duration, 0), 1) : 1;
    const { from, to } = walk;
    resident.shown = { x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share };
    this.place(resident);
  }

  private createResident(view: ResidentView): Resident {
    const ring = this.add.graphics().setVisible(false);
    ring.lineStyle(2, SELECTION_COLOR, 0.9);
    ring.strokeEllipse(0, 0, 38, 16);
    const figure = this.add.graphics();
    drawFigure(figure, view.color);
    const label = this.add.text(0, -FIGURE_HEIGHT - 4, residentLabel(view), NAME_STYLE).setOrigin(0.5, 1);
    const root = this.add.container(0, 0, [ring, figure, label]);
    // The container has no size, so this rectangle is in figure units around the feet.
    root.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-14, -FIGURE_HEIGHT - 2, 28, FIGURE_HEIGHT + 8),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    const shown = { ...view.position };
    return { root, ring, figure, label, color: view.color, position: view.position, shown, walk: null };
  }

  /** Stands the resident's feet on its shown position, sized and layered by distance. */
  private place(resident: Resident): void {
    const projection = this.projection!;
    const { x, y } = projection.toScreen(resident.shown);
    resident.root
      .setPosition(x, y)
      .setScale(RESIDENT_SCALE * projection.scaleAt(resident.shown))
      .setDepth(RESIDENT_DEPTH + y / CANVAS_HEIGHT);
  }

  private showCursor(pointer: Phaser.Input.Pointer): void {
    const position = this.projection?.toMap(pointer.x, pointer.y);
    this.cursor?.setText(position ? `指针 (${formatCoordinate(position.x)}, ${formatCoordinate(position.y)})` : '');
  }
}

function residentLabel(view: ResidentView): string {
  if (view.mining) return `${view.name} · 采矿中`;
  if (view.walking) return `${view.name} · 行走中`;
  return view.name;
}

/** A standing figure with its feet, and the centre of its shadow, at (0, 0). */
function drawFigure(figure: Phaser.GameObjects.Graphics, color: string): void {
  const fill = Phaser.Display.Color.HexStringToColor(color).color;
  figure.clear();
  figure.fillStyle(0x000000, 0.3);
  figure.fillEllipse(0, 0, 26, 11);
  figure.lineStyle(3, INK, 1);
  figure.lineBetween(-4, -1, -4, -14);
  figure.lineBetween(4, -1, 4, -14);
  figure.fillStyle(fill, 1);
  figure.fillRoundedRect(-9, -30, 18, 18, 5);
  figure.lineStyle(2, INK, 1);
  figure.strokeRoundedRect(-9, -30, 18, 18, 5);
  figure.fillStyle(SKIN, 1);
  figure.fillCircle(0, -FIGURE_HEIGHT + 9, 9);
  figure.strokeCircle(0, -FIGURE_HEIGHT + 9, 9);
  figure.fillStyle(INK, 1);
  figure.fillCircle(-3, -FIGURE_HEIGHT + 8, 1.6);
  figure.fillCircle(3, -FIGURE_HEIGHT + 8, 1.6);
}

function xy(point: Phaser.Math.Vector2): [number, number] {
  return [point.x, point.y];
}

/** Small deterministic generator (mulberry32) so the ground looks the same on every load. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

export function createMapGame(parent: HTMLElement, store: GameStore): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: BACKGROUND,
    banner: false,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [new MapScene(store)],
  });
}
