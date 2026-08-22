import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-customers',
  imports: [CommonModule, FormsModule],
  templateUrl: './customers.html',
})
export class Customers {
  showModal = signal(false);
  modalTitle = signal('Add Customer');
  formName = signal('');
  formEmail = signal('');
  formPhone = signal('');
  toastMessage = signal(''); toastType = signal<'success'|'danger'>('success'); showToast = signal(false);
  private t: any;

  openAdd() { this.modalTitle.set('Add Customer'); this.reset(); this.showModal.set(true); }
  reset() { this.formName.set(''); this.formEmail.set(''); this.formPhone.set(''); }
  save() { this.showModal.set(false); this.toast('Customer saved successfully', 'success'); }
  toast(msg: string, type: 'success'|'danger') { this.toastMessage.set(msg); this.toastType.set(type); this.showToast.set(true); clearTimeout(this.t); this.t = setTimeout(() => this.showToast.set(false), 3000); }
}