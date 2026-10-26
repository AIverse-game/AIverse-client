import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createLocalConnection } from './net/local';
import { StoreProvider } from './state/react';
import { GameStore } from './state/store';
import { App } from './ui/App';
import './styles.css';

// The only place that picks a transport. A WebSocket connection replaces this line later.
const store = new GameStore(createLocalConnection());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider store={store}>
      <App />
    </StoreProvider>
  </StrictMode>,
);
