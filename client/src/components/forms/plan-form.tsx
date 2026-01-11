import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { insertPlanSchema, Plan, AVAILABLE_MODULES } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Package, DollarSign, Calendar, Settings, Users, Building, BarChart } from "lucide-react";
import { z } from "zod";
import { useState, useEffect } from "react";

const formSchema = insertPlanSchema.extend({
  modules: z.array(z.object({
    moduleType: z.string(),
    isIncluded: z.boolean(),
    itemLimit: z.number().nullable(),
    canCreate: z.boolean(),
    canEdit: z.boolean(),
    canDelete: z.boolean(),
    features: z.array(z.string()).optional()
  })).optional()
});

interface PlanFormProps {
  plan?: Plan;
  onSuccess?: () => void;
}

export default function PlanForm({ plan, onSuccess }: PlanFormProps) {
  const [moduleConfig, setModuleConfig] = useState<Record<string, {
    isIncluded: boolean;
    itemLimit: number | null;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  }>>({});

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: plan?.name || '',
      description: plan?.description || '',
      price: plan?.price || '0.00',
      monthlyPrice: (plan as any)?.monthlyPrice || plan?.price || '0.00',
      annualPrice: (plan as any)?.annualPrice || '',
      billingFrequency: plan?.billingFrequency || 'MONTHLY',
      trialDays: plan?.trialDays || 14,
      status: plan?.status || 'ACTIVE',
      isDefault: plan?.isDefault || false,
      isActive: (plan as any)?.isActive ?? true,
      displayOrder: plan?.displayOrder || 0,
      features: plan?.features || []
    },
  });

  // Initialize module config
  useEffect(() => {
    const initialConfig: typeof moduleConfig = {};
    
    Object.values(AVAILABLE_MODULES).forEach(module => {
      initialConfig[module.type] = {
        isIncluded: false,
        itemLimit: module.defaultLimit,
        canCreate: true,
        canEdit: true,
        canDelete: true
      };
    });

    setModuleConfig(initialConfig);
  }, []);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      // Create plan first
      const planResponse = await apiRequest("POST", "/api/plans", {
        name: data.name,
        description: data.description,
        price: data.monthlyPrice, // Keep legacy field for compatibility
        monthlyPrice: data.monthlyPrice,
        annualPrice: data.annualPrice,
        billingFrequency: 'MONTHLY', // Legacy field
        trialDays: data.trialDays,
        status: data.status,
        isDefault: data.isDefault,
        isActive: data.isActive,
        displayOrder: data.displayOrder,
        features: data.features
      });

      const planData = await planResponse.json();

      // Create plan modules
      const modulePromises = Object.entries(moduleConfig)
        .filter(([_, config]) => config.isIncluded)
        .map(async ([moduleType, config]) => {
          await apiRequest("POST", "/api/plan-modules", {
            planId: planData.id,
            moduleType,
            isIncluded: config.isIncluded,
            itemLimit: config.itemLimit,
            canCreate: config.canCreate,
            canEdit: config.canEdit,
            canDelete: config.canDelete
          });
        });

      await Promise.all(modulePromises);

      return planData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      toast({
        title: "Plan creado",
        description: "El plan ha sido creado correctamente",
      });
      onSuccess?.();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear el plan",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PUT", `/api/plans/${plan!.id}`, {
        name: data.name,
        description: data.description,
        price: data.monthlyPrice, // Keep legacy field for compatibility
        monthlyPrice: data.monthlyPrice,
        annualPrice: data.annualPrice,
        billingFrequency: 'MONTHLY', // Legacy field
        trialDays: data.trialDays,
        status: data.status,
        isDefault: data.isDefault,
        isActive: data.isActive,
        displayOrder: data.displayOrder,
        features: data.features
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      toast({
        title: "Plan actualizado",
        description: "El plan ha sido actualizado correctamente",
      });
      onSuccess?.();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el plan",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (plan) {
      await updateMutation.mutateAsync(data);
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const getModuleIcon = (moduleType: string) => {
    const icons: Record<string, any> = {
      USERS: Users,
      COMPANIES: Building,
      CRM: Package,
      BILLING: DollarSign,
      INVENTORY: Package,
      HR: Users,
      ANALYTICS: BarChart,
      REPORTS: BarChart,
      AUTOMATION: Settings
    };
    return icons[moduleType] || Package;
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Package className="h-5 w-5" />
            <span>Información Básica</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del Plan</Label>
            <Input
              id="name"
              placeholder="Plan Básico, Plan Pro, etc."
              {...form.register("name")}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayOrder">Orden de Visualización</Label>
            <Input
              id="displayOrder"
              type="number"
              {...form.register("displayOrder", { valueAsNumber: true })}
            />
          </div>

          <div className="space-y-2 col-span-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              placeholder="Describe las características principales del plan"
              {...form.register("description")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Pricing & Billing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5" />
            <span>Precios y Facturación</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Dual Pricing */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="monthlyPrice">Precio Mensual</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="monthlyPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  className="pl-10"
                  {...form.register("monthlyPrice")}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="annualPrice">Precio Anual</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="annualPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  className="pl-10"
                  {...form.register("annualPrice")}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Discount Calculation */}
          {form.watch("monthlyPrice") && form.watch("annualPrice") && (
            <div className="pt-3 border-t border-gray-200">
              <div className="text-sm text-gray-600 space-y-1">
                <div>
                  <strong>Comparación anual:</strong>
                </div>
                <div className="ml-2 space-y-1">
                  <div>• Pagando mensual: ${(parseFloat(form.watch("monthlyPrice") || "0") * 12).toFixed(2)}/año</div>
                  <div>• Pagando anual: ${parseFloat(form.watch("annualPrice") || "0").toFixed(2)}/año</div>
                  <div>• <strong>Ahorro: ${Math.max(0, (parseFloat(form.watch("monthlyPrice") || "0") * 12) - parseFloat(form.watch("annualPrice") || "0")).toFixed(2)} ({Math.max(0, ((parseFloat(form.watch("monthlyPrice") || "0") * 12) - parseFloat(form.watch("annualPrice") || "0")) / (parseFloat(form.watch("monthlyPrice") || "0") * 12) * 100).toFixed(1)}%)</strong></div>
                </div>
              </div>
            </div>
          )}

          {/* Trial Days */}
          <div className="space-y-2">
            <Label htmlFor="trialDays">Días de Prueba</Label>
            <div className="relative max-w-xs">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="trialDays"
                type="number"
                min="0"
                max="365"
                className="pl-10"
                {...form.register("trialDays", { valueAsNumber: true })}
                placeholder="14"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Días sin cargo antes de que inicie la facturación (0 = sin periodo de prueba)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Status & Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Estado y Configuración</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="isActive">Plan Activo</Label>
              <p className="text-sm text-muted-foreground">
                Solo los planes activos están disponibles para suscripción
              </p>
            </div>
            <Switch
              id="isActive"
              checked={form.watch("isActive")}
              onCheckedChange={(checked) => form.setValue("isActive", checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="isDefault">Plan por Defecto</Label>
              <p className="text-sm text-muted-foreground">
                Se asigna automáticamente a nuevas empresas
              </p>
            </div>
            <Switch
              id="isDefault"
              checked={form.watch("isDefault")}
              onCheckedChange={(checked) => form.setValue("isDefault", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Module Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Package className="h-5 w-5" />
            <span>Módulos Incluidos</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.values(AVAILABLE_MODULES).map((module) => {
              const Icon = getModuleIcon(module.type);
              const config = moduleConfig[module.type];
              
              if (!config) return null;

              return (
                <Card key={module.type} className={`transition-colors ${config.isIncluded ? 'border-blue-200 bg-blue-50' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <Icon className="h-5 w-5 text-blue-500" />
                        <div>
                          <h4 className="font-medium">{module.name}</h4>
                          <p className="text-sm text-muted-foreground">{module.description}</p>
                        </div>
                      </div>
                      <Switch
                        checked={config.isIncluded}
                        onCheckedChange={(checked) => {
                          setModuleConfig(prev => ({
                            ...prev,
                            [module.type]: { ...prev[module.type], isIncluded: checked }
                          }));
                        }}
                      />
                    </div>

                    {config.isIncluded && (
                      <div className="space-y-3 pt-3 border-t">
                        {module.hasLimits && (
                          <div className="space-y-2">
                            <Label className="text-xs">Límite de elementos</Label>
                            <Input
                              type="number"
                              placeholder="Ilimitado"
                              value={config.itemLimit || ''}
                              onChange={(e) => {
                                const value = e.target.value ? parseInt(e.target.value) : null;
                                setModuleConfig(prev => ({
                                  ...prev,
                                  [module.type]: { ...prev[module.type], itemLimit: value }
                                }));
                              }}
                            />
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label className="text-xs">Permisos</Label>
                          <div className="flex flex-wrap gap-2">
                            <div className="flex items-center space-x-1">
                              <Switch
                                checked={config.canCreate}
                                onCheckedChange={(checked) => {
                                  setModuleConfig(prev => ({
                                    ...prev,
                                    [module.type]: { ...prev[module.type], canCreate: checked }
                                  }));
                                }}
                              />
                              <span className="text-xs">Crear</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Switch
                                checked={config.canEdit}
                                onCheckedChange={(checked) => {
                                  setModuleConfig(prev => ({
                                    ...prev,
                                    [module.type]: { ...prev[module.type], canEdit: checked }
                                  }));
                                }}
                              />
                              <span className="text-xs">Editar</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Switch
                                checked={config.canDelete}
                                onCheckedChange={(checked) => {
                                  setModuleConfig(prev => ({
                                    ...prev,
                                    [module.type]: { ...prev[module.type], canDelete: checked }
                                  }));
                                }}
                              />
                              <span className="text-xs">Eliminar</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex justify-end space-x-2">
        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
          {plan ? 'Actualizar Plan' : 'Crear Plan'}
        </Button>
      </div>
    </form>
  );
}