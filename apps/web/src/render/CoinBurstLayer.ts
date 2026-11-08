import type { ParcelView } from '@aiverse/protocol';
import * as THREE from 'three';
import {
  amountPose, burstDuration, COIN_LIFE, COIN_STAGGER, coinCount, coinPose, SPARKS_PER_COIN, sparkPose,
} from './coinBurst';
import { AMOUNT_PIXEL_SCALE, CoinSprites, COIN_PICTURE, COIN_PIXELS } from './coinSprites';
import type { FacilityAnchor } from './FacilityLayer';
import { PayoutWatch } from './payoutWatch';

/** Where in front of the facility's roof the first coin starts, in coin diameters. */
const START_HEIGHT = 0.6;
/** Height of the amount over where the coins started, before it rises, in coin diameters. */
const AMOUNT_HEIGHT = 3.3;
/** Space between neighbouring coins of a burst, in coin diameters. */
const COIN_SPACING = 1.15;
const SPARK_SIZE = 1.5;
/** A coin is drawn this wide in the scene, in map units, per unit of the facility's plot width; kept in bounds so a small plot's coin is still seen and a large one's is not huge. */
const COIN_PER_PLOT = 0.13;
const COIN_MIN = 1.6;
const COIN_MAX = 2.6;
/** Above everything else in the scene, which the sprites do not test depth against. */
const RENDER_ORDER = 20;
const DIAGONALS: ReadonlyArray<readonly [number, number]> = [[1, 1], [-1, 1], [-1, -1], [1, -1]];

/** Where a coin is when its pose says it has ended, which is where its sparks start. */
const END_RISE = coinPose(COIN_LIFE - 1e-6)!.rise;

interface Burst {
  group: THREE.Group;
  age: number;
  count: number;
  /** Width of a coin in map units. */
  unit: number;
  coins: THREE.Sprite[];
  sparks: THREE.Sprite[][];
  amount: THREE.Sprite;
}

/**
 * The coin effect over a facility each time it is paid, after `demos/arcade_owner_income_fx.html`: coins
 * pop up from the roof, turn and hang, then end in sparks while the amount rises and fades. A payout is
 * new when the snapshot's `income` has a later payday than before, see `PayoutWatch`; a page that opens
 * mid-game, or reconnects, does not replay what it missed.
 */
export class CoinBurstLayer {
  private readonly root = new THREE.Group();
  private readonly sprites = new CoinSprites();
  private readonly watch = new PayoutWatch();
  private readonly bursts: Burst[] = [];
  private readonly right = new THREE.Vector3(1, 0, 0);

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
  }

  /** Starts a burst over each facility `parcels` says has been paid since the last call. */
  sync(parcels: readonly ParcelView[], anchorOf: (parcelId: string) => FacilityAnchor | null): void {
    for (const { parcelId, coins } of this.watch.fresh(parcels)) {
      const anchor = anchorOf(parcelId);
      if (anchor) this.start(anchor, coins);
    }
  }

  /** Moves every burst on by `dt` seconds; `camera` says which way is sideways on screen. */
  update(dt: number, camera: THREE.Camera): void {
    if (!this.bursts.length) return;
    // Spread coins along the screen's horizontal, kept level so they do not tilt with the camera.
    const e = camera.matrixWorld.elements;
    this.right.set(e[0]!, 0, e[2]!);
    if (this.right.lengthSq() < 1e-6) this.right.set(1, 0, 0);
    this.right.normalize();
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const burst = this.bursts[i]!;
      burst.age += dt;
      if (burst.age >= burstDuration(burst.count)) {
        this.finish(burst);
        this.bursts.splice(i, 1);
      } else {
        this.place(burst);
      }
    }
  }

  dispose(): void {
    for (const burst of this.bursts) this.finish(burst);
    this.bursts.length = 0;
    this.root.removeFromParent();
    this.sprites.dispose();
  }

  private start(anchor: FacilityAnchor, coins: number): void {
    const count = coinCount(coins);
    const unit = Math.min(Math.max(anchor.side * COIN_PER_PLOT, COIN_MIN), COIN_MAX);
    const group = new THREE.Group();
    group.position.copy(anchor.top);
    const sprite = (material: THREE.SpriteMaterial) => {
      const made = new THREE.Sprite(material);
      made.renderOrder = RENDER_ORDER;
      made.visible = false;
      group.add(made);
      return made;
    };
    const { material, width, height } = this.sprites.amount(`+${coins}`);
    const amount = sprite(material);
    const pixel = unit / COIN_PIXELS;
    amount.scale.set(width * pixel * AMOUNT_PIXEL_SCALE, height * pixel * AMOUNT_PIXEL_SCALE, 1);
    const burst: Burst = {
      group,
      age: 0,
      count,
      unit,
      amount,
      coins: Array.from({ length: count }, () => sprite(this.sprites.coins[0]!)),
      sparks: Array.from({ length: count }, () => Array.from({ length: SPARKS_PER_COIN }, () => sprite(this.sprites.sparks.white))),
    };
    for (const coin of burst.coins) coin.scale.setScalar(unit * (COIN_PICTURE / COIN_PIXELS));
    for (const spark of burst.sparks.flat()) spark.scale.setScalar(pixel * SPARK_SIZE);
    this.root.add(group);
    this.bursts.push(burst);
    this.place(burst);
  }

  /** Puts each sprite of the burst where its pose says at the burst's age. */
  private place(burst: Burst): void {
    const { age, unit, count } = burst;
    const right = this.right;
    const at = (sprite: THREE.Sprite, sideways: number, up: number) => {
      sprite.position.set(right.x * sideways * unit, up * unit, right.z * sideways * unit);
    };
    for (let i = 0; i < count; i++) {
      const sideways = (i - (count - 1) / 2) * COIN_SPACING;
      const coinAge = age - i * COIN_STAGGER;
      const pose = coinPose(coinAge);
      const coin = burst.coins[i]!;
      coin.visible = pose !== null;
      if (pose) {
        coin.material = this.sprites.coins[pose.frame]!;
        coin.scale.setScalar(unit * (COIN_PICTURE / COIN_PIXELS) * pose.scale);
        at(coin, sideways, START_HEIGHT + pose.rise);
      }
      const sparkAge = coinAge - COIN_LIFE;
      const spark = sparkPose(sparkAge);
      burst.sparks[i]!.forEach((sprite, k) => {
        sprite.visible = spark !== null;
        if (!spark) return;
        const [dx, dy] = DIAGONALS[k % DIAGONALS.length]!;
        sprite.material = spark.white ? this.sprites.sparks.white : this.sprites.sparks.gold;
        at(sprite, sideways + (dx * spark.distance) / Math.SQRT2, START_HEIGHT + END_RISE + (dy * spark.distance) / Math.SQRT2);
      });
    }
    const amount = amountPose(age);
    burst.amount.visible = amount !== null;
    if (amount) {
      burst.amount.material.opacity = amount.opacity;
      at(burst.amount, 0, START_HEIGHT + AMOUNT_HEIGHT + amount.rise);
    }
  }

  /** Takes a burst out of the scene and releases its own material; the shared ones stay. */
  private finish(burst: Burst): void {
    this.root.remove(burst.group);
    burst.amount.material.dispose();
  }
}
