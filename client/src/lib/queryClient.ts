import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { buildApiUrl } from "./api";
import { getStoredJwtToken } from "./auth";
import { addCsrfTokenToHeaders, handleCsrfError, clearCsrfToken } from "./csrf";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    
    // Handle 401 Unauthorized specifically
    if (res.status === 401) {
      console.log("🚨 401 Unauthorized - clearing auth state");
      const { clearAuthStorage } = await import("./auth");
      clearAuthStorage();
      
      // Dispatch custom event for auth error
      window.dispatchEvent(new CustomEvent('auth-error', { 
        detail: { status: 401, message: text }
      }));
    }
    
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  retryOnCsrfError: boolean = true,
): Promise<Response> {
  const headers: Record<string, string> = {};
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }

  // Add JWT token to Authorization header if available
  const token = getStoredJwtToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Add CSRF token for state-changing requests (except auth endpoints)
  const isAuthEndpoint = url.includes('/api/auth/');
  const headersWithCsrf = isAuthEndpoint 
    ? headers 
    : await addCsrfTokenToHeaders(method, headers);

  // Build full API URL if it's an API endpoint
  const fullUrl = url.startsWith('/api/') ? buildApiUrl(url) : url;

  try {
    const res = await fetch(fullUrl, {
      method,
      headers: headersWithCsrf,
      body: data ? JSON.stringify(data) : undefined,
      credentials: 'include', // Include cookies for session-based auth
    });

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    // Handle CSRF token validation errors with retry
    if (retryOnCsrfError && handleCsrfError(error)) {
      console.log('🔄 Retrying request with fresh CSRF token');
      return await apiRequest(method, url, data, false); // Prevent infinite retry
    }
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const path = queryKey.join("/") as string;
    const fullUrl = path.startsWith('/api/') ? buildApiUrl(path) : path;
    
    const headers: Record<string, string> = {};
    
    // Add JWT token to Authorization header if available
    const token = getStoredJwtToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Note: GET requests typically don't need CSRF tokens
    // but we include the session cookies for the CSRF middleware to work
    
    const res = await fetch(fullUrl, {
      headers,
      credentials: 'include', // Include cookies for session-based auth (CSRF session)
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
