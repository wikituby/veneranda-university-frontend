import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RbacService } from '../../../core/services/rbac.service';
import { PermissionDto } from '../../../core/models/rbac.model';

@Component({
  selector: 'app-permissions',
  imports: [CommonModule],
  templateUrl: './permissions.html',
})
export class Permissions implements OnInit {
  private rbac = inject(RbacService);
  permissions = signal<PermissionDto[]>([]);
  loading = signal(true);
  selectedModule = signal('');

  async ngOnInit() { this.load(); }
  load(module?: string) {
    this.loading.set(true);
    this.rbac.listPermissions(module).subscribe({
      next: (p) => { this.permissions.set(p); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }
  grouped(): Map<string, PermissionDto[]> {
    const m = new Map<string, PermissionDto[]>();
    for (const p of this.permissions()) {
      const k = p.module || 'other';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    return m;
  }
}