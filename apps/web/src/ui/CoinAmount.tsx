import { useEffect, useRef, useState } from 'react';
import { amountSize, COIN_PICTURE, drawAmount, drawCoin, RED_AMOUNT } from '../render/coinPixels';
import { coinTurn, COUNT_MS, countUp, GAIN_MS } from './coinCountUp';

/** Screen pixels per pixel of the coin and the digits; whole numbers keep pixel art sharp. */
const PIXEL = 2;

/** Sizes `canvas` to a picture `width` × `height` pixels, shown `PIXEL` times as large, and draws it. */
function paint(canvas: HTMLCanvasElement | null, width: number, height: number, draw: (g: CanvasRenderingContext2D) => void): void {
  const g = canvas?.getContext('2d');
  if (!canvas || !g) return;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width * PIXEL}px`;
    canvas.style.height = `${height * PIXEL}px`;
  }
  g.clearRect(0, 0, width, height);
  draw(g);
}

const amountText = (coins: number) => coins.toLocaleString('en-US');

/**
 * An amount of coins drawn like the coin effect over facilities: the pixel coin and gold pixel digits.
 * When the amount changes the number runs to the new value while the coin turns once; when it grows,
 * the gain shows in red beside it, rises a little and fades. The first amount is drawn as it is.
 */
export function CoinAmount({ coins }: { coins: number }) {
  const coinCanvas = useRef<HTMLCanvasElement>(null);
  const amountCanvas = useRef<HTMLCanvasElement>(null);
  const gainCanvas = useRef<HTMLCanvasElement>(null);
  /** The number on screen, which lags `coins` while it runs up. */
  const shown = useRef(coins);
  /** The amount last asked for, to tell how much was gained. */
  const target = useRef(coins);
  const [gain, setGain] = useState<{ coins: number; key: number } | null>(null);

  useEffect(() => {
    const drawNumber = (value: number) => {
      const text = amountText(value);
      const { width, height } = amountSize(text);
      paint(amountCanvas.current, width, height, (g) => drawAmount(g, text));
    };
    const drawCoinAt = (phase: number) => paint(coinCanvas.current, COIN_PICTURE, COIN_PICTURE, (g) => drawCoin(g, phase));
    // With less motion asked for, the coin stays still; the CSS leaves out the pop and the rise.
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const from = shown.current;
    const gained = coins - target.current;
    target.current = coins;
    if (from === coins) {
      drawNumber(coins);
      drawCoinAt(0);
      return;
    }
    if (gained > 0) {
      setGain((before) => ({ coins: gained, key: (before?.key ?? 0) + 1 }));
      // Taking the class off and putting it back replays the pop for every gain, even one mid-count.
      const value = amountCanvas.current;
      if (value) {
        value.classList.remove('rising');
        void value.offsetWidth;
        value.classList.add('rising');
      }
    }
    const start = performance.now();
    let frame = 0;
    const step = () => {
      const elapsed = performance.now() - start;
      shown.current = countUp(from, coins, elapsed);
      drawNumber(shown.current);
      drawCoinAt(still ? 0 : coinTurn(elapsed));
      if (elapsed < COUNT_MS) frame = requestAnimationFrame(step);
    };
    step();
    return () => cancelAnimationFrame(frame);
  }, [coins]);

  useEffect(() => {
    if (!gain) return;
    const text = `+${amountText(gain.coins)}`;
    const { width, height } = amountSize(text);
    paint(gainCanvas.current, width, height, (g) => drawAmount(g, text, RED_AMOUNT));
    const timer = setTimeout(() => setGain(null), GAIN_MS);
    return () => clearTimeout(timer);
  }, [gain]);

  return (
    <span className="coin-amount" role="img" aria-label={`${coins.toLocaleString('zh-CN')} 金币`}>
      {gain && <canvas key={gain.key} ref={gainCanvas} className="coin-gain" aria-hidden="true" />}
      <canvas ref={coinCanvas} className="coin-amount-coin" aria-hidden="true" />
      <canvas
        ref={amountCanvas}
        className="coin-amount-value"
        aria-hidden="true"
        onAnimationEnd={(event) => event.currentTarget.classList.remove('rising')}
      />
    </span>
  );
}
