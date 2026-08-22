import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RbacService } from '../../../core/services/rbac.service';
import { AdminService } from '../../../core/services/admin.service';
import { RoleDto, PermissionDto, PageResponse } from '../../../core/models/rbac.model';

@Component({
  selector: 'app-roles',
  imports: [CommonModule, FormsModule],
  templateUrl: './roles.html',
  styleUrl: './roles.scss',
})
export class Roles implements OnInit {
  private rbac = inject(RbacService);
  private admin = inject(AdminService);

  roles = signal<RoleDto[]>([]);
  allPermissions = signal<PermissionDto[]>([]);
  loading = signal(true);
  totalElements = signal(0); page = signal(0); size = signal(20);
  sortBy = signal('id'); sortDir = signal<'asc'|'desc'>('asc'); searchText = signal('');
  Math = Math;

  showForm = signal(false); editMode = signal(false); editId = signal<number|null>(null);
  formName = signal(''); formCode = signal(''); formDesc = signal('');
  formActive = signal(true); formPerms: Set<number> = new Set();

  toastMessage = signal(''); toastType = signal<'success'|'danger'|'warning'|'info'>('info'); showToast = signal(false);
  private t: any;

  async ngOnInit() { await this.loadPerms(); this.loadRoles(); }
  async loadPerms() { try { const p = await import('rxjs').then(m => m.firstValueFrom(this.rbac.listPermissions())); this.allPermissions.set(p); } catch {} }
  loadRoles() { this.loading.set(true); this.rbac.listRoles(this.page(), this.size(), this.sortBy(), this.sortDir(), this.searchText()).subscribe({ next: (r: PageResponse<RoleDto>) => { this.roles.set(r.content); this.totalElements.set(r.totalElements); this.loading.set(false); }, error: () => { this.loading.set(false); this.tmsg('Failed', 'danger'); } }); }
  sort(c: string) { if(this.sortBy()===c) this.sortDir.set(this.sortDir()==='asc'?'desc':'asc'); else {this.sortBy.set(c); this.sortDir.set('asc');} this.loadRoles(); }
  sortIcon(c: string) { if(this.sortBy()!==c)return''; return this.sortDir()==='asc'?'bi-arrow-up':'bi-arrow-down'; }
  get tp() { return Math.ceil(this.totalElements()/this.size())||1; }
  get pa() { return Array.from({length:this.tp},(_,i)=>i); }
  gp(p: number) { if(p<0||p>=this.tp)return; this.page.set(p); this.loadRoles(); }

  openCreate() { this.formName.set(''); this.formCode.set(''); this.formDesc.set(''); this.formActive.set(true); this.formPerms.clear(); this.editMode.set(false); this.showForm.set(true); }
  openEdit(r: RoleDto) { this.formName.set(r.name); this.formCode.set(r.code); this.formDesc.set(r.description||''); this.formActive.set(r.isActive); this.formPerms = new Set(r.permissions.map(p=>p.id)); this.editId.set(r.id); this.editMode.set(true); this.showForm.set(true); }
  togglePerm(id: number) { if(this.formPerms.has(id)) this.formPerms.delete(id); else this.formPerms.add(id); }
  submit() {
    const ids = Array.from(this.formPerms);
    if(this.editMode()) this.rbac.updateRole(this.editId()!, this.formName(), this.formDesc(), this.formActive(), ids).subscribe({ next: () => { this.tmsg('Updated', 'success'); this.showForm.set(false); this.loadRoles(); }, error: (e:any) => this.tmsg(e?.error?.message||'Failed','danger') });
    else this.rbac.createRole(this.formName(), this.formCode(), this.formDesc(), ids).subscribe({ next: () => { this.tmsg('Created', 'success'); this.showForm.set(false); this.loadRoles(); }, error: (e:any) => this.tmsg(e?.error?.message||'Failed','danger') });
  }
  deleteRole(id: number, name: string) { if(confirm(`Delete "${name}"?`)) this.rbac.deleteRole(id).subscribe({ next: () => { this.tmsg(`"${name}" deleted`,'success'); this.loadRoles(); }, error: () => this.tmsg('Failed','danger') }); }

  groupedPerms(): Map<string, PermissionDto[]> {
    const m = new Map<string, PermissionDto[]>();
    for (const p of this.allPermissions()) {
      const key = p.module || 'other';
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(p);
    }
    return m;
  }

  tmsg(msg: string, type: 'success'|'danger'|'warning'|'info') { this.toastMessage.set(msg); this.toastType.set(type); this.showToast.set(true); clearTimeout(this.t); this.t = setTimeout(() => this.showToast.set(false), 4000); }
}