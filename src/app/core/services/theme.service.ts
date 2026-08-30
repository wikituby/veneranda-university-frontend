import { Injectable, signal } from '@angular/core';
import {
  ColorTheme,
  ColorThemeId,
  findColorTheme,
} from '../config/color-themes.config';
import { applyColorThemeToDocument, readStoredColorThemeId } from '../utils/apply-color-theme';

const COLOR_THEME_KEY = 'isp_color_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly activeThemeId = signal<ColorThemeId>(readStoredColorThemeId());
  readonly previewThemeId = signal<ColorThemeId | null>(null);

  constructor() {
    this.applyToDocument(this.activeThemeId());
  }

  getActiveTheme(): ColorTheme {
    return findColorTheme(this.activeThemeId());
  }

  displayedThemeId(): ColorThemeId {
    return this.previewThemeId() ?? this.activeThemeId();
  }

  previewColorTheme(id: ColorThemeId): void {
    this.previewThemeId.set(id);
    this.applyToDocument(id);
  }

  commitColorTheme(id: ColorThemeId): void {
    this.activeThemeId.set(id);
    this.previewThemeId.set(null);
    this.applyToDocument(id, true);
  }

  cancelPreview(): void {
    if (!this.previewThemeId()) return;
    this.previewThemeId.set(null);
    this.applyToDocument(this.activeThemeId());
  }

  private applyToDocument(id: ColorThemeId, persist = false): void {
    const theme = findColorTheme(id);
    applyColorThemeToDocument(theme);

    if (persist) {
      try {
        localStorage.setItem(COLOR_THEME_KEY, theme.id);
      } catch {
        /* ignore */
      }
    }
  }
}