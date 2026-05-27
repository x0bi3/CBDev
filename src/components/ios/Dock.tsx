import { useDevice } from '../../context/DeviceContext';
import { dockApps } from '../../data/apps';
import { AppIcon } from './AppIcon';

export function Dock() {
  const { openApp } = useDevice();

  return (
    <div className="px-4 pb-2">
      <div className="mx-auto max-w-md">
        <div className="glass-liquid rounded-[32px] px-3 py-3">
          <div className="flex items-center justify-around">
            {dockApps.map((app) => (
              <AppIcon
                key={app.id}
                app={app}
                onTap={(a) => openApp(a.id)}
                showLabel={false}
                size={56}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
