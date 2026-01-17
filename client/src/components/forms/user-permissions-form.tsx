import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Shield, Users, Building, Activity, BarChart3, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface UserPermissionsFormProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

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

export default function UserPermissionsForm({ user, isOpen, onClose, onSuccess }: UserPermissionsFormProps) {
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Load current permissions
  useEffect(() => {
    if (isOpen && user.id) {
      loadPermissions();
    }
  }, [isOpen, user.id]);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const response = await apiRequest("GET", `/api/users/${user.id}/permissions`);
      const userPerms = await response.json();
      
      // Initialize with default values if no permissions exist
      const initialPerms: Record<string, Record<string, boolean>> = {};
      MODULES.forEach(module => {
        initialPerms[module.key] = {
          canView: userPerms[module.key]?.canView ?? true,
          canCreate: userPerms[module.key]?.canCreate ?? false,
          canEdit: userPerms[module.key]?.canEdit ?? false,
          canDelete: userPerms[module.key]?.canDelete ?? false
        };
      });
      
      setPermissions(initialPerms);
    } catch (error) {
      console.error("Error loading permissions:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los permisos del usuario",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = (moduleKey: string, permissionKey: string, value: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [moduleKey]: {
        ...prev[moduleKey],
        [permissionKey]: value
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await apiRequest("PUT", `/api/users/${user.id}/permissions`, {
        permissions
      });

      if (response.ok) {
        toast({
          title: "Éxito",
          description: "Permisos actualizados correctamente"
        });
        onSuccess?.();
        onClose();
      } else {
        throw new Error("Failed to update permissions");
      }
    } catch (error) {
      console.error("Error saving permissions:", error);
      toast({
        title: "Error", 
        description: "No se pudieron guardar los permisos",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const setAllPermissions = (moduleKey: string, value: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [moduleKey]: {
        canView: value,
        canCreate: value,
        canEdit: value,
        canDelete: value
      }
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Gestionar Permisos - {user.name}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Cargando permisos...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* User Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Información del Usuario</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge variant="outline">{user.role}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Permissions by Module */}
            <div className="space-y-4">
              {MODULES.map(module => {
                const modulePerms = permissions[module.key] || {};
                const Icon = module.icon;
                const allEnabled = PERMISSION_TYPES.every(perm => modulePerms[perm.key]);
                const noneEnabled = PERMISSION_TYPES.every(perm => !modulePerms[perm.key]);

                return (
                  <Card key={module.key}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-md ${module.color}`}>
                            <Icon className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{module.name}</CardTitle>
                            <p className="text-sm text-muted-foreground">{module.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setAllPermissions(module.key, true)}
                            disabled={allEnabled}
                          >
                            Todo
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setAllPermissions(module.key, false)}
                            disabled={noneEnabled}
                          >
                            Nada
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                              className="text-sm cursor-pointer"
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

            <Separator />

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Guardar Permisos
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}