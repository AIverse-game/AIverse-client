import type { Position, ResidentId, ResidentView } from '@aiverse/protocol';
import * as Phaser from 'phaser';
import type { GameStore } from '../state/store';
import {
  axisTicks,
  CANVAS_SIZE,
  formatCoordinate,
  MAP_PIXELS,
  MARGIN,
  projectMap,
  type MapProjection,
} from './layout';

const FONT = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
const MOVE_TWEEN_MS = 400;
const GROUND_COLOR = 0x4f7a45;
const GRID_COLOR = 0xffffff;
const BORDER_COLOR = 0xfdf8ee;
const LABEL_STYLE = { fontFamily: FONT, fontSize: '12px', color: '#9fb3a8' };

interface Resident {
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  position: Position;
}

/** Drawn above the ground and axis labels, below the pointer readout. */
const RESIDENT_DEPTH = 1;

/** Draws the square map and its residents from the latest snapshot in the store. */
export class MapScene extends Phaser.Scene {
  private readonly residents = new Map<ResidentId, Resident>();
  private ground: Phaser.GameObjects.Graphics | null = null;
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
    this.cursor = this.add
      .text(MARGIN, MARGIN + MAP_PIXELS + MARGIN / 2, '', LABEL_STYLE)
      .setOrigin(0, 0.5)
      .setDepth(10);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => this.showCursor(pointer));
    this.input.on(Phaser.Input.Events.GAME_OUT, () => this.cursor?.setText(''));

    const unsubscribe = this.store.subscribe(() => this.sync());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    this.events.once(Phaser.Scenes.Events.DESTROY, unsubscribe);
    this.sync();
  }

  private sync(): void {
    const { world } = this.store.getState();
    if (!world) return;
    const resized = world.map.size !== this.drawnSize;
    if (resized) this.drawMap(world.map.size);
    this.syncResidents(world.residents, this.projection!, resized);
  }

  private drawMap(size: number): void {
    const projection = projectMap(size);
    const ground = this.ground!;
    const far = MARGIN + MAP_PIXELS;
    ground.clear();
    ground.fillStyle(GROUND_COLOR, 1);
    ground.fillRect(MARGIN, MARGIN, MAP_PIXELS, MAP_PIXELS);

    for (const label of this.axisLabels) label.destroy();
    this.axisLabels = [];
    ground.lineStyle(1, GRID_COLOR, 0.15);
    for (const tick of axisTicks(size)) {
      const { x, y } = projection.toScreen({ x: tick, y: tick });
      ground.lineBetween(x, MARGIN, x, far);
      ground.lineBetween(MARGIN, y, far, y);
      const text = formatCoordinate(tick);
      this.axisLabels.push(
        this.add.text(x, MARGIN - 6, text, LABEL_STYLE).setOrigin(0.5, 1),
        this.add.text(MARGIN - 6, y, text, LABEL_STYLE).setOrigin(1, 0.5),
      );
    }
    this.axisLabels.push(
      this.add.text(MARGIN + MAP_PIXELS / 2, 4, 'x →', LABEL_STYLE).setOrigin(0.5, 0),
      this.add.text(4, MARGIN + MAP_PIXELS / 2, 'y ↓', LABEL_STYLE).setOrigin(0, 0.5),
    );
    ground.lineStyle(2, BORDER_COLOR, 0.9);
    ground.strokeRect(MARGIN, MARGIN, MAP_PIXELS, MAP_PIXELS);

    this.projection = projection;
    this.drawnSize = size;
  }

  private syncResidents(views: ResidentView[], projection: MapProjection, resized: boolean): void {
    const present = new Set<ResidentId>();
    for (const view of views) {
      present.add(view.id);
      const target = projection.toScreen(view.position);
      const resident = this.residents.get(view.id);
      if (!resident) {
        this.residents.set(view.id, this.createResident(view, target));
        continue;
      }
      resident.body.setFillStyle(Phaser.Display.Color.HexStringToColor(view.color).color);
      resident.label.setText(view.name);
      const moved = resident.position.x !== view.position.x || resident.position.y !== view.position.y;
      resident.position = view.position;
      if (resized) {
        this.tweens.killTweensOf(resident.root);
        resident.root.setPosition(target.x, target.y);
      } else if (moved) {
        this.tweens.killTweensOf(resident.root);
        this.tweens.add({ targets: resident.root, x: target.x, y: target.y, duration: MOVE_TWEEN_MS, ease: 'Sine.easeInOut' });
      }
    }
    for (const [id, resident] of this.residents) {
      if (!present.has(id)) {
        resident.root.destroy();
        this.residents.delete(id);
      }
    }
  }

  private createResident(view: ResidentView, at: { x: number; y: number }): Resident {
    const color = Phaser.Display.Color.HexStringToColor(view.color).color;
    // The circle's centre is the resident's exact position.
    const body = this.add.circle(0, 0, 10, color).setStrokeStyle(2, 0xffffff);
    const label = this.add
      .text(0, 14, view.name, { fontFamily: FONT, fontSize: '13px', color: '#ffffff' })
      .setOrigin(0.5, 0);
    const root = this.add.container(at.x, at.y, [body, label]).setDepth(RESIDENT_DEPTH);
    return { root, body, label, position: view.position };
  }

  private showCursor(pointer: Phaser.Input.Pointer): void {
    const position = this.projection?.toMap(pointer.x, pointer.y);
    this.cursor?.setText(position ? `指针 (${formatCoordinate(position.x)}, ${formatCoordinate(position.y)})` : '');
  }
}

export function createMapGame(parent: HTMLElement, store: GameStore): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    backgroundColor: '#1f2d26',
    banner: false,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [new MapScene(store)],
  });
}
