import coin from '../assets/tokens/coin-icon.png';

// A small icon cut from the full picture beside it (coin.png): margins trimmed, scaled to 64 px.

/** The coin's picture, shown beside an amount of coins; the text next to it says what it is. */
export function CoinIcon() {
  return <img className="resource-icon" src={coin} alt="" />;
}
