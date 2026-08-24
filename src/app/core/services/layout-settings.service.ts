import { Injectable, signal } from '@angular/core';

const HOVER_SIDEBAR_KEY = 'isp_sidebar_hover';

@Injectable({ providedIn: 'root' })
export class LayoutSettingsService {
  /** Icon rail that expands over the page on hover, then collapses. */
  readonly hoverSidebar = signal(this.readHoverSidebar());

  setHoverSidebar(enabled: boolean): void {
    this.hoverSidebar.set(enabled);
    try {
      localStorage.setItem(HOVER_SIDEBAR_KEY, enabled ? '1' : '0');
    } catch {
      /* ignore quota / private mode */
    }
  }

  private readHoverSidebar(): boolean {
    try {
      return localStorage.getItem(HOVER_SIDEBAR_KEY) === '1';
    } catch {
      return false;
    }
  }
}
