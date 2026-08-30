import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { MainLayout } from './layout/main-layout/main-layout';
import { CatalogueLayout } from './layout/catalogue-layout/catalogue-layout';

export const routes: Routes = [
  {
    path: 'welcome',
    loadComponent: () =>
      import('./modules/landing/landing').then((m) => m.Landing),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'welcome',
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./modules/auth/login/login').then((m) => m.Login),
  },
  {
    path: '',
    component: CatalogueLayout,
    canActivate: [authGuard],
    children: [
      {
        path: 'home',
        redirectTo: 'explore',
        pathMatch: 'full',
      },
      {
        path: 'explore',
        loadComponent: () =>
          import('./modules/student/student-home').then((m) => m.StudentHome),
        data: { section: 'explore' },
      },
      {
        path: 'your-programmes',
        loadComponent: () =>
          import('./modules/student/student-home').then((m) => m.StudentHome),
        data: { section: 'yours' },
      },
      {
        path: 'created-programmes',
        loadComponent: () =>
          import('./modules/student/student-home').then((m) => m.StudentHome),
        data: { section: 'created' },
      },
      {
        path: 'creator-dashboard',
        loadComponent: () =>
          import('./modules/creator/creator-dashboard').then((m) => m.CreatorDashboardPage),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./modules/profile/profile-page').then((m) => m.ProfilePage),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./modules/account/account-settings').then((m) => m.AccountSettings),
      },
      {
        path: 'programmes',
        pathMatch: 'full',
        loadComponent: () =>
          import('./modules/programme/programme-browse').then((m) => m.ProgrammeBrowse),
      },
      {
        path: 'programmes/new',
        loadComponent: () =>
          import('./modules/programme/programme-create').then((m) => m.ProgrammeCreate),
      },
      {
        path: 'programmes/:id/details',
        loadComponent: () =>
          import('./modules/programme/programme-details').then((m) => m.ProgrammeDetails),
      },
      {
        path: 'programmes/:id',
        loadComponent: () =>
          import('./modules/programme/programme-page').then((m) => m.ProgrammePage),
      },
      {
        path: 'checkout/:categoryId',
        loadComponent: () =>
          import('./modules/programme/checkout').then((m) => m.Checkout),
      },
    ],
  },
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', loadComponent: () => import('./modules/dashboard/dashboard').then((m) => m.Dashboard) },
      {
        path: 'course',
        loadComponent: () => import('./modules/course-reader/course-reader').then((m) => m.CourseReader),
      },
      {
        path: 'course/:contentId',
        loadComponent: () => import('./modules/course-reader/course-reader').then((m) => m.CourseReader),
      },
      {
        path: 'course/file/:contentId',
        loadComponent: () => import('./modules/course-reader/course-reader').then((m) => m.CourseReader),
      },
      {
        path: 'admin/users',
        loadComponent: () => import('./modules/admin/users/users').then((m) => m.Users),
      },
      {
        path: 'admin/roles',
        loadComponent: () => import('./modules/admin/roles/roles').then((m) => m.Roles),
      },
      {
        path: 'admin/permissions',
        loadComponent: () => import('./modules/admin/permissions/permissions').then((m) => m.Permissions),
      },
      {
        path: 'admin/audit',
        loadComponent: () => import('./modules/admin/audit/audit').then((m) => m.Audit),
      },
      {
        path: 'admin/settings',
        loadComponent: () => import('./modules/admin/settings/settings').then((m) => m.Settings),
      },
      {
        path: 'customers',
        loadComponent: () => import('./modules/customers/customers').then((m) => m.Customers),
      },
      {
        path: 'packages',
        loadComponent: () => import('./modules/packages/packages').then((m) => m.Packages),
      },
      {
        path: 'billing',
        loadComponent: () => import('./modules/billing/billing').then((m) => m.Billing),
      },
      {
        path: 'payments',
        loadComponent: () => import('./modules/payments/payments').then((m) => m.Payments),
      },
      {
        path: 'vouchers',
        loadComponent: () => import('./modules/vouchers/vouchers').then((m) => m.Vouchers),
      },
      {
        path: 'hotspot',
        loadComponent: () => import('./modules/hotspot/hotspot').then((m) => m.Hotspot),
      },
      {
        path: 'pppoe',
        loadComponent: () => import('./modules/pppoe/pppoe').then((m) => m.PPPoE),
      },
      {
        path: 'routers',
        loadComponent: () => import('./modules/routers/router-list/router-list').then((m) => m.RouterList),
      },
      {
        path: 'routers/create',
        loadComponent: () => import('./modules/routers/router-form/router-form').then((m) => m.RouterForm),
      },
      {
        path: 'routers/:id',
        loadComponent: () => import('./modules/routers/router-detail/router-detail').then((m) => m.RouterDetail),
      },
      {
        path: 'routers/:id/edit',
        loadComponent: () => import('./modules/routers/router-form/router-form').then((m) => m.RouterForm),
      },
      {
        path: 'monitoring',
        loadComponent: () => import('./modules/monitoring/monitoring').then((m) => m.Monitoring),
      },
      {
        path: 'inventory',
        loadComponent: () => import('./modules/inventory/inventory').then((m) => m.Inventory),
      },
      {
        path: 'finance',
        loadComponent: () => import('./modules/finance/finance').then((m) => m.Finance),
      },
      {
        path: 'reports',
        loadComponent: () => import('./modules/reports/reports').then((m) => m.Reports),
      },
      {
        path: 'tickets',
        loadComponent: () => import('./modules/tickets/tickets').then((m) => m.Tickets),
      },
      {
        path: 'gis',
        loadComponent: () => import('./modules/gis/gis').then((m) => m.Gis),
      },
    ],
  },
  {
    path: 'portal',
    loadComponent: () => import('./modules/captive-portal/portal').then((m) => m.CaptivePortal),
  },
  { path: '**', redirectTo: 'welcome' },
];
