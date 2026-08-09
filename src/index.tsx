import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider } from './AppContext';
import { App } from './App';
import { seedIfEmpty } from './storage';
import './styles.css';

seedIfEmpty();

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <AppProvider>
        <App />
      </AppProvider>
    </React.StrictMode>,
  );
}
