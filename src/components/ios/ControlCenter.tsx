import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useDevice } from '../../context/DeviceContext';
import { themes, themeOrder } from '../../data/themes';

/**
 * iOS-style Control Center pulled from the top-right.
 * Hosts the theme switcher.
 */
export function ControlCenter() {
  const [open, setOpen] = useState(false);
  const { themeId, setTheme } = useDevice();

  return (
    <>
      {/* Trigger pill in top-right */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Open Control Center"
        className="fixed right-3 z-[60] flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur-md ring-1 ring-white/15 transition hover:bg-black/40 active:scale-95"
        style={{ top: 'calc(max(env(safe-area-inset-top), 12px) + 44px)' }}
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" strokeLinecap="round" />
        </svg>
        Theme
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="cc-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-black/30"
              onClick={() => setOpen(false)}
            />
            <motion.div
              key="cc-panel"
              initial={{ opacity: 0, y: -24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 360, damping: 30 }}
              className="glass-liquid fixed right-3 z-[80] w-[300px] rounded-3xl p-4 text-white"
              style={{ top: 'calc(max(env(safe-area-inset-top), 12px) + 84px)' }}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[15px] font-semibold">Appearance</h2>
                <button
                  onClick={() => setOpen(false)}
                  className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
                  aria-label="Close"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M6 6 L18 18 M18 6 L6 18" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {themeOrder.map((id) => {
                  const t = themes[id];
                  const active = id === themeId;
                  return (
                    <button
                      key={id}
                      onClick={() => {
                        setTheme(id);
                        setOpen(false);
                      }}
                      className={`group relative flex flex-col items-start gap-2 overflow-hidden rounded-2xl p-2 text-left transition ${
                        active ? 'ring-2 ring-white' : 'ring-1 ring-white/15 hover:ring-white/30'
                      }`}
                      style={{ background: 'rgba(255,255,255,0.06)' }}
                    >
                      <div
                        className="h-16 w-full rounded-xl"
                        style={{ background: t.wallpaper }}
                      />
                      <div className="flex w-full items-center justify-between px-1">
                        <span className="text-[12px] font-medium">{t.name}</span>
                        {active && (
                          <span className="grid h-4 w-4 place-items-center rounded-full bg-white text-black">
                            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 12l5 5L20 7" />
                            </svg>
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <p className="mt-3 px-1 text-[11px] text-white/60">
                Tip: tap a tile to change the wallpaper & glass tint instantly.
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
