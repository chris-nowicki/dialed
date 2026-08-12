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

let reactRoot: Root | null = null;

export function mount(container: HTMLElement, _context?: unknown): { unmount: () => void };
export function mount(container: unknown, _context?: unknown): { unmount: () => void } | undefined;
export function mount(container: unknown, _context?: unknown): { unmount: () => void } | undefined {
  // The existing installation uses this expose for both package lifecycle and
  // its UI surface. Package lifecycle calls do not provide a DOM container.
  if (!container || typeof container !== "object" || !("nodeType" in container)) return undefined;
  if (container.nodeType !== Node.ELEMENT_NODE) return undefined;
  if (reactRoot) return { unmount }; // idempotent

  const target = container as HTMLElement;

  seedIfEmpty();
  reactRoot = createRoot(target);
  reactRoot.render(
    <React.StrictMode>
      <AppProvider>
        <App />
      </AppProvider>
    </React.StrictMode>,
  );
  return { unmount };
}

export function unmount(): void {
  if (!reactRoot) return;
  reactRoot.unmount();
  reactRoot = null;
}

// The installed 0.1.0 package already points lifecycle at this expose. Keeping
// that identity stable lets the local update activate without expanding the
// package contract.
export const applicationLifecyclePlugin = Object.freeze({
  name: "dialed-lifecycle",
  mount,
  unmount,
});

export default applicationLifecyclePlugin;
