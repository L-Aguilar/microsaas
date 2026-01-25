import React from "react";
import { useModulePermissions } from "@/hooks/use-module-permissions";
import { useAuth } from "@/hooks/use-auth";
import { Shield, AlertTriangle } from "lucide-react";

interface RequireModuleAccessProps {
  module: string;
  action?: 'view' | 'create' | 'edit' | 'delete';
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Componente para controlar el acceso a módulos basado en permisos
 * Reemplaza las validaciones hardcodeadas por rol con permisos granulares
 */
export function RequireModuleAccess({ 
  module, 
  action = 'view', 
  fallback, 
  children 
}: RequireModuleAccessProps) {
  const { user } = useAuth();
  const { canView, canCreate, canEdit, canDelete, isLoading } = useModulePermissions(module);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  // Check specific permission based on action
  const hasPermission = () => {
    switch (action) {
      case 'view':
        return canView;
      case 'create':
        return canCreate;
      case 'edit':
        return canEdit;
      case 'delete':
        return canDelete;
      default:
        return canView;
    }
  };

  // SUPER_ADMIN always has access
  if (user?.role === 'SUPER_ADMIN') {
    return <>{children}</>;
  }

  // Check permission
  if (!hasPermission()) {
    // Return custom fallback if provided
    if (fallback) {
      return <>{fallback}</>;
    }

    // Default access denied message
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
            <Shield className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">
            Acceso Restringido
          </h2>
          <p className="text-gray-600 mb-4">
            No tienes permisos para {getActionLabel(action)} este módulo.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium text-amber-800">
                  Módulo: {getModuleLabel(module)}
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  Contacta a tu administrador para obtener los permisos necesarios.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // User has permission, render children
  return <>{children}</>;
}

/**
 * Hook para verificar rápidamente si el usuario tiene acceso a un módulo
 */
export function useHasModuleAccess(module: string, action: 'view' | 'create' | 'edit' | 'delete' = 'view') {
  const { user } = useAuth();
  const { canView, canCreate, canEdit, canDelete } = useModulePermissions(module);

  // SUPER_ADMIN always has access
  if (user?.role === 'SUPER_ADMIN') {
    return true;
  }

  switch (action) {
    case 'view':
      return canView;
    case 'create':
      return canCreate;
    case 'edit':
      return canEdit;
    case 'delete':
      return canDelete;
    default:
      return canView;
  }
}

/**
 * Componente de alto nivel para páginas completas que requieren acceso a módulos
 */
export function RequireModulePage({ module, children }: { module: string; children: React.ReactNode }) {
  return (
    <RequireModuleAccess module={module} action="view">
      {children}
    </RequireModuleAccess>
  );
}

// Helper functions
function getActionLabel(action: string): string {
  const actionLabels = {
    view: 'ver',
    create: 'crear en',
    edit: 'editar en',
    delete: 'eliminar de'
  };
  return actionLabels[action as keyof typeof actionLabels] || 'acceder a';
}

function getModuleLabel(module: string): string {
  const moduleLabels = {
    USERS: 'Usuarios',
    CONTACTS: 'Contactos',
    CRM: 'CRM / Oportunidades'
  };
  return moduleLabels[module as keyof typeof moduleLabels] || module;
}

export default RequireModuleAccess;