import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/contexts/sidebar-context";
import { Button } from "@/components/ui/button";
import { useAuth } from "./hooks/use-auth";
import { useOnboarding } from "./hooks/use-onboarding";
import { CURRENT_THEME } from "@shared/schema";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Companies from "@/pages/companies";
import CompanyDetail from "@/pages/company-detail";
import Opportunities from "@/pages/opportunities";
import OpportunityDetail from "@/pages/opportunity-detail";
import Reports from "@/pages/reports";
import Users from "@/pages/users";
import UserProfile from "@/pages/user-profile";
import Modules from "@/pages/modules";
import BusinessAccounts from "@/pages/business-accounts";
import BusinessAccountDetail from "@/pages/business-account-detail";
import AccountSettings from "@/pages/account";
import PasswordRecovery from "@/pages/password-recovery";
import RemindersDashboard from "@/pages/reminders";
import PlanManagement from "@/pages/plan-management";
import EmailSent from "@/pages/email-sent";
import VerificationSuccess from "@/pages/verification-success";
import OnboardingProfile from "@/pages/onboarding-profile";
import OnboardingPlans from "@/pages/onboarding-plans";
import MainLayout from "@/components/layout/main-layout";

function ProtectedRoute({ children, requiredRole, onNewOpportunity, onNewCompany, skipOnboarding = false }: { 
  children: React.ReactNode; 
  requiredRole?: string; 
  onNewOpportunity?: () => void; 
  onNewCompany?: () => void;
  skipOnboarding?: boolean;
}) {
  const { user, isLoading } = useAuth();
  const { onboardingStatus, isLoading: onboardingLoading, needsProfile, needsPlan } = useOnboarding();

  if (isLoading || onboardingLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // Check role-based access
  if (requiredRole && user.role !== requiredRole) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Acceso Denegado</h2>
          <p className="text-gray-600 mb-4">No tienes permisos para acceder a esta página.</p>
          <Button onClick={() => window.history.back()}>Volver</Button>
        </div>
      </div>
    );
  }

  // Check onboarding status (skip for certain routes)
  if (!skipOnboarding && user.role !== 'SUPER_ADMIN') {
    console.log("🔄 Checking onboarding for user:", user.name, user.role);
    console.log("👤 Full user object:", user);
    console.log("🔑 User businessAccountId:", user.businessAccountId);
    console.log("📊 Onboarding status:", { onboardingStatus, needsProfile, needsPlan, onboardingLoading });
    
    if (onboardingStatus) {
      const currentPath = window.location.pathname;
      console.log("📍 Current path:", currentPath);
      
      // Don't redirect if already on onboarding pages
      if (!currentPath.startsWith('/onboarding/')) {
        if (needsProfile) {
          console.log("🚀 Redirecting to profile setup...");
          window.location.href = '/onboarding/profile';
          return null;
        }
        
        if (needsPlan) {
          console.log("🚀 Redirecting to plan selection...");
          window.location.href = '/onboarding/plans';
          return null;
        }
        
        console.log("✅ Onboarding complete, proceeding to dashboard");
      } else {
        console.log("📝 Already on onboarding page");
      }
    } else {
      console.log("⚠️ No onboarding status available");
    }
  } else {
    console.log("⏭️ Skipping onboarding check:", { skipOnboarding, role: user.role });
  }

  return <MainLayout onNewOpportunity={onNewOpportunity} onNewCompany={onNewCompany}>{children}</MainLayout>;
}

function DashboardRoute() {
  const [showNewOpportunityModal, setShowNewOpportunityModal] = useState(false);
  const [showNewCompanyModal, setShowNewCompanyModal] = useState(false);

  return (
    <ProtectedRoute 
      onNewOpportunity={() => setShowNewOpportunityModal(true)}
      onNewCompany={() => setShowNewCompanyModal(true)}
    >
      <Dashboard 
        showNewOpportunityModal={showNewOpportunityModal}
        setShowNewOpportunityModal={setShowNewOpportunityModal}
        showNewCompanyModal={showNewCompanyModal}
        setShowNewCompanyModal={setShowNewCompanyModal}
      />
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/password-recovery" component={PasswordRecovery} />
      <Route path="/email-sent" component={EmailSent} />
      <Route path="/verification-success" component={VerificationSuccess} />
      <Route path="/onboarding/profile" component={OnboardingProfile} />
      <Route path="/onboarding/plans" component={OnboardingPlans} />
      <Route path="/">
        <DashboardRoute />
      </Route>
      <Route path="/companies">
        <ProtectedRoute>
          <Companies />
        </ProtectedRoute>
      </Route>
      <Route path="/companies/:id">
        {() => (
          <ProtectedRoute>
            <CompanyDetail />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/opportunities">
        <ProtectedRoute>
          <Opportunities />
        </ProtectedRoute>
      </Route>
      <Route path="/opportunities/:id">
        {(params) => (
          <ProtectedRoute>
            <OpportunityDetail opportunityId={params.id} />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/users">
        <ProtectedRoute>
          <Users />
        </ProtectedRoute>
      </Route>
      <Route path="/users/profile/:userId">
        {(params) => (
          <ProtectedRoute>
            <UserProfile />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/business-accounts">
        <ProtectedRoute requiredRole="SUPER_ADMIN">
          <BusinessAccounts />
        </ProtectedRoute>
      </Route>
      <Route path="/business-accounts/:id">
        {() => (
          <ProtectedRoute requiredRole="SUPER_ADMIN">
            <BusinessAccountDetail />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/reports">
        <ProtectedRoute>
          <Reports />
        </ProtectedRoute>
      </Route>
      <Route path="/modules">
        <ProtectedRoute requiredRole="SUPER_ADMIN">
          <Modules />
        </ProtectedRoute>
      </Route>
      <Route path="/account">
        <ProtectedRoute>
          <AccountSettings />
        </ProtectedRoute>
      </Route>
      <Route path="/reminders">
        <ProtectedRoute requiredRole="SUPER_ADMIN">
          <RemindersDashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/plan-management">
        <ProtectedRoute requiredRole="SUPER_ADMIN">
          <PlanManagement />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    // No theme classes needed - using default CSS variables
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider>
          <Toaster />
          <Router />
        </SidebarProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
