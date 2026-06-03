import type { AppDefinition } from '../types';
import { AboutApp } from '../components/apps/AboutApp';
import { ContactApp } from '../components/apps/ContactApp';
import { ServicesApp } from '../components/apps/ServicesApp';
import { MerchApp } from '../components/apps/MerchApp';
import { ProjectApp } from '../components/apps/ProjectApp';
import { LegalApp } from '../components/apps/LegalApp';
import { BlogApp } from '../components/apps/BlogApp';
import { SettingsApp } from '../components/apps/SettingsApp';

/** Apps shown on the home screen grid. */
export const homeApps: AppDefinition[] = [
  {
    id: 'merch',
    label: 'Merch',
    tile: 'linear-gradient(135deg,#f43f5e,#7c2d12)',
    glyph: '🛍️',
    view: MerchApp,
  },
  {
    id: 'project-a',
    label: 'Project A',
    tile: 'linear-gradient(135deg,#22d3ee,#0e7490)',
    glyph: '🚀',
    view: ProjectApp,
  },
  {
    id: 'project-b',
    label: 'Project B',
    tile: 'linear-gradient(135deg,#a78bfa,#4c1d95)',
    glyph: '🧪',
    view: ProjectApp,
  },
  {
    id: 'project-c',
    label: 'Project C',
    tile: 'linear-gradient(135deg,#34d399,#065f46)',
    glyph: '🌿',
    view: ProjectApp,
  },
  {
    id: 'blog',
    label: 'Blog',
    tile: 'linear-gradient(135deg,#fbbf24,#b45309)',
    glyph: '✍️',
    view: BlogApp,
  },
  {
    id: 'github',
    label: 'GitHub',
    tile: 'linear-gradient(135deg,#1f2937,#000000)',
    glyph: (
      <svg viewBox="0 0 24 24" className="h-10 w-10" fill="#fff">
        <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.77.11 3.06.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56C20.21 21.38 23.5 17.07 23.5 12 23.5 5.65 18.35.5 12 .5z" />
      </svg>
    ),
    href: 'https://github.com',
  },
  {
    id: 'settings',
    label: 'Settings',
    tile: 'linear-gradient(135deg,#9ca3af,#374151)',
    glyph: '⚙️',
    view: SettingsApp,
  },
  {
    id: 'legal',
    label: 'Legal',
    tile: 'linear-gradient(135deg,#94a3b8,#1e293b)',
    glyph: '⚖️',
    view: LegalApp,
    homePage: 2,
  },
];

/** Apps pinned to the dock. */
export const dockApps: AppDefinition[] = [
  {
    id: 'about',
    label: 'About',
    tile: 'linear-gradient(135deg,#60a5fa,#1e40af)',
    glyph: '👤',
    view: AboutApp,
  },
  {
    id: 'services',
    label: 'Services',
    tile: 'linear-gradient(135deg,#f59e0b,#b45309)',
    glyph: '🛠️',
    view: ServicesApp,
  },
  {
    id: 'support',
    label: 'Support',
    tile: 'linear-gradient(135deg,#38bdf8,#1e3a8a)',
    glyph: '🛠️',
  },
  {
    id: 'contact',
    label: 'Contact',
    tile: 'linear-gradient(135deg,#ec4899,#831843)',
    glyph: '✉️',
    view: ContactApp,
  },
];

export const allApps: AppDefinition[] = [...homeApps, ...dockApps];

export function getAppById(id: string): AppDefinition | undefined {
  return allApps.find((a) => a.id === id);
}
