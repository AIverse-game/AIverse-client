import mk1 from '../assets/chips/mk1-icon.png';
import mk2 from '../assets/chips/mk2-icon.png';
import mk3 from '../assets/chips/mk3-icon.png';

// Small icons cut from the full pictures beside them (mk1.png and so on): margins trimmed,
// scaled to 64 px.
const PICTURES: Record<string, string | undefined> = { C1: mk1, C2: mk2, C3: mk3 };

/**
 * A crystal tier's picture, shown beside its name; nothing for a tier the server sells
 * that this client has no picture for yet, so the name alone still says which one.
 * With `alone`, the picture stands in for the name: it carries the name as its alt text
 * and tooltip, and a tier without a picture shows the name instead.
 */
export function CrystalIcon({ tier, alone = false }: { tier: string; alone?: boolean }) {
  const src = PICTURES[tier];
  if (!src) return alone ? tier : null;
  return alone ? (
    <img className="crystal-icon" src={src} alt={tier} title={tier} />
  ) : (
    <img className="crystal-icon" src={src} alt="" />
  );
}
