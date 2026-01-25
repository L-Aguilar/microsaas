import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, CheckCircle, UserX, UserCheck } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface UserActivationToggleProps {
  userId: string;
  userName: string;
  isActive: boolean;
  onActivationChange?: (userId: string, isActive: boolean) => void;
}

export function UserActivationToggle({ 
  userId, 
  userName, 
  isActive, 
  onActivationChange 
}: UserActivationToggleProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingState, setPendingState] = useState<boolean | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const activationMutation = useMutation({
    mutationFn: async (newState: boolean) => {
      const response = await fetch(`/api/users/${userId}/activation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          isActive: newState,
          reason: newState ? 'Activado por administrador' : 'Desactivado por administrador'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al cambiar estado del usuario');
      }

      return response.json();
    },
    onSuccess: (data, newState) => {
      toast({
        title: `Usuario ${newState ? 'activado' : 'desactivado'}`,
        description: `${userName} ha sido ${newState ? 'activado' : 'desactivado'} exitosamente.`,
        variant: "default"
      });

      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['upsell-opportunities'] });
      
      // Notificar al componente padre si existe callback
      onActivationChange?.(userId, newState);
      
      // Reset pending state
      setPendingState(null);
      setShowConfirmDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error al cambiar estado",
        description: error.message || "No se pudo cambiar el estado del usuario",
        variant: "destructive"
      });
      
      // Reset pending state on error
      setPendingState(null);
      setShowConfirmDialog(false);
    }
  });

  const handleToggle = (newState: boolean) => {
    setPendingState(newState);
    setShowConfirmDialog(true);
  };

  const confirmAction = () => {
    if (pendingState !== null) {
      activationMutation.mutate(pendingState);
    }
  };

  const cancelAction = () => {
    setPendingState(null);
    setShowConfirmDialog(false);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Status Badge */}
        <Badge variant={isActive ? "default" : "secondary"} className="text-xs">
          {isActive ? (
            <>
              <CheckCircle className="h-3 w-3 mr-1" />
              Activo
            </>
          ) : (
            <>
              <UserX className="h-3 w-3 mr-1" />
              Inactivo
            </>
          )}
        </Badge>

        {/* Toggle Switch */}
        <Switch
          checked={isActive}
          onCheckedChange={handleToggle}
          disabled={activationMutation.isPending}
          aria-label={`${isActive ? 'Desactivar' : 'Activar'} usuario ${userName}`}
        />
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {pendingState ? (
                <>
                  <UserCheck className="h-5 w-5 text-green-500" />
                  Activar Usuario
                </>
              ) : (
                <>
                  <UserX className="h-5 w-5 text-orange-500" />
                  Desactivar Usuario
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-left pt-2">
              {pendingState ? (
                <>
                  ¿Estás seguro de que deseas <strong>activar</strong> a <strong>{userName}</strong>?
                  <br />
                  <br />
                  <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">
                    ✓ El usuario podrá acceder al sistema nuevamente
                    <br />
                    ✓ Contará hacia el límite de usuarios activos
                    <br />
                    ✓ Tendrá acceso a sus permisos asignados
                  </div>
                </>
              ) : (
                <>
                  ¿Estás seguro de que deseas <strong>desactivar</strong> a <strong>{userName}</strong>?
                  <br />
                  <br />
                  <div className="text-sm text-orange-600 bg-orange-50 p-3 rounded-md">
                    <AlertTriangle className="h-4 w-4 inline mr-1" />
                    <strong>Consecuencias:</strong>
                    <br />
                    • No podrá acceder al sistema
                    <br />
                    • No contará hacia el límite de usuarios activos
                    <br />
                    • Los datos se conservan intactos
                    <br />
                    • Se puede reactivar en cualquier momento
                  </div>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={cancelAction}
              disabled={activationMutation.isPending}
            >
              Cancelar
            </Button>
            <Button 
              onClick={confirmAction}
              disabled={activationMutation.isPending}
              variant={pendingState ? "default" : "destructive"}
            >
              {activationMutation.isPending ? (
                "Procesando..."
              ) : (
                pendingState ? "Activar Usuario" : "Desactivar Usuario"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}