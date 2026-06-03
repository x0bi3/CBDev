import { AnimatePresence, LayoutGroup } from 'framer-motion';
import { useDevice } from '../context/DeviceContext';
import { themes } from '../data/themes';
import { Wallpaper } from './Wallpaper';
import { StatusBar } from './StatusBar';
import { HomeIndicator } from './HomeIndicator';
import { HomeGrid } from './ios/HomeGrid';
import { Dock } from './ios/Dock';
import { AppFolderOverlay } from './ios/AppFolderOverlay';
import { AppView } from './ios/AppView';
import { ControlCenter } from './ios/ControlCenter';
import { getAppById } from '../data/apps';

export function Device() {
  const { themeId, openAppId, openFolderId, closeApp, closeFolder } = useDevice();
  const theme = themes[themeId];
  const openApp = openAppId ? getAppById(openAppId) : undefined;

  return (
    <div className="relative h-full w-full overflow-hidden font-sf">
      <Wallpaper css={theme.wallpaper} dimmed={!!openAppId || !!openFolderId} />

      <LayoutGroup>
        {/* Status bar — always on top */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-50">
          <div
            className="pointer-events-auto"
            style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
          >
            <StatusBar light={theme.statusLight} />
          </div>
        </div>

        {/* Control Center trigger lives inside status bar area */}
        <ControlCenter />

        {/* Home screen */}
        <div className="absolute inset-0 flex flex-col">
          <div className="h-[calc(env(safe-area-inset-top,0px)+44px)] shrink-0" />
          <div className="flex-1 overflow-hidden">
            <HomeGrid />
          </div>
          <Dock />
          <HomeIndicator onClick={openFolderId ? closeFolder : openAppId ? closeApp : undefined} />
        </div>

        <AppFolderOverlay />

        {/* Foreground app view */}
        <AnimatePresence>
          {openApp && <AppView key={openApp.id} app={openApp} onClose={closeApp} />}
        </AnimatePresence>
      </LayoutGroup>
    </div>
  );
}
