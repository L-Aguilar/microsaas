import { User } from "@shared/schema";

export interface AuthState {
  user: User | null;
  isLoading: boolean;
}

export const AUTH_STORAGE_KEY = 'crm_auth_user';
export const SESSION_STORAGE_KEY = 'crm_session_id';

export function getStoredUser(): User | null {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User | null): void {
  if (user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

export function getStoredSessionId(): string | null {
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredSessionId(sessionId: string | null): void {
  if (sessionId) {
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  } else {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}
