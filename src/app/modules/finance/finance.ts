import { Component, signal } from '@angular/core'; import { CommonModule } from '@angular/common'; import { FormsModule } from '@angular/forms';
@Component({ selector: 'app-finance', imports: [CommonModule, FormsModule], templateUrl: './finance.html' })
export class Finance { showModal = signal(false); modalTitle = signal('Record Transaction'); formDesc = signal(''); formAmount = signal(0); formType = signal('Income'); showToast = signal(false); toastMessage = signal(''); toastType = signal<'success'|'danger'>('success'); private t: any;
  openAdd() { this.modalTitle.set('Record Transaction'); this.formDesc.set(''); this.formAmount.set(0); this.showModal.set(true); }
  save() { this.showModal.set(false); this.tmsg('Transaction recorded', 'success'); }
  tmsg(m: string, type: 'success'|'danger') { this.toastMessage.set(m); this.toastType.set(type); this.showToast.set(true); clearTimeout(this.t); this.t = setTimeout(() => this.showToast.set(false), 3000); }
}