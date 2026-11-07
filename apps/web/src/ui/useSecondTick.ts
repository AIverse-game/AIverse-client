import { useEffect, useState } from 'react';

/**
 * Re-renders the caller every second while `active`, for values that move on the local clock
 * between snapshots.
 */
export function useSecondTick(active: boolean): void {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => tick((count) => count + 1), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
}
