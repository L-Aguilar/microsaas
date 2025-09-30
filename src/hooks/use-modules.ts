import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import type { ModuleWithStatus, CompanyWithRelations, BusinessAccountWithRelations } from "@shared/schema";

export function useCompanyModules(companyId: string | undefined) {
  return useQuery<ModuleWithStatus[]>({
    queryKey: ["/api/companies", companyId, "modules"],
    enabled: !!companyId,
    retry: false,
  });
}

export function useModules() {
  return useQuery({
    queryKey: ["/api/modules"],
    retry: false,
  });
}

export function useHasModule(companyId: string | undefined, moduleType: string) {
  const { data: modules, isLoading } = useCompanyModules(companyId);
  
  if (!modules || isLoading) return { hasModule: false, isLoading };
  
  const module = modules.find((m: ModuleWithStatus) => m.type === moduleType);
  return { hasModule: module?.isEnabled || false, isLoading: false };
}

// Hook to check if any company has a specific module enabled
export function useAnyCompanyHasModule(moduleType: string) {
  const companiesQuery = useQuery<CompanyWithRelations[]>({
    queryKey: ["/api/companies"],
    retry: false,
  });

  if (!companiesQuery.data || companiesQuery.isLoading) {
    return { hasModule: false, isLoading: companiesQuery.isLoading };
  }

  // Companies don't have modules directly - check business account modules instead
  const hasModule = false; // This hook is deprecated in favor of useBusinessAccountHasModule

  return { hasModule, isLoading: false };
}

// Hook to check if user's business account has a specific module enabled
export function useBusinessAccountHasModule(moduleType: string) {
  const { user } = useAuth();
  
  // Create a specific endpoint for getting user's own business account modules
  const { data: userBusinessAccountModules } = useQuery<{ type: string; isEnabled: boolean }[]>({
    queryKey: ["/api/user/business-account/modules"],
    queryFn: async () => {
      const response = await fetch('/api/user/business-account/modules');
      if (!response.ok) throw new Error('Failed to fetch modules');
      return response.json();
    },
    enabled: !!user && user.role !== 'SUPER_ADMIN' && !!(user.businessAccountId || user.business_account_id),
    retry: false,
  });

  let hasModule = false;

  if (user?.role === 'SUPER_ADMIN') {
    // SUPER_ADMIN has access to all modules by default
    hasModule = true;
  } else if (userBusinessAccountModules) {
    // Check if user's business account has the module enabled
    hasModule = userBusinessAccountModules.some(module => 
      module.type === moduleType && module.isEnabled
    );
  }

  return { hasModule };
}