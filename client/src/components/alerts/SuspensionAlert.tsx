import React, { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, CreditCard, Clock, Ban, Info, ExternalLink, X } from 'lucide-react';

interface SuspensionMessage {
  type: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
  canUseApp: boolean;
  showPaymentUpdate?: boolean;
}

interface SuspensionAlertProps {
  suspensionMessage: SuspensionMessage;
  onDismiss?: () => void;
  isBusinessAdmin?: boolean;
}

export function SuspensionAlert({ suspensionMessage, onDismiss, isBusinessAdmin = false }: SuspensionAlertProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const getAlertVariant = () => {
    switch (suspensionMessage.type) {
      case 'error': return 'destructive';
      case 'warning': return 'default';
      default: return 'default';
    }
  };

  const getIcon = () => {
    switch (suspensionMessage.type) {
      case 'error': return <AlertTriangle className="h-4 w-4" />;
      case 'warning': return <Clock className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getBadgeVariant = () => {
    switch (suspensionMessage.type) {
      case 'error': return 'destructive';
      case 'warning': return 'secondary';
      default: return 'outline';
    }
  };

  const handleAction = () => {
    if (suspensionMessage.actionUrl) {
      // Si es una URL externa (billing), abrir en nueva pestaña
      if (suspensionMessage.actionUrl.startsWith('http') || suspensionMessage.actionUrl.includes('billing')) {
        window.open(suspensionMessage.actionUrl, '_blank');
      } else {
        // URL interna, navegar en la misma pestaña
        window.location.href = suspensionMessage.actionUrl;
      }
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  // Para cuentas completamente suspendidas, mostrar modal bloqueante
  if (!suspensionMessage.canUseApp && suspensionMessage.type === 'error') {
    return (
      <Dialog open={true} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[500px]" hideCloseButton>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Ban className="h-5 w-5" />
              {suspensionMessage.title}
            </DialogTitle>
            <DialogDescription className="text-left pt-2">
              {suspensionMessage.message}
            </DialogDescription>
          </DialogHeader>
          
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <div className="text-sm text-red-700">
              <div className="font-medium mb-2">¿Qué significa esto?</div>
              <ul className="space-y-1 list-disc pl-4">
                <li>No puedes acceder a las funciones principales</li>
                <li>Los datos están seguros pero no editables</li>
                {isBusinessAdmin && <li>Solo tú puedes resolver este problema</li>}
              </ul>
            </div>
          </div>

          {suspensionMessage.showPaymentUpdate && isBusinessAdmin && (
            <DialogFooter className="flex gap-2">
              <Button 
                onClick={handleAction}
                className="flex items-center gap-2"
              >
                <CreditCard className="h-4 w-4" />
                {suspensionMessage.actionLabel || 'Resolver Pago'}
                <ExternalLink className="h-3 w-3" />
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  // Para alertas no bloqueantes
  return (
    <>
      <Alert variant={getAlertVariant()} className="mb-4 relative">
        <div className="flex items-start gap-3">
          {getIcon()}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <AlertTitle className="text-sm font-semibold">
                {suspensionMessage.title}
              </AlertTitle>
              <Badge variant={getBadgeVariant()} className="text-xs">
                {suspensionMessage.type.toUpperCase()}
              </Badge>
            </div>
            <AlertDescription className="text-sm">
              {suspensionMessage.message}
            </AlertDescription>
            
            <div className="flex items-center gap-2 mt-3">
              {suspensionMessage.actionLabel && (
                <Button 
                  size="sm" 
                  onClick={handleAction}
                  variant={suspensionMessage.type === 'error' ? 'destructive' : 'default'}
                  className="text-xs"
                >
                  {suspensionMessage.showPaymentUpdate && <CreditCard className="h-3 w-3 mr-1" />}
                  {suspensionMessage.actionLabel}
                  {suspensionMessage.actionUrl?.includes('billing') && <ExternalLink className="h-3 w-3 ml-1" />}
                </Button>
              )}
              
              {suspensionMessage.type !== 'error' && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setShowDetails(true)}
                  className="text-xs"
                >
                  Ver Detalles
                </Button>
              )}
            </div>
          </div>
          
          {/* Dismiss button for non-critical alerts */}
          {suspensionMessage.type !== 'error' && onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </Alert>

      {/* Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getIcon()}
              Estado de la Cuenta
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-gray-700 mb-2">Situación Actual</div>
              <div className="text-sm text-gray-600">{suspensionMessage.message}</div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-blue-700 mb-2">¿Qué puedes hacer?</div>
              <div className="text-sm text-blue-600 space-y-1">
                {isBusinessAdmin ? (
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Actualizar el método de pago si es necesario</li>
                    <li>Contactar con soporte si tienes dudas</li>
                    <li>Todas las funciones seguirán disponibles mientras resuelves</li>
                  </ul>
                ) : (
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Contacta al administrador de tu empresa</li>
                    <li>Continúa trabajando normalmente</li>
                    <li>Los datos están seguros y respaldados</li>
                  </ul>
                )}
              </div>
            </div>
            
            {suspensionMessage.type === 'warning' && (
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <div className="text-sm font-medium text-yellow-700 mb-1">⏰ Acción Requerida</div>
                <div className="text-sm text-yellow-600">
                  Esta situación requiere atención pronto para evitar interrupciones en el servicio.
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter className="gap-2">
            {suspensionMessage.actionLabel && (
              <Button onClick={handleAction}>
                {suspensionMessage.actionLabel}
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowDetails(false)}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}