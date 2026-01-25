import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2, Users, Zap, CreditCard, Check, AlertTriangle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface UpsellOpportunity {
  type: 'USER_LIMIT_REACHED' | 'MODULE_UPGRADE' | 'STORAGE_LIMIT' | 'FEATURE_REQUEST';
  productId: string;
  productName: string;
  description: string;
  currentUsage: number;
  limitReached: number;
  suggestedQuantity: number;
  unitPrice: number;
  totalPrice: number;
  savings?: number;
  isAutoUpgradeEligible: boolean;
  urgencyLevel: 'low' | 'medium' | 'high';
}

interface UpsellModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunities: UpsellOpportunity[];
  currentUsage?: {
    users: number;
    limit: number;
  };
}

export function UpsellModal({ isOpen, onClose, opportunities, currentUsage }: UpsellModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<UpsellOpportunity | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Auto-upgrade mutation
  const autoUpgradeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/upsell/auto-upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Error en auto-upgrade');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Auto-upgrade Exitoso",
        description: data.message,
        variant: "default"
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error en Auto-upgrade",
        description: error.message || "No se pudo completar el auto-upgrade",
        variant: "destructive"
      });
    }
  });

  // Manual purchase mutation
  const manualPurchaseMutation = useMutation({
    mutationFn: async (data: { productId: string; quantity: number }) => {
      const response = await fetch('/api/upsell/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Error en compra manual');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Compra Exitosa",
        description: data.message,
        variant: "default"
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error en Compra",
        description: error.message || "No se pudo completar la compra",
        variant: "destructive"
      });
    }
  });

  const handleAutoUpgrade = () => {
    setIsProcessing(true);
    autoUpgradeMutation.mutate();
  };

  const handleManualPurchase = (opportunity: UpsellOpportunity) => {
    setIsProcessing(true);
    setSelectedOpportunity(opportunity);
    manualPurchaseMutation.mutate({
      productId: opportunity.productId,
      quantity: opportunity.suggestedQuantity
    });
  };

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getUrgencyIcon = (level: string) => {
    switch (level) {
      case 'high': return <AlertTriangle className="h-4 w-4" />;
      case 'medium': return <Zap className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  const userLimitOpportunity = opportunities.find(o => o.type === 'USER_LIMIT_REACHED');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Amplía tu Equipo
          </DialogTitle>
          <DialogDescription>
            {userLimitOpportunity 
              ? `Has alcanzado el límite de ${userLimitOpportunity.limitReached} usuarios. Agrega más usuarios a tu plan para continuar.`
              : "Descubre nuevas funcionalidades disponibles para tu cuenta."
            }
          </DialogDescription>
        </DialogHeader>

        {/* Current Usage Status */}
        {currentUsage && (
          <Card className="bg-gray-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-gray-500" />
                  <span className="font-medium">Usuarios Actuales</span>
                </div>
                <Badge variant={currentUsage.users >= currentUsage.limit ? "destructive" : "secondary"}>
                  {currentUsage.users} / {currentUsage.limit}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {opportunities.map((opportunity) => (
            <Card key={opportunity.productId} className="border-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {getUrgencyIcon(opportunity.urgencyLevel)}
                    {opportunity.productName}
                  </CardTitle>
                  <Badge className={getUrgencyColor(opportunity.urgencyLevel)}>
                    {opportunity.urgencyLevel.toUpperCase()}
                  </Badge>
                </div>
                <CardDescription>{opportunity.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Pricing Information */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Cantidad Sugerida</div>
                      <div className="text-lg font-semibold">{opportunity.suggestedQuantity}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Precio Total</div>
                      <div className="text-lg font-semibold text-blue-600">
                        ${opportunity.totalPrice.toFixed(2)}/mes
                      </div>
                    </div>
                  </div>
                  
                  {opportunity.type === 'USER_LIMIT_REACHED' && (
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <div className="text-sm text-blue-700">
                        <Check className="h-4 w-4 inline mr-1" />
                        Nuevo límite: {opportunity.limitReached + opportunity.suggestedQuantity} usuarios
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  {opportunity.isAutoUpgradeEligible && (
                    <Button
                      onClick={handleAutoUpgrade}
                      disabled={isProcessing}
                      className="flex-1"
                      variant="default"
                    >
                      {isProcessing && autoUpgradeMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4 mr-2" />
                      )}
                      Auto-Upgrade
                    </Button>
                  )}
                  
                  <Button
                    onClick={() => handleManualPurchase(opportunity)}
                    disabled={isProcessing}
                    variant="outline"
                    className="flex-1"
                  >
                    {isProcessing && selectedOpportunity?.productId === opportunity.productId ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4 mr-2" />
                    )}
                    Comprar Ahora
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator />

        {/* Information Footer */}
        <div className="text-sm text-gray-500 space-y-2">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-500" />
            Los cargos se prorratean para tu primer ciclo de facturación
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-500" />
            Puedes cancelar o modificar en cualquier momento
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isProcessing}>
            Decidir Después
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}