import { computed, inject, Injectable } from '@angular/core';
import { KEYCLOAK_EVENT_SIGNAL, KeycloakEventType } from 'keycloak-angular';
import Keycloak, { KeycloakProfile } from 'keycloak-js';

export interface AuthenticatedUser {
  displayName: string;
}

@Injectable({ providedIn: 'root' })
export class AuthenticationService {
  private readonly keycloak = inject(Keycloak);
  private readonly keycloakEvent = inject(KEYCLOAK_EVENT_SIGNAL);
  readonly isAuthenticated = computed(() => {
    switch (this.keycloakEvent().type) {
      case KeycloakEventType.AuthError:
      case KeycloakEventType.AuthLogout:
      case KeycloakEventType.AuthRefreshError:
        return false;
      default:
        return this.keycloak.authenticated ?? false;
    }
  });

  async loadUser(): Promise<AuthenticatedUser> {
    if (!this.isAuthenticated()) {
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

    return { displayName };
  }

  logout(): Promise<void> {
    return this.keycloak.logout({ redirectUri: window.location.origin });
  }
}
