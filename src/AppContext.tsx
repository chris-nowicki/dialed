import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Screen, TempUnit } from './types';
import { getSettings, saveSettings } from './storage';

interface AppContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  replace: (screen: Screen) => void;
  goBack: () => void;
  tempUnit: TempUnit;
  setTempUnit: (unit: TempUnit) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<Screen[]>([{ id: 'home' }]);
  const [tempUnit, setTempUnitState] = useState<TempUnit>(() => getSettings().tempUnit);

  const screen = history[history.length - 1] ?? { id: 'home' };

  const navigate = useCallback((next: Screen) => {
    setHistory((h) => [...h, next]);
  }, []);

  const replace = useCallback((next: Screen) => {
    setHistory((current) => current.length > 0
      ? [...current.slice(0, -1), next]
      : [next]);
  }, []);

  const goBack = useCallback(() => {
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  }, []);

  const setTempUnit = useCallback((unit: TempUnit) => {
    saveSettings({ tempUnit: unit });
    setTempUnitState(unit);
  }, []);

  return (
    <AppContext.Provider value={{ screen, navigate, replace, goBack, tempUnit, setTempUnit }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
