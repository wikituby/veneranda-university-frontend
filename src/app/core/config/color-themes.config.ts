export type ColorThemeId =
  | 'light'
  | 'violet'
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'coral'
  | 'royal'
  | 'ember'
  | 'slate';

export type ColorThemeSurface = 'light' | 'solid';

export interface ColorTheme {
  id: ColorThemeId;
  label: string;
  description: string;
  /** Primary solid accent colour */
  start: string;
  /** Kept for compatibility; same as start (solid themes, no fade) */
  end: string;
  deep: string;
  rgb: string;
  surface: ColorThemeSurface;
}

export const COLOR_THEMES: ColorTheme[] = [
  {
    id: 'light',
    label: 'Light',
    description: 'Clean white layout with solid blue accents.',
    start: '#2563eb',
    end: '#2563eb',
    deep: '#2563eb',
    rgb: '37, 99, 235',
    surface: 'light',
  },
  {
    id: 'violet',
    label: 'Violet',
    description: 'Solid purple accent across the catalogue.',
    start: '#667eea',
    end: '#667eea',
    deep: '#4f46e5',
    rgb: '102, 126, 234',
    surface: 'solid',
  },
  {
    id: 'ocean',
    label: 'Ocean blue',
    description: 'Solid deep blue for focus and clarity.',
    start: '#1d4ed8',
    end: '#1d4ed8',
    deep: '#1e3a8a',
    rgb: '29, 78, 216',
    surface: 'solid',
  },
  {
    id: 'forest',
    label: 'Forest mint',
    description: 'Solid teal for a calm study mood.',
    start: '#11998e',
    end: '#11998e',
    deep: '#0f766e',
    rgb: '17, 153, 142',
    surface: 'solid',
  },
  {
    id: 'sunset',
    label: 'Sunset rose',
    description: 'Solid pink accent with warm energy.',
    start: '#db2777',
    end: '#db2777',
    deep: '#9d174d',
    rgb: '219, 39, 119',
    surface: 'solid',
  },
  {
    id: 'coral',
    label: 'Golden coral',
    description: 'Solid coral orange accent.',
    start: '#ea580c',
    end: '#ea580c',
    deep: '#c2410c',
    rgb: '234, 88, 12',
    surface: 'solid',
  },
  {
    id: 'royal',
    label: 'Royal sky',
    description: 'Solid sky blue accent.',
    start: '#0284c7',
    end: '#0284c7',
    deep: '#0369a1',
    rgb: '2, 132, 199',
    surface: 'solid',
  },
  {
    id: 'ember',
    label: 'Ember',
    description: 'Solid warm red accent.',
    start: '#dc2626',
    end: '#dc2626',
    deep: '#b91c1c',
    rgb: '220, 38, 38',
    surface: 'solid',
  },
  {
    id: 'slate',
    label: 'Slate noir',
    description: 'Solid charcoal for a minimal look.',
    start: '#475569',
    end: '#475569',
    deep: '#1e293b',
    rgb: '71, 85, 105',
    surface: 'solid',
  },
];

export const DEFAULT_COLOR_THEME_ID: ColorThemeId = 'violet';

export function findColorTheme(id: string | null | undefined): ColorTheme {
  const found = COLOR_THEMES.find((t) => t.id === id);
  return found ?? COLOR_THEMES.find((t) => t.id === DEFAULT_COLOR_THEME_ID)!;
}
