import type { AppDefinition } from '../../types';
import type { AppFolderDefinition } from '../../lib/homeFolders';

interface Props {
  folder: AppFolderDefinition;
  apps: AppDefinition[];
  onOpen: (folder: AppFolderDefinition) => void;
  showLabel?: boolean;
  size?: number;
}

/** iOS-style home screen folder tile (2×2 mini app preview). */
export function FolderIcon({ folder, apps, onOpen, showLabel = true, size = 62 }: Props) {
  const pad = Math.round(size * 0.1);
  const gap = 3;
  const cell = Math.floor((size - pad * 2 - gap) / 2);
  const radius = Math.round(size * 0.22);
  const miniRadius = Math.round(cell * 0.28);
  const miniFont = Math.max(10, Math.round(cell * 0.42));

  return (
    <button
      type="button"
      onClick={() => onOpen(folder)}
      aria-label={`Open ${folder.label} folder`}
      className="group flex flex-col items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-white/70 rounded-2xl"
    >
      <div
        className="icon-shadow relative overflow-hidden"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          background: 'rgba(255,255,255,0.24)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)',
        }}
      >
        <div
          className="absolute grid grid-cols-2"
          style={{ left: pad, top: pad, gap, width: size - pad * 2, height: size - pad * 2 }}
        >
          {apps.slice(0, 4).map((app) => (
            <div
              key={app.id}
              className="relative overflow-hidden"
              style={{ width: cell, height: cell, borderRadius: miniRadius, background: app.tile }}
            >
              <span
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 40%, rgba(0,0,0,0.12) 100%)',
                }}
              />
              <div
                className="absolute inset-0 grid place-items-center leading-none text-white"
                style={{ fontSize: miniFont }}
              >
                {app.glyph}
              </div>
            </div>
          ))}
        </div>
      </div>
      {showLabel && (
        <span className="text-[11px] font-medium leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
          {folder.label}
        </span>
      )}
    </button>
  );
}
