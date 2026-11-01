import type { MarketView, PoolView, Position, ResidentId, ResidentView, RigView } from '@aiverse/protocol';
import * as Phaser from 'phaser';
import floorCorners from '../assets/floor/metal-floor-corners.png';
import floorNodes from '../assets/floor/metal-floor-nodes.png';
import floorSparse from '../assets/floor/metal-floor-sparse.png';
import floorStrips from '../assets/floor/metal-floor-strips.png';
import marketSprite from '../assets/market/market-sprite.png';
import poolMarkerSprite from '../assets/pools/pool-marker-sprite.png';
import poolSprite from '../assets/pools/pool-sprite.png';
import miningRigSprite from '../assets/rigs/mining-rig.png';
import type { GameStore } from '../state/store';
import { paintFloorSurface, readFloorSources } from './floorSurface';
import {
  axisTicks,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  formatCoordinate,
  projectMap,
  SLAB_DEPTH,
  type MapProjection,
} from './layout';
import { markerPose } from './poolMarkerMotion';

const FONT = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
const MOVE_TWEEN_MS = 400;
const BACKGROUND = '#0d141e';
const INK = 0x1d1a16;
const FLOOR_TEXTURES = ['floor-corners', 'floor-sparse', 'floor-nodes', 'floor-strips'] as const;
const FLOOR_SURFACE = 'floor-surface';
const EDGE_COLOR = 0x487d91;
const SLAB_LIT = 0x243846;
const SLAB_SHADED = 0x172633;
const SKIN = 0xf4ead2;
const SELECTION_COLOR = 0xfdf8ee;
const LABEL_STYLE = { fontFamily: FONT, fontSize: '12px', color: '#c9b99a' };
const NAME_STYLE = { fontFamily: FONT, fontSize: '13px', color: '#fdf8ee', stroke: '#1d1a16', strokeThickness: 3 };
/** How far outside the map edge the tick labels sit, as a fraction of the map side. */
const LABEL_OFFSET = 0.04;
/** Residents who left the game stay on the map, faded. */
const LEFT_ALPHA = 0.35;
/**
 * Token pools: a portal lying on the ground over their reach, with a marker floating above its
 * middle. Both pictures are the user's pool.png and pool-marker.png beside them, trimmed to the
 * visible pixels (alpha above 8) and scaled down to 256 px wide and 128 px high.
 */
const POOL_TEXTURE = 'pool';
const POOL_MARKER_TEXTURE = 'pool-marker';
/** Height of the floating marker in canvas pixels at the map centre. */
const POOL_MARKER_HEIGHT = 44;
/** How far the marker's bottom hovers above the pool's centre, in canvas pixels at the map centre. */
const POOL_MARKER_HOVER = 10;
/** Pools with nothing left stay on the map, faded. */
const EMPTY_POOL_ALPHA = 0.35;
const POOL_LABEL_STYLE = { fontFamily: FONT, fontSize: '12px', color: '#dff8fc', stroke: '#1d1a16', strokeThickness: 3 };
/** The market: a patch of ground the size of its reach, with a machine standing in the middle. */
const MARKET_FILL = 0xe0a93b;
const MARKET_EDGE = 0xf7dc8a;
const MARKET_TEXTURE = 'market';
/**
 * Height of the machine in canvas pixels at the map centre, a little taller than a resident.
 * Its picture (market-sprite.png) is the user's market.png beside it trimmed to the visible
 * pixels (alpha above 8) and scaled to 192 px high.
 */
const MARKET_HEIGHT = 72;
/** Across the picture, where the front corner of its base touches the ground. */
const MARKET_FOOT_X = 0.65;
const MARKET_LABEL_STYLE = { fontFamily: FONT, fontSize: '12px', color: '#f7dc8a', stroke: '#1d1a16', strokeThickness: 3 };

const RIG_TEXTURE = 'mining-rig';
const RIG_FRAME = 'machine';
/** Visible area (alpha > 8) within the user's unchanged 1254 × 1254 transparent PNG. */
const RIG_BOUNDS = { x: 87, y: 311, width: 1083, height: 840 };
const RIG_HEIGHT = 66;
/** Ground contact near the front foot, measured within the visible frame. */
const RIG_FOOT_X = 0.7;

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

interface PoolMarker {
  image: Phaser.GameObjects.Image;
  /** Canvas pixels the marker's bottom edge rests above its ground point, and its full size there. */
  restingY: number;
  width: number;
  height: number;
  /** Offsets this marker's spin and bob from the others'. */
  phase: number;
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
  private floorEdge: Phaser.GameObjects.Graphics | null = null;
  private floorTexture: Phaser.Textures.CanvasTexture | null = null;
  private floorSources: ImageData[] = [];
  private poolGrounds: Phaser.GameObjects.Image[] = [];
  private poolMarkers: PoolMarker[] = [];
  private poolLabels: Phaser.GameObjects.Text[] = [];
  private market: Phaser.GameObjects.Graphics | null = null;
  private marketMachine: Phaser.GameObjects.Image | null = null;
  private marketLabel: Phaser.GameObjects.Text | null = null;
  /** Where the market was last drawn, so it is redrawn only when that changes. */
  private drawnMarket = '';
  /** What the pools were last drawn from, so they are redrawn only when that changes. */
  private drawnPools = '';
  private drawnRigs = '';
  private rigMarkers: { root: Phaser.GameObjects.Container; machine: Phaser.GameObjects.Image; position: Position }[] = [];
  private axisLabels: Phaser.GameObjects.Text[] = [];
  private cursor: Phaser.GameObjects.Text | null = null;
  private projection: MapProjection | null = null;
  private drawnSize: number | null = null;

  constructor(private readonly store: GameStore) {
    super('map');
  }

  preload(): void {
    this.load.image(MARKET_TEXTURE, marketSprite);
    this.load.image(POOL_TEXTURE, poolSprite);
    this.load.image(POOL_MARKER_TEXTURE, poolMarkerSprite);
    this.load.image(RIG_TEXTURE, miningRigSprite);
    [floorCorners, floorSparse, floorNodes, floorStrips].forEach((url, index) => {
      this.load.image(FLOOR_TEXTURES[index]!, url);
    });
  }

  create(): void {
    const texture = this.textures.get(RIG_TEXTURE);
    if (!texture.has(RIG_FRAME)) {
      texture.add(RIG_FRAME, 0, RIG_BOUNDS.x, RIG_BOUNDS.y, RIG_BOUNDS.width, RIG_BOUNDS.height);
    }
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.floorSources = readFloorSources(FLOOR_TEXTURES.map((key) => this.textures.get(key).getSourceImage() as HTMLImageElement));
    this.floorTexture = this.textures.createCanvas(FLOOR_SURFACE, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (!this.floorTexture) throw new Error('Cannot create floor surface texture');
    // Created first so the ground stays underneath everything else.
    this.ground = this.add.graphics();
    this.add.image(0, 0, FLOOR_SURFACE).setOrigin(0, 0).setDepth(0.1);
    this.floorEdge = this.add.graphics().setDepth(0.2);
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
    const rigs = JSON.stringify([world.map.size, world.rigs, world.game.ended]);
    if (rigs !== this.drawnRigs) {
      this.drawRigs(world.rigs, world.pools);
      this.drawnRigs = rigs;
    }
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
    const { selected, world } = this.store.getState();
    const rig = this.rigMarkers.find((marker) => over.includes(marker.machine));
    if (rig && selected && this.store.isFree(selected)) {
      this.store.act({ type: 'move_to', residentId: selected, target: rig.position });
      return;
    }
    // The machine stands up off the ground, so the ground behind it can lie outside the
    // market's reach; clicking the machine means walking to the market.
    const onMachine = this.marketMachine !== null && over.includes(this.marketMachine);
    const target = onMachine ? world?.market?.position : this.projection?.toMap(pointer.x, pointer.y);
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

    // Metal platform under the floor. Only the two near sides, the
    // east and south edges, are ever visible; the south one faces the light.
    const bottom = -SLAB_DEPTH * size;
    const nearSides: [number, number, number, number, number][] = [
      [size, 0, size, size, SLAB_SHADED],
      [size, size, 0, size, SLAB_LIT],
    ];
    for (const [x0, y0, x1, y1, color] of nearSides) {
      const side = [point(x0, y0), point(x1, y1), point(x1, y1, bottom), point(x0, y0, bottom)];
      ground.fillStyle(color, 1);
      ground.fillPoints(side, true);
      ground.lineStyle(2, INK, 0.9);
      ground.strokePoints(side, true);
      ground.lineStyle(1, EDGE_COLOR, 0.5);
      ground.lineBetween(...xy(point(x0, y0, bottom * 0.7)), ...xy(point(x1, y1, bottom * 0.7)));
    }

    paintFloorSurface(this.floorTexture!.getContext(), this.floorSources, projection, size);
    this.floorTexture!.refresh();
    const edge = this.floorEdge!;
    edge.clear();
    const ticks = axisTicks(size);
    edge.lineStyle(2, EDGE_COLOR, 0.8);
    edge.strokePoints(
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
    for (const image of this.poolGrounds) image.destroy();
    this.poolGrounds = [];
    for (const { image } of this.poolMarkers) image.destroy();
    this.poolMarkers = [];
    for (const label of this.poolLabels) label.destroy();
    this.poolLabels = [];
    pools.forEach((pool, index) => {
      const alpha = pool.reserve > 0 ? 1 : EMPTY_POOL_ALPHA;
      // The reach is a circle on the ground, so its picture is fitted to the circle's image.
      const rim = Array.from({ length: 48 }, (_, i) => {
        const angle = (i / 48) * 2 * Math.PI;
        return projection.toScreen({
          x: pool.position.x + pool.radius * Math.cos(angle),
          y: pool.position.y + pool.radius * Math.sin(angle),
        });
      });
      const xs = rim.map((point) => point.x);
      const ys = rim.map((point) => point.y);
      const { x, y } = projection.toScreen(pool.position);
      this.poolGrounds.push(
        this.add
          .image((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, POOL_TEXTURE)
          .setDisplaySize(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
          .setDepth(POOL_DEPTH)
          .setAlpha(alpha),
      );

      // The marker floats over the middle and is sorted with the residents, like the machines.
      const scale = projection.scaleAt(pool.position);
      const image = this.add
        .image(x, y, POOL_MARKER_TEXTURE)
        .setOrigin(0.5, 1)
        .setDepth(RESIDENT_DEPTH + y / CANVAS_HEIGHT)
        .setAlpha(alpha);
      const height = POOL_MARKER_HEIGHT * scale;
      this.poolMarkers.push({
        image,
        restingY: y - POOL_MARKER_HOVER * scale,
        width: (height * image.width) / image.height,
        height,
        phase: index / pools.length,
      });

      const label = this.add
        .text(x, y + 4, `${pool.id} · ${pool.reserve}`, POOL_LABEL_STYLE)
        .setOrigin(0.5, 0)
        .setDepth(POOL_DEPTH)
        .setAlpha(alpha);
      this.poolLabels.push(label);
    });
    this.moveMarkers(performance.now());
  }

  /** Turns each marker around its vertical axis and bobs it up and down. */
  private moveMarkers(now: number): void {
    for (const marker of this.poolMarkers) {
      const pose = markerPose(now, marker.phase);
      marker.image.setDisplaySize(marker.width * pose.width, marker.height).setY(marker.restingY - pose.lift * marker.height);
    }
  }

  private drawMarket(market: MarketView | undefined): void {
    const projection = this.projection!;
    const graphics = this.market!;
    graphics.clear();
    this.marketMachine?.destroy();
    this.marketMachine = null;
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

    // The machine stands on the centre and is sorted with the residents, so one walking
    // behind it is hidden and one in front covers it; one standing on the centre is in front.
    const { x, y } = projection.toScreen(market.position);
    const machine = this.add.image(x, y, MARKET_TEXTURE).setOrigin(MARKET_FOOT_X, 1);
    this.marketMachine = machine
      .setScale((MARKET_HEIGHT * projection.scaleAt(market.position)) / machine.height)
      .setDepth(RESIDENT_DEPTH + y / CANVAS_HEIGHT - 1e-6)
      .setInteractive({ pixelPerfect: true, useHandCursor: true });

    this.marketLabel = this.add
      .text(x, y + 4, '收购点', MARKET_LABEL_STYLE)
      .setOrigin(0.5, 0)
      .setDepth(POOL_DEPTH);
  }

  private drawRigs(rigs: RigView[], pools: PoolView[]): void {
    for (const marker of this.rigMarkers) marker.root.destroy();
    this.rigMarkers = [];
    const counts = new Map<string, number>();
    for (const rig of rigs) {
      const pool = pools.find((candidate) => candidate.id === rig.poolId)!;
      const index = counts.get(pool.id) ?? 0;
      counts.set(pool.id, index + 1);
      const point = this.projection!.toScreen(pool.position);
      const scale = this.projection!.scaleAt(pool.position);
      const machine = this.add.image(0, 0, RIG_TEXTURE, RIG_FRAME)
        .setOrigin(RIG_FOOT_X, 1)
        .setScale(RIG_HEIGHT / RIG_BOUNDS.height)
        .setInteractive({ pixelPerfect: true, alphaTolerance: 8, useHandCursor: true });
      const lights = this.add.graphics();
      for (let slot = 0; slot < 4; slot++) {
        const occupied = rig.slots[slot];
        const color = !occupied ? 0x56616b : occupied.status === 'running' ? 0x9cdbb2 : 0xe0a93b;
        lights.fillStyle(INK, 0.9).fillCircle(-23 + slot * 13, 9, 4);
        lights.fillStyle(color).fillCircle(-23 + slot * 13, 9, 2.5);
      }
      const label = this.add.text(-4, 17, `矿机 #${rig.id}`, MARKET_LABEL_STYLE).setOrigin(0.5, 0);
      const root = this.add.container(point.x + (70 + index * 94) * scale, point.y, [machine, lights, label])
        .setDepth(RESIDENT_DEPTH + point.y / CANVAS_HEIGHT)
        .setScale(scale);
      this.rigMarkers.push({ root, machine, position: pool.position });
    }
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
    this.moveMarkers(now);
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
