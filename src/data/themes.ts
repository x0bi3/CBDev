import type { Theme, ThemeId } from '../types';

export const themes: Record<ThemeId, Theme> = {
  'liquid-glass': {
    id: 'liquid-glass',
    name: 'Liquid Glass',
    wallpaper:
      'radial-gradient(120% 80% at 20% 10%, #6ea8ff 0%, transparent 55%),' +
      'radial-gradient(100% 70% at 80% 30%, #c084fc 0%, transparent 60%),' +
      'radial-gradient(140% 90% at 50% 110%, #ff7ab6 0%, transparent 60%),' +
      'linear-gradient(180deg, #0b1026 0%, #1a0b2e 100%)',
    swatch: 'linear-gradient(135deg,#6ea8ff,#c084fc 50%,#ff7ab6)',
    labelClass: 'text-white',
    statusLight: true,
    vars: {
      '--glass-bg': 'rgba(255,255,255,0.14)',
      '--glass-blur': '28px',
      '--glass-border': 'rgba(255,255,255,0.28)',
      '--glass-highlight': 'rgba(255,255,255,0.45)',
    },
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset',
    wallpaper:
      'radial-gradient(120% 80% at 30% 0%, #ffb37a 0%, transparent 55%),' +
      'radial-gradient(100% 80% at 80% 60%, #ff5e87 0%, transparent 60%),' +
      'linear-gradient(180deg, #3b0a45 0%, #7a1e3a 60%, #c2410c 100%)',
    swatch: 'linear-gradient(135deg,#ffb37a,#ff5e87,#c2410c)',
    labelClass: 'text-white',
    statusLight: true,
    vars: {
      '--glass-bg': 'rgba(255,255,255,0.16)',
      '--glass-blur': '24px',
      '--glass-border': 'rgba(255,255,255,0.22)',
      '--glass-highlight': 'rgba(255,255,255,0.35)',
    },
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    wallpaper:
      'radial-gradient(80% 60% at 70% 20%, #1e3a8a 0%, transparent 60%),' +
      'radial-gradient(100% 80% at 20% 90%, #0f172a 0%, transparent 70%),' +
      'linear-gradient(180deg, #020617 0%, #050816 100%)',
    swatch: 'linear-gradient(135deg,#1e3a8a,#0f172a,#020617)',
    labelClass: 'text-white',
    statusLight: true,
    vars: {
      '--glass-bg': 'rgba(255,255,255,0.08)',
      '--glass-blur': '32px',
      '--glass-border': 'rgba(255,255,255,0.14)',
      '--glass-highlight': 'rgba(255,255,255,0.18)',
    },
  },
  aqua: {
    id: 'aqua',
    name: 'Aqua',
    wallpaper:
      'radial-gradient(80% 60% at 20% 10%, #22d3ee 0%, transparent 55%),' +
      'radial-gradient(100% 80% at 80% 80%, #14b8a6 0%, transparent 60%),' +
      'linear-gradient(180deg, #052e3a 0%, #0e7490 60%, #0891b2 100%)',
    swatch: 'linear-gradient(135deg,#22d3ee,#14b8a6,#0891b2)',
    labelClass: 'text-white',
    statusLight: true,
    vars: {
      '--glass-bg': 'rgba(255,255,255,0.16)',
      '--glass-blur': '24px',
      '--glass-border': 'rgba(255,255,255,0.24)',
      '--glass-highlight': 'rgba(255,255,255,0.4)',
    },
  },
};

export const themeOrder: ThemeId[] = ['liquid-glass', 'sunset', 'midnight', 'aqua'];
