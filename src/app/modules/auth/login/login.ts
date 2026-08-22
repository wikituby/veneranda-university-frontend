import { AfterViewInit, Component, NgZone, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit, AfterViewInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private zone = inject(NgZone);

  tab = signal<'signin' | 'signup'>('signin');
  username = signal('');
  password = signal('');
  fullName = signal('');
  email = signal('');
  confirmPassword = signal('');
  hidePassword = signal(true);
  loading = signal(false);
  googleLoading = signal(false);
  errorMessage = signal('');
  googleEnabled = !!environment.googleClientId;

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'signup') this.tab.set('signup');
  }

  ngAfterViewInit(): void {
    if (!this.googleEnabled) {
      return;
    }
    this.initGoogleButton();
  }

  setTab(tab: 'signin' | 'signup'): void {
    this.tab.set(tab);
    this.errorMessage.set('');
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: tab === 'signup' ? { tab: 'signup' } : {},
      replaceUrl: true,
    });
  }

  onSubmit(form: NgForm): void {
    if (form.invalid) return;
    this.loading.set(true);
    this.errorMessage.set('');

    this.authService
      .login({ username: this.username(), password: this.password() })
      .subscribe({
        next: () => this.navigateAfterLogin(),
        error: (err) => {
          this.loading.set(false);
          if (err.status === 401) this.errorMessage.set('Invalid username or password');
          else if (err.error?.message) this.errorMessage.set(err.error.message);
          else this.errorMessage.set('Login failed. Please try again.');
        },
      });
  }

  onRegister(form: NgForm): void {
    if (form.invalid) return;
    if (this.password() !== this.confirmPassword()) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }
    this.loading.set(true);
    this.errorMessage.set('');
    this.authService
      .register({
        fullName: this.fullName().trim(),
        email: this.email().trim(),
        password: this.password(),
      })
      .subscribe({
        next: () => this.navigateAfterLogin(),
        error: (err) => {
          this.loading.set(false);
          if (err.error?.message) this.errorMessage.set(err.error.message);
          else this.errorMessage.set('Could not create the account. Please try again.');
        },
      });
  }

  private initGoogleButton(attempt = 0): void {
    const buttonHost = document.getElementById('googleSignInBtn');
    if (!buttonHost) {
      return;
    }

    if (!window.google?.accounts?.id) {
      if (attempt < 40) {
        setTimeout(() => this.initGoogleButton(attempt + 1), 150);
      }
      return;
    }

    window.google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (response: { credential?: string }) => {
        this.zone.run(() => this.handleGoogleCredential(response?.credential));
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    window.google.accounts.id.renderButton(buttonHost, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      width: 360,
    });
  }

  private handleGoogleCredential(idToken?: string): void {
    if (!idToken) {
      this.errorMessage.set('Google Sign-In did not return a token. Please try again.');
      return;
    }

    this.googleLoading.set(true);
    this.errorMessage.set('');

    this.authService.loginWithGoogle(idToken).subscribe({
      next: () => this.navigateAfterLogin(),
      error: (err) => {
        this.googleLoading.set(false);
        this.loading.set(false);
        if (err.error?.message) this.errorMessage.set(err.error.message);
        else if (err.status === 401) this.errorMessage.set('Google Sign-In failed. Please try again.');
        else this.errorMessage.set('Google Sign-In failed. Please try again.');
      },
    });
  }

  private navigateAfterLogin(): void {
    this.loading.set(false);
    this.googleLoading.set(false);
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || this.authService.defaultHomePath();
    this.router.navigateByUrl(returnUrl);
  }
}
