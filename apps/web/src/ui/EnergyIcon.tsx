import energy from '../assets/tokens/token-icon.png';

// A small icon cut from the full picture beside it (token.png): margins trimmed, scaled to 64 px.

/** The energy's picture, shown beside a number of energy; the text next to it says what it is. */
export function EnergyIcon() {
  return <img className="resource-icon" src={energy} alt="" />;
}
