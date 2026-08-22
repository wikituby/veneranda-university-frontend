import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RouterService } from '../../../core/services/router.service';
import { RouterDto, VENDOR_OPTIONS } from '../../../core/models/router.model';

@Component({
  selector: 'app-router-detail',
  imports: [CommonModule, RouterLink],
  templateUrl: './router-detail.html',
  styleUrl: './router-detail.scss',
})
export class RouterDetail implements OnInit {
  private routerService = inject(RouterService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  routerData = signal<RouterDto | null>(null);
  loading = signal(true);

  vendorOptions = VENDOR_OPTIONS;

  toastMessage = signal('');
  toastType = signal<'success' | 'danger' | 'warning' | 'info'>('info');
  showToast = signal(false);
  private toastTimer: any;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.loadRouter(Number(id));
  }

  loadRouter(id: number): void {
    this.loading.set(true);
    this.routerService.getById(id).subscribe({
      next: (data) => { this.routerData.set(data); this.loading.set(false); },
      error: () => {
        this.showToastMessage('Failed to load router', 'danger');
        this.loading.set(false);
        this.router.navigate(['/routers']);
      },
    });
  }

  testConnection(): void {
    const r = this.routerData(); if (!r) return;
    this.showToastMessage(`Testing "${r.name}"...`, 'info');
    this.routerService.testConnection(r.id).subscribe({
      next: (updated) => {
        this.routerData.set(updated);
        this.showToastMessage(`${r.name} is ${updated.isOnline ? '🟢 online' : '🔴 offline'}`, updated.isOnline ? 'success' : 'warning');
      },
      error: () => this.showToastMessage('Connection test failed', 'danger'),
    });
  }

  syncRouter(): void {
    const r = this.routerData(); if (!r) return;
    this.showToastMessage(`Syncing "${r.name}"...`, 'info');
    this.routerService.synchronize(r.id).subscribe({
      next: (updated) => {
        this.routerData.set(updated);
        this.showToastMessage(`${r.name} synced`, 'success');
      },
      error: () => this.showToastMessage('Sync failed', 'danger'),
    });
  }

  toggleRouter(): void {
    const r = this.routerData(); if (!r) return;
    const enable = !r.isEnabled;
    const action = enable ? this.routerService.enable(r.id) : this.routerService.disable(r.id);
    action.subscribe({
      next: (updated) => {
        this.routerData.set(updated);
        this.showToastMessage(`${r.name} ${enable ? 'enabled' : 'disabled'}`, 'success');
      },
      error: (e: any) => this.showToastMessage('Toggle failed: ' + (e?.error?.message || 'Unknown error'), 'danger'),
    });
  }

  deleteRouter(): void {
    const r = this.routerData(); if (!r) return;
    if (confirm(`Permanently delete router "${r.name}"? This action cannot be undone.`)) {
      this.routerService.delete(r.id).subscribe({
        next: () => {
          this.showToastMessage(`Router "${r.name}" deleted`, 'success');
          this.router.navigate(['/routers']);
        },
        error: () => this.showToastMessage('Failed to delete router', 'danger'),
      });
    }
  }

  getStatusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      ACTIVE: 'bg-success bg-opacity-10 text-success',
      OFFLINE: 'bg-secondary bg-opacity-10 text-secondary',
      MAINTENANCE: 'bg-warning bg-opacity-10 text-warning',
      RETIRED: 'bg-dark bg-opacity-10 text-dark'
    };
    return map[status] || 'bg-light text-dark';
  }

  getVendorLabel(vendor: string): string {
    return this.vendorOptions.find(o => o.value === vendor)?.label || vendor;
  }

  formatDateTime(dateStr?: string): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return d.toLocaleString();
  }

  showToastMessage(msg: string, type: 'success' | 'danger' | 'warning' | 'info'): void {
    this.toastMessage.set(msg); this.toastType.set(type); this.showToast.set(true);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.showToast.set(false), 4000);
  }
}