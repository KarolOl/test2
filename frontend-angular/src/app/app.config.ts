import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  AutoRefreshTokenService,
  createInterceptorCondition,
  INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
  includeBearerTokenInterceptor,
  IncludeBearerTokenCondition,
  provideKeycloak,
  UserActivityService,
  withAutoRefreshToken,
} from 'keycloak-angular';

import { APP_SETTINGS, AppSettings } from './config/app-settings';
import { routes } from './app.routes';
import { loadingInterceptor } from './interceptors/loading.interceptor';

export function createAppConfig(settings: AppSettings): ApplicationConfig {
  const apiCondition = createInterceptorCondition<IncludeBearerTokenCondition>({
    urlPattern: createApiUrlPattern(settings.apiBaseUrl),
    bearerPrefix: 'Bearer',
  });

  return {
    providers: [
      provideBrowserGlobalErrorListeners(),
      provideRouter(routes),
      { provide: APP_SETTINGS, useValue: settings },
      provideKeycloak({
        config: settings.keycloak,
        initOptions: {
          onLoad: 'login-required',
          checkLoginIframe: false,
        },
        features: [
          withAutoRefreshToken({
            onInactivityTimeout: 'logout',
            sessionTimeout: Number.POSITIVE_INFINITY,
            logoutOptions: { redirectUri: window.location.origin },
          }),
        ],
        providers: [AutoRefreshTokenService, UserActivityService],
      }),
      {
        provide: INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
        useValue: [apiCondition],
      },
      provideHttpClient(withInterceptors([loadingInterceptor, includeBearerTokenInterceptor])),
    ],
  };
}

function createApiUrlPattern(apiBaseUrl: string): RegExp {
  const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const origin =
    !apiBaseUrl || apiBaseUrl.startsWith('/')
      ? `(?:${escapePattern(window.location.origin)})?`
      : '';

  // Match the configured API and its paths, including absolute same-origin requests.
  // A root API must not match protocol-relative URLs pointing to another host.
  return new RegExp(`^${origin}${escapePattern(apiBaseUrl)}(?:/(?!/)|[?#]|$)`);
}
