import { useEffect, useRef } from 'react';
import { createTownGame } from '../render/TownScene';
import { useStore } from '../state/react';

/** Hosts the Phaser canvas; React owns the DOM node, Phaser owns what is drawn in it. */
export function TownView() {
  const store = useStore();
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const game = createTownGame(container.current!, store);
    return () => game.destroy(true);
  }, [store]);

  return <div className="town" ref={container} />;
}
