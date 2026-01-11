import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Package, 
  DollarSign, 
  Calendar, 
  Users, 
  Building, 
  TrendingUp, 
  TrendingDown,
  Settings,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  Minus
} from "lucide-react";
import { Plan, Product, BusinessAccountPlan, AVAILABLE_MODULES } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { PlanAlertService, usePlanErrorHandler } from "@/lib/planAlerts";
import { formatSafeDate } from "@/lib/custom-dates";

interface SubscriptionData {
  currentPlan: BusinessAccountPlan & { plan: Plan };
  additionalProducts: Array<{
    id: string;
    product: Product;
    quantity: number;
    totalAmount: string;
  }>;
  usage: Record<string, { current: number; limit: number | null }>;
}

export default function SubscriptionManagement() {
  const [activeTab, setActiveTab] = useState("overview");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { handlePlanError } = usePlanErrorHandler();

  // Queries
  const { data: subscriptionData, isLoading } = useQuery<SubscriptionData>({
    queryKey: ["/api/subscription"],
    enabled: !!user?.businessAccountId,
  });

  const { data: availablePlans = [] } = useQuery<Plan[]>({
    queryKey: ["/api/plans/available"],
  });

  const { data: availableProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products/available"],
  });

  // Mutations
  const changePlanMutation = useMutation({
    mutationFn: async ({ planId }: { planId: string }) => {
      const response = await apiRequest("POST", "/api/subscription/change-plan", { planId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      PlanAlertService.showPlanChangeSuccess("plan actualizado");
    },
    onError: async (error) => {
      const handled = await handlePlanError(error);
      if (!handled) {
        toast({
          title: "Error",
          description: "No se pudo cambiar el plan",
          variant: "destructive",
        });
      }
    },
  });

  const addProductMutation = useMutation({
    mutationFn: async ({ productId, quantity = 1 }: { productId: string; quantity?: number }) => {
      const response = await apiRequest("POST", "/api/subscription/add-product", { 
        productId, 
        quantity 
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      toast({
        title: "Producto agregado",
        description: "El producto ha sido agregado a tu suscripción",
      });
    },
    onError: async (error) => {
      const handled = await handlePlanError(error);
      if (!handled) {
        toast({
          title: "Error",
          description: "No se pudo agregar el producto",
          variant: "destructive",
        });
      }
    },
  });

  const removeProductMutation = useMutation({
    mutationFn: async ({ productId }: { productId: string }) => {
      const response = await apiRequest("DELETE", `/api/subscription/products/${productId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      toast({
        title: "Producto eliminado",
        description: "El producto ha sido eliminado de tu suscripción",
      });
    },
    onError: async (error) => {
      const handled = await handlePlanError(error);
      if (!handled) {
        toast({
          title: "Error",
          description: "No se pudo eliminar el producto",
          variant: "destructive",
        });
      }
    },
  });

  const handlePlanChange = async (newPlan: Plan) => {
    if (!subscriptionData) return;

    const currentPlan = subscriptionData.currentPlan.plan;
    const priceChange = parseFloat(newPlan.price) - parseFloat(currentPlan.price);
    
    const action = priceChange >= 0 ? 'upgrade' : 'downgrade';
    
    // Check if downgrade is allowed (if user has more items than new limit allows)
    if (action === 'downgrade') {
      const hasViolations = await checkDowngradeViolations(newPlan);
      if (hasViolations) {
        return; // The check function will show the appropriate alert
      }
    }

    const confirmed = await PlanAlertService.showPlanChangeConfirmation(
      action,
      currentPlan.name,
      newPlan.name,
      priceChange
    );

    if (confirmed) {
      PlanAlertService.showPlanChangeLoading();
      try {
        await changePlanMutation.mutateAsync({ planId: newPlan.id });
      } finally {
        PlanAlertService.close();
      }
    }
  };

  const checkDowngradeViolations = async (newPlan: Plan): Promise<boolean> => {
    // This would typically fetch plan modules for the new plan
    // and compare with current usage
    // For now, simplified logic
    const usage = subscriptionData?.usage || {};
    
    for (const [moduleType, usageData] of Object.entries(usage)) {
      const moduleInfo = AVAILABLE_MODULES[moduleType as keyof typeof AVAILABLE_MODULES];
      if (moduleInfo?.hasLimits && moduleInfo.defaultLimit && usageData.current > moduleInfo.defaultLimit) {
        const itemType = moduleType === 'USERS' ? 'usuarios' : 
                        moduleType === 'COMPANIES' ? 'empresas' : 'elementos';
        
        const canRedirect = await PlanAlertService.showCannotReduceAlert(
          itemType as 'usuarios' | 'empresas' | 'productos',
          usageData.current,
          moduleInfo.defaultLimit
        );
        
        if (canRedirect) {
          // Redirect to manage that specific module
          const routes = {
            'USERS': '/users',
            'COMPANIES': '/companies'
          };
          const route = routes[moduleType as keyof typeof routes];
          if (route) window.location.href = route;
        }
        
        return true; // Has violations
      }
    }
    
    return false; // No violations
  };

  const getUsagePercentage = (current: number, limit: number | null): number => {
    if (limit === null) return 0; // Unlimited
    return Math.min((current / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number): string => {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 70) return "bg-yellow-500";
    return "bg-green-500";
  };

  if (isLoading || !subscriptionData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const { currentPlan, additionalProducts, usage } = subscriptionData;
  const totalMonthlyCost = parseFloat(currentPlan.plan.price) + 
    additionalProducts.reduce((sum, p) => sum + parseFloat(p.totalAmount), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mi Suscripción</h1>
          <p className="text-muted-foreground">
            Gestiona tu plan y productos adicionales
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="plans">Cambiar Plan</TabsTrigger>
          <TabsTrigger value="products">Productos Adicionales</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Current Plan Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Package className="h-5 w-5" />
                <span>Plan Actual: {currentPlan.plan.name}</span>
                <Badge variant={currentPlan.status === 'ACTIVE' ? 'default' : 'secondary'}>
                  {currentPlan.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-3">
                  <DollarSign className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Costo Mensual</p>
                    <p className="text-2xl font-bold">${totalMonthlyCost.toFixed(2)}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Calendar className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Próxima Facturación</p>
                    <p className="font-medium">
                      {formatSafeDate(currentPlan.subscriptionEndDate)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Settings className="h-8 w-8 text-purple-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Productos Adicionales</p>
                    <p className="text-2xl font-bold">{additionalProducts.length}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Usage Summary */}
              <div>
                <h4 className="font-medium mb-3">Uso de Recursos</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(usage).map(([moduleType, usageData]) => {
                    const moduleInfo = AVAILABLE_MODULES[moduleType as keyof typeof AVAILABLE_MODULES];
                    if (!moduleInfo) return null;

                    const percentage = getUsagePercentage(usageData.current, usageData.limit);
                    const isUnlimited = usageData.limit === null;

                    return (
                      <Card key={moduleType} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            {moduleType === 'USERS' && <Users className="h-4 w-4" />}
                            {moduleType === 'COMPANIES' && <Building className="h-4 w-4" />}
                            <span className="text-sm font-medium">{moduleInfo.name}</span>
                          </div>
                          <Badge variant={percentage >= 90 ? 'destructive' : percentage >= 70 ? 'secondary' : 'default'}>
                            {usageData.current}/{isUnlimited ? '∞' : usageData.limit}
                          </Badge>
                        </div>
                        {!isUnlimited && (
                          <Progress 
                            value={percentage} 
                            className={`h-2 ${getUsageColor(percentage)}`}
                          />
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availablePlans.map((plan) => {
              const isCurrent = plan.id === currentPlan.plan.id;
              const priceChange = parseFloat(plan.price) - parseFloat(currentPlan.plan.price);
              const isUpgrade = priceChange > 0;
              const isDowngrade = priceChange < 0;

              return (
                <Card key={plan.id} className={`relative ${isCurrent ? 'border-blue-500 bg-blue-50' : ''}`}>
                  {isCurrent && (
                    <div className="absolute top-4 right-4">
                      <Badge variant="default">Actual</Badge>
                    </div>
                  )}
                  
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Package className="h-5 w-5" />
                      <span>{plan.name}</span>
                    </CardTitle>
                    <div className="text-3xl font-bold">
                      ${plan.price}
                      <span className="text-sm text-muted-foreground">/{plan.billingFrequency.toLowerCase()}</span>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                    
                    {plan.trialDays > 0 && (
                      <div className="flex items-center space-x-2 text-sm text-blue-600">
                        <Calendar className="h-4 w-4" />
                        <span>{plan.trialDays} días de prueba</span>
                      </div>
                    )}

                    {!isCurrent && (
                      <div className="space-y-2">
                        {priceChange !== 0 && (
                          <div className={`flex items-center space-x-2 text-sm ${isUpgrade ? 'text-green-600' : 'text-orange-600'}`}>
                            {isUpgrade ? (
                              <TrendingUp className="h-4 w-4" />
                            ) : (
                              <TrendingDown className="h-4 w-4" />
                            )}
                            <span>
                              {isUpgrade ? '+' : ''}${Math.abs(priceChange).toFixed(2)}/mes
                            </span>
                          </div>
                        )}

                        <Button
                          onClick={() => handlePlanChange(plan)}
                          disabled={changePlanMutation.isPending}
                          className="w-full"
                          variant={isUpgrade ? "default" : "outline"}
                        >
                          {isUpgrade ? (
                            <>
                              <TrendingUp className="h-4 w-4 mr-2" />
                              Actualizar
                            </>
                          ) : isDowngrade ? (
                            <>
                              <TrendingDown className="h-4 w-4 mr-2" />
                              Reducir
                            </>
                          ) : (
                            'Cambiar Plan'
                          )}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="products" className="space-y-6">
          {/* Current Additional Products */}
          {additionalProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Productos Contratados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {additionalProducts.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Package className="h-5 w-5 text-blue-500" />
                        <div>
                          <h4 className="font-medium">{item.product.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {item.product.description}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <p className="font-medium">${item.totalAmount}</p>
                          <p className="text-sm text-muted-foreground">
                            Cantidad: {item.quantity}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeProductMutation.mutate({ productId: item.product.id })}
                          disabled={removeProductMutation.isPending}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Available Products */}
          <Card>
            <CardHeader>
              <CardTitle>Productos Disponibles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableProducts
                  .filter(product => !additionalProducts.some(item => item.product.id === product.id))
                  .map((product) => (
                    <Card key={product.id} className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{product.name}</h4>
                          <Badge variant="outline">
                            {product.type === 'USER_ADDON' && 'Usuario Extra'}
                            {product.type === 'MODULE' && 'Módulo'}
                            {product.type === 'FEATURE_ADDON' && 'Función'}
                            {product.type === 'STORAGE_ADDON' && 'Almacenamiento'}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-muted-foreground">
                          {product.description}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <div className="text-lg font-bold">
                            ${product.price}
                            <span className="text-sm text-muted-foreground">/{product.billingFrequency.toLowerCase()}</span>
                          </div>
                          
                          <Button
                            onClick={() => addProductMutation.mutate({ productId: product.id })}
                            disabled={addProductMutation.isPending}
                            size="sm"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Agregar
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}