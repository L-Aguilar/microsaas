import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { insertProductSchema, Product, AVAILABLE_MODULES } from "@shared/schema";
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
import { Package, DollarSign, Settings, Users, Building, BarChart, HardDrive } from "lucide-react";
import { z } from "zod";

interface ProductFormProps {
  product?: Product;
  onSuccess?: () => void;
}

export default function ProductForm({ product, onSuccess }: ProductFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(insertProductSchema),
    defaultValues: {
      name: product?.name || '',
      description: product?.description || '',
      type: product?.type || 'USER_ADDON',
      price: product?.price || '0.00',
      billingFrequency: product?.billingFrequency || 'MONTHLY',
      moduleType: product?.moduleType || null,
      isActive: product?.isActive ?? true,
      metadata: product?.metadata || null
    },
  });

  const watchType = form.watch("type");

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertProductSchema>) => {
      const response = await apiRequest("POST", "/api/products", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Producto creado",
        description: "El producto ha sido creado correctamente",
      });
      onSuccess?.();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear el producto",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertProductSchema>) => {
      const response = await apiRequest("PUT", `/api/products/${product!.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Producto actualizado",
        description: "El producto ha sido actualizado correctamente",
      });
      onSuccess?.();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el producto",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: z.infer<typeof insertProductSchema>) => {
    if (product) {
      await updateMutation.mutateAsync(data);
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const getTypeDescription = (type: string) => {
    switch (type) {
      case 'MODULE':
        return 'Acceso completo a un módulo específico del sistema';
      case 'USER_ADDON':
        return 'Usuarios adicionales más allá del límite del plan base';
      case 'FEATURE_ADDON':
        return 'Funciones específicas dentro de un módulo existente';
      case 'STORAGE_ADDON':
        return 'Espacio de almacenamiento adicional';
      default:
        return '';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'MODULE':
        return Package;
      case 'USER_ADDON':
        return Users;
      case 'FEATURE_ADDON':
        return Settings;
      case 'STORAGE_ADDON':
        return HardDrive;
      default:
        return Package;
    }
  };

  const requiresModuleType = ['MODULE', 'FEATURE_ADDON'].includes(watchType);

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
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del Producto</Label>
              <Input
                id="name"
                placeholder="Usuario Adicional, CRM Plus, etc."
                {...form.register("name")}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Tipo de Producto</Label>
              <Select
                value={form.watch("type")}
                onValueChange={(value) => form.setValue("type", value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MODULE">
                    <div className="flex items-center space-x-2">
                      <Package className="h-4 w-4" />
                      <span>Módulo Completo</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="USER_ADDON">
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4" />
                      <span>Usuario Adicional</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="FEATURE_ADDON">
                    <div className="flex items-center space-x-2">
                      <Settings className="h-4 w-4" />
                      <span>Función Adicional</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="STORAGE_ADDON">
                    <div className="flex items-center space-x-2">
                      <HardDrive className="h-4 w-4" />
                      <span>Almacenamiento</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              placeholder="Describe las características y beneficios del producto"
              {...form.register("description")}
            />
          </div>

          {/* Type Description */}
          {watchType && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-1">
                {(() => {
                  const Icon = getTypeIcon(watchType);
                  return <Icon className="h-4 w-4 text-blue-500" />;
                })()}
                <span className="text-sm font-medium text-blue-800">
                  {watchType === 'MODULE' && 'Módulo Completo'}
                  {watchType === 'USER_ADDON' && 'Usuario Adicional'}
                  {watchType === 'FEATURE_ADDON' && 'Función Adicional'}
                  {watchType === 'STORAGE_ADDON' && 'Almacenamiento'}
                </span>
              </div>
              <p className="text-sm text-blue-700">{getTypeDescription(watchType)}</p>
            </div>
          )}

          {/* Module Type Selection (for MODULE and FEATURE_ADDON) */}
          {requiresModuleType && (
            <div className="space-y-2">
              <Label htmlFor="moduleType">Módulo Relacionado</Label>
              <Select
                value={form.watch("moduleType") || ''}
                onValueChange={(value) => form.setValue("moduleType", (value as keyof typeof AVAILABLE_MODULES) || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar módulo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(AVAILABLE_MODULES).map((module) => (
                    <SelectItem key={module.type} value={module.type}>
                      <div className="flex items-center space-x-2">
                        {(() => {
                          switch (module.type) {
                            case 'USERS': return <Users className="h-4 w-4" />;
                            case 'COMPANIES': return <Building className="h-4 w-4" />;
                            case 'CRM': return <BarChart className="h-4 w-4" />;
                            default: return <Package className="h-4 w-4" />;
                          }
                        })()}
                        <span>{module.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5" />
            <span>Precios</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="price">Precio</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              {...form.register("price")}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="billingFrequency">Frecuencia de Cobro</Label>
            <Select
              value={form.watch("billingFrequency")}
              onValueChange={(value) => form.setValue("billingFrequency", value as any)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar frecuencia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MONTHLY">Mensual</SelectItem>
                <SelectItem value="ANNUAL">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Configuración</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="isActive">Producto Activo</Label>
              <p className="text-sm text-muted-foreground">
                Solo los productos activos pueden ser contratados
              </p>
            </div>
            <Switch
              id="isActive"
              checked={form.watch("isActive")}
              onCheckedChange={(checked) => form.setValue("isActive", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Metadata (Optional) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Configuración Avanzada (Opcional)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="metadata">Metadatos JSON</Label>
            <Textarea
              id="metadata"
              placeholder='{"customConfig": "value", "specialFeatures": ["feature1", "feature2"]}'
              {...form.register("metadata")}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Configuración adicional en formato JSON para funcionalidades especiales
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex justify-end space-x-2">
        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
          {product ? 'Actualizar Producto' : 'Crear Producto'}
        </Button>
      </div>
    </form>
  );
}