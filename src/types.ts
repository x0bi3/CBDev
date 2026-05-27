import type { ComponentType, ReactNode } from 'react';

export type AppId =
  | 'about'
  | 'contact'
  | 'services'
  | 'portfolio'
  | 'merch'
  | 'project-a'
  | 'project-b'
  | 'project-c'
  | 'legal'
  | 'blog'
  | 'github'
  | 'settings';

export interface AppDefinition {
  id: AppId;
  label: string;
  /** A gradient or solid CSS background used as the icon tile. */
  tile: string;
  /** Icon glyph rendered inside the squircle (emoji or short text or SVG component). */
  glyph: ReactNode;
  /** Optional external URL — if set, tapping opens link instead of in-app view. */
  href?: string;
  /** App body component */
  view?: ComponentType;
}

export type ThemeId = 'liquid-glass' | 'sunset' | 'midnight' | 'aqua';

export interface Theme {
  id: ThemeId;
  name: string;
  /** Wallpaper CSS background. */
  wallpaper: string;
  /** A small preview swatch for the theme switcher. */
  swatch: string;
  /** Tailwind text class for icon labels (light/dark). */
  labelClass: string;
  /** CSS variables applied to root for the glass surfaces. */
  vars: Record<string, string>;
  /** Whether status bar icons should be light. */
  statusLight: boolean;
}
