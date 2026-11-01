import token from '../assets/tokens/token-icon.png';

// A small icon cut from the full picture beside it (token.png): margins trimmed, scaled to 64 px.

/** The token's picture, shown beside a number of tokens; the text next to it says what it is. */
export function TokenIcon() {
  return <img className="resource-icon" src={token} alt="" />;
}
