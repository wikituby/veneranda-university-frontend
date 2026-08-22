import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError, BehaviorSubject, filter, take, from, Observable } from 'rxjs';
import { TokenStorageService } from '../services/token-storage.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

/**
 * Tracks whether a token refresh is already in progress to avoid multiple
 * concurrent refresh requests from parallel API calls.
 */
let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

/**
 * Functional HTTP interceptor that:
 * 1. Attaches the JWT Bearer token to outgoing requests.
 * 2. On 401, attempts a token refresh once, then retries the original request.
 * 3. On refresh failure, clears the session and navigates to login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenStorage = inject(TokenStorageService);
  const authService = inject(AuthService);
  const router = inject(Router);

  const token = tokenStorage.getAccessToken();
  const isApiUrl = req.url.startsWith(environment.apiUrl);
  const isAuthEndpoint =
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/google') ||
    req.url.includes('/auth/refresh');

  // Attach token to API requests (except login/refresh)
  let authReq = req;
  if (token && isApiUrl && !isAuthEndpoint) {
    authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Only attempt refresh on 401 from non-auth endpoints
      if (error.status === 401 && isApiUrl && !isAuthEndpoint) {
        const refreshToken = tokenStorage.getRefreshToken();
        if (!refreshToken) {
          // No refresh token available, clear and redirect
          authService.clearSession();
          router.navigate(['/login']);
          return throwError(() => error);
        }

        // If a refresh is already in progress, wait for it
        if (isRefreshing) {
          return refreshTokenSubject.pipe(
            filter((newToken) => newToken !== null),
            take(1),
            switchMap((newToken) => {
              if (!newToken) {
                return throwError(() => error);
              }
              const clonedReq = req.clone({
                setHeaders: { Authorization: `Bearer ${newToken}` },
              });
              return next(clonedReq);
            })
          );
        }

        isRefreshing = true;
        refreshTokenSubject.next(null);

        return authService.refresh(refreshToken).pipe(
          switchMap((response) => {
            isRefreshing = false;
            refreshTokenSubject.next(response.accessToken);
            const clonedReq = req.clone({
              setHeaders: { Authorization: `Bearer ${response.accessToken}` },
            });
            return next(clonedReq);
          }),
          catchError((refreshError) => {
            isRefreshing = false;
            refreshTokenSubject.next('');
            authService.clearSession();
            router.navigate(['/login']);
            return throwError(() => refreshError);
          })
        );
      }
      return throwError(() => error);
    })
  );
};
