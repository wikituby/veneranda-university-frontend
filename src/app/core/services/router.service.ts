import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RouterDto, CreateRouterRequest, UpdateRouterRequest, RouterStats } from '../models/router.model';
import { PageResponse } from '../models/rbac.model';

/**
 * Router management service.
 */
@Injectable({ providedIn: 'root' })
export class RouterService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/routers`;

  list(page: number = 0, size: number = 20, sortBy: string = 'id', sortDir: string = 'asc', search?: string): Observable<PageResponse<RouterDto>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sortBy', sortBy)
      .set('sortDir', sortDir);
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<PageResponse<RouterDto>>(this.baseUrl, { params });
  }

  getById(id: number): Observable<RouterDto> {
    return this.http.get<RouterDto>(`${this.baseUrl}/${id}`);
  }

  create(request: CreateRouterRequest): Observable<RouterDto> {
    return this.http.post<RouterDto>(this.baseUrl, request);
  }

  update(id: number, request: UpdateRouterRequest): Observable<RouterDto> {
    return this.http.put<RouterDto>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  enable(id: number): Observable<RouterDto> {
    return this.http.post<RouterDto>(`${this.baseUrl}/${id}/enable`, {});
  }

  disable(id: number): Observable<RouterDto> {
    return this.http.post<RouterDto>(`${this.baseUrl}/${id}/disable`, {});
  }

  testConnection(id: number): Observable<RouterDto> {
    return this.http.post<RouterDto>(`${this.baseUrl}/${id}/test-connection`, {});
  }

  synchronize(id: number): Observable<RouterDto> {
    return this.http.post<RouterDto>(`${this.baseUrl}/${id}/sync`, {});
  }

  getStats(): Observable<RouterStats> {
    return this.http.get<RouterStats>(`${this.baseUrl}/stats`);
  }
}