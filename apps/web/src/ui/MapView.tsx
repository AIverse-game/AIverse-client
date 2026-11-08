import { useEffect, useRef } from 'react';
import { createMapRenderer } from '../render/MapRenderer';
import { useStore } from '../state/storeContext';

/** Hosts the map canvas; React owns the DOM node, the renderer owns what is drawn in it. */
export function MapView() {
  const store = useStore();
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const renderer = createMapRenderer(container.current!, store);
    return () => renderer.destroy();
  }, [store]);

  return <div className="map" ref={container} />;
}
