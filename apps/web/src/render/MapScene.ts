import type { Position, ResidentId, ResidentView, WorldView } from '@aiverse/protocol';
import * as Phaser from 'phaser';
import floorCorners from '../assets/floor/metal-floor-corners.png';
import floorNodes from '../assets/floor/metal-floor-nodes.png';
import floorSparse from '../assets/floor/metal-floor-sparse.png';
import floorStrips from '../assets/floor/metal-floor-strips.png';
import type { GameStore } from '../state/store';
import { activeContents } from '../state/facilityContents';
import { createBlockResident, type BlockResident } from './blockResident';
import { drawFacility } from './facilityModels';
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
import { floatPose, stepFloat, type FloatState } from './residentFloat';

const FONT = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
const MOVE_TWEEN_MS = 400;
const BACKGROUND = '#0d141e';
const INK = 0x1d1a16;
const FLOOR_TEXTURES = ['floor-corners', 'floor-sparse', 'floor-nodes', 'floor-strips'] as const;
const FLOOR_SURFACE = 'floor-surface';
const EDGE_COLOR = 0x487d91;
const SLAB_LIT = 0x243846;
const SLAB_SHADED = 0x172633;
const SELECTION_COLOR = 0xfdf8ee;
const LABEL_STYLE = { fontFamily: FONT, fontSize: '12px', color: '#c9b99a' };
const NAME_STYLE = { fontFamily: FONT, fontSize: '13px', color: '#fdf8ee', stroke: '#1d1a16', strokeThickness: 3 };
/** How far outside the map edge the tick labels sit, as a fraction of the map side. */
const LABEL_OFFSET = 0.04;
/** Residents who left the game stay on the map, faded. */
const LEFT_ALPHA = 0.35;
const FIGURE_HEIGHT = 48;
const FIGURE_HOVER = 0;
/** Canvas pixels per figure unit at the map centre. */
const RESIDENT_SCALE = 1.25;

interface Resident {
  root: Phaser.GameObjects.Container;
  /** Ring on the ground marking the selected resident. */
  ring: Phaser.GameObjects.Graphics;
  /** The resident's coloured disc and shadow on the ground, which shrinks as it rises. */
  shadow: Phaser.GameObjects.Graphics;
  figure: Phaser.GameObjects.Container;
  block: BlockResident;
  float: FloatState;
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

/**
 * Residents get depths in [1, 2) by how far down the canvas they stand, so nearer
 * ones cover farther ones. All of them stay above the ground and axis labels and
 * below the pointer readout.
 */
const RESIDENT_DEPTH = 1;
const CURSOR_DEPTH = 10;

/**
 * Draws the map as a tilted ground slab and its residents from the latest snapshot in the store.
 * Clicking a resident selects it; clicking the ground then asks the server to move it there.
 */
export class MapScene extends Phaser.Scene {
  private readonly residents = new Map<ResidentId, Resident>();
  private ground: Phaser.GameObjects.Graphics | null = null;
  private floorEdge: Phaser.GameObjects.Graphics | null = null;
  private parcels: Phaser.GameObjects.Graphics | null = null;
  private facilities: Phaser.GameObjects.Graphics | null = null;
  private floorTexture: Phaser.Textures.CanvasTexture | null = null;
  private floorSources: ImageData[] = [];
  private axisLabels: Phaser.GameObjects.Text[] = [];
  private cursor: Phaser.GameObjects.Text | null = null;
  private projection: MapProjection | null = null;
  private drawnSize: number | null = null;
  private nextContentExpiry: number | null = null;
  private lastUpdate = performance.now();

  constructor(private readonly store: GameStore) {
    super('map');
  }

  preload(): void {
    [floorCorners, floorSparse, floorNodes, floorStrips].forEach((url, index) => {
      this.load.image(FLOOR_TEXTURES[index]!, url);
    });
  }

  create(): void {
    this.floorSources = readFloorSources(FLOOR_TEXTURES.map((key) => this.textures.get(key).getSourceImage() as HTMLImageElement));
    this.floorTexture = this.textures.createCanvas(FLOOR_SURFACE, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (!this.floorTexture) throw new Error('Cannot create floor surface texture');
    // Created first so the ground stays underneath everything else.
    this.ground = this.add.graphics();
    this.add.image(0, 0, FLOOR_SURFACE).setOrigin(0, 0).setDepth(0.1);
    this.floorEdge = this.add.graphics().setDepth(0.2);
    this.parcels = this.add.graphics().setDepth(0.25);
    this.facilities = this.add.graphics().setDepth(0.5);
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
    this.drawParcels(world);
    this.scheduleContentExpiry(world);
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
    const world = this.store.getState().world;
    if (target && world) {
      const count = Math.max(1, Math.floor(world.map.size / world.map.parcelSize));
      const col = Math.min(Math.floor(target.x / world.map.parcelSize), count - 1);
      const row = Math.min(Math.floor(target.y / world.map.parcelSize), count - 1);
      this.store.selectParcel(`L${col}-${row}`);
    }
    if (selected && target && this.store.isFree(selected) && pointer.event.shiftKey) {
      this.store.act({ type: 'move_to', residentId: selected, target });
    }
  }

  private drawParcels(world: WorldView): void {
    const projection = this.projection!;
    const grid = this.parcels!;
    const models = this.facilities!;
    grid.clear();
    models.clear();
    const side = world.map.parcelSize;
    const count = Math.max(1, Math.floor(world.map.size / side));
    const owned = new Map(world.parcels.map((parcel) => [parcel.id, parcel]));
    const selected = this.store.getState().selectedParcel;
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        const id = `L${col}-${row}`;
        const parcel = owned.get(id);
        const right = col === count - 1 ? world.map.size : (col + 1) * side;
        const bottom = row === count - 1 ? world.map.size : (row + 1) * side;
        const points = [
          projection.toScreen({ x: col * side, y: row * side }),
          projection.toScreen({ x: right, y: row * side }),
          projection.toScreen({ x: right, y: bottom }),
          projection.toScreen({ x: col * side, y: bottom }),
        ].map((p) => new Phaser.Math.Vector2(p.x, p.y));
        if (parcel) {
          grid.fillStyle(0x54cadc, 0.13);
          grid.fillPoints(points, true);
        }
        grid.lineStyle(id === selected ? 5 : 1, id === selected ? 0xffdb84 : 0x6e91a4, id === selected ? 1 : 0.35);
        grid.strokePoints(points, true);
      }
    }
    for (const parcel of [...world.parcels].sort((a, b) => a.col + a.row - b.col - b.row)) {
      if (parcel.facility) drawFacility(models, projection, parcel, side, activeContents(parcel.facility, (time) => this.store.countdown(time)));
    }
  }

  private scheduleContentExpiry(world: WorldView): void {
    if (world.game.ended) {
      this.nextContentExpiry = null;
      return;
    }
    const receivedAt = this.store.getState().receivedAt;
    const now = performance.now();
    const future = world.parcels.flatMap((parcel) => parcel.facility?.expiresIn ?? [])
      .map((seconds) => (receivedAt ?? now) + seconds * 1000)
      .filter((time) => time > now);
    this.nextContentExpiry = future.length ? Math.min(...future) : null;
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
        drawShadow(resident.shadow, view.color);
        resident.figure.removeAll(true);
        resident.block = createBlockResident(this, view.color);
        resident.figure.add(resident.block.parts);
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
    // A long pause, such as a hidden tab, must not make the bob jump.
    const elapsed = Math.min(now - this.lastUpdate, 100);
    this.lastUpdate = now;
    if (this.nextContentExpiry !== null && now >= this.nextContentExpiry) {
      const world = this.store.getState().world;
      if (world) {
        this.drawParcels(world);
        this.scheduleContentExpiry(world);
      }
    }
    for (const resident of this.residents.values()) {
      this.stepWalk(resident, now);
      resident.float = stepFloat(resident.float, elapsed, isMoving(resident, now));
      const pose = floatPose(resident.float);
      resident.figure.setY(-pose.lift * 0.25);
      resident.shadow.setScale(pose.shadow);
      const swing = Math.sin(resident.float.angle * 3) * (isMoving(resident, now) ? 0.12 : 0.02);
      resident.block.leftArm.setRotation(swing);
      resident.block.rightArm.setRotation(-swing);
      resident.block.leftLeg.setRotation(-swing * 0.8);
      resident.block.rightLeg.setRotation(swing * 0.8);
    }
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
    const shadow = this.add.graphics();
    drawShadow(shadow, view.color);
    const block = createBlockResident(this, view.color);
    const figure = this.add.container(0, 0, block.parts);
    const label = this.add.text(0, -FIGURE_HEIGHT - FIGURE_HOVER - 6, residentLabel(view), NAME_STYLE).setOrigin(0.5, 1);
    const root = this.add.container(0, 0, [ring, shadow, figure, label]);
    // The container has no size, so this rectangle is in figure units around the feet.
    root.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-14, -FIGURE_HEIGHT - FIGURE_HOVER - 6, 28, FIGURE_HEIGHT + FIGURE_HOVER + 12),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    const shown = { ...view.position };
    // Residents start at different points of the bob, so they do not rise and fall together.
    const float = { angle: Math.random() * 2 * Math.PI, effort: 0 };
    return { root, ring, shadow, figure, block, float, label, color: view.color, position: view.position, shown, walk: null };
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
  if (view.walking) return `${view.name} · 行走中`;
  return view.name;
}

/** Whether the resident is on the way somewhere: along a walk the server reported or in a move tween. */
function isMoving(resident: Resident, now: number): boolean {
  const { walk, shown, position } = resident;
  // A finished walk leaves `shown` at the target while `position` waits for the next snapshot.
  if (walk) return now < walk.start + walk.duration;
  return shown.x !== position.x || shown.y !== position.y;
}

/** The resident's colour as a disc on the ground, and its shadow, centred on (0, 0). */
function drawShadow(shadow: Phaser.GameObjects.Graphics, color: string): void {
  shadow.clear();
  shadow.fillStyle(0x000000, 0.3);
  shadow.fillEllipse(0, 0, 26, 11);
  shadow.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 0.9);
  shadow.fillEllipse(0, 0, 16, 7);
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
