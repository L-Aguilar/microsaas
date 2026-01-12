import { User } from "@shared/schema";

export interface AuthState {
  user: User | null;
  isLoading: boolean;
}

export const AUTH_STORAGE_KEY = 'crm_auth_user';
export const JWT_TOKEN_KEY = 'crm_jwt_token';

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

export function getStoredJwtToken(): string | null {
  try {
    return localStorage.getItem(JWT_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredJwtToken(token: string | null): void {
  if (token) {
    localStorage.setItem(JWT_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(JWT_TOKEN_KEY);
  }
}
