import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createWebSocketConnection, defaultServerUrl } from './net/websocket';
import { StoreProvider } from './state/storeContext';
import { GameStore } from './state/store';
import { App } from './ui/App';
import './styles.css';

// The only place that picks a transport and server address.
const serverUrl = import.meta.env.VITE_SERVER_URL || defaultServerUrl(window.location);
const store = new GameStore(createWebSocketConnection(serverUrl));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider store={store}>
      <App />
    </StoreProvider>
  </StrictMode>,
);
