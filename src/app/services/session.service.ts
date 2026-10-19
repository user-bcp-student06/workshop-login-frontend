import { Injectable } from '@angular/core';

export interface SessionUser {
  username?: string;
  displayName?: string;
  [key: string]: unknown;
}

export interface UserPreferences {
  theme: string;
  showTips: boolean;
  compact: boolean;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private token: string | null = null;
  private user: SessionUser | null = null;
  private readonly preferencesKey = 'workshop_preferences';

  getToken(): string | null {
    return this.token;
  }

  getUser(): SessionUser | null {
    return this.user;
  }

  setSession(token: string, user: SessionUser): void {
    this.token = token;
    this.user = user;
  }

  clearSession(): void {
    this.token = null;
    this.user = null;
  }

  loadPreferences(defaults: UserPreferences): UserPreferences {
    try {
      const saved = JSON.parse(localStorage.getItem(this.preferencesKey) || '{}') as Partial<UserPreferences>;
      return { ...defaults, ...saved };
    } catch {
      return defaults;
    }
  }

  savePreferences(preferences: UserPreferences): void {
    localStorage.setItem(this.preferencesKey, JSON.stringify(preferences));
  }
}