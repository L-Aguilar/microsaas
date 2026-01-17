import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Module } from "@shared/schema";
import PhoneInput from "@/components/ui/phone-input";
import { cleanPhoneNumber } from "@/lib/phoneUtils";
import { useState, useEffect } from "react";

const businessAccountSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  contactEmail: z.string().email("Debe ser un email válido"),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  plan: z.string().default("BUSINESS_ADMIN"),
  isActive: z.boolean().default(true),
  enabledModules: z.array(z.string()).default([]),
});

type BusinessAccountFormData = z.infer<typeof businessAccountSchema>;

interface BusinessAccountFormProps {
  initialData?: {
    id?: string;
    name: string;
    contactEmail?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    plan?: string;
    isActive?: boolean;
  };
  onSuccess: () => void;
  onCancel: () => void;
}

export default function BusinessAccountForm({ 
  initialData, 
  onSuccess, 
  onCancel 
}: BusinessAccountFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!initialData?.id;
  const [countryCode, setCountryCode] = useState(initialData?.contactPhone?.substring(0, 3) || "+52");
  const [phoneNumber, setPhoneNumber] = useState(initialData?.contactPhone?.substring(3) || "");

  // Get available modules
  const { data: modules = [], isLoading: modulesLoading } = useQuery<Module[]>({
    queryKey: ["/api/modules"],
  });

  // Only use modules that actually exist and are implemented
  const availableModules = modules.filter(module => 
    ['USERS', 'CONTACTS', 'CRM'].includes(module.type)
  );

  // Update phone state when initialData changes
  useEffect(() => {
    if (initialData?.contactPhone) {
      setCountryCode(initialData.contactPhone.substring(0, 3));
      setPhoneNumber(initialData.contactPhone.substring(3));
    }
  }, [initialData]);


  const form = useForm<BusinessAccountFormData>({
    resolver: zodResolver(businessAccountSchema),
    defaultValues: {
      name: initialData?.name || "",
      contactEmail: initialData?.contactEmail || "",
      contactName: initialData?.contactName || "",
      contactPhone: initialData?.contactPhone || "",
      plan: initialData?.plan || "BUSINESS_ADMIN",
      isActive: initialData?.isActive ?? true,
      enabledModules: [], // For new accounts, start with no modules
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: BusinessAccountFormData) => {
      const url = isEditing 
        ? `/api/business-accounts/${initialData.id}`
        : "/api/business-accounts";
      const method = isEditing ? "PUT" : "POST";
      
      const response = await apiRequest(method, url, data);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["/api/business-accounts"] });
      
      toast({
        title: isEditing ? "Cuenta actualizada" : "Cuenta creada",
        description: isEditing 
          ? "La cuenta de negocio ha sido actualizada exitosamente"
          : "La cuenta de negocio ha sido creada exitosamente",
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: isEditing 
          ? "No se pudo actualizar la cuenta de negocio"
          : "No se pudo crear la cuenta de negocio",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BusinessAccountFormData) => {
    // Clean and format the phone number before submitting
    const cleanedPhone = cleanPhoneNumber(phoneNumber ? countryCode + phoneNumber : "");
    const submitData = {
      ...data,
      contactPhone: cleanedPhone
    };
    mutation.mutate(submitData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre de la Organización</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Ej: Empresa ABC S.A." 
                  {...field}
                  data-testid="input-business-account-name"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="contactEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email de Contacto</FormLabel>
              <FormControl>
                <Input 
                  type="email"
                  placeholder="admin@empresa.com" 
                  {...field}
                  data-testid="input-business-account-email"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="contactName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre del Contacto (Opcional)</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Juan Pérez" 
                  {...field}
                  data-testid="input-business-account-contact"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <PhoneInput
          label="Teléfono del Contacto (Opcional)"
          countryCode={countryCode}
          phoneNumber={phoneNumber}
          onCountryCodeChange={setCountryCode}
          onPhoneNumberChange={(fullNumber) => {
            // Extract just the number part (remove country code)
            const numberPart = fullNumber.replace(countryCode, '');
            setPhoneNumber(numberPart);
          }}
          placeholder="123 456 7890"
          testId="input-business-account-phone"
          error={form.formState.errors.contactPhone?.message}
        />

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Cuenta Activa</FormLabel>
                <div className="text-sm text-gray-600">
                  Las cuentas inactivas no pueden acceder a la plataforma
                </div>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="switch-business-account-active"
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Module Selection - Only show implemented modules */}
        {!isEditing && availableModules.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Módulos Habilitados</CardTitle>
              <div className="text-sm text-gray-600">
                Selecciona los módulos que estarán disponibles para esta organización
              </div>
            </CardHeader>
            <CardContent>
              {modulesLoading ? (
                <div className="text-center py-4">
                  <div className="text-sm text-gray-600">Cargando módulos...</div>
                </div>
              ) : (
                <FormField
                  control={form.control}
                  name="enabledModules"
                  render={() => (
                    <FormItem>
                      <div className="grid grid-cols-1 gap-4">
                        {availableModules.map((module) => (
                          <FormField
                            key={module.id}
                            control={form.control}
                            name="enabledModules"
                            render={({ field }) => {
                              const isChecked = field.value?.includes(module.id) || false;
                              return (
                                <FormItem
                                  key={module.id}
                                  className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4"
                                >
                                  <FormControl>
                                    <Switch
                                      checked={isChecked}
                                      onCheckedChange={(checked) => {
                                        const currentValue = field.value || [];
                                        if (checked) {
                                          field.onChange([...currentValue, module.id]);
                                        } else {
                                          field.onChange(
                                            currentValue.filter((value) => value !== module.id)
                                          );
                                        }
                                      }}
                                      data-testid={`switch-module-${module.type}`}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="text-sm font-medium">
                                      {module.name}
                                    </FormLabel>
                                    <p className="text-sm text-gray-600">
                                      {module.description}
                                    </p>
                                  </div>
                                </FormItem>
                              );
                            }}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
            data-testid="button-cancel"
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            disabled={mutation.isPending}
            className="flex-1"
            data-testid="button-submit"
          >
            {mutation.isPending 
              ? (isEditing ? "Actualizando..." : "Creando...") 
              : (isEditing ? "Actualizar" : "Crear Cuenta")
            }
          </Button>
        </div>
      </form>
    </Form>
  );
}