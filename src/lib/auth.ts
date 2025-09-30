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
    if (!stored) return null;
    
    const user = JSON.parse(stored);
    
    // DEFENSIVE: Clean any potentially invalid dates in user object
    if (user && typeof user === 'object') {
      Object.keys(user).forEach(key => {
        if (key.includes('date') || key.includes('_at')) {
          if (user[key] && typeof user[key] === 'string') {
            const date = new Date(user[key]);
            if (isNaN(date.getTime())) {
              console.warn(`🗑️ Removing invalid date from user.${key}:`, user[key]);
              delete user[key];
            }
          }
        }
      });
    }
    
    return user;
  } catch (error) {
    console.warn('🗑️ Error parsing stored user, clearing localStorage:', error);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function setStoredUser(user: User | null): void {
  if (user) {
    // NUCLEAR FIX: Remove ALL date fields before storing
    const cleanUser = { ...user };
    Object.keys(cleanUser).forEach(key => {
      if (key.includes('date') || key.includes('_at') || key.includes('Date') || key.includes('time')) {
        delete cleanUser[key];
      }
    });
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(cleanUser));
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
