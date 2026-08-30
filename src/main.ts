import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { findColorTheme } from './app/core/config/color-themes.config';
import { applyColorThemeToDocument, readStoredColorThemeId } from './app/core/utils/apply-color-theme';

applyColorThemeToDocument(findColorTheme(readStoredColorThemeId()));

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
