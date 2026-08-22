import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, AuditLogDto, PageResponse } from '../../../core/services/admin.service';

@Component({
  selector: 'app-audit',
  imports: [CommonModule, FormsModule],
  templateUrl: './audit.html',
})
export class Audit implements OnInit {
  private admin = inject(AdminService);
  logs = signal<AuditLogDto[]>([]);
  loading = signal(true);
  totalElements = signal(0); page = signal(0); size = signal(20);
  sortBy = signal('createdAt'); sortDir = signal<'asc'|'desc'>('desc');
  searchText = signal('');
  Math = Math;

  ngOnInit() { this.load(); }
  load() {
    this.loading.set(true);
    this.admin.listAuditLogs(this.page(), this.size(), this.sortBy(), this.sortDir(), this.searchText()).subscribe({
      next: (r: PageResponse<AuditLogDto>) => { this.logs.set(r.content); this.totalElements.set(r.totalElements); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }
  sort(c: string) { if(this.sortBy()===c) this.sortDir.set(this.sortDir()==='asc'?'desc':'asc'); else {this.sortBy.set(c); this.sortDir.set('asc');} this.load(); }
  sortIcon(c: string) { if(this.sortBy()!==c)return''; return this.sortDir()==='asc'?'bi-arrow-up':'bi-arrow-down'; }
  get tp() { return Math.ceil(this.totalElements()/this.size())||1; }
  get pa() { return Array.from({length:this.tp},(_,i)=>i); }
  gp(p: number) { if(p<0||p>=this.tp)return; this.page.set(p); this.load(); }
}