import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';

interface SuspensionMessage {
  type: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
  canUseApp: boolean;
  showPaymentUpdate?: boolean;
}

interface AccountStatus {
  suspensionMessage?: SuspensionMessage;
  paymentStatus: string;
  canUseApp: boolean;
}

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

interface UpsellOpportunitiesResponse {
  opportunities: UpsellOpportunity[];
  accountStatus: AccountStatus;
}

export function useAccountStatus() {
  const { user } = useAuth();
  
  const queryKey = ['account-status'];
  
  const { data: accountStatus, isLoading, error } = useQuery({
    queryKey,
    queryFn: async (): Promise<AccountStatus> => {
      const response = await fetch('/api/account/status', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener estado de cuenta');
      }
      
      return response.json();
    },
    enabled: !!user && user.role !== 'SUPER_ADMIN', // Solo para usuarios con business account
    refetchInterval: 5 * 60 * 1000, // Verificar cada 5 minutos
    staleTime: 2 * 60 * 1000, // Considerar stale después de 2 minutos
  });

  return {
    accountStatus,
    isLoading,
    error,
    isBusinessAdmin: user?.role === 'BUSINESS_ADMIN',
    shouldShowSuspensionAlert: accountStatus?.suspensionMessage != null,
    canUseApp: accountStatus?.canUseApp !== false
  };
}

export function useUpsellOpportunities() {
  const { user } = useAuth();
  
  const queryKey = ['upsell-opportunities'];
  
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async (): Promise<UpsellOpportunitiesResponse> => {
      const headers: Record<string, string> = {};
      
      // Add JWT token to Authorization header if available
      const token = localStorage.getItem('auth_token');
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/upsell/opportunities', {
        headers,
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener oportunidades de upselling');
      }
      
      return response.json();
    },
    enabled: !!user && user.role === 'BUSINESS_ADMIN', // Solo para Business Admins
    refetchInterval: 10 * 60 * 1000, // Verificar cada 10 minutos
  });

  const hasUserLimitOpportunity = data?.opportunities.some(o => o.type === 'USER_LIMIT_REACHED');
  const hasHighPriorityOpportunities = data?.opportunities.some(o => o.urgencyLevel === 'high');

  return {
    opportunities: data?.opportunities || [],
    accountStatus: data?.accountStatus,
    isLoading,
    error,
    hasUserLimitOpportunity,
    hasHighPriorityOpportunities,
    shouldShowUpsellModal: hasUserLimitOpportunity || hasHighPriorityOpportunities
  };
}

export function useAutoUpgrade() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/upsell/auto-upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error en auto-upgrade');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['upsell-opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['account-status'] });
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    }
  });
}

export function useManualPurchase() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { productId: string; quantity: number }) => {
      const response = await fetch('/api/upsell/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error en la compra');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['upsell-opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['account-status'] });
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    }
  });
}

export function useBillingInfo() {
  const { user } = useAuth();
  
  const queryKey = ['billing-info'];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      const response = await fetch('/api/billing/info', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener información de facturación');
      }
      
      return response.json();
    },
    enabled: !!user && user.role === 'BUSINESS_ADMIN',
    refetchInterval: 15 * 60 * 1000, // Verificar cada 15 minutos
  });
}

export function usePurchaseHistory() {
  const { user } = useAuth();
  
  const queryKey = ['purchase-history'];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      const response = await fetch('/api/billing/history', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener historial de compras');
      }
      
      return response.json();
    },
    enabled: !!user && user.role === 'BUSINESS_ADMIN',
  });
}