import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, SettingDto } from '../../../core/services/admin.service';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
})
export class Settings implements OnInit {
  private admin = inject(AdminService);
  settings = signal<SettingDto[]>([]);
  loading = signal(true);
  editKey = signal('');
  editValue = signal('');
  editId = signal<number | null>(null);

  toastMessage = signal(''); toastType = signal<'success'|'danger'|'warning'|'info'>('info'); showToast = signal(false);
  private t: any;

  ngOnInit() { this.load(); }
  load() {
    this.loading.set(true);
    this.admin.getSettings().subscribe({
      next: (s) => { this.settings.set(s); this.loading.set(false); },
      error: () => { this.loading.set(false); this.tmsg('Failed to load', 'danger'); }
    });
  }
  startEdit(s: SettingDto) { this.editKey.set(s.key); this.editValue.set(s.value); this.editId.set(s.id); }
  cancelEdit() { this.editKey.set(''); this.editId.set(null); }
  saveEdit() {
    if (this.editId()) {
      this.admin.updateSetting(this.editId()!, this.editValue()).subscribe({
        next: () => { this.tmsg('Saved', 'success'); this.cancelEdit(); this.load(); },
        error: () => this.tmsg('Failed', 'danger')
      });
    }
  }

  groupedSettings(): Map<string, SettingDto[]> {
    const m = new Map<string, SettingDto[]>();
    for (const s of this.settings()) {
      const k = s.category || 'general';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    }
    return m;
  }

  tmsg(msg: string, type: 'success'|'danger'|'warning'|'info') { this.toastMessage.set(msg); this.toastType.set(type); this.showToast.set(true); clearTimeout(this.t); this.t = setTimeout(() => this.showToast.set(false), 4000); }
}