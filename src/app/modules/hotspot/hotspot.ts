import { Component, signal } from '@angular/core'; import { CommonModule } from '@angular/common'; import { FormsModule } from '@angular/forms';
@Component({ selector: 'app-hotspot', imports: [CommonModule, FormsModule], templateUrl: './hotspot.html' })
export class Hotspot { showModal = signal(false); modalTitle = signal('Add Hotspot User'); formName = signal(''); formPassword = signal(''); formProfile = signal('default'); showToast = signal(false); toastMessage = signal(''); toastType = signal<'success'|'danger'>('success'); private t: any;
  openAdd() { this.modalTitle.set('Add Hotspot User'); this.formName.set(''); this.formPassword.set(''); this.showModal.set(true); }
  save() { this.showModal.set(false); this.tmsg('Hotspot user created', 'success'); }
  tmsg(m: string, type: 'success'|'danger') { this.toastMessage.set(m); this.toastType.set(type); this.showToast.set(true); clearTimeout(this.t); this.t = setTimeout(() => this.showToast.set(false), 3000); }
}