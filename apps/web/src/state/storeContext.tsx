import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import type { ClientState, GameStore } from './store';

const StoreContext = createContext<GameStore | null>(null);

export function StoreProvider({ store, children }: { store: GameStore; children: ReactNode }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): GameStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}

export function useGameState(): ClientState {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.getState);
}
