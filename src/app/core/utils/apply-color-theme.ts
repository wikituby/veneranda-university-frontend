import { ColorTheme, ColorThemeId, findColorTheme } from '../config/color-themes.config';

function applyLightSurfaces(theme: ColorTheme, root: HTMLElement): void {
  root.style.setProperty('--site-bg', '#f0f2f7');
  root.style.setProperty('--bg-body', '#f0f2f7');
  root.style.setProperty('--bg-card', '#ffffff');
  root.style.setProperty('--bg-toolbar', '#ffffff');
  root.style.setProperty('--bg-input', '#ffffff');
  root.style.setProperty('--bg-muted', '#fafbfc');
  root.style.setProperty('--bg-hover', '#f7f8fa');
  root.style.setProperty('--border-color', '#e3e8ee');
  root.style.setProperty('--catalogue-sidebar-bg', '#ffffff');
  root.style.setProperty('--catalogue-sidebar-border', '#e3e8ee');
  root.style.setProperty('--catalogue-sidebar-text', '#1a1f36');
  root.style.setProperty('--catalogue-sidebar-text-dim', '#697386');
  root.style.setProperty('--catalogue-nav-hover', '#f4f6fb');
  root.style.setProperty('--catalogue-nav-active', `rgba(${theme.rgb}, 0.12)`);
  root.style.setProperty('--catalogue-nav-active-text', theme.deep);
  root.style.setProperty('--catalogue-nav-active-icon', theme.deep);
  root.style.setProperty('--topbar-accent-line', theme.deep);
  root.style.setProperty('--gradient-primary', theme.deep);
}

function applySolidSurfaces(theme: ColorTheme, root: HTMLElement): void {
  const accent = theme.start;
  root.style.setProperty('--site-bg', '#f0f2f7');
  root.style.setProperty('--bg-body', '#f0f2f7');
  root.style.setProperty('--bg-card', '#ffffff');
  root.style.setProperty('--bg-toolbar', '#ffffff');
  root.style.setProperty('--bg-input', '#ffffff');
  root.style.setProperty('--bg-muted', '#fafbfc');
  root.style.setProperty('--bg-hover', '#f7f8fa');
  root.style.setProperty('--border-color', '#e3e8ee');
  root.style.setProperty('--catalogue-sidebar-bg', theme.deep);
  root.style.setProperty('--catalogue-sidebar-border', theme.deep);
  root.style.setProperty('--catalogue-sidebar-text', 'rgba(255, 255, 255, 0.94)');
  root.style.setProperty('--catalogue-sidebar-text-dim', 'rgba(255, 255, 255, 0.62)');
  root.style.setProperty('--catalogue-nav-hover', 'rgba(255, 255, 255, 0.12)');
  root.style.setProperty('--catalogue-nav-active', 'rgba(255, 255, 255, 0.2)');
  root.style.setProperty('--catalogue-nav-active-text', '#ffffff');
  root.style.setProperty('--catalogue-nav-active-icon', '#ffffff');
  root.style.setProperty('--topbar-accent-line', accent);
  root.style.setProperty('--gradient-primary', accent);
}

export function applyColorThemeToDocument(
  theme: ColorTheme,
  root: HTMLElement = document.documentElement,
): void {
  root.setAttribute('data-color-theme', theme.id);
  root.setAttribute('data-theme-surface', theme.surface);
  root.style.setProperty('--theme-accent-start', theme.start);
  root.style.setProperty('--theme-accent-end', theme.start);
  root.style.setProperty('--theme-accent-deep', theme.deep);
  root.style.setProperty('--theme-accent-rgb', theme.rgb);
  root.style.setProperty('--accent', theme.surface === 'light' ? theme.deep : theme.start);
  root.style.setProperty('--accent-strong', theme.deep);
  root.style.setProperty('--sidebar-active', `rgba(${theme.rgb}, 0.28)`);
  root.style.setProperty('--sidebar-hover-accent', `rgba(${theme.rgb}, 0.12)`);
  root.style.setProperty('--accent-focus-ring', `rgba(${theme.rgb}, 0.2)`);
  root.style.setProperty('--accent-soft-bg', `rgba(${theme.rgb}, 0.12)`);

  if (theme.surface === 'light') {
    applyLightSurfaces(theme, root);
  } else {
    applySolidSurfaces(theme, root);
  }
}

export function readStoredColorThemeId(): ColorThemeId {
  try {
    const raw = localStorage.getItem('isp_color_theme');
    if (raw && findColorTheme(raw).id === raw) {
      return raw as ColorThemeId;
    }
  } catch {
    /* ignore */
  }
  return findColorTheme(null).id;
}
