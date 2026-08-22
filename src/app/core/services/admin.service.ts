import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SettingDto { id: number; key: string; value: string; category: string; valueType: string; description?: string; isPublic: boolean; isEncrypted: boolean; status: string; createdAt: string; updatedAt: string; }
export interface AuditLogDto { id: number; username: string; module: string; action: string; entityType?: string; entityId?: number; description?: string; ipAddress?: string; requestPath?: string; httpMethod?: string; statusCode?: number; durationMs?: number; createdAt: string; }
export interface PageResponse<T> { content: T[]; totalElements: number; totalPages: number; page: number; size: number; first: boolean; last: boolean; }

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private base = (path: string) => `${environment.apiUrl}${path}`;

  getSettings(): Observable<SettingDto[]> { return this.http.get<SettingDto[]>(this.base('/settings')); }
  updateSetting(id: number, value: string): Observable<any> { return this.http.put(this.base(`/settings/${id}`), { value }); }

  listAuditLogs(page = 0, size = 20, sortBy = 'createdAt', sortDir = 'desc', search?: string): Observable<PageResponse<AuditLogDto>> {
    let p = new HttpParams().set('page', page).set('size', size).set('sortBy', sortBy).set('sortDir', sortDir);
    if (search) p = p.set('search', search);
    return this.http.get<PageResponse<AuditLogDto>>(this.base('/audit-logs'), { params: p });
  }
}