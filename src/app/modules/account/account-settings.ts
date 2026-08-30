import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { COLOR_THEMES, ColorThemeId } from '../../core/config/color-themes.config';
import { LayoutSettingsService } from '../../core/services/layout-settings.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-account-settings',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './account-settings.html',
  styleUrl: './account-settings.scss',
})
export class AccountSettings implements OnDestroy {
  private layout = inject(LayoutSettingsService);
  private theme = inject(ThemeService);

  readonly themes = COLOR_THEMES;

  pendingThemeId = signal<ColorThemeId>(this.theme.activeThemeId());
  pendingHoverSidebar = signal(this.layout.hoverSidebar());

  saving = signal(false);
  saveOk = signal('');
  saveError = signal('');

  readonly hasChanges = computed(() => {
    return (
      this.pendingThemeId() !== this.theme.activeThemeId() ||
      this.pendingHoverSidebar() !== this.layout.hoverSidebar()
    );
  });

  ngOnDestroy(): void {
    this.theme.cancelPreview();
  }

  selectTheme(id: ColorThemeId): void {
    this.pendingThemeId.set(id);
    this.theme.previewColorTheme(id);
    this.saveOk.set('');
    this.saveError.set('');
  }

  onHoverSidebarChange(event: Event): void {
    const enabled = (event.target as HTMLInputElement).checked;
    this.pendingHoverSidebar.set(enabled);
    this.saveOk.set('');
    this.saveError.set('');
  }

  saveSettings(): void {
    if (!this.hasChanges()) return;

    this.saving.set(true);
    this.saveOk.set('');
    this.saveError.set('');

    try {
      const themeId = this.pendingThemeId();
      if (themeId !== this.theme.activeThemeId()) {
        this.theme.commitColorTheme(themeId);
      } else {
        this.theme.cancelPreview();
      }

      if (this.pendingHoverSidebar() !== this.layout.hoverSidebar()) {
        this.layout.setHoverSidebar(this.pendingHoverSidebar());
      }

      this.saveOk.set('Settings saved. Your theme is applied across the site.');
    } catch {
      this.saveError.set('Could not save settings. Try again.');
    } finally {
      this.saving.set(false);
    }
  }
}