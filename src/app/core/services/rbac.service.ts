import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserDto, CreateUserRequest, UpdateUserRequest, RoleDto, PermissionDto, PageResponse } from '../models/rbac.model';

@Injectable({ providedIn: 'root' })
export class RbacService {
  private http = inject(HttpClient);
  private base = (path: string) => `${environment.apiUrl}${path}`;

  // === Users ===
  listUsers(page = 0, size = 20, sortBy = 'id', sortDir = 'asc', search?: string): Observable<PageResponse<UserDto>> {
    let p = new HttpParams().set('page', page).set('size', size).set('sortBy', sortBy).set('sortDir', sortDir);
    if (search) p = p.set('search', search);
    return this.http.get<PageResponse<UserDto>>(this.base('/users'), { params: p });
  }
  getUser(id: number): Observable<UserDto> { return this.http.get<UserDto>(this.base(`/users/${id}`)); }
  createUser(r: CreateUserRequest): Observable<UserDto> { return this.http.post<UserDto>(this.base('/users'), r); }
  updateUser(id: number, r: UpdateUserRequest): Observable<UserDto> { return this.http.put<UserDto>(this.base(`/users/${id}`), r); }
  deleteUser(id: number): Observable<void> { return this.http.delete<void>(this.base(`/users/${id}`)); }

  // === Roles ===
  listRoles(page = 0, size = 20, sortBy = 'id', sortDir = 'asc', search?: string): Observable<PageResponse<RoleDto>> {
    let p = new HttpParams().set('page', page).set('size', size).set('sortBy', sortBy).set('sortDir', sortDir);
    if (search) p = p.set('search', search);
    return this.http.get<PageResponse<RoleDto>>(this.base('/roles'), { params: p });
  }
  getRole(id: number): Observable<RoleDto> { return this.http.get<RoleDto>(this.base(`/roles/${id}`)); }
  createRole(name: string, code: string, description: string, permissionIds: number[]): Observable<RoleDto> {
    return this.http.post<RoleDto>(this.base('/roles'), { name, code, description, permissionIds });
  }
  updateRole(id: number, name: string, description: string, isActive: boolean, permissionIds: number[]): Observable<RoleDto> {
    return this.http.put<RoleDto>(this.base(`/roles/${id}`), { name, description, isActive, permissionIds });
  }
  deleteRole(id: number): Observable<void> { return this.http.delete<void>(this.base(`/roles/${id}`)); }

  // === Permissions ===
  listPermissions(module?: string): Observable<PermissionDto[]> {
    let p = new HttpParams();
    if (module) p = p.set('module', module);
    return this.http.get<PermissionDto[]>(this.base('/permissions'), { params: p });
  }
}