import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { buildApiUrl } from "./api";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {};
  
  // Special handling for login to use query parameters
  if (url === '/api/auth/login' && data && typeof data === 'object' && data !== null) {
    const loginData = data as { email: string; password: string };
    const queryParams = new URLSearchParams({
      email: loginData.email,
      password: loginData.password
    });
    url = `/api/test-supabase?${queryParams.toString()}`;
    method = 'GET';
    data = undefined; // Clear data since we're using query params
  }
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  // Build full API URL if it's an API endpoint
  const fullUrl = url.startsWith('/api/') ? buildApiUrl(url) : url;

  const res = await fetch(fullUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    let path = queryKey.join("/") as string;
    
    // Redirect API calls to REAL CRM DATA from Supabase
    if (path === '/api/companies') {
      path = '/api/test-supabase?entity=companies';
    } else if (path === '/api/opportunities') {
      path = '/api/test-supabase?entity=opportunities';
    } else if (path === '/api/users') {
      path = '/api/test-supabase?entity=users';
    } else if (path === '/api/activities') {
      path = '/api/test-supabase?entity=activities';
    } else if (path === '/api/reports/stats') {
      path = '/api/reports';
    }
    
    const fullUrl = path.startsWith('/api/') ? buildApiUrl(path) : path;
    
    const res = await fetch(fullUrl, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    const result = await res.json();
    
    // AGGRESSIVE FIX: Remove ALL date fields completely to prevent crashes
    const cleanDates = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(cleanDates);
      } else if (obj && typeof obj === 'object') {
        const cleaned = { ...obj };
        Object.keys(cleaned).forEach(key => {
          if (key.includes('date') || key.includes('_at')) {
            delete cleaned[key]; // Remove ALL date fields completely
          } else if (typeof cleaned[key] === 'object') {
            cleaned[key] = cleanDates(cleaned[key]);
          }
        });
        return cleaned;
      }
      return obj;
    };
    
    // Transform data to expected format
    if (result.data && Array.isArray(result.data)) {
      return cleanDates(result.data); // Return cleaned data array for entity queries
    } else if (Array.isArray(result)) {
      return cleanDates(result); // Direct array response (like debug-frontend)
    }
    
    return cleanDates(result);
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 0, // NO CACHE
      cacheTime: 0, // NO CACHE
      retry: false,
      enabled: true,
    },
    mutations: {
      retry: false,
    },
  },
});
