import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CatalogueTopbar } from '../catalogue-topbar/catalogue-topbar';
import { userAvatarUrl, userInitials } from '../../core/utils/user-display.util';

interface CatalogueNavItem {
  label: string;
  icon: string;
  route: string;
  permission?: string;
}

@Component({
  selector: 'app-catalogue-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, CatalogueTopbar],
  templateUrl: './catalogue-layout.html',
  styleUrl: './catalogue-layout.scss',
})
export class CatalogueLayout {
  private auth = inject(AuthService);
  private router = inject(Router);

  sidebarOpen = signal(false);

  readonly primaryNav: CatalogueNavItem[] = [
    { label: 'Explore programmes', icon: 'bi-compass', route: '/explore' },
    { label: 'Your programmes', icon: 'bi-collection-play', route: '/your-programmes' },
    { label: 'Created programmes', icon: 'bi-pencil-square', route: '/created-programmes' },
    { label: 'Creator dashboard', icon: 'bi-graph-up-arrow', route: '/creator-dashboard' },
    { label: 'Register a programme', icon: 'bi-plus-circle', route: '/programmes/new' },
  ];

  readonly accountNav: CatalogueNavItem[] = [
    { label: 'Profile', icon: 'bi-person', route: '/profile' },
    { label: 'Settings', icon: 'bi-sliders', route: '/settings' },
  ];

  readonly adminNav: CatalogueNavItem[] = [
    { label: 'Users', icon: 'bi-people', route: '/admin/users', permission: 'user:read' },
    { label: 'Roles', icon: 'bi-shield-check', route: '/admin/roles', permission: 'role:read' },
    { label: 'Permissions', icon: 'bi-key', route: '/admin/permissions', permission: 'role:read' },
    { label: 'Audit logs', icon: 'bi-journal-text', route: '/admin/audit', permission: 'audit:read' },
    { label: 'Platform settings', icon: 'bi-gear', route: '/admin/settings', permission: 'setting:manage' },
  ];

  get user() {
    return this.auth.currentUser;
  }

  get displayName(): string {
    const u = this.user;
    if (!u) return 'Account';
    return (u.fullName || '').trim() || u.username || 'Account';
  }

  get initials(): string {
    return userInitials(this.user);
  }

  get avatarUrl(): string | null {
    return userAvatarUrl(this.user);
  }

  get showAdminSection(): boolean {
    return this.adminNav.some((item) => this.canSee(item));
  }

  canSee(item: CatalogueNavItem): boolean {
    if (item.permission) {
      return this.auth.hasPermission(item.permission);
    }
    return true;
  }

  navLink(item: CatalogueNavItem): string[] {
    return [item.route];
  }

  isNavActive(item: CatalogueNavItem): boolean {
    const url = this.router.url.split('?')[0].split('#')[0];
    return url === item.route || url.startsWith(item.route + '/');
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  onNavClick(): void {
    if (window.matchMedia('(max-width: 960px)').matches) {
      this.closeSidebar();
    }
  }

  logout(): void {
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/welcome']),
      error: () => {
        this.auth.clearSession();
        this.router.navigate(['/welcome']);
      },
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeSidebar();
  }
}