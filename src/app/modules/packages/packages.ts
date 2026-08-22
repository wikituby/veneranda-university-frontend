import { Component, signal } from '@angular/core'; import { CommonModule } from '@angular/common'; import { FormsModule } from '@angular/forms';
@Component({ selector: 'app-packages', imports: [CommonModule, FormsModule], templateUrl: './packages.html' })
export class Packages { showModal = signal(false); modalTitle = signal('Add Package'); formName = signal(''); formPrice = signal(0); feature = signal('Basic'); showToast = signal(false); toastMessage = signal(''); toastType = signal<'success'|'danger'>('success'); private t: any;
  openAdd() { this.modalTitle.set('Add Package'); this.formName.set(''); this.formPrice.set(0); this.showModal.set(true); }
  save() { this.showModal.set(false); this.tmsg('Package saved', 'success'); }
  tmsg(m: string, type: 'success'|'danger') { this.toastMessage.set(m); this.toastType.set(type); this.showToast.set(true); clearTimeout(this.t); this.t = setTimeout(() => this.showToast.set(false), 3000); }
}