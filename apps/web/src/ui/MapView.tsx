import { useEffect, useRef } from 'react';
import { createMapGame } from '../render/MapScene';
import { useStore } from '../state/react';

/** Hosts the Phaser canvas; React owns the DOM node, Phaser owns what is drawn in it. */
export function MapView() {
  const store = useStore();
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const game = createMapGame(container.current!, store);
    return () => game.destroy(true);
  }, [store]);

  return <div className="map" ref={container} />;
}
