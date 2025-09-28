import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertUserSchema, User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import PhoneInput from "@/components/ui/phone-input";
import { cleanPhoneNumber } from "@/lib/phoneUtils";
import { z } from "zod";

const userFormSchema = insertUserSchema.extend({
  role: z.enum(['SUPER_ADMIN', 'BUSINESS_PLAN', 'USER']).default('USER'),
}).omit({ password: true });

type UserFormData = z.infer<typeof userFormSchema>;

interface UserFormProps {
  user?: User | null;
  onClose: () => void;
}

export default function UserForm({ user, onClose, businessAccountId, onSuccess }: UserFormProps & { businessAccountId?: string; onSuccess?: () => void }) {
  const [countryCode, setCountryCode] = useState(user?.phone?.substring(0, 3) || "+52");
  const [phoneNumber, setPhoneNumber] = useState(user?.phone?.substring(3) || "");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser, updateUser } = useAuth();

  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      role: user?.role || 'USER',
      businessAccountId: user?.businessAccountId || businessAccountId || currentUser?.businessAccountId,
    },
  });

  // Update form values when user data changes
  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        role: user.role,
        businessAccountId: user.businessAccountId,
      });
      
      // Update phone state
      if (user.phone) {
        setCountryCode(user.phone.substring(0, 3));
        setPhoneNumber(user.phone.substring(3));
      }
    }
  }, [user, form]);

  const createUserMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      // Add secure password for API compatibility - server will generate strong password
      const userWithPassword = {
        ...data,
        password: "", // Password will be auto-generated on server side
      };
      const endpoint = businessAccountId && currentUser?.role === 'SUPER_ADMIN' 
        ? `/api/business-accounts/${businessAccountId}/users`
        : "/api/users";
      const response = await apiRequest("POST", endpoint, userWithPassword);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      if (businessAccountId) {
        queryClient.invalidateQueries({ queryKey: ["/api/business-accounts", businessAccountId, "users"] });
      }
      toast({
        title: "Usuario creado exitosamente",
        description: `Se ha creado el usuario ${data.name}`,
      });
      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error al crear usuario",
        description: error.message || "Ocurrió un error inesperado",
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const response = await apiRequest("PUT", `/api/users/${user!.id}`, data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      if (businessAccountId) {
        queryClient.invalidateQueries({ queryKey: ["/api/business-accounts", businessAccountId, "users"] });
      }
      
      // Si el usuario editado es el usuario actual, actualizar el estado de autenticación
      if (currentUser && user && user.id === currentUser.id) {
        // Actualizar el usuario en el contexto de autenticación
        const updatedCurrentUser = { ...currentUser, ...data };
        updateUser(updatedCurrentUser);
        // Invalidar cualquier query relacionada con el usuario actual
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      }
      
      toast({
        title: "Usuario actualizado exitosamente",
        description: `Se ha actualizado el usuario ${data.name}`,
      });
      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar usuario",
        description: error.message || "Ocurrió un error inesperado",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UserFormData) => {
    // Clean and format the phone number before submitting
    const cleanedPhone = cleanPhoneNumber(phoneNumber ? countryCode + phoneNumber : "");
    const submitData = {
      ...data,
      phone: cleanedPhone
    };
    
    if (user) {
      // Editing existing user
      updateUserMutation.mutate(submitData);
    } else {
      // Creating new user
      createUserMutation.mutate(submitData);
    }
  };

  // Determine available roles based on current user
  const getAvailableRoles = () => {
    if (currentUser?.role === 'SUPER_ADMIN') {
      return [
        { value: 'BUSINESS_PLAN', label: 'Admin Empresa' },
        { value: 'USER', label: 'Usuario' },
      ];
    } else if (currentUser?.role === 'BUSINESS_PLAN') {
      return [
        { value: 'BUSINESS_PLAN', label: 'Admin Empresa' },
        { value: 'USER', label: 'Usuario' },
      ];
    } else {
      return [
        { value: 'USER', label: 'Usuario' },
      ];
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre completo</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Juan Pérez"
                  data-testid="input-user-name"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input 
                  type="email"
                  placeholder="juan@empresa.com"
                  data-testid="input-user-email"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <PhoneInput
          label="Teléfono"
          countryCode={countryCode}
          phoneNumber={phoneNumber}
          onCountryCodeChange={setCountryCode}
          onPhoneNumberChange={(fullNumber) => {
            // Extract just the number part (remove country code)
            const numberPart = fullNumber.replace(countryCode, '');
            setPhoneNumber(numberPart);
          }}
          placeholder="123 456 7890"
          testId="input-user-phone"
          error={form.formState.errors.phone?.message}
        />

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rol</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-user-role">
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {getAvailableRoles().map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />


        <div className="flex justify-end space-x-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            data-testid="button-cancel-user"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="bg-brand-500 hover:bg-brand-600 text-white"
            disabled={createUserMutation.isPending || updateUserMutation.isPending}
            data-testid="button-save-user"
          >
            {user ? (
              updateUserMutation.isPending ? "Actualizando..." : "Actualizar Usuario"
            ) : (
              createUserMutation.isPending ? "Creando..." : "Crear Usuario"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}