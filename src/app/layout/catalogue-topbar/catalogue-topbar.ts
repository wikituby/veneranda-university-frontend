import { Component, HostListener, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-catalogue-topbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './catalogue-topbar.html',
  styleUrl: './catalogue-topbar.scss',
})
export class CatalogueTopbar {
  private auth = inject(AuthService);
  private router = inject(Router);

  showHome = input(true);
  menuOpen = signal(false);

  get user() {
    return this.auth.currentUser;
  }

  get displayName(): string {
    const u = this.user;
    if (!u) return 'Account';
    return (u.fullName || '').trim() || u.username || 'Account';
  }

  get initials(): string {
    const u = this.user;
    if (!u) return '?';
    const name = (u.fullName || '').trim();
    if (name) {
      return name
        .split(/\s+/)
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();
    }
    return (u.username || '?').slice(0, 2).toUpperCase();
  }

  toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMenu();
  }

  logout(): void {
    this.closeMenu();
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/welcome']),
      error: () => {
        this.auth.clearSession();
        this.router.navigate(['/welcome']);
      },
    });
  }
}
