import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RbacService } from '../../../core/services/rbac.service';
import { UserDto, RoleDto, CreateUserRequest, UpdateUserRequest, PageResponse } from '../../../core/models/rbac.model';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-users',
  imports: [CommonModule, FormsModule],
  templateUrl: './users.html',
  styleUrl: './users.scss',
})
export class Users implements OnInit {
  private rbac = inject(RbacService);

  users = signal<UserDto[]>([]);
  allRoles = signal<RoleDto[]>([]);
  loading = signal(true);
  totalElements = signal(0);
  page = signal(0); size = signal(20);
  sortBy = signal('id'); sortDir = signal<'asc'|'desc'>('asc');
  searchText = signal('');
  Math = Math;

  showForm = signal(false); editMode = signal(false); editId = signal<number|null>(null);
  formName = signal(''); formUsername = signal(''); formPassword = signal(''); formEmail = signal('');
  formPhone = signal(''); formJobTitle = signal(''); formIsActive = signal(true);
  formRoleId = signal<number|null>(null);

  toastMessage = signal(''); toastType = signal<'success'|'danger'|'warning'|'info'>('info'); showToast = signal(false);
  private toastTimer: any;

  async ngOnInit() {
    await this.loadRoles();
    this.loadUsers();
  }

  async loadRoles() {
    try {
      const r = await firstValueFrom(this.rbac.listRoles(0, 100, 'name', 'asc'));
      this.allRoles.set(r.content || []);
    } catch {
      this.allRoles.set([]);
    }
  }

  loadUsers() {
    this.loading.set(true);
    this.rbac.listUsers(this.page(), this.size(), this.sortBy(), this.sortDir(), this.searchText()).subscribe({
      next: (r: PageResponse<UserDto>) => { this.users.set(r.content); this.totalElements.set(r.totalElements); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast('Failed to load users', 'danger'); }
    });
  }

  sort(col: string) {
    if (this.sortBy() === col) this.sortDir.set(this.sortDir()==='asc'?'desc':'asc');
    else { this.sortBy.set(col); this.sortDir.set('asc'); }
    this.loadUsers();
  }
  sortIcon(col: string) { if (this.sortBy() !== col) return ''; return this.sortDir()==='asc'?'bi-arrow-up':'bi-arrow-down'; }
  get totalPages() { return Math.ceil(this.totalElements()/this.size())||1; }
  get pagesArray() { return Array.from({length:this.totalPages},(_,i)=>i); }
  goToPage(p: number) { if(p<0||p>=this.totalPages)return; this.page.set(p); this.loadUsers(); }
  onSearch() { this.page.set(0); this.loadUsers(); }

  roleLabels(u: UserDto): string[] {
    const roles = u.roles as string[] | Set<string> | undefined;
    if (!roles) return [];
    return Array.isArray(roles) ? roles : Array.from(roles);
  }

  openCreate() {
    this.resetForm();
    this.editMode.set(false);
    this.showForm.set(true);
  }

  openEdit(u: UserDto) {
    this.formName.set(u.fullName);
    this.formUsername.set(u.username);
    this.formPassword.set('');
    this.formEmail.set(u.email);
    this.formPhone.set(u.phone || '');
    this.formJobTitle.set(u.jobTitle || '');
    this.formIsActive.set(u.isActive);
    const codes = Array.isArray(u.roleCodes) ? u.roleCodes : u.roleCodes ? Array.from(u.roleCodes as Set<string>) : [];
    const match = this.allRoles().find(r => codes.includes(r.code));
    this.formRoleId.set(match?.id ?? null);
    this.editId.set(u.id);
    this.editMode.set(true);
    this.showForm.set(true);
  }

  cancelForm() { this.showForm.set(false); }

  resetForm() {
    this.formName.set(''); this.formUsername.set(''); this.formPassword.set(''); this.formEmail.set('');
    this.formPhone.set(''); this.formJobTitle.set(''); this.formIsActive.set(true);
    this.formRoleId.set(null); this.editId.set(null);
  }

  private selectedRoleIds(): number[] | undefined {
    const id = this.formRoleId();
    return id != null ? [id] : undefined;
  }

  submitForm() {
    const roleIds = this.selectedRoleIds();
    if (this.editMode()) {
      const r: UpdateUserRequest = {
        firstName: this.formName().split(' ')[0] || '',
        lastName: this.formName().split(' ').slice(1).join(' ') || '',
        email: this.formEmail(),
        phone: this.formPhone() || undefined,
        jobTitle: this.formJobTitle() || undefined,
        isActive: this.formIsActive(),
        roleIds: roleIds ?? [],
      };
      this.rbac.updateUser(this.editId()!, r).subscribe({
        next: () => { this.toast('User updated', 'success'); this.showForm.set(false); this.loadUsers(); },
        error: (e: any) => this.toast(e?.error?.message || 'Failed', 'danger')
      });
    } else {
      if (!this.formPassword()) {
        this.toast('Password is required', 'warning');
        return;
      }
      const r: CreateUserRequest = {
        username: this.formUsername(),
        password: this.formPassword(),
        firstName: this.formName().split(' ')[0] || '',
        lastName: this.formName().split(' ').slice(1).join(' ') || '',
        email: this.formEmail(),
        phone: this.formPhone() || undefined,
        jobTitle: this.formJobTitle() || undefined,
        isActive: this.formIsActive(),
        roleIds,
      };
      this.rbac.createUser(r).subscribe({
        next: () => { this.toast('User created', 'success'); this.showForm.set(false); this.loadUsers(); },
        error: (e: any) => this.toast(e?.error?.message || 'Failed', 'danger')
      });
    }
  }

  deleteUser(id: number, name: string) {
    if (confirm(`Delete user "${name}"?`)) {
      this.rbac.deleteUser(id).subscribe({
        next: () => { this.toast(`"${name}" deleted`, 'success'); this.loadUsers(); },
        error: () => this.toast('Failed to delete', 'danger')
      });
    }
  }

  toast(msg: string, type: 'success'|'danger'|'warning'|'info') {
    this.toastMessage.set(msg); this.toastType.set(type); this.showToast.set(true);
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => this.showToast.set(false), 4000);
  }
}
