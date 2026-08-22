import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface PackageDto { id: string; name: string; price: number; currency: string; durationMinutes: number; durationLabel: string; icon: string; }
interface PaymentResponse { success: boolean; message: string; transactionId: string; phoneNumber: string; packageId: string; status: string; expiresAt: string; }

@Component({
  selector: 'app-captive-portal',
  imports: [CommonModule, FormsModule],
  templateUrl: './portal.html',
  styleUrl: './portal.scss',
})
export class CaptivePortal implements OnDestroy {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/captive-portal`;

  // Steps: 1=plans, 2=phone, 3=waiting, 4=connected
  step = signal(1);

  packages = signal<PackageDto[]>([]);
  selectedPackage = signal<PackageDto | null>(null);
  phoneNumber = signal('');
  transactionId = signal('');
  loading = signal(false);
  errorMessage = signal('');
  session = signal<any>(null);

  // Polling
  private pollTimer: any;
  pollAttempts = signal(0);

  ngOnDestroy() { clearInterval(this.pollTimer); clearInterval(this.sessionTimer); }
  private sessionTimer: any;

  ngOnInit() { this.loadPackages(); }

  loadPackages() {
    this.loading.set(true);
    this.http.get<PackageDto[]>(`${this.base}/packages`).subscribe({
      next: (p) => { this.packages.set(p); this.loading.set(false); },
      error: () => { this.loading.set(false); this.errorMessage.set('Failed to load packages'); }
    });
  }

  selectPackage(pkg: PackageDto) {
    this.selectedPackage.set(pkg);
    this.step.set(2);
    this.errorMessage.set('');
  }

  initiatePayment() {
    const phone = this.phoneNumber().trim();
    if (!phone || phone.length < 10) {
      this.errorMessage.set('Enter a valid phone number (e.g., 0772123456)');
      return;
    }
    if (!this.selectedPackage()) {
      this.errorMessage.set('Please select a package');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.http.post<PaymentResponse>(`${this.base}/initiate-payment`, {
      phoneNumber: phone,
      packageId: this.selectedPackage()!.id
    }).subscribe({
      next: (r) => {
        this.transactionId.set(r.transactionId);
        this.step.set(3);
        this.loading.set(false);
        this.pollAttempts.set(0);
        this.startPolling();
      },
      error: (e) => {
        this.loading.set(false);
        this.errorMessage.set(e?.error?.error || 'Payment initiation failed');
      }
    });
  }

  startPolling() {
    clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => {
      this.pollPaymentStatus();
    }, 3000); // Poll every 3 seconds
  }

  pollPaymentStatus() {
    const txId = this.transactionId();
    if (!txId) return;

    this.http.get<PaymentResponse>(`${this.base}/payment-status/${txId}`).subscribe({
      next: (r) => {
        if (r.status === 'COMPLETED') {
          clearInterval(this.pollTimer);
          this.fetchActiveSession();
        } else if (r.status === 'FAILED' || r.status === 'EXPIRED') {
          clearInterval(this.pollTimer);
          this.errorMessage.set('Payment ' + r.status.toLowerCase() + '. Please try again.');
          this.step.set(2);
        }
        // Else still PENDING_PIN — keep polling
        this.pollAttempts.set(this.pollAttempts() + 1);
      },
      error: () => { /* retry on next poll */ }
    });
  }

  fetchActiveSession() {
    this.http.get<any>(`${this.base}/session/${this.transactionId()}`).subscribe({
      next: (s) => {
        this.session.set(s);
        this.step.set(4);
        // Start periodic session check for expiry
        this.sessionTimer = setInterval(() => {
          this.http.get<any>(`${this.base}/session/${this.transactionId()}`).subscribe({
            next: (updated) => {
              this.session.set(updated);
              if (updated.status === 'EXPIRED') clearInterval(this.sessionTimer);
            }
          });
        }, 30000);
      },
      error: () => this.errorMessage.set('Could not retrieve session')
    });
  }

  disconnect() {
    this.http.post(`${this.base}/logout`, { sessionId: this.transactionId() }).subscribe({ next: () => this.goToPlans(), error: () => this.goToPlans() });
  }
  logoutSession() {
    this.disconnect();
  }
  back() { clearInterval(this.pollTimer); this.step.set(this.step() - 1); this.errorMessage.set(''); }
  goToPlans() { this.step.set(1); this.selectedPackage.set(null); this.phoneNumber.set(''); this.transactionId.set(''); this.session.set(null); this.errorMessage.set(''); }

  formatPrice(p: PackageDto) { return `${p.currency === 'UGX' ? 'UGX' : ''} ${p.price.toLocaleString()}`; }
}