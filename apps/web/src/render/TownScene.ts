import type { PlayerId, PublicPlayer, WorldView, ZoneId } from '@aiverse/protocol';
import * as Phaser from 'phaser';
import { ACTION_NAMES, ZONE_NAMES } from '../labels';
import type { GameStore } from '../state/store';
import { residentPosition, WORLD_HEIGHT, WORLD_WIDTH, ZONE_LAYOUT } from './layout';

const FONT = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
const MAX_TWEEN_MS = 700;

interface Resident {
  root: Phaser.GameObjects.Container;
  action: Phaser.GameObjects.Text;
  zone: ZoneId;
}

/** Draws the latest snapshot from the store and animates the difference. */
export class TownScene extends Phaser.Scene {
  private readonly residents = new Map<PlayerId, Resident>();
  /** Created first so roads stay underneath; filled once the map arrives. */
  private roads: Phaser.GameObjects.Graphics | null = null;
  private roadsDrawn = false;

  constructor(private readonly store: GameStore) {
    super('town');
  }

  create(): void {
    this.roads = this.add.graphics();
    this.drawZones();
    const unsubscribe = this.store.subscribe(() => this.sync());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    this.events.once(Phaser.Scenes.Events.DESTROY, unsubscribe);
    this.sync();
  }

  private drawZones(): void {
    for (const [id, box] of Object.entries(ZONE_LAYOUT) as [ZoneId, (typeof ZONE_LAYOUT)[ZoneId]][]) {
      const area = this.add.graphics();
      area.fillStyle(box.color, 1);
      area.fillRoundedRect(box.x - box.width / 2, box.y - box.height / 2, box.width, box.height, 16);
      this.add
        .text(box.x, box.y - box.height / 2 + 18, ZONE_NAMES[id], { fontFamily: FONT, fontSize: '18px', color: '#fdf8ee' })
        .setOrigin(0.5);
    }
  }

  private drawRoads(roads: Phaser.GameObjects.Graphics, world: WorldView): void {
    roads.lineStyle(14, 0xd9c8a0, 0.6);
    for (const zone of world.zones) {
      for (const neighbor of zone.neighbors) {
        if (zone.id < neighbor) {
          const a = ZONE_LAYOUT[zone.id];
          const b = ZONE_LAYOUT[neighbor];
          roads.lineBetween(a.x, a.y, b.x, b.y);
        }
      }
    }
    this.roadsDrawn = true;
  }

  private sync(): void {
    const { world, roundDurationMs } = this.store.getState();
    if (!world) return;
    if (!this.roadsDrawn && this.roads) this.drawRoads(this.roads, world);
    const duration = Math.min(MAX_TWEEN_MS, roundDurationMs / 2);
    world.players.forEach((player, seat) => {
      const resident = this.residents.get(player.id) ?? this.createResident(player, seat);
      resident.action.setText(player.lastAction ? ACTION_NAMES[player.lastAction] : '');
      if (resident.zone !== player.zone) {
        resident.zone = player.zone;
        const target = residentPosition(player.zone, seat);
        this.tweens.add({ targets: resident.root, x: target.x, y: target.y, duration, ease: 'Sine.easeInOut' });
      }
    });
  }

  private createResident(player: PublicPlayer, seat: number): Resident {
    const { x, y } = residentPosition(player.zone, seat);
    const color = Phaser.Display.Color.HexStringToColor(player.color).color;
    const body = this.add.circle(0, 0, 14, color).setStrokeStyle(2, 0xffffff);
    const name = this.add
      .text(0, 22, player.name, { fontFamily: FONT, fontSize: '13px', color: '#ffffff' })
      .setOrigin(0.5, 0);
    const action = this.add
      .text(0, -20, '', { fontFamily: FONT, fontSize: '12px', color: '#1d2b24', backgroundColor: '#fdf8ee', padding: { x: 4, y: 1 } })
      .setOrigin(0.5, 1);
    const root = this.add.container(x, y, [body, name, action]);
    const resident: Resident = { root, action, zone: player.zone };
    this.residents.set(player.id, resident);
    return resident;
  }
}

export function createTownGame(parent: HTMLElement, store: GameStore): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    backgroundColor: '#24372d',
    banner: false,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [new TownScene(store)],
  });
}
