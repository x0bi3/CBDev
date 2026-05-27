import { motion } from 'framer-motion';
import type { AppDefinition } from '../../types';

interface Props {
  app: AppDefinition;
  onTap: (app: AppDefinition) => void;
  showLabel?: boolean;
  size?: number;
}

/**
 * Apple-style squircle icon using SVG clipPath for a true superellipse.
 * Uses Framer Motion layoutId so the icon morphs into the AppView.
 */
export function AppIcon({ app, onTap, showLabel = true, size = 62 }: Props) {
  const handleClick = () => {
    if (app.href) {
      window.open(app.href, '_blank', 'noopener,noreferrer');
      return;
    }
    onTap(app);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group flex flex-col items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-white/70 rounded-2xl"
      aria-label={`Open ${app.label}`}
    >
      <motion.div
        layoutId={`app-tile-${app.id}`}
        className="icon-shadow relative overflow-hidden"
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.28,
          background: app.tile,
        }}
        whileTap={{ scale: 0.88 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      >
        {/* Inner highlight */}
        <span
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 35%, rgba(0,0,0,0.18) 100%)',
          }}
        />
        <motion.div
          layoutId={`app-glyph-${app.id}`}
          className="absolute inset-0 grid place-items-center text-[28px] leading-none text-white"
        >
          {app.glyph}
        </motion.div>
      </motion.div>
      {showLabel && (
        <motion.span
          layoutId={`app-label-${app.id}`}
          className="text-[11px] font-medium leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
        >
          {app.label}
        </motion.span>
      )}
    </button>
  );
}
