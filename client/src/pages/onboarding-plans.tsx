import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Check, Crown, Building, Zap, ArrowRight, LogOut } from "lucide-react";
import { useLocation } from "wouter";
import { getCurrentThemeConfig, type Plan } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

export default function OnboardingPlans() {
  const themeConfig = getCurrentThemeConfig();
  const [_, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const { logout } = useAuth();

  // Fetch available plans from API
  useEffect(() => {
    async function fetchPlans() {
      try {
        const response = await fetch("/api/onboarding/plans");
        
        if (response.ok) {
          const plansData = await response.json();
          setPlans(plansData);
        } else {
          console.error("Failed to fetch plans:", response.statusText);
        }
      } catch (error) {
        console.error("Error fetching plans:", error);
      } finally {
        setLoadingPlans(false);
      }
    }

    fetchPlans();
  }, []);

  const getPrice = (plan: Plan) => {
    // Use the plan's price directly (assuming it's monthly)
    // Convert string to number for calculations
    return parseFloat(plan.price.toString()) || 0;
  };

  // Helper function to get plan icon
  const getPlanIcon = (planName: string) => {
    if (planName.toLowerCase().includes('basic') || planName.toLowerCase().includes('básico')) {
      return Building;
    } else if (planName.toLowerCase().includes('professional') || planName.toLowerCase().includes('profesional')) {
      return Zap;
    } else if (planName.toLowerCase().includes('enterprise') || planName.toLowerCase().includes('empresarial')) {
      return Crown;
    }
    return Building; // Default
  };

  // Helper function to check if plan is popular (middle plan or has specific indicator)
  const isPlanPopular = (plan: Plan, index: number, totalPlans: number) => {
    // Mark middle plan as popular if there are 3 plans
    return totalPlans === 3 && index === 1;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPlan) {
      alert("Por favor selecciona un plan");
      return;
    }

    setLoading(true);
    
    try {
      // Get business account ID from localStorage or auth context
      const user = JSON.parse(localStorage.getItem('crm_auth_user') || '{}');
      const businessAccountId = user.businessAccountId;
      
      if (!businessAccountId) {
        throw new Error("No se encontró la información de la empresa");
      }

      const selectedPlanData = plans.find(p => p.id === selectedPlan);
      if (!selectedPlanData) {
        throw new Error("Plan seleccionado no encontrado");
      }

      const response = await fetch("/api/onboarding/plan", {
        method: "POST", 
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessAccountId,
          planId: selectedPlanData.id,
          planName: selectedPlanData.name,
          billingCycle: billingCycle,
          pricePerMonth: getPrice(selectedPlanData),
          features: selectedPlanData.features || [],
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al seleccionar el plan");
      }

      // Complete onboarding
      const completeResponse = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json", 
        },
        body: JSON.stringify({ businessAccountId }),
      });

      const completeResult = await completeResponse.json();

      if (!completeResponse.ok) {
        throw new Error(completeResult.error || "Error al completar el onboarding");
      }

      console.log("✅ Onboarding completed successfully");
      setLocation("/");
    } catch (error) {
      console.error("Error selecting plan:", error);
      alert("Error al seleccionar el plan: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setShowLogoutDialog(true);
  };

  const confirmLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen w-full bg-gray-50">
      {/* Progress Steps - Top */}
      <div className="w-full bg-gradient-to-r from-brand-500 to-brand-700 py-8">
        <div className="max-w-2xl mx-auto px-8">
          <div className="text-white text-center mb-6">
            <h2 className="text-2xl font-bold mb-2">{themeConfig.name}</h2>
            <p className="text-white/90">¡Ya casi terminamos!</p>
          </div>
          
          <div className="flex justify-center space-x-8">
            {/* Step 1 - Completed */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Check className="h-5 w-5 text-white" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-white">Perfil de empresa</h3>
                <p className="text-white/80 text-sm">Información completada</p>
              </div>
            </div>
            
            {/* Step 2 - Active */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-brand-600 font-bold">2</span>
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-white">Seleccionar plan</h3>
                <p className="text-white/80 text-sm">Elige el plan que mejor se adapte</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Centered */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        {/* Logout Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="absolute top-4 right-4 text-gray-500 hover:text-red-500"
        >
          <LogOut className="h-4 w-4" />
          <span className="ml-1">Salir</span>
        </Button>
        
        <div className="w-full max-w-4xl">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-brand-500 rounded-full flex items-center justify-center">
                <Crown className="h-8 w-8 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-2">Elige tu plan</h1>
            <p className="text-gray-600">
              Selecciona el plan que mejor se adapte a las necesidades de tu empresa
            </p>
          </div>

          {/* Billing Toggle - Only show if plans support different billing cycles */}
          {plans.some(plan => plan.billingFrequency === 'BOTH' || plan.billingFrequency === 'ANNUAL') && (
            <div className="flex justify-center mb-8">
              <RadioGroup
                value={billingCycle}
                onValueChange={setBillingCycle}
                className="flex bg-gray-100 rounded-lg p-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="monthly" id="monthly" className="sr-only" />
                  <Label
                    htmlFor="monthly"
                    className={`px-4 py-2 rounded-md cursor-pointer transition-colors ${
                      billingCycle === "monthly"
                        ? "bg-white shadow text-brand-600 font-medium"
                        : "text-gray-600"
                    }`}
                  >
                    Mensual
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="annual" id="annual" className="sr-only" />
                  <Label
                    htmlFor="annual"
                    className={`px-4 py-2 rounded-md cursor-pointer transition-colors ${
                      billingCycle === "annual"
                        ? "bg-white shadow text-brand-600 font-medium"
                        : "text-gray-600"
                    }`}
                  >
                    Anual
                    <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700">
                      Ahorra hasta 20%
                    </Badge>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Plans */}
          {loadingPlans ? (
            <div className="flex justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Cargando planes...</p>
              </div>
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No hay planes disponibles en este momento.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <RadioGroup value={selectedPlan} onValueChange={setSelectedPlan}>
                <div className={`grid gap-6 mb-8 ${
                  plans.length === 1 ? "grid-cols-1 max-w-md mx-auto" :
                  plans.length === 2 ? "grid-cols-1 md:grid-cols-2" :
                  "grid-cols-1 md:grid-cols-3"
                }`}>
                  {plans.map((plan, index) => {
                    const Icon = getPlanIcon(plan.name);
                    const price = getPrice(plan);
                    const isPopular = isPlanPopular(plan, index, plans.length);
                    
                    return (
                      <div key={plan.id} className="relative">
                        {isPopular && (
                          <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-brand-500">
                            Más popular
                          </Badge>
                        )}
                        <Card
                          className={`cursor-pointer transition-all hover:shadow-lg ${
                            selectedPlan === plan.id
                              ? "ring-2 ring-brand-500 shadow-lg"
                              : ""
                          }`}
                        >
                          <CardHeader className="text-center">
                            <RadioGroupItem
                              value={plan.id}
                              id={plan.id}
                              className="sr-only"
                            />
                            <Label
                              htmlFor={plan.id}
                              className="cursor-pointer w-full block"
                            >
                              <div className="flex justify-center mb-4">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                  isPopular ? "bg-brand-500" : "bg-gray-200"
                                }`}>
                                  <Icon className={`h-6 w-6 ${
                                    isPopular ? "text-white" : "text-gray-600"
                                  }`} />
                                </div>
                              </div>
                              <CardTitle className="text-xl font-bold">
                                {plan.name}
                              </CardTitle>
                              <CardDescription className="text-sm">
                                {plan.description || "Plan diseñado para tu empresa"}
                              </CardDescription>
                              <div className="mt-4">
                                <span className="text-3xl font-bold">
                                  ${price.toFixed(2)}
                                </span>
                                <span className="text-gray-600 text-sm">
                                  /{plan.billingFrequency === 'ANNUAL' ? 'año' : 'mes'}
                                </span>
                              </div>
                            </Label>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-2">
                              {plan.features && plan.features.length > 0 ? (
                                plan.features.map((feature, index) => (
                                  <li key={index} className="flex items-center space-x-2">
                                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                                    <span className="text-sm">{feature}</span>
                                  </li>
                                ))
                              ) : (
                                <li className="flex items-center space-x-2">
                                  <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                                  <span className="text-sm">Acceso completo al sistema</span>
                                </li>
                              )}
                            </ul>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </RadioGroup>

              <div className="flex justify-center">
                <Button
                  type="submit"
                  disabled={loading || !selectedPlan}
                  size="lg"
                  className="px-8"
                >
                  {loading ? (
                    "Procesando..."
                  ) : (
                    <>
                      Completar configuración
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
      
      {/* Logout Confirmation Dialog */}
      <ConfirmationDialog
        open={showLogoutDialog}
        onOpenChange={setShowLogoutDialog}
        title="Cerrar sesión"
        description="¿Estás seguro de que quieres cerrar sesión? Se perderá el progreso actual del onboarding y tendrás que empezar de nuevo."
        onConfirm={confirmLogout}
        confirmText="Sí, cerrar sesión"
        cancelText="Cancelar"
        variant="destructive"
      />
    </div>
  );
}