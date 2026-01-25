import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, Building, Activity, Shield, AlertCircle, Zap, CheckCircle } from "lucide-react";
import { insertUserSchema, User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import PhoneInput from "@/components/ui/phone-input";
import { cleanPhoneNumber } from "@/lib/phoneUtils";
import { z } from "zod";
import { UserLimitsIndicator } from "@/components/ui/UserLimitsIndicator";
import { UpsellModal } from "@/components/modals/UpsellModal";
import { useUpsellOpportunities, useAutoUpgrade } from "@/hooks/use-account-status";

const userFormSchema = insertUserSchema.extend({
  role: z.literal('USER').default('USER'),
}).omit({ password: true });

type UserFormData = z.infer<typeof userFormSchema>;

const MODULES = [
  { 
    key: 'USERS', 
    name: 'Usuarios', 
    description: 'Gestión de usuarios de la empresa',
    icon: Users,
    color: 'bg-blue-500'
  },
  { 
    key: 'CONTACTS', 
    name: 'Contactos', 
    description: 'Gestión de contactos y clientes',
    icon: Building,
    color: 'bg-green-500'
  },
  { 
    key: 'CRM', 
    name: 'CRM', 
    description: 'Oportunidades y actividades',
    icon: Activity,
    color: 'bg-purple-500'
  }
];

const PERMISSION_TYPES = [
  { key: 'canView', label: 'Ver', description: 'Puede ver y consultar información' },
  { key: 'canCreate', label: 'Crear', description: 'Puede crear nuevos registros' },
  { key: 'canEdit', label: 'Editar', description: 'Puede modificar registros existentes' },
  { key: 'canDelete', label: 'Eliminar', description: 'Puede eliminar registros' }
];

interface UserFormProps {
  user?: User | null;
  onClose?: () => void;
  onCancel?: () => void;
}

export default function UserForm({ user, onClose, onCancel, businessAccountId, onSuccess }: UserFormProps & { businessAccountId?: string; onSuccess?: () => void }) {
  const [countryCode, setCountryCode] = useState(user?.phone?.substring(0, 3) || "+52");
  const [phoneNumber, setPhoneNumber] = useState(user?.phone?.substring(3) || "");
  const [userPermissions, setUserPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser, updateUser } = useAuth();
  
  // User limits and upselling functionality
  const { opportunities, hasUserLimitOpportunity } = useUpsellOpportunities();
  const autoUpgradeMutation = useAutoUpgrade();
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [userLimitReached, setUserLimitReached] = useState(false);
  const [currentUserStats, setCurrentUserStats] = useState({ current: 0, limit: 0, active: 0 });

  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      role: 'USER', // Always USER for new users created by BUSINESS_ADMIN
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
        role: 'USER', // Force USER role for existing users too
        businessAccountId: user.businessAccountId,
      });
      
      // Update phone state
      if (user.phone) {
        setCountryCode(user.phone.substring(0, 3));
        setPhoneNumber(user.phone.substring(3));
      }
    }
  }, [user, form]);

  // Initialize permissions when user changes or form loads
  useEffect(() => {
    if (user?.id) {
      // Load existing permissions for editing
      const loadUserPermissions = async () => {
        try {
          const response = await apiRequest("GET", `/api/users/${user.id}/permissions`);
          const userPerms = await response.json();
          setUserPermissions(userPerms);
        } catch (error) {
          console.error("Error loading user permissions:", error);
        }
      };
      loadUserPermissions();
    } else {
      // Initialize with default permissions for new user
      const initialPerms: Record<string, Record<string, boolean>> = {};
      MODULES.forEach(module => {
        initialPerms[module.key] = {
          canView: true,
          canCreate: false,
          canEdit: false,
          canDelete: false
        };
      });
      setUserPermissions(initialPerms);
    }
  }, [user?.id]);

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
      const createdUser = await response.json();
      
      // Set permissions after user creation
      if (createdUser.id && Object.keys(userPermissions).length > 0) {
        try {
          await apiRequest("PUT", `/api/users/${createdUser.id}/permissions`, {
            permissions: userPermissions
          });
        } catch (permError) {
          console.error("Error setting permissions:", permError);
          toast({
            title: "Usuario creado con advertencia",
            description: "Usuario creado pero no se pudieron establecer los permisos",
            variant: "destructive",
          });
        }
      }
      
      return createdUser;
    },
    onSuccess: async (data) => {
      // Esperar a que las queries se invaliden y refetchen antes de cerrar el modal
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/users"], refetchType: "all" }),
        businessAccountId ? queryClient.invalidateQueries({ queryKey: ["/api/business-accounts", businessAccountId, "users"], refetchType: "all" }) : Promise.resolve(),
      ]);
      
      toast({
        title: "Usuario creado exitosamente",
        description: `Se ha creado el usuario ${data.name}`,
      });
      if (onSuccess) {
        onSuccess();
      } else if (onClose) {
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
      const updatedUser = await response.json();
      
      // Update permissions if they exist
      if (Object.keys(userPermissions).length > 0) {
        try {
          await apiRequest("PUT", `/api/users/${user!.id}/permissions`, {
            permissions: userPermissions
          });
        } catch (permError) {
          console.error("Error updating permissions:", permError);
          toast({
            title: "Usuario actualizado con advertencia",
            description: "Usuario actualizado pero no se pudieron actualizar los permisos",
            variant: "destructive",
          });
        }
      }
      
      return updatedUser;
    },
    onSuccess: async (data) => {
      // Esperar a que las queries se invaliden y refetchen antes de cerrar el modal
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/users"], refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: ["/api/users", user!.id, "permissions"], refetchType: "all" }),
        businessAccountId ? queryClient.invalidateQueries({ queryKey: ["/api/business-accounts", businessAccountId, "users"], refetchType: "all" }) : Promise.resolve(),
      ]);
      
      // Si el usuario editado es el usuario actual, actualizar el estado de autenticación
      if (currentUser && user && user.id === currentUser.id) {
        // Actualizar el usuario en el contexto de autenticación
        const updatedCurrentUser = { ...currentUser, ...data };
        updateUser(updatedCurrentUser);
        // Invalidar cualquier query relacionada con el usuario actual
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"], refetchType: "all" });
      }
      
      toast({
        title: "Usuario actualizado exitosamente",
        description: `Se ha actualizado el usuario ${data.name}`,
      });
      if (onSuccess) {
        onSuccess();
      } else if (onClose) {
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

  const onSubmit = async (data: UserFormData) => {
    // Clean and format the phone number before submitting
    const cleanedPhone = cleanPhoneNumber(phoneNumber ? countryCode + phoneNumber : "");
    const submitData = {
      ...data,
      phone: cleanedPhone,
      permissions: userPermissions
    };
    
    if (user) {
      // Editing existing user
      updateUserMutation.mutate(submitData);
    } else {
      // Creating new user - check limits first
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        
        // Add JWT token to Authorization header if available
        const token = localStorage.getItem('auth_token');
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        
        const response = await fetch('/api/users-enhanced', {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(submitData)
        });
        
        if (response.status === 403) {
          const error = await response.json();
          if (error.error === 'USER_LIMIT_REACHED') {
            // Show limit reached with auto-upgrade option
            setUserLimitReached(true);
            setCurrentUserStats({
              current: error.currentCount || 0,
              limit: error.limit || 0,
              active: error.currentCount || 0
            });
            
            if (error.autoUpgradeAvailable) {
              setShowUpsellModal(true);
            } else {
              toast({
                title: "Límite de usuarios alcanzado",
                description: error.message || "No puedes agregar más usuarios. Actualiza tu plan.",
                variant: "destructive"
              });
            }
            return;
          }
        }
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Error al crear usuario');
        }
        
        const result = await response.json();
        
        // Invalidate queries and show success
        queryClient.invalidateQueries({ queryKey: ['/api/users'] });
        
        toast({
          title: "Usuario creado exitosamente",
          description: result.message,
        });
        
        if (onSuccess) {
          onSuccess();
        } else if (onClose) {
          onClose();
        }
        
      } catch (error: any) {
        toast({
          title: "Error al crear usuario",
          description: error.message || "Ocurrió un error inesperado",
          variant: "destructive",
        });
      }
    }
  };


  // Handle permission changes
  const handlePermissionChange = (moduleKey: string, permissionKey: string, value: boolean) => {
    setUserPermissions(prev => ({
      ...prev,
      [moduleKey]: {
        ...prev[moduleKey],
        [permissionKey]: value
      }
    }));
  };

  // Set all permissions for a module
  const setAllPermissions = (moduleKey: string, value: boolean) => {
    setUserPermissions(prev => ({
      ...prev,
      [moduleKey]: {
        canView: value,
        canCreate: value,
        canEdit: value,
        canDelete: value
      }
    }));
  };

  // Check if current user can assign permissions
  const canAssignPermissions = currentUser?.role === 'BUSINESS_ADMIN' || currentUser?.role === 'SUPER_ADMIN';

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          
          {/* User Limits Indicator - Only show for new users and Business Admins */}
          {!user && currentUser?.role === 'BUSINESS_ADMIN' && (
            <UserLimitsIndicator
              currentUsers={currentUserStats.current}
              totalLimit={currentUserStats.limit}
              activeUsers={currentUserStats.active}
              className="mb-4"
            />
          )}

          {/* User Limit Alert */}
          {userLimitReached && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>
                  Has alcanzado el límite de usuarios ({currentUserStats.current}/{currentUserStats.limit}). 
                  {hasUserLimitOpportunity ? ' ¡Auto-upgrade disponible!' : ' Actualiza tu plan para continuar.'}
                </span>
                {hasUserLimitOpportunity && (
                  <Button
                    size="sm"
                    onClick={() => {
                      autoUpgradeMutation.mutate();
                      setUserLimitReached(false);
                    }}
                    disabled={autoUpgradeMutation.isPending}
                    className="ml-2"
                  >
                    {autoUpgradeMutation.isPending ? (
                      <>Procesando...</>
                    ) : (
                      <>
                        <Zap className="h-3 w-3 mr-1" />
                        Auto-Upgrade
                      </>
                    )}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
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


        {/* Permissions Section */}
        {canAssignPermissions && (
          <div className="space-y-4">
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <h3 className="text-lg font-medium">Permisos por Módulo</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Configura los permisos específicos que tendrá este usuario en cada módulo del sistema.
              </p>
            </div>

            <div className="space-y-3">
              {MODULES.map(module => {
                const modulePerms = userPermissions[module.key] || {};
                const Icon = module.icon;
                const allEnabled = PERMISSION_TYPES.every(perm => modulePerms[perm.key]);
                const noneEnabled = PERMISSION_TYPES.every(perm => !modulePerms[perm.key]);

                return (
                  <Card key={module.key} className="border-l-4" style={{ borderLeftColor: module.color.replace('bg-', '#') === 'blue-500' ? '#3b82f6' : module.color.replace('bg-', '#') === 'green-500' ? '#10b981' : '#8b5cf6' }}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-md ${module.color}`}>
                            <Icon className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-sm">{module.name}</CardTitle>
                            <p className="text-xs text-muted-foreground">{module.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            type="button"
                            variant="outline"
                            onClick={() => setAllPermissions(module.key, true)}
                            disabled={allEnabled}
                            className="text-xs px-2 py-1 h-auto"
                          >
                            Todo
                          </Button>
                          <Button 
                            size="sm" 
                            type="button"
                            variant="outline"
                            onClick={() => setAllPermissions(module.key, false)}
                            disabled={noneEnabled}
                            className="text-xs px-2 py-1 h-auto"
                          >
                            Nada
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {PERMISSION_TYPES.map(permission => (
                          <div key={permission.key} className="flex items-center space-x-2">
                            <Switch
                              id={`${module.key}-${permission.key}`}
                              checked={modulePerms[permission.key] || false}
                              onCheckedChange={(value) => 
                                handlePermissionChange(module.key, permission.key, value)
                              }
                            />
                            <Label 
                              htmlFor={`${module.key}-${permission.key}`}
                              className="text-xs cursor-pointer"
                            >
                              {permission.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

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

      {/* Upsell Modal */}
      <UpsellModal
        isOpen={showUpsellModal}
        onClose={() => {
          setShowUpsellModal(false);
          setUserLimitReached(false);
        }}
        opportunities={opportunities}
        currentUsage={currentUserStats.current > 0 ? {
          users: currentUserStats.active,
          limit: currentUserStats.limit
        } : undefined}
      />
    </>
  );
}