import { useDevice } from '../../context/DeviceContext';
import { homeApps } from '../../data/apps';
import { AppIcon } from './AppIcon';

export function HomeGrid() {
  const { openApp } = useDevice();

  return (
    <div className="mx-auto h-full max-w-md px-6 pt-4">
      <div className="grid grid-cols-4 gap-x-4 gap-y-6">
        {homeApps.map((app) => (
          <div key={app.id} className="flex justify-center">
            <AppIcon app={app} onTap={(a) => openApp(a.id)} />
          </div>
        ))}
      </div>

      {/* Page dots */}
      <div className="mt-6 flex items-center justify-center gap-1.5">
        <span className="page-dot active" />
        <span className="page-dot" />
      </div>
    </div>
  );
}
