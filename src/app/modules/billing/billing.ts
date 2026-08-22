import { Component, signal } from '@angular/core'; import { CommonModule } from '@angular/common'; import { FormsModule } from '@angular/forms';
@Component({ selector: 'app-billing', imports: [CommonModule, FormsModule], templateUrl: './billing.html' })
export class Billing {
  showModal = signal(false); modalTitle = signal('Generate Invoice');
  formCustomer = signal(''); formAmount = signal(0); formDesc = signal('');
  showToast = signal(false); toastMessage = signal(''); toastType = signal<'success'|'danger'>('success'); private t: any;
  openAdd() { this.modalTitle.set('Generate Invoice'); this.formCustomer.set(''); this.formAmount.set(0); this.formDesc.set(''); this.showModal.set(true); }
  save() { this.showModal.set(false); this.tmsg('Invoice generated', 'success'); }
  tmsg(m: string, type: 'success'|'danger') { this.toastMessage.set(m); this.toastType.set(type); this.showToast.set(true); clearTimeout(this.t); this.t = setTimeout(() => this.showToast.set(false), 3000); }
}