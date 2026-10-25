import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { APP_SETTINGS, loadAppSettings } from './app/config/app-settings';

async function start(): Promise<void> {
  const settings = await loadAppSettings();
  document.title = settings.appTitle;
  await bootstrapApplication(App, {
    ...appConfig,
    providers: [...appConfig.providers, { provide: APP_SETTINGS, useValue: settings }],
  });
}

void start().catch((error: unknown) => {
  console.error(error);
  const alert = document.createElement('p');
  alert.className = 'alert alert-danger m-3';
  alert.setAttribute('role', 'alert');
  alert.textContent = `Nie udało się uruchomić aplikacji: ${error instanceof Error ? error.message : String(error)}`;
  document.querySelector('app-root')?.replaceChildren(alert);
});
