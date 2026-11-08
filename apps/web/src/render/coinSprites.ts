import * as THREE from 'three';
import { COIN_FRAMES } from './coinBurst';
import { canvasTex } from './sceneKit';

/** The golds of `demos/arcade_owner_income_fx.html`. */
const GOLD = { edge: '#2a1405', d2: '#9a5a0e', mid: '#d48e18', gold: '#f5b92c', lt: '#ffde5e', cream: '#fff4bc' } as const;
/** Colours of the five rows of a digit, lit from the top. */
const AMOUNT_ROWS = [GOLD.cream, GOLD.lt, GOLD.gold, GOLD.gold, GOLD.mid] as const;

const COIN_RADIUS = 5;
/** Width of the picture a coin is drawn in, which leaves its edge a pixel of room. */
export const COIN_PICTURE = 13;
/** Pixels across a coin at its widest. */
export const COIN_PIXELS = 2 * COIN_RADIUS + 1;
/** The same size for text, which is drawn a little larger than the coin's pixels so it reads. */
export const AMOUNT_PIXEL_SCALE = 1.3;
export const SPARK_COLORS = { white: 0xffffff, gold: 0xffde5e } as const;

/** The demo's 3 × 5 digits and plus sign, one string a row. */
const GLYPHS: Record<string, readonly string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '011', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  '+': ['000', '010', '111', '010', '000'],
};

/** A coin turned `phase` radians about its upright axis, drawn as in the demo: dark edge, lit upper left, embossed bar. */
function drawCoin(g: CanvasRenderingContext2D, phase: number): void {
  const r = COIN_RADIUS;
  const cx = (COIN_PICTURE - 1) / 2;
  const cy = (COIN_PICTURE - 1) / 2;
  const put = (x: number, y: number, colour: string) => {
    g.fillStyle = colour;
    g.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
  };
  const w = Math.max(0.15, Math.abs(Math.cos(phase))) * r;
  if (w < 1.3) {
    for (let y = -r; y <= r; y++) put(0, y, Math.abs(y) >= r - 0.5 ? GOLD.edge : y < 0 ? GOLD.lt : GOLD.mid);
    return;
  }
  const outerW = w + 0.5, outerR = r + 0.5, innerW = w - 0.6, innerR = r - 0.6;
  const reach = Math.ceil(w);
  const bar = Math.max(0, Math.round(w * 0.22));
  const barHalf = Math.round(r * 0.45);
  for (let y = -r; y <= r; y++) {
    for (let x = -reach; x <= reach; x++) {
      if ((x * x) / (outerW * outerW) + (y * y) / (outerR * outerR) > 1) continue;
      if ((x * x) / (innerW * innerW) + (y * y) / (innerR * innerR) > 1) {
        put(x, y, GOLD.edge);
        continue;
      }
      const d = x / w + y / r;
      let colour: string = d < -0.95 ? GOLD.lt : d > 0.75 ? GOLD.mid : GOLD.gold;
      if (w > 2.4 && Math.abs(x) <= bar && Math.abs(y) <= barHalf) {
        colour = x === -bar ? GOLD.lt : GOLD.d2;
        if (Math.abs(y) === barHalf) colour = GOLD.mid;
      }
      if (x === -Math.round(w * 0.5) && y === -Math.round(r * 0.5)) colour = GOLD.cream;
      put(x, y, colour);
    }
  }
}

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
      const letters = [...text].filter((letter) => GLYPHS[letter]);
      const width = letters.length * 4 + 1;
      const height = 7;
      const texture = canvasTex(width, height, (g) => {
        const cells = (paint: (x: number, y: number, row: number) => void) =>
          letters.forEach((letter, i) => GLYPHS[letter]!.forEach((line, row) => [...line].forEach((on, column) => on === '1' && paint(1 + i * 4 + column, 1 + row, row))));
        g.fillStyle = GOLD.edge;
        cells((x, y) => g.fillRect(x - 1, y - 1, 3, 3));
        cells((x, y, row) => {
          g.fillStyle = AMOUNT_ROWS[row]!;
          g.fillRect(x, y, 1, 1);
        });
      });
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
