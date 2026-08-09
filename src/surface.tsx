/**
 * surface.tsx — TAP miniapp SDK surface entry point.
 * Exports deterministic, idempotent mount() and unmount().
 */

import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AppProvider } from './AppContext';
import { App } from './App';
import { seedIfEmpty } from './storage';
import './styles.css';

let root: Root | null = null;

export function mount(container: HTMLElement, _context?: unknown): void {
  if (root) return; // idempotent
  seedIfEmpty();
  root = createRoot(container);
  root.render(
    <React.StrictMode>
      <AppProvider>
        <App />
      </AppProvider>
    </React.StrictMode>,
  );
}

export function unmount(): void {
  if (!root) return;
  root.unmount();
  root = null;
}
