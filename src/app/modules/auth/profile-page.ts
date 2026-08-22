import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CatalogueTopbar } from '../../layout/catalogue-topbar/catalogue-topbar';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule, FormsModule, CatalogueTopbar],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss',
})
export class ProfilePage implements OnInit {
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  fullName = '';
  email = '';
  phone = '';
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  savingProfile = signal(false);
  savingPassword = signal(false);
  profileError = signal('');
  profileOk = signal('');
  passwordError = signal('');
  passwordOk = signal('');
  hideCurrent = signal(true);
  hideNew = signal(true);
  hideConfirm = signal(true);

  get username(): string {
    return this.auth.currentUser?.username || '';
  }

  get hasPassword(): boolean {
    return this.auth.currentUser?.hasPassword !== false;
  }

  get initials(): string {
    const name = (this.fullName || this.auth.currentUser?.fullName || '').trim();
    if (!name) return '?';
    return name
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  ngOnInit(): void {
    this.fillFromUser();
    this.auth.loadCurrentUser().subscribe({
      next: () => this.fillFromUser(),
      error: () => {},
    });
    this.route.fragment.subscribe((fragment) => {
      if (fragment === 'password') {
        queueMicrotask(() => document.getElementById('password')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    });
  }

  saveProfile(): void {
    const fullName = this.fullName.trim();
    const email = this.email.trim();
    if (!fullName || !email) {
      this.profileError.set('Name and email are required.');
      this.profileOk.set('');
      return;
    }
    this.savingProfile.set(true);
    this.profileError.set('');
    this.profileOk.set('');
    this.auth.updateProfile({ fullName, email, phone: this.phone.trim() }).subscribe({
      next: () => {
        this.savingProfile.set(false);
        this.profileOk.set('Your details were saved.');
      },
      error: (err) => {
        this.savingProfile.set(false);
        this.profileError.set(err?.error?.message || 'Could not save your details.');
      },
    });
  }

  savePassword(): void {
    if (this.newPassword.length < 8) {
      this.passwordError.set('New password must be at least 8 characters.');
      this.passwordOk.set('');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.passwordError.set('New password and confirmation do not match.');
      this.passwordOk.set('');
      return;
    }
    if (this.hasPassword && !this.currentPassword) {
      this.passwordError.set('Enter your current password.');
      this.passwordOk.set('');
      return;
    }
    this.savingPassword.set(true);
    this.passwordError.set('');
    this.passwordOk.set('');
    this.auth.changePassword({
      currentPassword: this.hasPassword ? this.currentPassword : undefined,
      newPassword: this.newPassword,
    }).subscribe({
      next: () => {
        this.savingPassword.set(false);
        this.passwordOk.set(this.hasPassword ? 'Your password was changed.' : 'Your password was set. You can now sign in with email.');
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
      },
      error: (err) => {
        this.savingPassword.set(false);
        this.passwordError.set(err?.error?.message || 'Could not update your password.');
      },
    });
  }

  private fillFromUser(): void {
    const user = this.auth.currentUser;
    if (!user) return;
    this.fullName = user.fullName || '';
    this.email = user.email || '';
    this.phone = user.phone || '';
  }
}
