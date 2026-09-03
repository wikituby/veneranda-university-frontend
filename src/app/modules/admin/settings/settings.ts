import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LayoutSettingsService } from '../../../core/services/layout-settings.service';
import { AdminService, SettingDto } from '../../../core/services/admin.service';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings implements OnInit {
  private layout = inject(LayoutSettingsService);
  private admin = inject(AdminService);

  hoverSidebar = this.layout.hoverSidebar;
  paymentSettings = signal<SettingDto[]>([]);
  loadingPayments = signal(true);
  savingKey = signal<string | null>(null);
  paymentError = signal('');
  paymentSaved = signal('');
  drafts = signal<Record<number, string>>({});

  ngOnInit(): void {
    this.admin.getSettings().subscribe({
      next: (all) => {
        const payment = (all || [])
          .filter((s) => s.category === 'payment')
          .sort((a, b) => a.key.localeCompare(b.key));
        this.paymentSettings.set(payment);
        const draft: Record<number, string> = {};
        for (const s of payment) {
          draft[s.id] = s.isEncrypted && s.value === '••••••' ? '' : (s.value ?? '');
        }
        this.drafts.set(draft);
        this.loadingPayments.set(false);
      },
      error: () => {
        this.paymentError.set('Could not load payment settings (need setting:manage).');
        this.loadingPayments.set(false);
      },
    });
  }

  onHoverSidebarChange(event: Event): void {
    const enabled = (event.target as HTMLInputElement).checked;
    this.layout.setHoverSidebar(enabled);
  }

  onDraft(id: number, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.drafts.update((d) => ({ ...d, [id]: value }));
  }

  saveSetting(setting: SettingDto): void {
    const value = this.drafts()[setting.id] ?? '';
    if (setting.isEncrypted && !value.trim()) {
      this.paymentError.set(`Enter a new value to replace the saved ${setting.key}.`);
      return;
    }
    this.savingKey.set(setting.key);
    this.paymentError.set('');
    this.paymentSaved.set('');
    this.admin.updateSetting(setting.id, value).subscribe({
      next: () => {
        this.savingKey.set(null);
        this.paymentSaved.set(`Saved ${setting.key}.`);
        if (setting.isEncrypted) {
          this.drafts.update((d) => ({ ...d, [setting.id]: '' }));
        }
      },
      error: (err) => {
        this.savingKey.set(null);
        this.paymentError.set(err.error?.message || `Could not save ${setting.key}.`);
      },
    });
  }

  labelFor(key: string): string {
    const labels: Record<string, string> = {
      payment_currency: 'Payment currency (Flutterwave)',
      flutterwave_enabled: 'Flutterwave enabled',
      flutterwave_public_key: 'Flutterwave public key',
      flutterwave_secret_key: 'Flutterwave secret key',
      flutterwave_webhook_hash: 'Flutterwave webhook hash',
      frontend_base_url: 'Frontend base URL (redirect after pay)',
      mtn_momo_enabled: 'MTN MoMo enabled (legacy flag)',
      airtel_money_enabled: 'Airtel Money enabled (legacy flag)',
      pesapal_enabled: 'Pesapal enabled (legacy flag)',
    };
    return labels[key] || key;
  }
}
