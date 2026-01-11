import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { Button } from './button';
import { Alert, AlertDescription } from './alert';
import { Eye, Lock, Upgrade, Info } from 'lucide-react';
import { ModulePermissions } from '@shared/schema';

interface ReadOnlyModeProps {
  isReadOnly: boolean;
  moduleType: string;
  moduleName: string;
  children: React.ReactNode;
  permissions?: ModulePermissions;
  onUpgradeClick?: () => void;
}

/**
 * Wrapper component that shows content in read-only mode when permissions are limited
 */
export function ReadOnlyMode({ 
  isReadOnly, 
  moduleType, 
  moduleName,
  children, 
  permissions,
  onUpgradeClick 
}: ReadOnlyModeProps) {
  if (!isReadOnly) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-4">
      {/* Read-only banner */}
      <Alert className="border-orange-200 bg-orange-50">
        <Info className="h-4 w-4 text-orange-600" />
        <AlertDescription className="text-orange-800">
          <div className="flex items-center justify-between">
            <div>
              <strong>Modo Solo Lectura:</strong> Puedes ver el historial de {moduleName.toLowerCase()}, 
              pero no puedes crear, editar o eliminar elementos porque esta función no está activa en tu plan.
            </div>
            {onUpgradeClick && (
              <Button onClick={onUpgradeClick} size="sm" variant="outline">
                <Upgrade className="h-4 w-4 mr-2" />
                Actualizar Plan
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>

      {/* Wrapped content with disabled interactions */}
      <div className="relative">
        {/* Overlay to prevent interactions */}
        <div className="absolute inset-0 z-10 bg-transparent pointer-events-auto">
          <div 
            className="w-full h-full"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            style={{ 
              cursor: 'not-allowed'
            }}
          />
        </div>

        {/* Content with visual indicators */}
        <div className="opacity-75 select-none pointer-events-none">
          {children}
        </div>
      </div>
    </div>
  );
}

interface ReadOnlyButtonProps {
  canPerformAction: boolean;
  action: 'create' | 'edit' | 'delete';
  moduleName: string;
  disabledReason?: string;
  onUpgradeClick?: () => void;
  children: React.ReactNode;
  [key: string]: any;
}

/**
 * Button component that shows upgrade option when action is not allowed due to plan limits
 */
export function ReadOnlyButton({ 
  canPerformAction, 
  action, 
  moduleName,
  disabledReason,
  onUpgradeClick,
  children,
  ...buttonProps 
}: ReadOnlyButtonProps) {
  if (canPerformAction) {
    return <Button {...buttonProps}>{children}</Button>;
  }

  const actionLabels = {
    create: 'crear',
    edit: 'editar',
    delete: 'eliminar'
  };

  return (
    <div className="relative group">
      <Button 
        {...buttonProps} 
        disabled 
        className="relative"
        title={disabledReason || `No puedes ${actionLabels[action]} ${moduleName.toLowerCase()}`}
      >
        <Lock className="h-4 w-4 mr-2" />
        {children}
      </Button>
      
      {/* Tooltip with upgrade option */}
      <div className="absolute bottom-full mb-2 left-0 invisible group-hover:visible bg-black text-white text-xs rounded py-1 px-2 whitespace-nowrap z-50">
        <div className="space-y-1">
          <div>{disabledReason || `No puedes ${actionLabels[action]} ${moduleName.toLowerCase()}`}</div>
          {onUpgradeClick && (
            <button 
              onClick={onUpgradeClick}
              className="text-blue-300 hover:text-blue-100 underline"
            >
              Actualizar plan →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface ReadOnlyTableProps {
  permissions: ModulePermissions;
  moduleName: string;
  children: React.ReactNode;
  onUpgradeClick?: () => void;
  showLimitWarning?: boolean;
}

/**
 * Table wrapper that shows read-only indicators and limit warnings
 */
export function ReadOnlyTable({ 
  permissions, 
  moduleName, 
  children, 
  onUpgradeClick,
  showLimitWarning = true 
}: ReadOnlyTableProps) {
  const hasLimitations = !permissions.canCreate || !permissions.canEdit || !permissions.canDelete;
  const isNearLimit = permissions.itemLimit !== null && 
    permissions.currentCount >= (permissions.itemLimit * 0.8);
  const isAtLimit = permissions.itemLimit !== null && 
    permissions.currentCount >= permissions.itemLimit;

  return (
    <div className="space-y-4">
      {/* Limit warnings */}
      {showLimitWarning && permissions.itemLimit !== null && (
        <>
          {isAtLimit && (
            <Alert className="border-red-200 bg-red-50">
              <Lock className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <div className="flex items-center justify-between">
                  <div>
                    <strong>Límite alcanzado:</strong> Has llegado al máximo de {permissions.itemLimit} {moduleName.toLowerCase()}. 
                    No puedes crear más elementos.
                  </div>
                  {onUpgradeClick && (
                    <Button onClick={onUpgradeClick} size="sm" variant="outline">
                      <Upgrade className="h-4 w-4 mr-2" />
                      Aumentar Límite
                    </Button>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          {isNearLimit && !isAtLimit && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <Info className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <div className="flex items-center justify-between">
                  <div>
                    Cerca del límite: {permissions.currentCount}/{permissions.itemLimit} {moduleName.toLowerCase()}
                  </div>
                  {onUpgradeClick && (
                    <Button onClick={onUpgradeClick} size="sm" variant="outline">
                      <Upgrade className="h-4 w-4 mr-2" />
                      Aumentar Límite
                    </Button>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {/* Permissions summary */}
      {hasLimitations && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center space-x-2">
              <Eye className="h-4 w-4 text-blue-500" />
              <span>Permisos del Módulo</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              <Badge variant={permissions.canCreate ? "default" : "secondary"}>
                {permissions.canCreate ? '✓' : '✗'} Crear
              </Badge>
              <Badge variant={permissions.canEdit ? "default" : "secondary"}>
                {permissions.canEdit ? '✓' : '✗'} Editar
              </Badge>
              <Badge variant={permissions.canDelete ? "default" : "secondary"}>
                {permissions.canDelete ? '✓' : '✗'} Eliminar
              </Badge>
              <Badge variant="outline">
                ✓ Ver Historial
              </Badge>
              {onUpgradeClick && (
                <Button onClick={onUpgradeClick} size="sm" variant="link" className="p-0 h-auto">
                  <Upgrade className="h-3 w-3 mr-1" />
                  Mejorar Plan
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {children}
    </div>
  );
}