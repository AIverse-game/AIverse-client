import * as THREE from 'three';
import { COIN_FRAMES } from './coinBurst';
import { amountSize, COIN_PICTURE, drawAmount, drawCoin } from './coinPixels';
import { canvasTex } from './sceneKit';

/** Text is drawn a little larger than the coin's pixels so it reads. */
export const AMOUNT_PIXEL_SCALE = 1.3;
export const SPARK_COLORS = { white: 0xffffff, gold: 0xffde5e } as const;

/** What the layer draws coins, sparks and amounts with, kept and released together. Nothing is drawn through the depth buffer, so a burst shows over the facility it is for. */
export class CoinSprites {
  /** One material per frame of the half turn; the coins all share them. */
  readonly coins: THREE.SpriteMaterial[];
  readonly sparks: Record<keyof typeof SPARK_COLORS, THREE.SpriteMaterial>;
  private readonly amounts = new Map<string, { material: THREE.SpriteMaterial; width: number; height: number }>();
  private readonly textures: THREE.Texture[] = [];

  constructor() {
    this.coins = Array.from({ length: COIN_FRAMES }, (_, frame) => {
      const texture = canvasTex(COIN_PICTURE, COIN_PICTURE, (g) => drawCoin(g, (frame / COIN_FRAMES) * Math.PI));
      this.textures.push(texture);
      return this.material({ map: texture });
    });
    this.sparks = {
      white: this.material({ color: SPARK_COLORS.white }),
      gold: this.material({ color: SPARK_COLORS.gold }),
    };
  }

  /**
   * A material for the amount `text`, such as `+12`, with its picture's size in pixels. Each call gives a
   * fresh material, which fades without affecting other amounts and is for the caller to dispose; the
   * picture itself is shared.
   */
  amount(text: string): { material: THREE.SpriteMaterial; width: number; height: number } {
    let shared = this.amounts.get(text);
    if (!shared) {
      const { width, height } = amountSize(text);
      const texture = canvasTex(width, height, (g) => drawAmount(g, text));
      this.textures.push(texture);
      shared = { material: this.material({ map: texture }), width, height };
      this.amounts.set(text, shared);
    }
    return { material: shared.material.clone(), width: shared.width, height: shared.height };
  }

  dispose(): void {
    for (const material of [...this.coins, ...Object.values(this.sparks), ...[...this.amounts.values()].map((amount) => amount.material)]) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.amounts.clear();
  }

  private material(parameters: THREE.SpriteMaterialParameters): THREE.SpriteMaterial {
    return new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false, ...parameters });
  }
}
