import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Queries
  const { data: plans = [], isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["/api/plans"],
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: planModules = [] } = useQuery({
    queryKey: ["/api/plan-modules"],
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
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el plan",
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
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el producto",
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
      header: "Precio",
      accessor: (plan) => plan.price,
      render: (value, plan) => (
        <div className="flex items-center space-x-1">
          <DollarSign className="h-4 w-4 text-green-500" />
          <span className="font-medium">${plan.price}</span>
          <span className="text-sm text-muted-foreground">/{plan.billingFrequency.toLowerCase()}</span>
        </div>
      ),
    },
    {
      key: "trialDays",
      header: "Días de Prueba",
      accessor: (plan) => plan.trialDays,
      render: (value, plan) => (
        <Badge variant={plan.trialDays > 0 ? "secondary" : "outline"}>
          {plan.trialDays} días
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Estado",
      accessor: (plan) => plan.status,
      render: (value, plan) => (
        <Badge variant={plan.status === 'ACTIVE' ? "default" : "secondary"}>
          {plan.status === 'ACTIVE' ? (
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
        plan.isDefault ? (
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
      key: "createdAt",
      header: "Fecha de Creación",
      accessor: (plan) => plan.createdAt,
      render: (value, plan) => formatSafeDate(plan.createdAt),
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
      header: "Precio",
      accessor: (product) => product.price,
      render: (value, product) => (
        <div className="flex items-center space-x-1">
          <DollarSign className="h-4 w-4 text-green-500" />
          <span className="font-medium">${product.price}</span>
          <span className="text-sm text-muted-foreground">/{product.billingFrequency.toLowerCase()}</span>
        </div>
      ),
    },
    {
      key: "moduleType",
      header: "Módulo",
      accessor: (product) => product.moduleType,
      render: (value, product) => {
        if (!product.moduleType) return <span className="text-muted-foreground">-</span>;
        const moduleName = AVAILABLE_MODULES[product.moduleType as keyof typeof AVAILABLE_MODULES]?.name;
        return (
          <Badge variant="outline">
            {moduleName || product.moduleType}
          </Badge>
        );
      },
    },
    {
      key: "isActive",
      header: "Estado",
      accessor: (product) => product.isActive,
      render: (value, product) => (
        <Badge variant={product.isActive ? "default" : "secondary"}>
          {product.isActive ? (
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
      key: "createdAt", 
      header: "Fecha de Creación",
      accessor: (product) => product.createdAt,
      render: (value, product) => formatSafeDate(product.createdAt),
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
                onEdit={(plan) => {
                  setSelectedPlan(plan);
                  setShowEditPlanModal(true);
                }}
                onDelete={(plan) => {
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
                onEdit={(product) => {
                  setSelectedProduct(product);
                  setShowEditProductModal(true);
                }}
                onDelete={(product) => {
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
    </div>
  );
}