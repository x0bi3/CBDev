import { motion, useMotionValue, useTransform } from 'framer-motion';
import { useEffect } from 'react';
import type { AppDefinition } from '../../types';

interface Props {
  app: AppDefinition;
  onClose: () => void;
}

/**
 * Fullscreen app view that morphs from the tapped icon via shared layoutId.
 * Supports drag-down-to-close gesture.
 */
export function AppView({ app, onClose }: Props) {
  const View = app.view;

  // Drag-to-dismiss
  const y = useMotionValue(0);
  const scale = useTransform(y, [0, 300], [1, 0.85]);
  const opacity = useTransform(y, [0, 300], [1, 0.4]);

  // Lock background scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <motion.div
      layoutId={`app-tile-${app.id}`}
      className="fixed inset-0 z-40 overflow-hidden bg-neutral-950"
      style={{
        background: app.tile,
        borderRadius: 0,
        y,
        scale,
        opacity,
      }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.6 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 140 || info.velocity.y > 600) onClose();
      }}
      transition={{ type: 'spring', stiffness: 360, damping: 34 }}
    >
      {/* Backdrop layer so content has a clean canvas after morph */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ delay: 0.18, duration: 0.25 }}
        className="absolute inset-0 bg-neutral-950"
      />

      {/* App chrome — header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ delay: 0.22, duration: 0.25 }}
        className="absolute inset-x-0 top-0 z-20"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
      >
        <div className="flex items-center justify-between px-4 pt-12 pb-3">
          <div className="flex items-center gap-3">
            <motion.div
              layoutId={`app-glyph-${app.id}`}
              className="grid h-9 w-9 place-items-center rounded-xl text-[20px]"
              style={{ background: app.tile }}
            >
              {app.glyph}
            </motion.div>
            <motion.h1
              layoutId={`app-label-${app.id}`}
              className="text-[17px] font-semibold text-white"
            >
              {app.label}
            </motion.h1>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25 active:scale-90"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 6 L18 18 M18 6 L6 18" />
            </svg>
          </button>
        </div>
      </motion.header>

      {/* Scrollable content */}
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ delay: 0.28, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="no-scrollbar absolute inset-0 z-10 overflow-y-auto bg-neutral-950 text-white"
        style={{
          paddingTop: 'calc(max(env(safe-area-inset-top), 12px) + 84px)',
          paddingBottom: 'calc(max(env(safe-area-inset-bottom), 12px) + 40px)',
        }}
      >
        {View ? <View /> : <DefaultView label={app.label} />}
      </motion.section>
    </motion.div>
  );
}

function DefaultView({ label }: { label: string }) {
  return (
    <div className="px-6">
      <p className="text-white/70">No view implemented for {label} yet.</p>
    </div>
  );
}
