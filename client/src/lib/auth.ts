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
    
    console.log("📖 getStoredUser called - stored user:", stored ? "exists" : "missing", "token:", token ? "exists" : "missing");
    
    if (!stored) {
      console.log("📖 No stored user data");
      return null;
    }
    
    if (!token) {
      console.log("📖 Missing JWT token, clearing storage");
      clearAuthStorage();
      return null;
    }
    
    const user = JSON.parse(stored);
    console.log("📖 Getting user from localStorage:", user);
    console.log("🔍 User businessAccountId from storage:", user?.businessAccountId);
    
    // Validate user structure - only require id and email
    if (!user.id || !user.email) {
      console.log("🚨 Invalid user structure (missing id or email), clearing storage");
      clearAuthStorage();
      return null;
    }
    
    // Validate JWT token is not expired
    if (!isTokenValid(token)) {
      console.log("🚨 JWT token expired or invalid, clearing storage");
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
    // Normalizar claves y limpiar fechas inválidas
    const cleanUser: any = { ...user };

    // Normalizar businessAccountId (campo que viene como business_account_id desde backend)
    if (!cleanUser.businessAccountId && cleanUser.business_account_id) {
      cleanUser.businessAccountId = cleanUser.business_account_id;
      delete cleanUser.business_account_id;
    }
    if (!cleanUser.businessAccountId && cleanUser.business_accountId) {
      cleanUser.businessAccountId = cleanUser.business_accountId;
      delete cleanUser.business_accountId;
    }

    // Remover campos de fecha potencialmente problemáticos
    Object.keys(cleanUser).forEach((key) => {
      if (key.toLowerCase().includes('date') || key.toLowerCase().includes('_at') || key.toLowerCase().includes('time')) {
        if (cleanUser[key] && typeof cleanUser[key] === 'string') {
          const d = new Date(cleanUser[key]);
          if (isNaN(d.getTime())) {
            console.warn(`🗑️ Removing invalid date from user.${key}:`, cleanUser[key]);
            delete cleanUser[key];
          }
        }
      }
    });

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(cleanUser));
    console.log("✅ User saved to localStorage (normalized)");
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
    console.log("✅ JWT token saved to localStorage");
  } else {
    localStorage.removeItem(JWT_TOKEN_KEY);
    console.log("🗑️ JWT token removed from localStorage");
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
    if (!token || typeof token !== 'string') {
      console.log("🚨 Token missing or not a string");
      return false;
    }
    
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log("🚨 Token format invalid (not 3 parts)");
      return false;
    }
    
    // Decode payload
    const payload = JSON.parse(atob(parts[1]));
    console.log("🔐 Token payload:", payload);
    
    // Check if token is expired
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      console.log("🚨 JWT token is expired");
      return false;
    }
    
    // Don't require userId/email in token validation - just check structure and expiration
    console.log("✅ Token is valid");
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
