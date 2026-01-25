import React, { useState, useEffect } from 'react';
import { SuspensionAlert } from '@/components/alerts/SuspensionAlert';
import { UpsellModal } from '@/components/modals/UpsellModal';
import { useAccountStatus, useUpsellOpportunities } from '@/hooks/use-account-status';
import { useAuth } from '@/hooks/use-auth';

interface AccountStatusMonitorProps {
  children: React.ReactNode;
}

export function AccountStatusMonitor({ children }: AccountStatusMonitorProps) {
  const { user } = useAuth();
  const { accountStatus, isBusinessAdmin, shouldShowSuspensionAlert } = useAccountStatus();
  const { opportunities, shouldShowUpsellModal, hasUserLimitOpportunity } = useUpsellOpportunities();
  
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [suspensionDismissed, setSuspensionDismissed] = useState(false);

  // Auto-mostrar modal de upselling cuando se detecten oportunidades críticas
  useEffect(() => {
    if (shouldShowUpsellModal && hasUserLimitOpportunity && isBusinessAdmin) {
      const timer = setTimeout(() => {
        setShowUpsellModal(true);
      }, 1000); // Delay de 1 segundo para mejor UX
      
      return () => clearTimeout(timer);
    }
  }, [shouldShowUpsellModal, hasUserLimitOpportunity, isBusinessAdmin]);

  // Resetear dismissal de suspensión si cambia el mensaje
  useEffect(() => {
    setSuspensionDismissed(false);
  }, [accountStatus?.suspensionMessage?.type, accountStatus?.suspensionMessage?.message]);

  // No mostrar nada para Super Admins
  if (!user || user.role === 'SUPER_ADMIN') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen">
      {/* Suspension Alert */}
      {shouldShowSuspensionAlert && !suspensionDismissed && accountStatus?.suspensionMessage && (
        <div className="bg-white border-b border-gray-200 px-4 py-2">
          <SuspensionAlert
            suspensionMessage={accountStatus.suspensionMessage}
            onDismiss={() => setSuspensionDismissed(true)}
            isBusinessAdmin={isBusinessAdmin}
          />
        </div>
      )}

      {/* Main Content */}
      <div className={shouldShowSuspensionAlert && !suspensionDismissed ? 'pt-0' : ''}>
        {children}
      </div>

      {/* Upsell Modal */}
      {isBusinessAdmin && (
        <UpsellModal
          isOpen={showUpsellModal}
          onClose={() => setShowUpsellModal(false)}
          opportunities={opportunities}
          currentUsage={hasUserLimitOpportunity ? {
            users: opportunities.find(o => o.type === 'USER_LIMIT_REACHED')?.currentUsage || 0,
            limit: opportunities.find(o => o.type === 'USER_LIMIT_REACHED')?.limitReached || 0
          } : undefined}
        />
      )}
    </div>
  );
}