import { InjectionToken } from '@angular/core';

export interface AppSettings {
  readonly appTitle: string;
  readonly apiBaseUrl: string;
  readonly keycloak: {
    readonly url: string;
    readonly realm: string;
    readonly clientId: string;
  };
  readonly fileExtensions: {
    readonly firstFile: readonly string[];
    readonly secondFile: readonly string[];
  };
}

export const APP_SETTINGS = new InjectionToken<AppSettings>('APP_SETTINGS');

export async function loadAppSettings(): Promise<AppSettings> {
  const response = await fetch(new URL('settings.json', document.baseURI), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Nie udało się wczytać settings.json (HTTP ${response.status}).`);
  }

  const settings = readObject(await response.json(), 'settings');
  const keycloak = readObject(settings['keycloak'], 'keycloak');
  const fileExtensions = readObject(settings['fileExtensions'], 'fileExtensions');

  return {
    appTitle: readString(settings['appTitle'], 'appTitle'),
    apiBaseUrl: readUrl(settings['apiBaseUrl'], 'apiBaseUrl', true).replace(/\/+$/, ''),
    keycloak: {
      url: readUrl(keycloak['url'], 'keycloak.url'),
      realm: readString(keycloak['realm'], 'keycloak.realm'),
      clientId: readString(keycloak['clientId'], 'keycloak.clientId'),
    },
    fileExtensions: {
      firstFile: readExtensions(fileExtensions['firstFile'], 'fileExtensions.firstFile'),
      secondFile: readExtensions(fileExtensions['secondFile'], 'fileExtensions.secondFile'),
    },
  };
}

function readObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Nieprawidłowe ustawienie ${field}: oczekiwano obiektu JSON.`);
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Nieprawidłowe ustawienie ${field}: oczekiwano niepustego tekstu.`);
  }
  return value.trim();
}

function readUrl(value: unknown, field: string, allowRelative = false): string {
  const url = readString(value, field);
  if (allowRelative && /^\/(?!\/)/.test(url) && !/[?#\\]/.test(url)) return url;

  try {
    const parsed = new URL(url);
    if (
      ['http:', 'https:'].includes(parsed.protocol) &&
      !parsed.username &&
      !parsed.password &&
      !parsed.search &&
      !parsed.hash
    )
      return url;
  } catch {
    // The error below also covers malformed absolute URLs.
  }
  throw new Error(
    `Nieprawidłowy adres ${field}: podaj URL HTTP(S)${allowRelative ? ' lub ścieżkę /api' : ''}.`,
  );
}

function readExtensions(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw new Error(`Nieprawidłowe ustawienie ${field}: oczekiwano listy rozszerzeń.`);
  }
  return [
    ...new Set(
      value.map((item: unknown) => {
        const extension = readString(item, field).toLowerCase();
        if (!/^\.?[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(extension)) {
          throw new Error(`Nieprawidłowe rozszerzenie w ${field}: ${extension}.`);
        }
        return extension.startsWith('.') ? extension : `.${extension}`;
      }),
    ),
  ];
}
