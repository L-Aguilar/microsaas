import { getStoredUser, getStoredJwtToken, isTokenValid } from "./auth";

/**
 * Auth debugging utilities for troubleshooting cache and session issues
 */
export class AuthDebugger {
  
  /**
   * Complete diagnostic report of auth state
   */
  static diagnose(): void {
    console.group("🔍 AUTH DIAGNOSTIC REPORT");
    
    // Check localStorage
    console.group("📱 LocalStorage Analysis");
    const storedUser = localStorage.getItem('crm_auth_user');
    const storedToken = localStorage.getItem('crm_jwt_token');
    
    console.log("Raw user data:", storedUser);
    console.log("Raw token data:", storedToken);
    
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        console.log("Parsed user:", parsedUser);
        console.log("User ID:", parsedUser.id);
        console.log("User email:", parsedUser.email);
        console.log("User role:", parsedUser.role);
        console.log("Business Account ID:", parsedUser.businessAccountId);
      } catch (e) {
        console.error("❌ Error parsing user data:", e);
      }
    }
    console.groupEnd();
    
    // Check token validity
    console.group("🔑 Token Analysis");
    if (storedToken) {
      console.log("Token exists:", !!storedToken);
      console.log("Token valid:", isTokenValid(storedToken));
      
      try {
        const parts = storedToken.split('.');
        const payload = JSON.parse(atob(parts[1]));
        console.log("Token payload:", payload);
        console.log("Token expires at:", new Date(payload.exp * 1000));
        console.log("Token time remaining:", Math.floor((payload.exp * 1000 - Date.now()) / 1000 / 60), "minutes");
      } catch (e) {
        console.error("❌ Error parsing token:", e);
      }
    } else {
      console.log("❌ No token found");
    }
    console.groupEnd();
    
    // Check processed user (with validations)
    console.group("✅ Processed User Analysis");
    const processedUser = getStoredUser();
    console.log("getStoredUser() result:", processedUser);
    console.groupEnd();
    
    // Check all localStorage keys
    console.group("🗂️ All LocalStorage Keys");
    const allKeys = Object.keys(localStorage);
    const authRelatedKeys = allKeys.filter(key => 
      key.includes('crm') || key.includes('auth') || key.includes('token')
    );
    console.log("Auth-related keys:", authRelatedKeys);
    authRelatedKeys.forEach(key => {
      console.log(`  ${key}:`, localStorage.getItem(key));
    });
    console.groupEnd();
    
    console.groupEnd();
  }
  
  /**
   * Force clear all auth data and show what was cleared
   */
  static forceClearAndReport(): void {
    console.group("🧹 FORCE CLEAR AUTH DATA");
    
    const beforeKeys = Object.keys(localStorage);
    console.log("Before clearing:", beforeKeys);
    
    // Clear all possible auth data
    const authKeys = [
      'crm_auth_user',
      'crm_jwt_token',
      'auth_user', 
      'jwt_token',
      'token',
      'user'
    ];
    
    authKeys.forEach(key => {
      const existed = localStorage.getItem(key);
      if (existed) {
        localStorage.removeItem(key);
        console.log(`✅ Removed ${key}:`, existed);
      }
    });
    
    // Clear React Query cache if available
    if (window.queryClient) {
      console.log("🗑️ Clearing React Query cache");
      window.queryClient.clear();
    }
    
    const afterKeys = Object.keys(localStorage);
    console.log("After clearing:", afterKeys);
    
    console.groupEnd();
    
    // Refresh page
    console.log("🔄 Forcing page refresh...");
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }
  
  /**
   * Monitor auth state changes
   */
  static startMonitoring(): void {
    console.log("👀 Starting auth state monitoring...");
    
    let lastUser = getStoredUser();
    let lastToken = getStoredJwtToken();
    
    const checkChanges = () => {
      const currentUser = getStoredUser();
      const currentToken = getStoredJwtToken();
      
      if (JSON.stringify(currentUser) !== JSON.stringify(lastUser)) {
        console.log("🔄 User changed:", { from: lastUser, to: currentUser });
        lastUser = currentUser;
      }
      
      if (currentToken !== lastToken) {
        console.log("🔑 Token changed:", { from: lastToken, to: currentToken });
        lastToken = currentToken;
      }
    };
    
    // Check every 5 seconds
    const interval = setInterval(checkChanges, 5000);
    
    // Listen for storage events
    window.addEventListener('storage', (e) => {
      if (e.key?.includes('crm') || e.key?.includes('auth')) {
        console.log("📱 Storage event:", e.key, e.oldValue, "→", e.newValue);
      }
    });
    
    return () => clearInterval(interval);
  }
  
  /**
   * Validate current session
   */
  static validateSession(): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    const user = getStoredUser();
    const token = getStoredJwtToken();
    
    if (!user) issues.push("No user data found");
    if (!token) issues.push("No token found");
    if (token && !isTokenValid(token)) issues.push("Token is invalid or expired");
    if (user && !user.id) issues.push("User missing ID");
    if (user && !user.email) issues.push("User missing email");
    if (user && user.role !== 'SUPER_ADMIN' && !user.businessAccountId) {
      issues.push("Non-admin user missing business account ID");
    }
    
    const isValid = issues.length === 0;
    
    console.log("🏥 Session validation:", { isValid, issues });
    
    return { isValid, issues };
  }
}

// Make it available globally for debugging
(window as any).AuthDebugger = AuthDebugger;

// Auto-diagnose on console errors related to auth
const originalError = console.error;
console.error = (...args) => {
  const message = args.join(' ');
  if (message.includes('401') || message.includes('Unauthorized') || 
      message.includes('token') || message.includes('auth')) {
    console.log("🚨 Auth-related error detected, running diagnosis...");
    setTimeout(() => AuthDebugger.diagnose(), 100);
  }
  originalError.apply(console, args);
};

export default AuthDebugger;