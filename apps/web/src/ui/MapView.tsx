import { useEffect, useRef } from 'react';
import { createMapGame } from '../render/MapScene';
import { useStore } from '../state/storeContext';
import { wheelScrollDelta } from './mapScroll';

/** Hosts the Phaser canvas; React owns the DOM node, Phaser owns what is drawn in it. */
export function MapView() {
  const store = useStore();
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const game = createMapGame(container.current!, store);
    const viewport = container.current!.parentElement;
    const onScroll = () => game.scale.updateBounds();
    if (viewport) {
      viewport.addEventListener('scroll', onScroll);
      viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) / 2;
      viewport.scrollTop = (viewport.scrollHeight - viewport.clientHeight) / 2;
      onScroll();
    }
    const onWheel = (event: WheelEvent) => {
      if (!viewport) return;
      const { x, y } = wheelScrollDelta(event, { width: viewport.clientWidth, height: viewport.clientHeight });
      viewport.scrollLeft += x;
      viewport.scrollTop += y;
      onScroll();
      event.preventDefault();
    };
    viewport?.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => {
      viewport?.removeEventListener('wheel', onWheel, { capture: true });
      viewport?.removeEventListener('scroll', onScroll);
      game.destroy(true);
    };
  }, [store]);

  return <div className="map" ref={container} />;
}
