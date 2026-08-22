import { Component, signal } from '@angular/core'; import { CommonModule } from '@angular/common'; import { FormsModule } from '@angular/forms';
@Component({ selector: 'app-payments', imports: [CommonModule, FormsModule], templateUrl: './payments.html' })
export class Payments { showModal = signal(false); modalTitle = signal('Record Payment'); formCustomer = signal(''); formAmount = signal(0); formMethod = signal('Cash'); showToast = signal(false); toastMessage = signal(''); toastType = signal<'success'|'danger'>('success'); private t: any;
  openAdd() { this.modalTitle.set('Record Payment'); this.formCustomer.set(''); this.formAmount.set(0); this.showModal.set(true); }
  save() { this.showModal.set(false); this.tmsg('Payment recorded', 'success'); }
  tmsg(m: string, type: 'success'|'danger') { this.toastMessage.set(m); this.toastType.set(type); this.showToast.set(true); clearTimeout(this.t); this.t = setTimeout(() => this.showToast.set(false), 3000); }
}