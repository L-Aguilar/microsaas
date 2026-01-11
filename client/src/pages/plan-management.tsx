import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Plus, Edit, Trash2, Settings, Package, DollarSign, Users, Building, Check, X } from "lucide-react";
import { Plan, Product, AVAILABLE_MODULES } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DataTable, Column } from "@/components/ui/data-table";
import PlanForm from "@/components/forms/plan-form";
import ProductForm from "@/components/forms/product-form";
import { formatSafeDate } from "@/lib/custom-dates";

export default function PlanManagement() {
  const [activeTab, setActiveTab] = useState("plans");
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [showEditPlanModal, setShowEditPlanModal] = useState(false);
  const [showCreateProductModal, setShowCreateProductModal] = useState(false);
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: 'plan' | 'product' } | null>(null);
  const [showPriceEditModal, setShowPriceEditModal] = useState(false);
  const [selectedProductForPriceEdit, setSelectedProductForPriceEdit] = useState<Product | null>(null);
  const [showPlanPriceEditModal, setShowPlanPriceEditModal] = useState(false);
  const [selectedPlanForPriceEdit, setSelectedPlanForPriceEdit] = useState<Plan | null>(null);
  const [monthlyPrice, setMonthlyPrice] = useState<string>('');
  const [annualPrice, setAnnualPrice] = useState<string>('');
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Queries
  const { data: plans = [], isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["/api/plans"],
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });



  // Mutations
  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      await apiRequest("DELETE", `/api/plans/${planId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      toast({
        title: "Plan eliminado",
        description: "El plan ha sido eliminado correctamente",
      });
    },
    onError: (error: any) => {
      const isValidationError = error.message?.includes("está siendo usado por");
      toast({
        title: "Error",
        description: isValidationError 
          ? error.message 
          : "No se pudo eliminar el plan",
        variant: "destructive",
      });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      await apiRequest("DELETE", `/api/products/${productId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Producto eliminado",
        description: "El producto ha sido eliminado correctamente",
      });
    },
    onError: (error: any) => {
      const isValidationError = error.message?.includes("está siendo usado por");
      toast({
        title: "Error",
        description: isValidationError 
          ? error.message 
          : "No se pudo eliminar el producto",
        variant: "destructive",
      });
    },
  });

  const updateProductPricesMutation = useMutation({
    mutationFn: async ({ productId, priceData, applyToExisting }: { 
      productId: string, 
      priceData: { monthlyPrice: string, annualPrice: string }, 
      applyToExisting: boolean 
    }) => {
      const response = await apiRequest("PUT", `/api/products/${productId}/prices`, {
        ...priceData,
        applyToExistingCustomers: applyToExisting
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Precios actualizados",
        description: "Los precios del producto han sido actualizados correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudieron actualizar los precios del producto",
        variant: "destructive",
      });
    },
  });

  const updatePlanPricesMutation = useMutation({
    mutationFn: async ({ planId, priceData, applyToExisting }: { 
      planId: string, 
      priceData: { monthlyPrice: string, annualPrice: string }, 
      applyToExisting: boolean 
    }) => {
      const response = await apiRequest("PUT", `/api/plans/${planId}/prices`, {
        ...priceData,
        applyToExistingCustomers: applyToExisting
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      toast({
        title: "Precios actualizados",
        description: "Los precios del plan han sido actualizados correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudieron actualizar los precios del plan",
        variant: "destructive",
      });
    },
  });

  const handleDelete = async () => {
    if (!itemToDelete) return;
    
    if (itemToDelete.type === 'plan') {
      await deletePlanMutation.mutateAsync(itemToDelete.id);
    } else {
      await deleteProductMutation.mutateAsync(itemToDelete.id);
    }
    
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const handleEditPrice = (product: Product) => {
    setSelectedProductForPriceEdit(product);
    // Use los nuevos campos de precio dual o fallback al precio legacy
    setMonthlyPrice((product as any).monthlyPrice || product.price || '0.00');
    setAnnualPrice((product as any).annualPrice || 
      (product.price ? (parseFloat(product.price) * 10).toFixed(2) : '0.00'));
    setShowPriceEditModal(true);
  };

  const handleSavePrices = async () => {
    if (!selectedProductForPriceEdit) return;
    
    // Directamente actualizar para nuevos clientes solamente
    await updateProductPricesMutation.mutateAsync({
      productId: selectedProductForPriceEdit.id,
      priceData: { 
        monthlyPrice, 
        annualPrice 
      },
      applyToExisting: false
    });

    setShowPriceEditModal(false);
    setSelectedProductForPriceEdit(null);
    setMonthlyPrice('');
    setAnnualPrice('');
  };

  const handleApplyToAllClients = async () => {
    if (!selectedProductForPriceEdit) return;

    await updateProductPricesMutation.mutateAsync({
      productId: selectedProductForPriceEdit.id,
      priceData: { 
        monthlyPrice, 
        annualPrice 
      },
      applyToExisting: true
    });

    setShowPriceEditModal(false);
    setSelectedProductForPriceEdit(null);
    setMonthlyPrice('');
    setAnnualPrice('');
  };

  const handleCancelEditPrice = () => {
    setShowPriceEditModal(false);
    setSelectedProductForPriceEdit(null);
    setMonthlyPrice('');
    setAnnualPrice('');
  };

  const handleEditPlanPrice = (plan: Plan) => {
    setSelectedPlanForPriceEdit(plan);
    // Use los nuevos campos de precio dual o fallback al precio legacy
    setMonthlyPrice((plan as any).monthlyPrice || plan.price || '0.00');
    setAnnualPrice((plan as any).annualPrice || 
      (plan.price ? (parseFloat(plan.price) * 10).toFixed(2) : '0.00'));
    setShowPlanPriceEditModal(true);
  };

  const handleSavePlanPrices = async () => {
    if (!selectedPlanForPriceEdit) return;
    
    // Directamente actualizar para nuevos clientes solamente
    await updatePlanPricesMutation.mutateAsync({
      planId: selectedPlanForPriceEdit.id,
      priceData: { 
        monthlyPrice, 
        annualPrice 
      },
      applyToExisting: false
    });

    setShowPlanPriceEditModal(false);
    setSelectedPlanForPriceEdit(null);
    setMonthlyPrice('');
    setAnnualPrice('');
  };

  const handleApplyPlanPricesToAllClients = async () => {
    if (!selectedPlanForPriceEdit) return;

    await updatePlanPricesMutation.mutateAsync({
      planId: selectedPlanForPriceEdit.id,
      priceData: { 
        monthlyPrice, 
        annualPrice 
      },
      applyToExisting: true
    });

    setShowPlanPriceEditModal(false);
    setSelectedPlanForPriceEdit(null);
    setMonthlyPrice('');
    setAnnualPrice('');
  };

  const handleCancelEditPlanPrice = () => {
    setShowPlanPriceEditModal(false);
    setSelectedPlanForPriceEdit(null);
    setMonthlyPrice('');
    setAnnualPrice('');
  };

  // Plan columns
  const planColumns: Column<Plan>[] = [
    {
      key: "name",
      header: "Nombre del Plan",
      accessor: (plan) => plan.name,
      render: (value, plan) => (
        <div className="flex items-center space-x-2">
          <Package className="h-4 w-4 text-blue-500" />
          <div>
            <div className="font-medium">{plan.name}</div>
            <div className="text-sm text-muted-foreground">{plan.description}</div>
          </div>
        </div>
      ),
    },
    {
      key: "price",
      header: "Precios",
      accessor: (plan) => plan.price,
      render: (value, plan) => (
        <div className="flex items-center space-x-2">
          <div className="space-y-1">
            <div className="flex items-center space-x-1">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="font-medium">${(plan as any).monthlyPrice || plan.price || '0.00'}</span>
              <span className="text-xs text-muted-foreground">mensual</span>
            </div>
            <div className="flex items-center space-x-1">
              <DollarSign className="h-4 w-4 text-blue-500" />
              <span className="font-medium">
                ${(plan as any).annualPrice || 
                  (plan.price ? (parseFloat(plan.price) * 10).toFixed(2) : '0.00')}
              </span>
              <span className="text-xs text-muted-foreground">anual</span>
            </div>
          </div>
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => handleEditPlanPrice(plan)}
            className="h-8 w-8 p-0"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
    {
      key: "trialDays",
      header: "Días de Prueba",
      accessor: (plan) => plan.trialDays,
      render: (value, plan) => (
        <Badge variant={(plan.trialDays || 0) > 0 ? "secondary" : "outline"}>
          {plan.trialDays || 0} días
        </Badge>
      ),
    },
    {
      key: "isActive",
      header: "Estado",
      accessor: (plan) => (plan as any).isActive,
      render: (value, plan) => (
        <Badge variant={((plan as any).isActive ?? false) ? "default" : "secondary"}>
          {((plan as any).isActive ?? false) ? (
            <>
              <Check className="h-3 w-3 mr-1" />
              Activo
            </>
          ) : (
            <>
              <X className="h-3 w-3 mr-1" />
              Inactivo
            </>
          )}
        </Badge>
      ),
    },
    {
      key: "isDefault",
      header: "Plan Por Defecto",
      accessor: (plan) => plan.isDefault,
      render: (value, plan) => (
        (plan.isDefault ?? false) ? (
          <Badge variant="default">
            <Settings className="h-3 w-3 mr-1" />
            Por Defecto
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        )
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      accessor: () => "",
      render: (value, plan) => (
        <div className="flex items-center space-x-2">
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => {
              setSelectedPlan(plan);
              setShowEditPlanModal(true);
            }}
            className="h-8 w-8 p-0"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => {
              setItemToDelete({ id: plan.id, type: 'plan' });
              setDeleteDialogOpen(true);
            }}
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  // Product columns
  const productColumns: Column<Product>[] = [
    {
      key: "name",
      header: "Nombre del Producto",
      accessor: (product) => product.name,
      render: (value, product) => (
        <div className="flex items-center space-x-2">
          <Package className="h-4 w-4 text-purple-500" />
          <div>
            <div className="font-medium">{product.name}</div>
            <div className="text-sm text-muted-foreground">{product.description}</div>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Tipo",
      accessor: (product) => product.type,
      render: (value, product) => {
        const typeColors = {
          MODULE: "blue",
          USER_ADDON: "green", 
          FEATURE_ADDON: "orange",
          STORAGE_ADDON: "purple"
        };
        const typeLabels = {
          MODULE: "Módulo",
          USER_ADDON: "Usuario Adicional",
          FEATURE_ADDON: "Función Adicional", 
          STORAGE_ADDON: "Almacenamiento"
        };
        return (
          <Badge variant="outline" className={`border-${typeColors[product.type]}-200`}>
            {typeLabels[product.type]}
          </Badge>
        );
      },
    },
    {
      key: "price",
      header: "Precios",
      accessor: (product) => product.price,
      render: (value, product) => (
        <div className="flex items-center space-x-2">
          <div className="space-y-1">
            <div className="flex items-center space-x-1">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="font-medium">
                ${(product as any).monthlyPrice || product.price || '0.00'}
              </span>
              <span className="text-xs text-muted-foreground">mensual</span>
            </div>
            <div className="flex items-center space-x-1">
              <DollarSign className="h-4 w-4 text-blue-500" />
              <span className="font-medium">
                ${(product as any).annualPrice || 
                  (product.price ? (parseFloat(product.price) * 10).toFixed(2) : '0.00')}
              </span>
              <span className="text-xs text-muted-foreground">anual</span>
            </div>
          </div>
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => handleEditPrice(product)}
            className="h-8 w-8 p-0"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
    {
      key: "isActive",
      header: "Estado",
      accessor: (product) => product.isActive,
      render: (value, product) => (
        <Badge variant={(product.isActive ?? false) ? "default" : "secondary"}>
          {(product.isActive ?? false) ? (
            <>
              <Check className="h-3 w-3 mr-1" />
              Activo
            </>
          ) : (
            <>
              <X className="h-3 w-3 mr-1" />
              Inactivo
            </>
          )}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Planes SaaS</h1>
          <p className="text-muted-foreground">
            Administra planes de suscripción y productos adicionales
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="plans" className="flex items-center space-x-2">
            <Package className="h-4 w-4" />
            <span>Planes de Suscripción</span>
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span>Productos Independientes</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <Package className="h-5 w-5" />
                    <span>Planes de Suscripción</span>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Gestiona los planes principales con módulos incluidos y límites
                  </p>
                </div>
                <Button onClick={() => setShowCreatePlanModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Plan
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={planColumns}
                data={plans}
                loading={plansLoading}
                onEdit={(plan: Plan) => {
                  setSelectedPlan(plan);
                  setShowEditPlanModal(true);
                }}
                onDelete={(plan: Plan) => {
                  setItemToDelete({ id: plan.id, type: 'plan' });
                  setDeleteDialogOpen(true);
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <Settings className="h-5 w-5" />
                    <span>Productos Independientes</span>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Gestiona productos adicionales: usuarios extra, funciones, almacenamiento
                  </p>
                </div>
                <Button onClick={() => setShowCreateProductModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Producto
                </Button>
              </div>
            </CardHeader>
            <CardContent>

              <DataTable
                columns={productColumns}
                data={products}
                loading={productsLoading}
                onEdit={(product: Product) => {
                  setSelectedProduct(product);
                  setShowEditProductModal(true);
                }}
                onDelete={(product: Product) => {
                  setItemToDelete({ id: product.id, type: 'product' });
                  setDeleteDialogOpen(true);
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Plan Modals */}
      <Dialog open={showCreatePlanModal} onOpenChange={setShowCreatePlanModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Plan</DialogTitle>
            <DialogDescription>
              Define un nuevo plan de suscripción con módulos y límites
            </DialogDescription>
          </DialogHeader>
          <PlanForm 
            onSuccess={() => {
              setShowCreatePlanModal(false);
              queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showEditPlanModal} onOpenChange={setShowEditPlanModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Editar Plan</DialogTitle>
            <DialogDescription>
              Modifica los detalles y configuración del plan
            </DialogDescription>
          </DialogHeader>
          {selectedPlan && (
            <PlanForm 
              plan={selectedPlan}
              onSuccess={() => {
                setShowEditPlanModal(false);
                setSelectedPlan(null);
                queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Product Modals */}
      <Dialog open={showCreateProductModal} onOpenChange={setShowCreateProductModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Producto</DialogTitle>
            <DialogDescription>
              Define un producto adicional independiente
            </DialogDescription>
          </DialogHeader>
          <ProductForm 
            onSuccess={() => {
              setShowCreateProductModal(false);
              queryClient.invalidateQueries({ queryKey: ["/api/products"] });
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showEditProductModal} onOpenChange={setShowEditProductModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
            <DialogDescription>
              Modifica los detalles del producto
            </DialogDescription>
          </DialogHeader>
          {selectedProduct && (
            <ProductForm 
              product={selectedProduct}
              onSuccess={() => {
                setShowEditProductModal(false);
                setSelectedProduct(null);
                queryClient.invalidateQueries({ queryKey: ["/api/products"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title={`Eliminar ${itemToDelete?.type === 'plan' ? 'Plan' : 'Producto'}`}
        description={`¿Estás seguro de que deseas eliminar este ${itemToDelete?.type === 'plan' ? 'plan' : 'producto'}? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />

      {/* Price Edit Modal */}
      <Dialog open={showPriceEditModal} onOpenChange={setShowPriceEditModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Precios del Producto</DialogTitle>
            <DialogDescription>
              Configura los precios mensual y anual para este producto
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="space-y-4">
              <h4 className="font-medium text-sm">
                {selectedProductForPriceEdit?.name}
              </h4>
              
              {/* Precio Mensual */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Precio Mensual
                </label>
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={monthlyPrice}
                    onChange={(e) => setMonthlyPrice(e.target.value)}
                    placeholder="0.00"
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground">/ mes</span>
                </div>
              </div>
              
              {/* Precio Anual */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Precio Anual
                </label>
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-blue-500" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={annualPrice}
                    onChange={(e) => setAnnualPrice(e.target.value)}
                    placeholder="0.00"
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground">/ año</span>
                </div>
              </div>
              
              {/* Descuento Calculado */}
              <div className="pt-3 border-t border-gray-200">
                {monthlyPrice && annualPrice ? (() => {
                  const monthly = parseFloat(monthlyPrice);
                  const annual = parseFloat(annualPrice);
                  const yearlyIfMonthly = monthly * 12;
                  const savings = yearlyIfMonthly - annual;
                  const discountPercent = (savings / yearlyIfMonthly * 100);
                  const monthlyEquivalent = annual / 12;
                  
                  return (
                    <>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>
                          <strong>Precio anual vs 12 meses:</strong>
                        </div>
                        <div className="ml-2 space-y-1">
                          <div>• Pagando mensual: ${yearlyIfMonthly.toFixed(2)}/año</div>
                          <div>• Pagando anual: ${annual.toFixed(2)}/año</div>
                          <div>• <strong>Ahorro: ${savings.toFixed(2)} ({discountPercent.toFixed(1)}%)</strong></div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-gray-100">
                        Precio mensual equivalente del plan anual: ${monthlyEquivalent.toFixed(2)}/mes
                      </div>
                    </>
                  );
                })() : (
                  <div className="text-sm text-muted-foreground">
                    Ingresa ambos precios para ver el cálculo de descuento
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex flex-col space-y-3">
              <Button onClick={handleSavePrices} className="w-full">
                Guardar Precios (Solo Nuevos Clientes)
              </Button>
              <Button 
                variant="outline" 
                onClick={handleApplyToAllClients}
                className="w-full"
              >
                Aplicar a Todos los Clientes (Nuevos + Existentes)
              </Button>
              <Button variant="ghost" onClick={handleCancelEditPrice} className="w-full">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Plan Price Edit Modal */}
      <Dialog open={showPlanPriceEditModal} onOpenChange={setShowPlanPriceEditModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Precios del Plan</DialogTitle>
            <DialogDescription>
              Configura los precios mensual y anual para este plan
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="space-y-4">
              <h4 className="font-medium text-sm">
                {selectedPlanForPriceEdit?.name}
              </h4>
              
              {/* Precio Mensual */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Precio Mensual
                </label>
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={monthlyPrice}
                    onChange={(e) => setMonthlyPrice(e.target.value)}
                    placeholder="0.00"
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground">/ mes</span>
                </div>
              </div>
              
              {/* Precio Anual */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Precio Anual
                </label>
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-blue-500" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={annualPrice}
                    onChange={(e) => setAnnualPrice(e.target.value)}
                    placeholder="0.00"
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground">/ año</span>
                </div>
              </div>
              
              {/* Descuento Calculado */}
              <div className="pt-3 border-t border-gray-200">
                {monthlyPrice && annualPrice ? (() => {
                  const monthly = parseFloat(monthlyPrice);
                  const annual = parseFloat(annualPrice);
                  const yearlyIfMonthly = monthly * 12;
                  const savings = yearlyIfMonthly - annual;
                  const discountPercent = (savings / yearlyIfMonthly * 100);
                  const monthlyEquivalent = annual / 12;
                  
                  return (
                    <>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>
                          <strong>Precio anual vs 12 meses:</strong>
                        </div>
                        <div className="ml-2 space-y-1">
                          <div>• Pagando mensual: ${yearlyIfMonthly.toFixed(2)}/año</div>
                          <div>• Pagando anual: ${annual.toFixed(2)}/año</div>
                          <div>• <strong>Ahorro: ${savings.toFixed(2)} ({discountPercent.toFixed(1)}%)</strong></div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-gray-100">
                        Precio mensual equivalente del plan anual: ${monthlyEquivalent.toFixed(2)}/mes
                      </div>
                    </>
                  );
                })() : (
                  <div className="text-sm text-muted-foreground">
                    Ingresa ambos precios para ver el cálculo de descuento
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex flex-col space-y-3">
              <Button onClick={handleSavePlanPrices} className="w-full">
                Guardar Precios (Solo Nuevos Clientes)
              </Button>
              <Button 
                variant="outline" 
                onClick={handleApplyPlanPricesToAllClients}
                className="w-full"
              >
                Aplicar a Todos los Clientes (Nuevos + Existentes)
              </Button>
              <Button variant="ghost" onClick={handleCancelEditPlanPrice} className="w-full">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}