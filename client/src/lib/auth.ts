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
    const token = localStorage.getItem(JWT_TOKEN_KEY);
    
    if (!stored || !token) {
      console.log("📖 Missing user data or token, clearing storage");
      clearAuthStorage();
      return null;
    }
    
    const user = JSON.parse(stored);
    console.log("📖 Getting user from localStorage:", user);
    console.log("🔍 User businessAccountId from storage:", user?.businessAccountId);
    
    // Validate user structure
    if (!user.id || !user.email) {
      console.log("🚨 Invalid user structure, clearing storage");
      clearAuthStorage();
      return null;
    }
    
    // Validate JWT token is not expired
    if (!isTokenValid(token)) {
      console.log("🚨 JWT token expired or invalid, clearing storage");
      clearAuthStorage();
      return null;
    }
    
    // Validate business account for non-SUPER_ADMIN users
    if (user.role !== 'SUPER_ADMIN' && !user.businessAccountId) {
      console.log("🚨 User missing businessAccountId, clearing storage for fresh login");
      clearAuthStorage();
      return null;
    }
    
    return user;
  } catch (error) {
    console.log("❌ Error reading user from localStorage:", error);
    clearAuthStorage();
    return null;
  }
}

export function setStoredUser(user: User | null): void {
  console.log("💾 Setting user in localStorage:", user);
  if (user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    console.log("✅ User saved to localStorage");
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    console.log("🗑️ User removed from localStorage");
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

/**
 * Clear all authentication data from storage
 */
export function clearAuthStorage(): void {
  console.log("🧹 Clearing all auth storage");
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(JWT_TOKEN_KEY);
  // Clear any other auth-related storage items
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('crm_') || key.includes('auth') || key.includes('token')) {
      localStorage.removeItem(key);
    }
  });
}

/**
 * Validate JWT token structure and expiration
 */
export function isTokenValid(token: string): boolean {
  try {
    if (!token || typeof token !== 'string') return false;
    
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    // Decode payload
    const payload = JSON.parse(atob(parts[1]));
    
    // Check if token is expired
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      console.log("🚨 JWT token is expired");
      return false;
    }
    
    // Validate required fields
    if (!payload.userId || !payload.email) {
      console.log("🚨 JWT token missing required fields");
      return false;
    }
    
    return true;
  } catch (error) {
    console.log("🚨 Error validating JWT token:", error);
    return false;
  }
}

/**
 * Force a complete auth state refresh
 */
export function refreshAuthState(): void {
  console.log("🔄 Forcing auth state refresh");
  
  // Trigger a storage event to notify all tabs
  window.dispatchEvent(new StorageEvent('storage', {
    key: AUTH_STORAGE_KEY,
    newValue: localStorage.getItem(AUTH_STORAGE_KEY),
    oldValue: null,
  }));
  
  // Force page reload if needed
  window.dispatchEvent(new Event('auth-refresh'));
}
