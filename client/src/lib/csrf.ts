/**
 * CSRF Token Management for Frontend
 * Provides functions to obtain and manage CSRF tokens for secure API requests
 */

let cachedCsrfToken: string | null = null;
let csrfTokenPromise: Promise<string> | null = null;

/**
 * Extract CSRF token from JWT payload
 * JWT-based CSRF tokens are embedded in the authentication token
 */
function extractCsrfFromJWT(jwtToken: string): string | null {
  try {
    // Parse JWT payload (without verification for CSRF extraction)
    const payloadBase64 = jwtToken.split('.')[1];
    if (!payloadBase64) {
      return null;
    }

    const payload = JSON.parse(atob(payloadBase64));
    return payload.csrfNonce || null;
  } catch (error) {
    console.error('❌ Error extracting CSRF from JWT:', error);
    return null;
  }
}

/**
 * Get CSRF token from current JWT token
 * This replaces the session-based approach with JWT-embedded nonces
 */
async function fetchCsrfToken(): Promise<string> {
  try {
    // Get JWT token from localStorage
    const { getStoredJwtToken } = await import('./auth');
    const jwtToken = getStoredJwtToken();
    
    if (!jwtToken) {
      throw new Error('No JWT token available for CSRF nonce extraction');
    }

    // Extract CSRF nonce from JWT payload
    const csrfNonce = extractCsrfFromJWT(jwtToken);
    
    if (!csrfNonce) {
      throw new Error('CSRF nonce not found in JWT token');
    }

    console.log('✅ CSRF nonce extracted from JWT successfully');
    return csrfNonce;
  } catch (error) {
    console.error('❌ Error fetching CSRF token from JWT:', error);
    throw error;
  }
}

/**
 * Get current CSRF token, with caching and single-request optimization
 */
export async function getCsrfToken(): Promise<string> {
  // Return cached token if available
  if (cachedCsrfToken) {
    return cachedCsrfToken;
  }

  // If there's already a pending request, wait for it
  if (csrfTokenPromise) {
    return await csrfTokenPromise;
  }

  // Start new request and cache the promise
  csrfTokenPromise = fetchCsrfToken();
  
  try {
    cachedCsrfToken = await csrfTokenPromise;
    return cachedCsrfToken;
  } catch (error) {
    // Clear failed promise so we can retry
    csrfTokenPromise = null;
    throw error;
  } finally {
    // Clear promise after completion (success or failure)
    csrfTokenPromise = null;
  }
}

/**
 * Clear cached CSRF token (use when token becomes invalid)
 */
export function clearCsrfToken(): void {
  cachedCsrfToken = null;
  csrfTokenPromise = null;
  console.log('🧹 CSRF token cache cleared');
}

/**
 * Refresh CSRF token by clearing cache and fetching new one
 */
export async function refreshCsrfToken(): Promise<string> {
  clearCsrfToken();
  return await getCsrfToken();
}

/**
 * Check if a request method requires CSRF protection
 */
export function requiresCsrfToken(method: string): boolean {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  return !safeMethods.includes(method.toUpperCase());
}

/**
 * Add CSRF token to headers if required for the request method
 */
export async function addCsrfTokenToHeaders(
  method: string, 
  headers: Record<string, string>
): Promise<Record<string, string>> {
  if (!requiresCsrfToken(method)) {
    return headers;
  }

  try {
    const csrfToken = await getCsrfToken();
    return {
      ...headers,
      'X-CSRF-Token': csrfToken,
    };
  } catch (error) {
    console.error('❌ Failed to add CSRF token to headers:', error);
    // For auth endpoints or when no JWT is available, don't block the request
    // This allows login and other auth flows to work
    const { getStoredJwtToken } = await import('./auth');
    if (!getStoredJwtToken()) {
      console.log('ℹ️ No JWT token available, proceeding without CSRF token');
      return headers;
    }
    throw new Error('Unable to obtain CSRF token for secure request');
  }
}

/**
 * Handle CSRF token validation errors
 * When server returns 403 with CSRF error, clear token and retry
 */
export function handleCsrfError(error: any): boolean {
  if (error?.message?.includes('403') && 
      (error?.message?.includes('CSRF') || 
       error?.message?.includes('token'))) {
    console.log('🔄 CSRF token validation failed, clearing cache for retry');
    clearCsrfToken();
    return true;
  }
  return false;
}