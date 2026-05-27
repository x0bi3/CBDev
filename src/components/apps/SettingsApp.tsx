import { useDevice } from '../../context/DeviceContext';
import { themes, themeOrder } from '../../data/themes';
import { AppShell, Card } from './AppShell';

export function SettingsApp() {
  const { themeId, setTheme } = useDevice();

  return (
    <AppShell title="Settings" subtitle="Personalise the device.">
      <Card>
        <p className="mb-3 text-[13px] uppercase tracking-wider text-white/50">Wallpaper & Glass</p>
        <div className="grid grid-cols-2 gap-3">
          {themeOrder.map((id) => {
            const t = themes[id];
            const active = id === themeId;
            return (
              <button
                key={id}
                onClick={() => setTheme(id)}
                className={`flex flex-col items-start gap-2 overflow-hidden rounded-2xl p-2 text-left transition ${
                  active ? 'ring-2 ring-white' : 'ring-1 ring-white/10 hover:ring-white/30'
                }`}
              >
                <div className="h-20 w-full rounded-xl" style={{ background: t.wallpaper }} />
                <span className="px-1 text-[12px] font-medium">{t.name}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <p className="mb-2 text-[13px] uppercase tracking-wider text-white/50">About this device</p>
        <p className="text-[14px] text-white/80">
          Built with React, TypeScript, Tailwind & Framer Motion. The whole browser
          window <em>is</em> the iPhone — try opening an app, dragging it down to
          close, or pressing <kbd className="rounded bg-white/15 px-1.5 py-0.5 text-[11px]">Esc</kbd>.
        </p>
      </Card>
    </AppShell>
  );
}
