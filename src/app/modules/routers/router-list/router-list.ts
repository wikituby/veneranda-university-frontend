import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RouterService } from '../../../core/services/router.service';
import { RouterDto, VENDOR_OPTIONS } from '../../../core/models/router.model';
import { PageResponse } from '../../../core/models/rbac.model';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-router-list',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './router-list.html',
  styleUrl: './router-list.scss',
})
export class RouterList implements OnInit {
  private routerService = inject(RouterService);
  private router = inject(Router);

  routers = signal<RouterDto[]>([]);
  loading = signal(true);
  totalElements = signal(0);
  page = signal(0);
  size = signal(20);
  sortBy = signal('name');
  sortDir = signal<'asc' | 'desc'>('asc');
  searchText = signal('');

  totalRouters = signal(0);
  onlineRouters = signal(0);

  Math = Math;

  vendorOptions = VENDOR_OPTIONS;

  // Toast messages
  toastMessage = signal('');
  toastType = signal<'success' | 'danger' | 'warning' | 'info'>('info');
  showToast = signal(false);
  private toastTimer: any;

  displayedColumns = ['name', 'vendor', 'ipAddress', 'status', 'isOnline', 'branchName', 'actions'];

  async ngOnInit(): Promise<void> {
    await this.loadStats();
    this.loadRouters();
  }

  async loadStats(): Promise<void> {
    try {
      const stats = await firstValueFrom(this.routerService.getStats());
      this.totalRouters.set(stats.totalRouters);
      this.onlineRouters.set(stats.onlineRouters);
    } catch { /* ignore */ }
  }

  loadRouters(): void {
    this.loading.set(true);
    this.routerService.list(this.page(), this.size(), this.sortBy(), this.sortDir(), this.searchText()).subscribe({
      next: (response: PageResponse<RouterDto>) => {
        this.routers.set(response.content);
        this.totalElements.set(response.totalElements);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.showToastMessage('Failed to load routers', 'danger');
      },
    });
  }

  onSearch(): void {
    this.page.set(0);
    this.loadRouters();
  }

  sort(column: string): void {
    if (this.sortBy() === column) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(column);
      this.sortDir.set('asc');
    }
    this.loadRouters();
  }

  sortIcon(column: string): string {
    if (this.sortBy() !== column) return '';
    return this.sortDir() === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down';
  }

  get totalPages(): number {
    return Math.ceil(this.totalElements() / this.size()) || 1;
  }

  get pagesArray(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
  }

  goToPage(p: number): void {
    if (p < 0 || p >= this.totalPages) return;
    this.page.set(p);
    this.loadRouters();
  }

  navigateToCreate(): void { this.router.navigate(['/routers/create']); }
  navigateToDetails(id: number): void { this.router.navigate(['/routers', id]); }
  navigateToEdit(id: number): void { this.router.navigate(['/routers', id, 'edit']); }

  deleteRouter(id: number, name: string): void {
    if (confirm(`Permanently delete router "${name}"? This action cannot be undone.`)) {
      this.routerService.delete(id).subscribe({
        next: () => {
          this.showToastMessage(`Router "${name}" deleted`, 'success');
          this.loadStats();
          this.loadRouters();
        },
        error: () => this.showToastMessage('Failed to delete router', 'danger'),
      });
    }
  }

  toggleRouter(id: number, enable: boolean, name: string): void {
    const action = enable ? this.routerService.enable(id) : this.routerService.disable(id);
    action.subscribe({
      next: () => {
        this.showToastMessage(`Router "${name}" ${enable ? 'enabled' : 'disabled'}`, 'success');
        this.loadRouters();
      },
      error: (e: any) => this.showToastMessage('Toggle failed: ' + (e?.error?.message || 'Unknown error'), 'danger'),
    });
  }

  testConnection(id: number, name: string): void {
    this.showToastMessage(`Testing "${name}"...`, 'info');
    this.routerService.testConnection(id).subscribe({
      next: (r) => {
        this.showToastMessage(`${name} is ${r.isOnline ? '🟢 online' : '🔴 offline'}`, r.isOnline ? 'success' : 'warning');
        this.loadRouters();
      },
      error: () => this.showToastMessage('Connection test failed', 'danger'),
    });
  }

  syncRouter(id: number, name: string): void {
    this.showToastMessage(`Syncing "${name}"...`, 'info');
    this.routerService.synchronize(id).subscribe({
      next: () => {
        this.showToastMessage(`${name} synced`, 'success');
        this.loadRouters();
      },
      error: () => this.showToastMessage('Sync failed', 'danger'),
    });
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

  showToastMessage(msg: string, type: 'success' | 'danger' | 'warning' | 'info'): void {
    this.toastMessage.set(msg);
    this.toastType.set(type);
    this.showToast.set(true);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.showToast.set(false), 4000);
  }
}