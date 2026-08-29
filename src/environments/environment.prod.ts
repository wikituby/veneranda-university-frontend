export const environment = {
  production: true,
  /** Overwritten by GitHub Actions on deploy; default matches Render service name. */
  apiUrl: 'https://veneranda-university-backend.onrender.com/api/v1',
  appName: 'Veneranda University',
  appVersion: '1.0.0',
  /** Fixed system/owner fee added on top of coordinator share (UGX). */
  serverFeeAmount: 5000,
  defaultCurrency: 'UGX',
  googleClientId: '936423918383-606sfujp00scurea3cb7a37qsdoh202b.apps.googleusercontent.com',
};
