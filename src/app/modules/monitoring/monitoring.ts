import { Component, signal } from '@angular/core'; import { CommonModule } from '@angular/common';
@Component({ selector: 'app-monitoring', imports: [CommonModule], templateUrl: './monitoring.html' })
export class Monitoring { showModal = signal(false); modalTitle = signal('Add Monitor'); showToast = signal(false); toastMessage = signal(''); toastType = signal<'success'|'danger'>('success'); private t: any;
  openAdd() { this.modalTitle.set('Add Network Monitor'); this.showModal.set(true); }
  save() { this.showModal.set(false); this.tmsg('Monitor added', 'success'); }
  tmsg(m: string, type: 'success'|'danger') { this.toastMessage.set(m); this.toastType.set(type); this.showToast.set(true); clearTimeout(this.t); this.t = setTimeout(() => this.showToast.set(false), 3000); }
}