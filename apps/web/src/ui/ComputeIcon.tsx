import compute from '../assets/tokens/token-icon.png';

// A small icon cut from the full picture beside it (token.png): margins trimmed, scaled to 64 px.

/** The compute's picture, shown beside a number of compute; the text next to it says what it is. */
export function ComputeIcon() {
  return <img className="resource-icon" src={compute} alt="" />;
}
