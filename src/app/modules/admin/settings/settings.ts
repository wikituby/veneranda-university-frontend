import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LayoutSettingsService } from '../../../core/services/layout-settings.service';

@Component({
  selector: 'app-settings',
  imports: [CommonModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  private layout = inject(LayoutSettingsService);
  hoverSidebar = this.layout.hoverSidebar;

  onHoverSidebarChange(event: Event): void {
    const enabled = (event.target as HTMLInputElement).checked;
    this.layout.setHoverSidebar(enabled);
  }
}
