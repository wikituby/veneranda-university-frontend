import { Component, signal } from '@angular/core'; import { CommonModule } from '@angular/common'; import { FormsModule } from '@angular/forms';
@Component({ selector: 'app-vouchers', imports: [CommonModule, FormsModule], templateUrl: './vouchers.html' })
export class Vouchers { showModal = signal(false); modalTitle = signal('Generate Voucher'); formCount = signal(1); formDuration = signal('1 Hour'); showToast = signal(false); toastMessage = signal(''); toastType = signal<'success'|'danger'>('success'); private t: any;
  openAdd() { this.modalTitle.set('Generate Vouchers'); this.formCount.set(1); this.showModal.set(true); }
  save() { this.showModal.set(false); this.tmsg('Vouchers generated', 'success'); }
  tmsg(m: string, type: 'success'|'danger') { this.toastMessage.set(m); this.toastType.set(type); this.showToast.set(true); clearTimeout(this.t); this.t = setTimeout(() => this.showToast.set(false), 3000); }
}