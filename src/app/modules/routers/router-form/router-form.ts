import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RouterService } from '../../../core/services/router.service';
import { RouterDto, CreateRouterRequest, UpdateRouterRequest, VENDOR_OPTIONS } from '../../../core/models/router.model';

@Component({
  selector: 'app-router-form',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './router-form.html',
  styleUrl: './router-form.scss',
})
export class RouterForm implements OnInit {
  private routerService = inject(RouterService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  isEditMode = signal(false);
  routerId = signal<number | null>(null);
  loading = signal(false);
  pageTitle = signal('Register New Router');

  vendorOptions = VENDOR_OPTIONS;

  name = signal('');
  vendor = signal('');
  model = signal('');
  ipAddress = signal('');
  apiPort = signal(8728);
  username = signal('');
  password = signal('');
  location = signal('');
  firmware = signal('');
  routerVersion = signal('');
  serialNumber = signal('');
  isEnabled = signal(true);
  notes = signal('');

  // Toast
  toastMessage = signal('');
  toastType = signal<'success' | 'danger' | 'warning' | 'info'>('info');
  showToast = signal(false);
  private toastTimer: any;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.routerId.set(Number(id));
      this.pageTitle.set('Edit Router');
      this.loadRouter(Number(id));
    }
  }

  loadRouter(id: number): void {
    this.loading.set(true);
    this.routerService.getById(id).subscribe({
      next: (router: RouterDto) => {
        this.name.set(router.name);
        this.vendor.set(router.vendor);
        this.model.set(router.model || '');
        this.ipAddress.set(router.ipAddress);
        this.apiPort.set(router.apiPort);
        this.username.set(router.username);
        this.location.set(router.location || '');
        this.firmware.set(router.firmware || '');
        this.routerVersion.set(router.routerVersion || '');
        this.serialNumber.set(router.serialNumber || '');
        this.isEnabled.set(router.isEnabled);
        this.notes.set(router.notes || '');
        this.loading.set(false);
      },
      error: () => {
        this.showToastMessage('Failed to load router', 'danger');
        this.loading.set(false);
        this.router.navigate(['/routers']);
      },
    });
  }

  onSubmit(): void {
    if (this.isEditMode()) {
      this.updateRouter();
    } else {
      this.createRouter();
    }
  }

  createRouter(): void {
    if (!this.name() || !this.vendor() || !this.ipAddress() || !this.username() || !this.password()) {
      this.showToastMessage('Please fill all required fields', 'warning');
      return;
    }

    this.loading.set(true);
    const request: CreateRouterRequest = {
      name: this.name(), vendor: this.vendor(), model: this.model() || undefined,
      ipAddress: this.ipAddress(), apiPort: this.apiPort(), username: this.username(),
      password: this.password(), location: this.location() || undefined,
      firmware: this.firmware() || undefined, routerVersion: this.routerVersion() || undefined,
      serialNumber: this.serialNumber() || undefined, isEnabled: this.isEnabled(),
      notes: this.notes() || undefined,
    };

    this.routerService.create(request).subscribe({
      next: () => {
        this.showToastMessage('Router registered successfully', 'success');
        this.router.navigate(['/routers']);
      },
      error: (err: any) => {
        this.showToastMessage(err?.error?.message || 'Failed to register router', 'danger');
        this.loading.set(false);
      },
    });
  }

  updateRouter(): void {
    this.loading.set(true);
    const request: UpdateRouterRequest = {
      name: this.name(), vendor: this.vendor(), model: this.model() || undefined,
      ipAddress: this.ipAddress(), apiPort: this.apiPort(), username: this.username(),
      location: this.location() || undefined, firmware: this.firmware() || undefined,
      routerVersion: this.routerVersion() || undefined, serialNumber: this.serialNumber() || undefined,
      isEnabled: this.isEnabled(), notes: this.notes() || undefined,
    };
    if (this.password()) request.password = this.password();

    this.routerService.update(this.routerId()!, request).subscribe({
      next: () => {
        this.showToastMessage('Router updated successfully', 'success');
        this.router.navigate(['/routers', this.routerId()!]);
      },
      error: (err: any) => {
        this.showToastMessage(err?.error?.message || 'Failed to update router', 'danger');
        this.loading.set(false);
      },
    });
  }

  showToastMessage(msg: string, type: 'success' | 'danger' | 'warning' | 'info'): void {
    this.toastMessage.set(msg);
    this.toastType.set(type);
    this.showToast.set(true);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.showToast.set(false), 4000);
  }
}