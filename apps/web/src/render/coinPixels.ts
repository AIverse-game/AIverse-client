/**
 * The pixel coin and the pixel digits of `demos/arcade_owner_income_fx.html`, drawn on a 2D canvas: the
 * coin effect over facilities makes its sprites from them and the coin amounts in the panels draw them
 * straight onto a canvas. Nothing here depends on Three.js.
 */

/** The golds of `demos/arcade_owner_income_fx.html`. */
const GOLD = { edge: '#2a1405', d2: '#9a5a0e', mid: '#d48e18', gold: '#f5b92c', lt: '#ffde5e', cream: '#fff4bc' } as const;

/** How an amount is coloured: the outline round every lit pixel, and the colour of each of a digit's five rows. */
export interface AmountColors {
  edge: string;
  rows: readonly [string, string, string, string, string];
}

/** Gold digits lit from the top, as the coins are. */
export const GOLD_AMOUNT: AmountColors = { edge: GOLD.edge, rows: [GOLD.cream, GOLD.lt, GOLD.gold, GOLD.gold, GOLD.mid] };
/** Red digits for a gain shown beside an amount, lit the same way. */
export const RED_AMOUNT: AmountColors = { edge: '#2a0508', rows: ['#ffd6d6', '#ff8f8f', '#ff4d5e', '#ff4d5e', '#c41f3a'] };

const COIN_RADIUS = 5;
/** Width of the picture a coin is drawn in, which leaves its edge a pixel of room. */
export const COIN_PICTURE = 13;
/** Pixels across a coin at its widest. */
export const COIN_PIXELS = 2 * COIN_RADIUS + 1;

/** The demo's 3 × 5 digits and plus sign, and a comma between thousands, one string a row. */
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
  ',': ['000', '000', '000', '010', '100'],
};

/** A coin turned `phase` radians about its upright axis, drawn as in the demo: dark edge, lit upper left, embossed bar. */
export function drawCoin(g: CanvasRenderingContext2D, phase: number): void {
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

/** Pixels each letter of an amount takes across, with the gap after it. */
const LETTER_PITCH = 4;

/** Size in pixels of the picture `drawAmount` makes of `text`; letters without a glyph are left out. */
export function amountSize(text: string): { width: number; height: number } {
  const letters = [...text].filter((letter) => GLYPHS[letter]).length;
  return { width: letters * LETTER_PITCH + 1, height: 7 };
}

/** Draws `text`, such as `+12`, in outlined pixel digits from the top left of `g`, `amountSize(text)` big. */
export function drawAmount(g: CanvasRenderingContext2D, text: string, colors: AmountColors = GOLD_AMOUNT): void {
  const letters = [...text].filter((letter) => GLYPHS[letter]);
  const cells = (paint: (x: number, y: number, row: number) => void) =>
    letters.forEach((letter, i) => GLYPHS[letter]!.forEach((line, row) => [...line].forEach((on, column) => on === '1' && paint(1 + i * LETTER_PITCH + column, 1 + row, row))));
  g.fillStyle = colors.edge;
  cells((x, y) => g.fillRect(x - 1, y - 1, 3, 3));
  cells((x, y, row) => {
    g.fillStyle = colors.rows[row]!;
    g.fillRect(x, y, 1, 1);
  });
}
