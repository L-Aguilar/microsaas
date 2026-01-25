import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, Plus, Zap, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';
import { UpsellModal } from '@/components/modals/UpsellModal';
import { useUpsellOpportunities } from '@/hooks/use-account-status';

interface UserLimitsIndicatorProps {
  currentUsers: number;
  totalLimit: number;
  activeUsers?: number;
  className?: string;
}

export function UserLimitsIndicator({ 
  currentUsers, 
  totalLimit, 
  activeUsers = currentUsers,
  className = "" 
}: UserLimitsIndicatorProps) {
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const { opportunities, hasUserLimitOpportunity } = useUpsellOpportunities();

  const usagePercentage = totalLimit > 0 ? Math.round((activeUsers / totalLimit) * 100) : 0;
  const isNearLimit = usagePercentage >= 80;
  const isAtLimit = usagePercentage >= 100;
  const remainingUsers = Math.max(0, totalLimit - activeUsers);

  const getStatusColor = () => {
    if (isAtLimit) return 'text-red-600';
    if (isNearLimit) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStatusIcon = () => {
    if (isAtLimit) return <AlertCircle className="h-4 w-4 text-red-500" />;
    if (isNearLimit) return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getProgressColor = () => {
    if (isAtLimit) return 'bg-red-500';
    if (isNearLimit) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const getBadgeVariant = () => {
    if (isAtLimit) return 'destructive';
    if (isNearLimit) return 'secondary';
    return 'outline';
  };

  const getStatusMessage = () => {
    if (isAtLimit) {
      return hasUserLimitOpportunity ? 
        'Límite alcanzado - Auto-upgrade disponible' : 
        'Límite alcanzado - Actualiza tu plan';
    }
    if (isNearLimit) {
      return `Acercándose al límite - ${remainingUsers} usuario${remainingUsers !== 1 ? 's' : ''} restante${remainingUsers !== 1 ? 's' : ''}`;
    }
    return `${remainingUsers} usuario${remainingUsers !== 1 ? 's' : ''} disponible${remainingUsers !== 1 ? 's' : ''}`;
  };

  return (
    <>
      <Card className={`${className} ${isAtLimit ? 'border-red-200 bg-red-50' : isNearLimit ? 'border-yellow-200 bg-yellow-50' : ''}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Límite de Usuarios
            </div>
            <Badge variant={getBadgeVariant()} className="text-xs">
              {activeUsers} / {totalLimit}
            </Badge>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-3">
          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress 
              value={Math.min(usagePercentage, 100)} 
              className="h-2"
              style={{
                '--progress-background': getProgressColor()
              } as React.CSSProperties}
            />
            
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">
                {usagePercentage}% utilizado
              </span>
              <span className={`font-medium ${getStatusColor()}`}>
                {getStatusMessage()}
              </span>
            </div>
          </div>

          {/* Status and Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className={`text-sm font-medium ${getStatusColor()}`}>
                {isAtLimit ? 'Límite Alcanzado' : isNearLimit ? 'Cerca del Límite' : 'Disponible'}
              </span>
            </div>
            
            {(isAtLimit || isNearLimit) && (
              <Button
                size="sm"
                onClick={() => setShowUpsellModal(true)}
                variant={isAtLimit ? "default" : "outline"}
                className="text-xs"
              >
                {hasUserLimitOpportunity ? (
                  <>
                    <Zap className="h-3 w-3 mr-1" />
                    Auto-Upgrade
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Ampliar Plan
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Additional Info for Near/At Limit */}
          {(isAtLimit || isNearLimit) && (
            <div className="text-xs text-gray-500 bg-gray-100 p-2 rounded">
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>
                  Usuarios totales: {currentUsers} | Activos: {activeUsers}
                  {currentUsers !== activeUsers && (
                    <span className="text-gray-400 ml-1">
                      ({currentUsers - activeUsers} inactivo{currentUsers - activeUsers !== 1 ? 's' : ''})
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upsell Modal */}
      <UpsellModal
        isOpen={showUpsellModal}
        onClose={() => setShowUpsellModal(false)}
        opportunities={opportunities}
        currentUsage={{
          users: activeUsers,
          limit: totalLimit
        }}
      />
    </>
  );
}