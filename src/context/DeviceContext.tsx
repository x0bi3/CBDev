import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { themes } from '../data/themes';
import type { AppFolderId } from '../lib/homeFolders';
import type { AppId, ThemeId } from '../types';

interface DeviceState {
  themeId: ThemeId;
  setTheme: (id: ThemeId) => void;
  openFolderId: AppFolderId | null;
  openFolder: (id: AppFolderId) => void;
  closeFolder: () => void;
  openAppId: AppId | null;
  openApp: (id: AppId) => void;
  closeApp: () => void;
}

const DeviceContext = createContext<DeviceState | null>(null);

const STORAGE_KEY = 'iphone-portfolio:theme';

export function DeviceProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    if (typeof window === 'undefined') return 'liquid-glass';
    const saved = window.localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    return saved && saved in themes ? saved : 'liquid-glass';
  });
  const [openFolderId, setOpenFolderId] = useState<AppFolderId | null>(null);
  const openFolderIdRef = useRef(openFolderId);
  openFolderIdRef.current = openFolderId;
  const [openAppId, setOpenAppId] = useState<AppId | null>(null);

  // Apply theme CSS vars on root
  useEffect(() => {
    const theme = themes[themeId];
    const root = document.documentElement;
    Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
    window.localStorage.setItem(STORAGE_KEY, themeId);
  }, [themeId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (openFolderIdRef.current) {
        setOpenFolderId(null);
        return;
      }
      setOpenAppId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const setTheme = useCallback((id: ThemeId) => setThemeId(id), []);
  const openFolder = useCallback((id: AppFolderId) => setOpenFolderId(id), []);
  const closeFolder = useCallback(() => setOpenFolderId(null), []);
  const openApp = useCallback((id: AppId) => {
    setOpenFolderId(null);
    setOpenAppId(id);
  }, []);
  const closeApp = useCallback(() => setOpenAppId(null), []);

  const value = useMemo<DeviceState>(
    () => ({
      themeId,
      setTheme,
      openFolderId,
      openFolder,
      closeFolder,
      openAppId,
      openApp,
      closeApp,
    }),
    [themeId, setTheme, openFolderId, openFolder, closeFolder, openAppId, openApp, closeApp],
  );

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
}

export function useDevice() {
  const ctx = useContext(DeviceContext);
  if (!ctx) throw new Error('useDevice must be used inside DeviceProvider');
  return ctx;
}
