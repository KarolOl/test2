import { inject, Injectable, signal } from '@angular/core';
import Keycloak, { KeycloakProfile } from 'keycloak-js';
import { APP_SETTINGS } from '../config/app-settings';

export interface AuthenticatedUser {
  displayName: string;
}

@Injectable({ providedIn: 'root' })
export class AuthenticationService {
  private readonly authenticated = signal(false);
  readonly isAuthenticated = this.authenticated.asReadonly();

  private readonly keycloak = new Keycloak(inject(APP_SETTINGS).keycloak);

  constructor() {
    this.keycloak.onAuthLogout = () => this.authenticated.set(false);
    this.keycloak.onAuthRefreshError = () => this.authenticated.set(false);
  }

  async initialize(): Promise<AuthenticatedUser> {
    this.authenticated.set(false);
    const authenticated = await this.keycloak.init({
      onLoad: 'login-required',
      checkLoginIframe: false,
    });

    if (!authenticated) {
      throw new Error('Użytkownik nie został uwierzytelniony.');
    }

    let profile: KeycloakProfile | undefined;
    try {
      profile = await this.keycloak.loadUserProfile();
    } catch {
      // Claims from the token are sufficient when the profile endpoint is unavailable.
    }

    const claims = this.keycloak.tokenParsed;
    const displayName =
      profile?.firstName && profile?.lastName
        ? `${profile.firstName} ${profile.lastName}`
        : (profile?.username ??
          (claims?.['name'] as string | undefined) ??
          (claims?.['email'] as string | undefined) ??
          (claims?.['preferred_username'] as string | undefined) ??
          'zalogowany użytkownik');

    this.authenticated.set(true);
    return { displayName };
  }

  async getValidToken(): Promise<string> {
    try {
      await this.keycloak.updateToken(30);
    } catch (error) {
      this.authenticated.set(false);
      await this.keycloak.login();
      throw error;
    }

    if (!this.keycloak.token) {
      this.authenticated.set(false);
      throw new Error('Brak tokenu dostępowego.');
    }
    return this.keycloak.token;
  }

  logout(): Promise<void> {
    this.authenticated.set(false);
    return this.keycloak.logout({ redirectUri: window.location.origin });
  }
}
