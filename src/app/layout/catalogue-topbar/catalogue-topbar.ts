import { Component, HostListener, inject, input, output, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { userAvatarUrl, userInitials } from '../../core/utils/user-display.util';

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
  showMenuToggle = input(false);
  menuToggle = output<void>();
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
    return userInitials(this.user);
  }

  get avatarUrl(): string | null {
    return userAvatarUrl(this.user);
  }

  onMenuToggle(event: Event): void {
    event.stopPropagation();
    this.menuToggle.emit();
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
