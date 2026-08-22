import { Component, signal } from '@angular/core'; import { CommonModule } from '@angular/common'; import { FormsModule } from '@angular/forms';
@Component({ selector: 'app-inventory', imports: [CommonModule, FormsModule], templateUrl: './inventory.html' })
export class Inventory { showModal = signal(false); modalTitle = signal('Add Item'); formName = signal(''); formQty = signal(1); formCategory = signal('Hardware'); showToast = signal(false); toastMessage = signal(''); toastType = signal<'success'|'danger'>('success'); private t: any;
  openAdd() { this.modalTitle.set('Add Inventory Item'); this.formName.set(''); this.formQty.set(1); this.showModal.set(true); }
  save() { this.showModal.set(false); this.tmsg('Item added', 'success'); }
  tmsg(m: string, type: 'success'|'danger') { this.toastMessage.set(m); this.toastType.set(type); this.showToast.set(true); clearTimeout(this.t); this.t = setTimeout(() => this.showToast.set(false), 3000); }
}