import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { Screen, TempUnit } from "./types";
import { getSettings, saveSettings } from "./storage";

interface NavigationEntry {
  screen: Screen;
  scrollY: number;
}

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
  const [history, setHistory] = useState<NavigationEntry[]>([
    { screen: { id: "home" }, scrollY: 0 },
  ]);
  const historyRef = useRef(history);
  const [tempUnit, setTempUnitState] = useState<TempUnit>(() => getSettings().tempUnit);
  const pendingScrollY = useRef<number | null>(null);

  const screen = history[history.length - 1]?.screen ?? { id: "home" };

  useLayoutEffect(() => {
    if (pendingScrollY.current === null) return;

    const scrollY = pendingScrollY.current;
    pendingScrollY.current = null;
    window.scrollTo(0, scrollY);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => window.scrollTo(0, scrollY));
    });
  }, [screen]);

  const navigate = useCallback((next: Screen) => {
    const currentScrollY = window.scrollY;
    pendingScrollY.current = 0;
    const current = historyRef.current;
    const updated = current.map((entry, index) => (
      index === current.length - 1
        ? { ...entry, scrollY: currentScrollY }
        : entry
    ));
    const nextHistory = [...updated, { screen: next, scrollY: 0 }];
    historyRef.current = nextHistory;
    setHistory(nextHistory);
  }, []);

  const replace = useCallback((next: Screen) => {
    pendingScrollY.current = 0;
    const current = historyRef.current;
    const nextHistory = current.length > 0
      ? [...current.slice(0, -1), { screen: next, scrollY: 0 }]
      : [{ screen: next, scrollY: 0 }];
    historyRef.current = nextHistory;
    setHistory(nextHistory);
  }, []);

  const goBack = useCallback(() => {
    const current = historyRef.current;
    if (current.length <= 1) return;
    const previous = current[current.length - 2];
    const nextHistory = current.slice(0, -1);
    pendingScrollY.current = previous?.scrollY ?? 0;
    historyRef.current = nextHistory;
    setHistory(nextHistory);
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
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
