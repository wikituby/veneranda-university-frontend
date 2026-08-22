import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface DashboardSummary {
  totalUsers: number; activeUsers: number;
  totalCustomers: number; activeSubscriptions: number;
  totalRouters: number; onlineRouters: number;
  onlineHotspotUsers: number; pendingInvoices: number; overdueInvoices: number;
  monthlyRevenue: number; openTickets: number; activeVouchers: number; onlineSessions: number;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private http = inject(HttpClient);
  summary = signal<DashboardSummary | null>(null);
  loading = signal(true);

  ngOnInit() { this.load(); }
  load() {
    this.http.get<DashboardSummary>(`${environment.apiUrl}/dashboard/summary`).subscribe({
      next: (d) => { this.summary.set(d); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  cards() {
    const s = this.summary(); if (!s) return [];
    return [
      { v: s.totalRouters, l: 'Total Routers', i: 'bi-hdd-rack', c: '#667eea', g: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
      { v: s.onlineRouters, l: 'Online Routers', i: 'bi-check-circle', c: '#11998e', g: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
      { v: s.totalCustomers, l: 'Total Customers', i: 'bi-people', c: '#4facfe', g: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
      { v: s.onlineHotspotUsers, l: 'Online Hotspot', i: 'bi-wifi', c: '#f093fb', g: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
      { v: s.activeSubscriptions, l: 'Subscriptions', i: 'bi-card-checklist', c: '#43e97b', g: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
      { v: this.fmt(s.monthlyRevenue), l: 'Monthly Revenue', i: 'bi-cash-stack', c: '#667eea', g: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
      { v: s.pendingInvoices, l: 'Pending Invoices', i: 'bi-receipt', c: '#f5af19', g: 'linear-gradient(135deg, #f5af19 0%, #f12711 100%)' },
      { v: s.totalUsers, l: 'System Users', i: 'bi-person-badge', c: '#667eea', g: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    ];
  }

  today = new Date();
  fmt(v: number) { return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(v); }
}