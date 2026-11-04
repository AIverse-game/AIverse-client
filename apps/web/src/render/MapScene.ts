import type { MarketView, Position, QuarryView, ResidentId, ResidentView, SpringView, TowerView, WorkshopView } from '@aiverse/protocol';
import * as Phaser from 'phaser';
import floorCorners from '../assets/floor/metal-floor-corners.png';
import floorNodes from '../assets/floor/metal-floor-nodes.png';
import floorSparse from '../assets/floor/metal-floor-sparse.png';
import floorStrips from '../assets/floor/metal-floor-strips.png';
import marketSprite from '../assets/market/market-sprite.png';
import springMarkerSprite from '../assets/pools/pool-marker-sprite.png';
import springSprite from '../assets/pools/pool-sprite.png';
import residentSprite from '../assets/residents/resident-sprite.png';
import towerSprite from '../assets/rigs/mining-rig.png';
import type { GameStore } from '../state/store';
import { paintFloorSurface, readFloorSources } from './floorSurface';
import {
  axisTicks,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  formatCoordinate,
  projectMap,
  towerPositionOnSpring,
  SLAB_DEPTH,
  type MapProjection,
} from './layout';
import { markerPose } from './springMarkerMotion';
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
/**
 * Energy springs: a square pad lying on the ground around their centre, its edges touching the reach
 * circle (so the circle is inscribed in it and the corners stick out), with a marker floating above its middle. Both pictures are the user's pool.png and
 * pool-marker.png beside them, trimmed to the visible pixels (alpha above 8) and scaled down to
 * 256 px wide and 128 px high.
 */
const SPRING_TEXTURE = 'spring';
const SPRING_MARKER_TEXTURE = 'spring-marker';
/** Side of the pad before it is turned and squashed onto the ground; only its ratio to the result matters. */
const SPRING_PAD_SIZE = 100;
/** Height of the floating marker in canvas pixels at the map centre. */
const SPRING_MARKER_HEIGHT = 44;
/** How far the marker's bottom hovers above the spring's centre, in canvas pixels at the map centre. */
const SPRING_MARKER_HOVER = 10;
/** Springs with nothing left stay on the map, faded. */
const EMPTY_SPRING_ALPHA = 0.35;
const SPRING_LABEL_STYLE = { fontFamily: FONT, fontSize: '12px', color: '#dff8fc', stroke: '#1d1a16', strokeThickness: 3 };
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

const TOWER_TEXTURE = 'tower';
const TOWER_FRAME = 'machine';
/** Visible area (alpha > 8) within the user's unchanged 1254 × 1254 transparent PNG. */
const TOWER_BOUNDS = { x: 87, y: 311, width: 1083, height: 840 };
const TOWER_HEIGHT = 66;
/** Ground contact near the front foot, measured within the visible frame. */
const TOWER_FOOT_X = 0.7;

/**
 * A resident is the user's resident.png, a spirit that floats, trimmed to the visible pixels
 * (alpha above 8) and scaled to 128 px high. Its size and positions are in figure units, which
 * `RESIDENT_SCALE` turns into canvas pixels; the resident's own colour is the disc on the ground
 * under it, since the picture is the same for everyone.
 */
const RESIDENT_TEXTURE = 'resident';
const FIGURE_HEIGHT = 48;
/** How far above the ground the picture's lowest pixel floats when it is not bobbing. */
const FIGURE_HOVER = 6;
/** Canvas pixels per figure unit at the map centre. */
const RESIDENT_SCALE = 1.25;

interface Resident {
  root: Phaser.GameObjects.Container;
  /** Ring on the ground marking the selected resident. */
  ring: Phaser.GameObjects.Graphics;
  /** The resident's coloured disc and shadow on the ground, which shrinks as it rises. */
  shadow: Phaser.GameObjects.Graphics;
  figure: Phaser.GameObjects.Image;
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

interface SpringMarker {
  image: Phaser.GameObjects.Image;
  /** Canvas pixels the marker's bottom edge rests above its ground point, and its full size there. */
  restingY: number;
  width: number;
  height: number;
  /** Offsets this marker's spin and bob from the others'. */
  phase: number;
}

/** Springs lie on the ground, above the turf and below every resident. */
const SPRING_DEPTH = 0.5;

/**
 * Shard quarries and the workshop: a patch of ground the size of their reach with a small drawn
 * figure in the middle, sorted with the residents. Drawn here until there are pictures for them.
 */
const QUARRY_FILL = 0x8f6fd6;
const QUARRY_EDGE = 0xc9b3f5;
const QUARRY_LABEL_STYLE = { fontFamily: FONT, fontSize: '12px', color: '#e4d8fb', stroke: '#1d1a16', strokeThickness: 3 };
const WORKSHOP_FILL = 0x4fa58a;
const WORKSHOP_EDGE = 0x9cdbb2;
const WORKSHOP_LABEL_STYLE = { fontFamily: FONT, fontSize: '12px', color: '#c8f0d7', stroke: '#1d1a16', strokeThickness: 3 };
/** Quarries with nothing left stay on the map, faded. */
const EMPTY_QUARRY_ALPHA = 0.35;
/** Canvas pixels per figure unit of a quarry's or the workshop's figure at the map centre. */
const SITE_FIGURE_SCALE = 2;

/**
 * Residents get depths in [1, 2) by how far down the canvas they stand, so nearer
 * ones cover farther ones. All of them stay above the ground and axis labels and
 * below the pointer readout.
 */
const RESIDENT_DEPTH = 1;
const CURSOR_DEPTH = 10;

/**
 * Draws the map as a tilted ground slab, its springs, quarries, workshop, market and residents from the latest
 * snapshot in the store.
 * Clicking a resident selects it; clicking the ground then asks the server to move it there.
 */
export class MapScene extends Phaser.Scene {
  private readonly residents = new Map<ResidentId, Resident>();
  private ground: Phaser.GameObjects.Graphics | null = null;
  private floorEdge: Phaser.GameObjects.Graphics | null = null;
  private floorTexture: Phaser.Textures.CanvasTexture | null = null;
  private floorSources: ImageData[] = [];
  private springGrounds: Phaser.GameObjects.Container[] = [];
  private springMarkers: SpringMarker[] = [];
  private springLabels: Phaser.GameObjects.Text[] = [];
  private market: Phaser.GameObjects.Graphics | null = null;
  private marketMachine: Phaser.GameObjects.Image | null = null;
  private marketLabel: Phaser.GameObjects.Text | null = null;
  /** Where the market was last drawn, so it is redrawn only when that changes. */
  private drawnMarket = '';
  /** What the springs were last drawn from, so they are redrawn only when that changes. */
  private drawnSprings = '';
  /** Patches of the quarries and the workshop, and their figures and labels. */
  private sites: Phaser.GameObjects.Graphics | null = null;
  private siteObjects: Phaser.GameObjects.GameObject[] = [];
  private drawnSites = '';
  private drawnTowers = '';
  private towerMarkers: { root: Phaser.GameObjects.Container; machine: Phaser.GameObjects.Image; position: Position }[] = [];
  private axisLabels: Phaser.GameObjects.Text[] = [];
  private cursor: Phaser.GameObjects.Text | null = null;
  private projection: MapProjection | null = null;
  private drawnSize: number | null = null;
  private lastUpdate = performance.now();

  constructor(private readonly store: GameStore) {
    super('map');
  }

  preload(): void {
    this.load.image(MARKET_TEXTURE, marketSprite);
    this.load.image(SPRING_TEXTURE, springSprite);
    this.load.image(SPRING_MARKER_TEXTURE, springMarkerSprite);
    this.load.image(TOWER_TEXTURE, towerSprite);
    this.load.image(RESIDENT_TEXTURE, residentSprite);
    [floorCorners, floorSparse, floorNodes, floorStrips].forEach((url, index) => {
      this.load.image(FLOOR_TEXTURES[index]!, url);
    });
  }

  create(): void {
    const texture = this.textures.get(TOWER_TEXTURE);
    if (!texture.has(TOWER_FRAME)) {
      texture.add(TOWER_FRAME, 0, TOWER_BOUNDS.x, TOWER_BOUNDS.y, TOWER_BOUNDS.width, TOWER_BOUNDS.height);
    }
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.floorSources = readFloorSources(FLOOR_TEXTURES.map((key) => this.textures.get(key).getSourceImage() as HTMLImageElement));
    this.floorTexture = this.textures.createCanvas(FLOOR_SURFACE, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (!this.floorTexture) throw new Error('Cannot create floor surface texture');
    // Created first so the ground stays underneath everything else.
    this.ground = this.add.graphics();
    this.add.image(0, 0, FLOOR_SURFACE).setOrigin(0, 0).setDepth(0.1);
    this.floorEdge = this.add.graphics().setDepth(0.2);
    this.market = this.add.graphics().setDepth(SPRING_DEPTH);
    this.sites = this.add.graphics().setDepth(SPRING_DEPTH);
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
    const springs = JSON.stringify([world.map.size, world.springs]);
    if (springs !== this.drawnSprings) {
      this.drawSprings(world.springs);
      this.drawnSprings = springs;
    }
    // Only the place is drawn: the price moves with time, so the side panel shows it.
    const market = JSON.stringify([world.map.size, world.market?.position, world.market?.radius]);
    if (market !== this.drawnMarket) {
      this.drawMarket(world.market);
      this.drawnMarket = market;
    }
    const sites = JSON.stringify([world.map.size, world.quarries, world.workshop?.position, world.workshop?.radius]);
    if (sites !== this.drawnSites) {
      this.drawSites(world.quarries, world.workshop);
      this.drawnSites = sites;
    }
    this.syncResidents(world.residents, resized);
    const towers = JSON.stringify([
      world.map.size,
      world.towers,
      world.game.ended,
      world.springs.map(({ id, position, radius }) => [id, position, radius]),
    ]);
    if (towers !== this.drawnTowers) {
      this.drawTowers(world.towers, world.springs);
      this.drawnTowers = towers;
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
    const tower = this.towerMarkers.find((marker) => over.includes(marker.machine));
    if (tower && selected && this.store.isFree(selected)) {
      this.store.act({ type: 'move_to', residentId: selected, target: tower.position });
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

  private drawSprings(springs: SpringView[]): void {
    const projection = this.projection!;
    for (const pad of this.springGrounds) pad.destroy();
    this.springGrounds = [];
    for (const { image } of this.springMarkers) image.destroy();
    this.springMarkers = [];
    for (const label of this.springLabels) label.destroy();
    this.springLabels = [];
    springs.forEach((spring, index) => {
      const alpha = spring.reserve > 0 ? 1 : EMPTY_SPRING_ALPHA;
      // The pad is square on the ground, so its corners are projected and the picture turned a
      // quarter of the way round, as the map is, then squashed to fit the diamond they make.
      const { x, y } = projection.toScreen(spring.position);
      const [near, far] = [-spring.radius, spring.radius];
      const corners = [
        { x: spring.position.x + near, y: spring.position.y + near },
        { x: spring.position.x + far, y: spring.position.y + near },
        { x: spring.position.x + far, y: spring.position.y + far },
        { x: spring.position.x + near, y: spring.position.y + far },
      ].map((corner) => projection.toScreen(corner));
      const xs = corners.map((point) => point.x);
      const ys = corners.map((point) => point.y);
      const turned = this.add.image(0, 0, SPRING_TEXTURE).setDisplaySize(SPRING_PAD_SIZE, SPRING_PAD_SIZE).setRotation(Math.PI / 4);
      const diagonal = SPRING_PAD_SIZE * Math.SQRT2;
      this.springGrounds.push(
        this.add
          .container((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, [turned])
          .setScale((Math.max(...xs) - Math.min(...xs)) / diagonal, (Math.max(...ys) - Math.min(...ys)) / diagonal)
          .setDepth(SPRING_DEPTH)
          .setAlpha(alpha),
      );

      // The marker floats over the middle and is sorted with the residents, like the machines.
      const scale = projection.scaleAt(spring.position);
      const image = this.add
        .image(x, y, SPRING_MARKER_TEXTURE)
        .setOrigin(0.5, 1)
        .setDepth(RESIDENT_DEPTH + y / CANVAS_HEIGHT)
        .setAlpha(alpha);
      const height = SPRING_MARKER_HEIGHT * scale;
      this.springMarkers.push({
        image,
        restingY: y - SPRING_MARKER_HOVER * scale,
        width: (height * image.width) / image.height,
        height,
        phase: index / springs.length,
      });

      const label = this.add
        .text(x, y + 4, `${spring.id} · ${spring.reserve}`, SPRING_LABEL_STYLE)
        .setOrigin(0.5, 0)
        .setDepth(SPRING_DEPTH)
        .setAlpha(alpha);
      this.springLabels.push(label);
    });
    this.moveMarkers(performance.now());
  }

  /** Turns each marker around its vertical axis and bobs it up and down. */
  private moveMarkers(now: number): void {
    for (const marker of this.springMarkers) {
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
      .setDepth(SPRING_DEPTH);
  }

  private drawSites(quarries: QuarryView[], workshop: WorkshopView | undefined): void {
    const projection = this.projection!;
    const ground = this.sites!;
    ground.clear();
    for (const object of this.siteObjects) object.destroy();
    this.siteObjects = [];
    const patch = (position: Position, radius: number, fill: number, edge: number, alpha: number) => {
      const rim = Array.from({ length: 48 }, (_, i) => {
        const angle = (i / 48) * 2 * Math.PI;
        const { x, y } = projection.toScreen({ x: position.x + radius * Math.cos(angle), y: position.y + radius * Math.sin(angle) });
        return new Phaser.Math.Vector2(x, y);
      });
      ground.fillStyle(fill, 0.25 * alpha).fillPoints(rim, true);
      ground.lineStyle(2, edge, 0.8 * alpha).strokePoints(rim, true);
    };
    // A figure stands on its centre, scaled by distance and sorted with the residents.
    const figure = (position: Position, draw: (graphics: Phaser.GameObjects.Graphics) => void) => {
      const { x, y } = projection.toScreen(position);
      const graphics = this.add.graphics({ x, y });
      draw(graphics);
      this.siteObjects.push(graphics.setScale(SITE_FIGURE_SCALE * projection.scaleAt(position)).setDepth(RESIDENT_DEPTH + y / CANVAS_HEIGHT));
      return { x, y };
    };

    for (const quarry of quarries) {
      const alpha = quarry.reserve > 0 ? 1 : EMPTY_QUARRY_ALPHA;
      patch(quarry.position, quarry.radius, QUARRY_FILL, QUARRY_EDGE, alpha);
      const { x, y } = figure(quarry.position, (graphics) => {
        // A cluster of three upright crystals, the middle one tallest.
        for (const [dx, height, width] of [[-9, 18, 7], [9, 14, 6], [0, 28, 9]] as const) {
          const points = [
            new Phaser.Math.Vector2(dx, 0),
            new Phaser.Math.Vector2(dx - width / 2, -height * 0.7),
            new Phaser.Math.Vector2(dx, -height),
            new Phaser.Math.Vector2(dx + width / 2, -height * 0.7),
          ];
          graphics.fillStyle(QUARRY_FILL, alpha).fillPoints(points, true);
          graphics.lineStyle(1.5, INK, 0.9 * alpha).strokePoints(points, true);
          graphics.fillStyle(QUARRY_EDGE, 0.8 * alpha).fillTriangle(dx, -height, dx + width / 2, -height * 0.7, dx, -height * 0.45);
        }
      });
      this.siteObjects.push(
        this.add.text(x, y + 4, `${quarry.id} · ${quarry.reserve}`, QUARRY_LABEL_STYLE).setOrigin(0.5, 0).setDepth(SPRING_DEPTH).setAlpha(alpha),
      );
    }

    if (!workshop) return;
    patch(workshop.position, workshop.radius, WORKSHOP_FILL, WORKSHOP_EDGE, 1);
    const { x, y } = figure(workshop.position, (graphics) => {
      // A small hut with a chimney and a glowing doorway.
      graphics.fillStyle(0x2f5f50).fillRect(-16, -22, 32, 22);
      graphics.fillStyle(0x3b7a66).fillTriangle(-20, -22, 20, -22, 0, -36);
      graphics.fillStyle(0x56616b).fillRect(8, -38, 6, 12);
      graphics.fillStyle(0xf7dc8a).fillRect(-5, -13, 10, 13);
      graphics.lineStyle(1.5, INK, 0.9).strokeRect(-16, -22, 32, 22).strokeTriangle(-20, -22, 20, -22, 0, -36);
    });
    this.siteObjects.push(this.add.text(x, y + 4, '工坊', WORKSHOP_LABEL_STYLE).setOrigin(0.5, 0).setDepth(SPRING_DEPTH));
  }

  private drawTowers(towers: TowerView[], springs: SpringView[]): void {
    for (const marker of this.towerMarkers) marker.root.destroy();
    this.towerMarkers = [];
    for (const spring of springs) {
      const atSpring = towers.filter((tower) => tower.springId === spring.id);
      if (atSpring.length === 0) continue;
      // A spring pad is smaller than two machine sprites, so one marker represents the group.
      const tower = atSpring[0]!;
      const position = towerPositionOnSpring(spring);
      const point = this.projection!.toScreen(position);
      const scale = this.projection!.scaleAt(position);
      const machine = this.add.image(0, 0, TOWER_TEXTURE, TOWER_FRAME)
        .setOrigin(TOWER_FOOT_X, 1)
        .setScale(TOWER_HEIGHT / TOWER_BOUNDS.height)
        .setInteractive({ pixelPerfect: true, alphaTolerance: 8, useHandCursor: true });
      const lights = this.add.graphics();
      if (atSpring.length === 1) {
        for (let slot = 0; slot < 4; slot++) {
          const occupied = tower.slots[slot];
          const color = !occupied ? 0x56616b : occupied.status === 'running' ? 0x9cdbb2 : 0xe0a93b;
          lights.fillStyle(INK, 0.9).fillCircle(-23 + slot * 13, 9, 4);
          lights.fillStyle(color).fillCircle(-23 + slot * 13, 9, 2.5);
        }
      }
      const labelText = atSpring.length === 1 ? `汲能塔 #${tower.id}` : `汲能塔 ×${atSpring.length}`;
      const label = this.add.text(-4, 17, labelText, MARKET_LABEL_STYLE).setOrigin(0.5, 0);
      const root = this.add.container(point.x, point.y, [machine, lights, label])
        .setDepth(RESIDENT_DEPTH + point.y / CANVAS_HEIGHT)
        .setScale(scale);
      this.towerMarkers.push({ root, machine, position: spring.position });
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
        drawShadow(resident.shadow, view.color);
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
    for (const resident of this.residents.values()) {
      this.stepWalk(resident, now);
      resident.float = stepFloat(resident.float, elapsed, isMoving(resident, now));
      const pose = floatPose(resident.float);
      resident.figure.setY(-FIGURE_HOVER - pose.lift);
      resident.shadow.setScale(pose.shadow);
    }
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
    const shadow = this.add.graphics();
    drawShadow(shadow, view.color);
    const figure = this.add.image(0, -FIGURE_HOVER, RESIDENT_TEXTURE).setOrigin(0.5, 1);
    figure.setScale(FIGURE_HEIGHT / figure.height);
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
    return { root, ring, shadow, figure, float, label, color: view.color, position: view.position, shown, walk: null };
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
  if (view.harvesting) return `${view.name} · 汲取中`;
  if (view.digging) return `${view.name} · 挖砂中`;
  if (view.refining) return `${view.name} · 炼制中`;
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
