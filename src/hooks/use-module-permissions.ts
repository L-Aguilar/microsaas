import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { ModulePermissions } from "@shared/schema";

/**
 * Hook para verificar permisos de módulos según el plan actual
 */
export function useModulePermissions(moduleType: string) {
  const { user } = useAuth();

  const { data: permissions, isLoading } = useQuery<ModulePermissions>({
    queryKey: ["/api/module-permissions", moduleType],
    queryFn: async () => {
      const response = await fetch(`/api/module-permissions/${moduleType}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch module permissions');
      }
      
      return response.json();
    },
    enabled: !!user?.businessAccountId && user?.role !== 'SUPER_ADMIN',
    // Super Admin has all permissions by default
    placeholderData: user?.role === 'SUPER_ADMIN' ? {
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canView: true,
      itemLimit: null,
      currentCount: 0
    } : undefined
  });

  // Default permissions for Super Admin
  const defaultPermissions: ModulePermissions = {
    canCreate: user?.role === 'SUPER_ADMIN',
    canEdit: user?.role === 'SUPER_ADMIN',
    canDelete: user?.role === 'SUPER_ADMIN',
    canView: user?.role === 'SUPER_ADMIN',
    itemLimit: null,
    currentCount: 0
  };

  return {
    permissions: permissions || defaultPermissions,
    isLoading,
    canCreate: permissions?.canCreate || user?.role === 'SUPER_ADMIN',
    canEdit: permissions?.canEdit || user?.role === 'SUPER_ADMIN',
    canDelete: permissions?.canDelete || user?.role === 'SUPER_ADMIN',
    canView: permissions?.canView || user?.role === 'SUPER_ADMIN',
    itemLimit: permissions?.itemLimit,
    currentCount: permissions?.currentCount || 0,
    isNearLimit: permissions?.itemLimit !== null && 
      permissions?.currentCount !== undefined &&
      permissions.currentCount >= (permissions.itemLimit * 0.8), // 80% of limit
    isAtLimit: permissions?.itemLimit !== null &&
      permissions?.currentCount !== undefined &&
      permissions.currentCount >= permissions.itemLimit
  };
}

/**
 * Hook para envolver componentes con verificación de permisos
 */
export function usePermissionWrapper() {
  const { user } = useAuth();

  return {
    withPermissions: <T extends Record<string, any>>(
      moduleType: string,
      component: React.ComponentType<T>,
      fallback?: React.ComponentType<T>
    ) => {
      return (props: T) => {
        const { permissions, isLoading } = useModulePermissions(moduleType);

        if (isLoading) {
          return (
            <div className="flex items-center justify-center p-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            </div>
          );
        }

        if (!permissions.canView) {
          if (fallback) {
            const FallbackComponent = fallback;
            return <FallbackComponent {...props} />;
          }

          return (
            <div className="flex items-center justify-center p-8">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m9-7V8a5 5 0 00-10 0v1M5 9h14a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V10a1 1 0 011-1z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Módulo No Disponible</h3>
                <p className="text-gray-600">Este módulo no está incluido en tu plan actual.</p>
              </div>
            </div>
          );
        }

        const Component = component;
        return <Component {...props} permissions={permissions} />;
      };
    }
  };
}

/**
 * Hook para crear botones con verificación de permisos
 */
export function usePermissionButton(moduleType: string, action: 'create' | 'edit' | 'delete') {
  const { permissions } = useModulePermissions(moduleType);

  const canPerformAction = () => {
    switch (action) {
      case 'create':
        return permissions.canCreate && !permissions.isAtLimit;
      case 'edit':
        return permissions.canEdit;
      case 'delete':
        return permissions.canDelete;
      default:
        return false;
    }
  };

  const getDisabledReason = () => {
    if (action === 'create' && permissions.isAtLimit) {
      return `Has alcanzado el límite de ${permissions.itemLimit} elementos`;
    }
    
    const actionNames = {
      create: 'crear',
      edit: 'editar',
      delete: 'eliminar'
    };

    return `Tu plan no permite ${actionNames[action]} elementos en este módulo`;
  };

  return {
    canPerformAction: canPerformAction(),
    disabledReason: canPerformAction() ? null : getDisabledReason(),
    isNearLimit: permissions.isNearLimit,
    isAtLimit: permissions.isAtLimit,
    currentCount: permissions.currentCount,
    itemLimit: permissions.itemLimit
  };
}