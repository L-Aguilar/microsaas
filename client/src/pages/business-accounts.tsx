import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Users, Building, Settings, Eye } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import BusinessAccountForm from "@/components/forms/business-account-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BusinessAccount {
  id: string;
  name: string;
  plan: string;
  isActive: boolean;
  contactEmail: string | null;
  contactName: string | null;
  createdAt: string;
  updatedAt: string;
  modules: Array<{
    id: string;
    name: string;
    type: string;
    isEnabled: boolean;
  }>;
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
  }>;
  companies: Array<{
    id: string;
    name: string;
  }>;
}

export default function BusinessAccounts() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BusinessAccount | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<BusinessAccount | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery<BusinessAccount[]>({
    queryKey: ["/api/business-accounts"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/business-accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-accounts"] });
      toast({
        title: "Cuenta desactivada",
        description: "La cuenta de negocio ha sido desactivada exitosamente",
      });
      setDeletingAccount(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo desactivar la cuenta de negocio",
        variant: "destructive",
      });
    },
  });

  const handleCreateSuccess = () => {
    setShowCreateDialog(false);
    queryClient.invalidateQueries({ queryKey: ["/api/business-accounts"] });
    toast({
      title: "Cuenta creada",
      description: "La cuenta de negocio ha sido creada exitosamente",
    });
  };

  const handleEditSuccess = () => {
    setEditingAccount(null);
    queryClient.invalidateQueries({ queryKey: ["/api/business-accounts"] });
    toast({
      title: "Cuenta actualizada",
      description: "La cuenta de negocio ha sido actualizada exitosamente",
    });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" data-testid="text-page-title">
            Cuentas de Negocio
          </h1>
          <p className="text-gray-600 mt-1">
            Gestiona todas las organizaciones de la plataforma
          </p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="flex items-center gap-2"
          data-testid="button-create-business-account"
        >
          <Plus className="h-4 w-4" />
          Nueva Cuenta
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Cuentas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accounts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Cuentas Activas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {accounts.filter(acc => acc.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Usuarios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {accounts.reduce((sum, acc) => sum + acc.users.length, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Empresas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {accounts.reduce((sum, acc) => sum + acc.companies.length, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Business Accounts Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => (
          <Card key={account.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg" data-testid={`text-account-name-${account.id}`}>
                    {account.name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {account.contactEmail || 'Sin email asignado'}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={account.isActive ? "default" : "secondary"}>
                    {account.isActive ? "Activa" : "Inactiva"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Contact Info */}
              {account.contactName && (
                <div className="text-sm text-gray-600">
                  <strong>Contacto:</strong> {account.contactName}
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="flex flex-col items-center gap-1">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium">{account.users.length}</span>
                  <span className="text-xs text-gray-500">Usuarios</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Building className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium">{account.companies.length}</span>
                  <span className="text-xs text-gray-500">Empresas</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Settings className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium">
                    {account.modules.filter(m => m.isEnabled).length}
                  </span>
                  <span className="text-xs text-gray-500">Módulos</span>
                </div>
              </div>

              {/* Modules */}
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Módulos Activos</div>
                <div className="flex flex-wrap gap-1">
                  {account.modules.filter(m => m.isEnabled).map((module) => (
                    <Badge key={module.id} variant="outline" className="text-xs">
                      {module.name}
                    </Badge>
                  ))}
                  {account.modules.filter(m => m.isEnabled).length === 0 && (
                    <span className="text-xs text-gray-500">Sin módulos activos</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Link href={`/business-accounts/${account.id}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    data-testid={`button-view-account-${account.id}`}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Ver Detalle
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingAccount(account)}
                  data-testid={`button-edit-account-${account.id}`}
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeletingAccount(account)}
                  className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                  data-testid={`button-delete-account-${account.id}`}
                  title="Desactivar cuenta"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {accounts.length === 0 && (
        <Card className="p-12 text-center">
          <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay cuentas de negocio
          </h3>
          <p className="text-gray-600 mb-4">
            Comienza creando la primera cuenta de negocio para tus clientes
          </p>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Crear Primera Cuenta
          </Button>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Cuenta de Negocio</DialogTitle>
            <DialogDescription>
              Crea una nueva organización para un cliente
            </DialogDescription>
          </DialogHeader>
          <BusinessAccountForm
            onSuccess={handleCreateSuccess}
            onCancel={() => setShowCreateDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingAccount} onOpenChange={() => setEditingAccount(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cuenta de Negocio</DialogTitle>
            <DialogDescription>
              Modifica la información de la organización
            </DialogDescription>
          </DialogHeader>
          {editingAccount && (
            <BusinessAccountForm
              initialData={editingAccount}
              onSuccess={handleEditSuccess}
              onCancel={() => setEditingAccount(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingAccount} onOpenChange={() => setDeletingAccount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar cuenta de negocio?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción desactivará la cuenta "{deletingAccount?.name}" y ocultará 
              todos sus datos asociados. La cuenta se puede reactivar posteriormente 
              si es necesario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingAccount && deleteMutation.mutate(deletingAccount.id)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}