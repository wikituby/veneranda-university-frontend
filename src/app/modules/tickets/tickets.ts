import { Component, signal } from '@angular/core'; import { CommonModule } from '@angular/common'; import { FormsModule } from '@angular/forms';
@Component({ selector: 'app-tickets', imports: [CommonModule, FormsModule], templateUrl: './tickets.html' })
export class Tickets { showModal = signal(false); modalTitle = signal('New Ticket'); formSubject = signal(''); formPriority = signal('Medium'); showToast = signal(false); toastMessage = signal(''); toastType = signal<'success'|'danger'>('success'); private t: any;
  openAdd() { this.modalTitle.set('Create Ticket'); this.formSubject.set(''); this.showModal.set(true); }
  save() { this.showModal.set(false); this.tmsg('Ticket created', 'success'); }
  tmsg(m: string, type: 'success'|'danger') { this.toastMessage.set(m); this.toastType.set(type); this.showToast.set(true); clearTimeout(this.t); this.t = setTimeout(() => this.showToast.set(false), 3000); }
}