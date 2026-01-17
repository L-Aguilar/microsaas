import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { getStoredUser, setStoredUser, getStoredJwtToken, setStoredJwtToken, clearAuthStorage, refreshAuthState } from "@/lib/auth";
import { useToast } from "./use-toast";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Temporary disable React Query to fix businessAccountId issue
  // const { data: currentUser, isLoading: userLoading } = useQuery({
  //   queryKey: ["auth", "currentUser"],
  //   queryFn: () => {
  //     const storedUser = getStoredUser();
  //     console.log("⚡ React Query queryFn - storedUser:", storedUser);
  //     console.log("⚡ React Query queryFn - businessAccountId:", storedUser?.businessAccountId);
  //     return storedUser;
  //   },
  //   staleTime: 0, // Siempre considerar los datos como stale para forzar actualizaciones
  //   gcTime: 0, // No cachear para forzar re-fetch
  // });

  // Simplified approach without React Query
  const currentUser = null; // Disable React Query override
  const userLoading = false;

  useEffect(() => {
    const initializeAuth = () => {
      const storedUser = getStoredUser();
      
      console.log("🚀 useAuth init - storedUser:", storedUser);
      console.log("🔑 useAuth init - businessAccountId:", storedUser?.businessAccountId);
      
      if (storedUser) {
        console.log("✅ Setting initial user:", storedUser);
        setUser(storedUser);
      } else {
        console.log("❌ No valid user found, clearing state");
        setUser(null);
      }
      
      setIsLoading(false);
    };

    initializeAuth();

    // Listen for storage events (when localStorage is cleared)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'crm_auth_user' || e.key === 'crm_jwt_token') {
        console.log("🔄 Storage changed, reinitializing auth");
        initializeAuth();
      }
    };

    // Listen for custom auth refresh events
    const handleAuthRefresh = () => {
      console.log("🔄 Auth refresh requested, reinitializing");
      initializeAuth();
    };

    // Listen for auth errors from API calls
    const handleAuthError = (e: CustomEvent) => {
      console.log("🚨 Auth error event received:", e.detail);
      setUser(null);
      clearAuthStorage();
      queryClient.clear();
      setLocation("/login");
      
      // Show specific message based on error
      const errorMessage = e.detail?.message || '';
      let title = "Sesión expirada";
      let description = "Tu sesión ha expirado. Por favor, inicia sesión nuevamente";
      
      if (errorMessage.includes('no longer exists') || errorMessage.includes('been deleted')) {
        title = "Cuenta eliminada";
        description = "Esta cuenta ya no existe. Contacta al administrador si necesitas acceso";
      } else if (errorMessage.includes('inactive')) {
        title = "Cuenta inactiva";
        description = "Tu cuenta ha sido desactivada. Contacta al administrador";
      } else if (errorMessage.includes('suspended')) {
        title = "Cuenta suspendida";
        description = "Tu cuenta ha sido suspendida. Contacta al administrador";
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth-refresh', handleAuthRefresh);
    window.addEventListener('auth-error', handleAuthError as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-refresh', handleAuthRefresh);
      window.removeEventListener('auth-error', handleAuthError as EventListener);
    };
  }, []);

  // Sincronizar el estado local con React Query
  // DISABLED: This was overriding the user state after login
  // useEffect(() => {
  //   console.log("🔄 useAuth currentUser changed:", currentUser);
  //   if (currentUser !== undefined) {
  //     console.log("📝 Setting user from React Query:", currentUser);
  //     setUser(currentUser || null);
  //   }
  // }, [currentUser]);

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const response = await apiRequest("POST", "/api/auth/login", { email, password });
      return response.json();
    },
    onSuccess: (data) => {
      console.log("🔐 Login response data:", data);
      console.log("👤 Login user data:", data.user);
      console.log("🔑 User businessAccountId:", data.user?.businessAccountId);
      
      // Store JWT token and user data
      setStoredJwtToken(data.token);
      setUser(data.user);
      setStoredUser(data.user);
      // Invalidar la query del usuario actual para forzar re-render
      queryClient.invalidateQueries({ queryKey: ["auth", "currentUser"] });
      
      // Immediate redirect to dashboard after successful login
      console.log("🚀 Login successful, redirecting to dashboard immediately");
      setLocation("/");
      
      toast({
        title: "Bienvenido",
        description: "Has iniciado sesión correctamente",
      });
    },
    onError: (error: any) => {
      console.log("🚨 Login error:", error);
      
      // Try to extract specific error message from backend
      let errorMessage = "Credenciales inválidas";
      let errorTitle = "Error";
      
      if (error?.message) {
        const msg = error.message.toLowerCase();
        
        if (msg.includes("organización ya no existe")) {
          errorTitle = "Organización eliminada";
          errorMessage = "Esta organización ya no existe. Contacta al administrador si necesitas acceso";
        } else if (msg.includes("organización está inactiva")) {
          errorTitle = "Organización inactiva";
          errorMessage = "Esta organización está inactiva. Contacta al administrador";
        } else if (msg.includes("organización ha sido eliminada")) {
          errorTitle = "Organización eliminada";
          errorMessage = "Esta organización ha sido eliminada. Contacta al administrador si necesitas acceso";
        } else if (error.message && !msg.includes("401") && !msg.includes("credentials")) {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      console.log("🔄 Iniciando logout...");
      try {
        const response = await apiRequest("POST", "/api/auth/logout");
        console.log("✅ Logout exitoso en backend");
        return response;
      } catch (error) {
        console.log("⚠️ Backend logout failed, but continuing with local cleanup:", error);
        return null; // Continue with local cleanup even if backend fails
      }
    },
    onSuccess: () => {
      console.log("🧹 Limpiando estado completo...");
      
      // Clear all auth state
      setUser(null);
      clearAuthStorage(); // Use the robust cleanup function
      
      // Clear React Query cache completely
      queryClient.clear();
      queryClient.removeQueries();
      queryClient.resetQueries();
      
      // Clear any module permission cache specifically
      queryClient.removeQueries({ queryKey: ["/api/module-permissions"] });
      queryClient.removeQueries({ queryKey: ["auth"] });
      
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión correctamente",
      });
      
      // Force a complete refresh after logout
      console.log("🚀 Redirigiendo a login...");
      setTimeout(() => {
        setLocation("/login");
        // Trigger auth refresh event for other components
        refreshAuthState();
      }, 100);
    },
    onError: (error) => {
      console.error("❌ Error en logout:", error);
      // Even on error, try to clean local state
      console.log("🧹 Limpiando estado local por error...");
      setUser(null);
      clearAuthStorage();
      
      toast({
        title: "Error",
        description: "Error al cerrar sesión, pero se limpió el estado local",
        variant: "destructive",
      });
      
      setTimeout(() => {
        setLocation("/login");
      }, 100);
    },
  });

  // Function to handle auth errors (like expired tokens)
  const handleAuthError = () => {
    console.log("🚨 Auth error detected, clearing state and redirecting");
    setUser(null);
    clearAuthStorage();
    queryClient.clear();
    setLocation("/login");
    toast({
      title: "Sesión expirada",
      description: "Por favor, inicia sesión nuevamente",
      variant: "destructive",
    });
  };

  // Function to recover from cache issues
  const recoverFromCacheIssues = () => {
    console.log("🔄 Recovering from cache issues...");
    
    // Try to get user again with fresh validation
    const recoveredUser = getStoredUser();
    
    if (recoveredUser) {
      console.log("✅ Successfully recovered user from storage");
      setUser(recoveredUser);
      refreshAuthState();
      return true;
    } else {
      console.log("❌ Could not recover user, clearing state");
      handleAuthError();
      return false;
    }
  };

  return {
    user,
    isLoading: isLoading || loginMutation.isPending || userLoading,
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    isLoginPending: loginMutation.isPending,
    handleAuthError,
    recoverFromCacheIssues,
    updateUser: (updatedUser: User) => {
      setUser(updatedUser);
      setStoredUser(updatedUser);
      // Invalidar la query del usuario actual para forzar re-render inmediato
      queryClient.setQueryData(["auth", "currentUser"], updatedUser);
    },
  };
}
