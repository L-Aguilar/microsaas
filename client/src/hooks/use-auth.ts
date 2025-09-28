import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { getStoredUser, setStoredUser, getStoredSessionId, setStoredSessionId } from "@/lib/auth";
import { useToast } from "./use-toast";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Usar React Query para el usuario actual para mejor sincronización
  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: ["auth", "currentUser"],
    queryFn: () => {
      const storedUser = getStoredUser();
      return storedUser;
    },
    staleTime: 0, // Siempre considerar los datos como stale para forzar actualizaciones
    gcTime: 0, // No cachear para forzar re-fetch
  });

  useEffect(() => {
    const storedUser = getStoredUser();
    setUser(storedUser);
    setIsLoading(false);
  }, []);

  // Sincronizar el estado local con React Query
  useEffect(() => {
    if (currentUser !== undefined) {
      setUser(currentUser || null);
    }
  }, [currentUser]);

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const response = await apiRequest("POST", "/api/auth/login", { email, password });
      return response.json();
    },
    onSuccess: (data) => {
      setUser(data.user);
      setStoredUser(data.user);
      // Invalidar la query del usuario actual para forzar re-render
      queryClient.invalidateQueries({ queryKey: ["auth", "currentUser"] });
      toast({
        title: "Bienvenido",
        description: "Has iniciado sesión correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Credenciales inválidas",
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      console.log("🔄 Iniciando logout...");
      const response = await apiRequest("POST", "/api/auth/logout");
      console.log("✅ Logout exitoso en backend");
      return response;
    },
    onSuccess: () => {
      console.log("🧹 Limpiando estado local...");
      setUser(null);
      setStoredUser(null);
      queryClient.clear();
      // Invalidar la query del usuario actual
      queryClient.invalidateQueries({ queryKey: ["auth", "currentUser"] });
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión correctamente",
      });
      // Automatic redirect to login after successful logout
      console.log("🚀 Redirigiendo a login...");
      setTimeout(() => {
        setLocation("/login");
      }, 100);
    },
    onError: (error) => {
      console.error("❌ Error en logout:", error);
      toast({
        title: "Error",
        description: "Error al cerrar sesión",
        variant: "destructive",
      });
    },
  });

  return {
    user,
    isLoading: isLoading || loginMutation.isPending || userLoading,
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    isLoginPending: loginMutation.isPending,
    updateUser: (updatedUser: User) => {
      setUser(updatedUser);
      setStoredUser(updatedUser);
      // Invalidar la query del usuario actual para forzar re-render inmediato
      queryClient.setQueryData(["auth", "currentUser"], updatedUser);
    },
  };
}
