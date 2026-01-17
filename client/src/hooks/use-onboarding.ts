import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { apiRequest } from "@/lib/queryClient";

export interface OnboardingStatus {
  onboarding_completed: boolean;
  profile_completed: boolean;
  plan_selected: boolean;
  needs_profile: boolean;
  needs_plan: boolean;
  needs_onboarding: boolean;
}

export function useOnboarding() {
  const { user } = useAuth();
  
  console.log("🔧 useOnboarding hook called with user:", user?.name, user?.businessAccountId);

  const { data: onboardingStatus, isLoading, error } = useQuery({
    queryKey: ["onboarding", "status", user?.businessAccountId],
    queryFn: async (): Promise<OnboardingStatus | null> => {
      if (!user?.businessAccountId) {
        console.log("❌ No business_account_id found for user:", user);
        return null;
      }
      
      console.log("🔍 Fetching onboarding status for:", user.businessAccountId);
      
      const response = await apiRequest("GET", `/api/onboarding/status/${user.businessAccountId}`);
      console.log("📡 Onboarding status response:", response.status);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log("⚠️ Onboarding status not found (404)");
          return null;
        }
        const errorText = await response.text();
        console.error("❌ Failed to fetch onboarding status:", response.status, errorText);
        throw new Error("Failed to fetch onboarding status");
      }
      
      const data = await response.json();
      console.log("✅ Onboarding status data:", data);
      return data;
    },
    enabled: !!user?.businessAccountId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });

  if (error) {
    console.error("🚨 Onboarding hook error:", error);
  }

  return {
    onboardingStatus,
    isLoading,
    needsOnboarding: onboardingStatus?.needs_onboarding ?? false,
    needsProfile: onboardingStatus?.needs_profile ?? false,
    needsPlan: onboardingStatus?.needs_plan ?? false,
    isOnboardingComplete: onboardingStatus?.onboarding_completed ?? false,
  };
}