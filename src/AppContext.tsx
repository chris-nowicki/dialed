import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Screen, TempUnit } from './types';
import { getSettings, saveSettings } from './storage';

interface AppContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  goBack: () => void;
  tempUnit: TempUnit;
  toggleTempUnit: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<Screen[]>([{ id: 'home' }]);
  const [tempUnit, setTempUnit] = useState<TempUnit>(() => getSettings().tempUnit);

  const screen = history[history.length - 1] ?? { id: 'home' };

  const navigate = useCallback((next: Screen) => {
    setHistory((h) => [...h, next]);
  }, []);

  const goBack = useCallback(() => {
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  }, []);

  const toggleTempUnit = useCallback(() => {
    setTempUnit((u) => {
      const next: TempUnit = u === 'F' ? 'C' : 'F';
      saveSettings({ tempUnit: next });
      return next;
    });
  }, []);

  return (
    <AppContext.Provider value={{ screen, navigate, goBack, tempUnit, toggleTempUnit }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
