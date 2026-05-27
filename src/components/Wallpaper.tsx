import { motion } from 'framer-motion';

interface Props {
  css: string;
  dimmed?: boolean;
}

export function Wallpaper({ css, dimmed }: Props) {
  return (
    <motion.div
      key={css}
      initial={{ opacity: 0, scale: 1.05 }}
      animate={{ opacity: 1, scale: dimmed ? 1.1 : 1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
      style={{ background: css }}
    >
      {/* Subtle grain for depth */}
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
      {dimmed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.35 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black"
        />
      )}
    </motion.div>
  );
}
