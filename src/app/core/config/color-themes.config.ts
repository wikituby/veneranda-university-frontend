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

export type ColorThemeSurface = 'light' | 'gradient';

export interface ColorTheme {
  id: ColorThemeId;
  label: string;
  description: string;
  start: string;
  end: string;
  deep: string;
  rgb: string;
  surface: ColorThemeSurface;
}

export const COLOR_THEMES: ColorTheme[] = [
  {
    id: 'light',
    label: 'Light',
    description: 'Clean white layout with soft blue accents.',
    start: '#dbeafe',
    end: '#f8fafc',
    deep: '#2563eb',
    rgb: '37, 99, 235',
    surface: 'light',
  },
  {
    id: 'violet',
    label: 'Violet dusk',
    description: 'Classic purple gradient used across the catalogue.',
    start: '#667eea',
    end: '#764ba2',
    deep: '#0056d2',
    rgb: '102, 126, 234',
    surface: 'gradient',
  },
  {
    id: 'ocean',
    label: 'Ocean blue',
    description: 'Deep blue flowing into bright cyan.',
    start: '#1d4ed8',
    end: '#0ea5e9',
    deep: '#0369a1',
    rgb: '29, 78, 216',
    surface: 'gradient',
  },
  {
    id: 'forest',
    label: 'Forest mint',
    description: 'Teal greens for a calm study mood.',
    start: '#11998e',
    end: '#38ef7d',
    deep: '#047857',
    rgb: '17, 153, 142',
    surface: 'gradient',
  },
  {
    id: 'sunset',
    label: 'Sunset rose',
    description: 'Pink and coral warmth.',
    start: '#f093fb',
    end: '#f5576c',
    deep: '#db2777',
    rgb: '240, 147, 251',
    surface: 'gradient',
  },
  {
    id: 'coral',
    label: 'Golden coral',
    description: 'Peach melting into golden yellow.',
    start: '#fa709a',
    end: '#fee140',
    deep: '#ea580c',
    rgb: '250, 112, 154',
    surface: 'gradient',
  },
  {
    id: 'royal',
    label: 'Royal sky',
    description: 'Bright sky blue with aqua highlights.',
    start: '#4facfe',
    end: '#00f2fe',
    deep: '#0284c7',
    rgb: '79, 172, 254',
    surface: 'gradient',
  },
  {
    id: 'ember',
    label: 'Ember glow',
    description: 'Warm red and amber energy.',
    start: '#ff6b6b',
    end: '#feca57',
    deep: '#dc2626',
    rgb: '255, 107, 107',
    surface: 'gradient',
  },
  {
    id: 'slate',
    label: 'Slate noir',
    description: 'Neutral charcoal for a minimal look.',
    start: '#64748b',
    end: '#334155',
    deep: '#1e293b',
    rgb: '100, 116, 139',
    surface: 'gradient',
  },
];

export const DEFAULT_COLOR_THEME_ID: ColorThemeId = 'violet';

export function findColorTheme(id: string | null | undefined): ColorTheme {
  const found = COLOR_THEMES.find((t) => t.id === id);
  return found ?? COLOR_THEMES.find((t) => t.id === DEFAULT_COLOR_THEME_ID)!;
}