import { Component, signal } from '@angular/core'; import { CommonModule } from '@angular/common';
@Component({ selector: 'app-reports', imports: [CommonModule], templateUrl: './reports.html' })
export class Reports { showModal = signal(false); modalTitle = signal('Generate Report'); showToast = signal(false); toastMessage = signal(''); toastType = signal<'success'|'danger'>('success'); private t: any;
  openAdd() { this.modalTitle.set('Generate Report'); this.showModal.set(true); }
  save() { this.showModal.set(false); this.tmsg('Report generated', 'success'); }
  tmsg(m: string, type: 'success'|'danger') { this.toastMessage.set(m); this.toastType.set(type); this.showToast.set(true); clearTimeout(this.t); this.t = setTimeout(() => this.showToast.set(false), 3000); }
}