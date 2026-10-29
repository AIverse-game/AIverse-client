import mk1 from '../assets/chips/mk1-icon.png';
import mk2 from '../assets/chips/mk2-icon.png';
import mk3 from '../assets/chips/mk3-icon.png';

// Small icons cut from the full pictures beside them (mk1.png and so on): margins trimmed,
// scaled to 64 px.
const PICTURES: Record<string, string | undefined> = { MK1: mk1, MK2: mk2, MK3: mk3 };

/**
 * A chip model's picture, shown beside its name; nothing for a model the server sells
 * that this client has no picture for yet, so the name alone still says which one.
 * With `alone`, the picture stands in for the name: it carries the name as its alt text
 * and tooltip, and a model without a picture shows the name instead.
 */
export function ChipIcon({ model, alone = false }: { model: string; alone?: boolean }) {
  const src = PICTURES[model];
  if (!src) return alone ? model : null;
  return alone ? (
    <img className="chip-icon" src={src} alt={model} title={model} />
  ) : (
    <img className="chip-icon" src={src} alt="" />
  );
}
