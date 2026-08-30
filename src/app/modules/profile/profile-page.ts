import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { userAvatarUrl, userInitials } from '../../core/utils/user-display.util';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  hideCurrent = signal(true);
  hideNew = signal(true);
  hideConfirm = signal(true);

  savingProfile = signal(false);
  savingPassword = signal(false);
  uploadingAvatar = signal(false);
  profileError = signal('');
  profileOk = signal('');
  avatarError = signal('');
  avatarOk = signal('');
  passwordError = signal('');
  passwordOk = signal('');

  get username(): string {
    return this.auth.currentUser?.username || '';
  }

  get hasPassword(): boolean {
    return this.auth.currentUser?.hasPassword !== false;
  }

  get initials(): string {
    return userInitials(this.auth.currentUser);
  }

  get avatarUrl(): string | null {
    return userAvatarUrl(this.auth.currentUser);
  }

  ngOnInit(): void {
    const user = this.auth.currentUser;
    this.fullName = user?.fullName || '';
    this.email = user?.email || '';
    this.phone = user?.phone || '';
    this.auth.loadCurrentUser().subscribe({
      next: (fresh) => {
        this.fullName = fresh.fullName || '';
        this.email = fresh.email || '';
        this.phone = fresh.phone || '';
      },
    });
    this.route.fragment.subscribe((fragment) => {
      if (fragment === 'password') {
        queueMicrotask(() => document.getElementById('password')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    });
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.avatarError.set('Choose a JPEG, PNG, WebP, or GIF image.');
      this.avatarOk.set('');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.avatarError.set('Image must be 5 MB or smaller.');
      this.avatarOk.set('');
      return;
    }

    this.uploadingAvatar.set(true);
    this.avatarError.set('');
    this.avatarOk.set('');
    this.auth.uploadAvatar(file).subscribe({
      next: () => {
        this.uploadingAvatar.set(false);
        this.avatarOk.set('Profile photo updated.');
      },
      error: (err) => {
        this.uploadingAvatar.set(false);
        this.avatarError.set(err?.error?.message || 'Could not upload profile photo.');
      },
    });
  }

  saveProfile(): void {
    const fullName = this.fullName.trim();
    const email = this.email.trim();
    if (!fullName || !email) {
      this.profileError.set('Enter your name and email.');
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
    if (this.hasPassword && !this.currentPassword) {
      this.passwordError.set('Enter your current password.');
      this.passwordOk.set('');
      return;
    }
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
    this.savingPassword.set(true);
    this.passwordError.set('');
    this.passwordOk.set('');
    const settingFirstPassword = this.auth.currentUser?.hasPassword === false;
    this.auth.changePassword({
      currentPassword: this.currentPassword || undefined,
      newPassword: this.newPassword,
    }).subscribe({
      next: () => {
        this.savingPassword.set(false);
        this.passwordOk.set(settingFirstPassword ? 'Your password is now set.' : 'Your password was updated.');
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
}
