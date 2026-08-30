import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  LoginRequest,
  GoogleLoginRequest,
  RegisterRequest,
  TokenResponse,
  RefreshTokenRequest,
  UserInfo,
  UpdateProfileRequest,
  ChangePasswordRequest,
} from '../models/auth.model';
import { TokenStorageService } from './token-storage.service';

/**
 * Authentication service: login, Google Sign-In, refresh, logout, current user.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private tokenStorage = inject(TokenStorageService);

  private currentUserSubject = new BehaviorSubject<UserInfo | null>(this.tokenStorage.getUser());
  currentUser$ = this.currentUserSubject.asObservable();

  get currentUser(): UserInfo | null {
    return this.currentUserSubject.value;
  }

  get isLoggedIn(): boolean {
    return this.tokenStorage.isLoggedIn();
  }

  login(request: LoginRequest): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${environment.apiUrl}/auth/login`, request).pipe(
      tap((response) => this.persistSession(response))
    );
  }

  register(request: RegisterRequest): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${environment.apiUrl}/auth/register`, request).pipe(
      tap((response) => this.persistSession(response))
    );
  }

  loginWithGoogle(idToken: string): Observable<TokenResponse> {
    const request: GoogleLoginRequest = { idToken };
    return this.http.post<TokenResponse>(`${environment.apiUrl}/auth/google`, request).pipe(
      tap((response) => this.persistSession(response))
    );
  }

  refresh(refreshToken: string): Observable<TokenResponse> {
    const request: RefreshTokenRequest = { refreshToken };
    return this.http.post<TokenResponse>(`${environment.apiUrl}/auth/refresh`, request).pipe(
      tap((response) => this.persistSession(response))
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/logout`, {}).pipe(
      tap(() => this.clearSession())
    );
  }

  loadCurrentUser(): Observable<UserInfo> {
    return this.http.get<UserInfo>(`${environment.apiUrl}/auth/me`).pipe(
      tap((user) => this.persistUser(user))
    );
  }

  updateProfile(request: UpdateProfileRequest): Observable<UserInfo> {
    return this.http.put<UserInfo>(`${environment.apiUrl}/auth/me`, request).pipe(
      tap((user) => this.persistUser(user))
    );
  }

  uploadAvatar(file: File): Observable<UserInfo> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<UserInfo>(`${environment.apiUrl}/auth/me/avatar/upload`, form).pipe(
      tap((user) => this.persistUser(user))
    );
  }

  changePassword(request: ChangePasswordRequest): Observable<UserInfo> {
    return this.http.put<UserInfo>(`${environment.apiUrl}/auth/me/password`, request).pipe(
      tap((user) => this.persistUser(user))
    );
  }

  clearSession(): void {
    this.tokenStorage.clear();
    this.currentUserSubject.next(null);
  }

  hasPermission(permission: string): boolean {
    const user = this.currentUser;
    return !!user && user.permissions.includes(permission);
  }

  hasRole(role: string): boolean {
    const user = this.currentUser;
    return !!user && user.roles.includes(role);
  }

  /** Platform system administrators (not lecturers or coordinators). */
  isSystemAdmin(): boolean {
    return ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'].some((role) => this.hasRole(role));
  }

  /**
   * Staff who may create/edit course outline and lesson media.
   * Students and other learners are read-only.
   */
  canManageCourseContent(): boolean {
    if (this.hasPermission('course:manage')) return true;
    const managers = [
      'SUPER_ADMIN',
      'SYSTEM_ADMIN',
      'ADMIN',
      'INSTRUCTOR',
      'TEACHER',
      'LECTURER',
      'COORDINATOR',
    ];
    return managers.some((role) => this.hasRole(role));
  }

  /**
   * Staff with course:manage, or the user who created this programme.
   */
  canManageProgramme(createdBy?: number | null): boolean {
    if (this.canManageCourseContent()) return true;
    const userId = this.currentUser?.id;
    return createdBy != null && userId != null && createdBy === userId;
  }

  isLearner(): boolean {
    return !this.canManageCourseContent();
  }

  defaultHomePath(): string {
    return '/explore';
  }

  private persistUser(user: UserInfo): void {
    this.tokenStorage.saveUser(user);
    this.currentUserSubject.next(user);
  }

  private persistSession(response: TokenResponse): void {
    this.tokenStorage.saveTokens(response.accessToken, response.refreshToken);
    this.tokenStorage.saveUser(response.user);
    this.currentUserSubject.next(response.user);
  }
}
