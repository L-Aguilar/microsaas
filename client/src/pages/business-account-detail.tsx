import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { DataTable, Column } from "@/components/ui/data-table";
import { Building, Users, Mail, Phone, Trash2, Plus, ArrowLeft, Settings, ToggleLeft, ToggleRight, Eye } from "lucide-react";
import { User, BusinessAccountWithRelations, Module, CompanyWithRelations, AVAILABLE_MODULES } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import UserForm from "@/components/forms/user-form";
import { Link } from "wouter";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function BusinessAccountDetailPage() {
  const { id } = useParams();
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const { data: businessAccount, isLoading } = useQuery<BusinessAccountWithRelations>({
    queryKey: ["/api/business-accounts", id],
    enabled: !!id,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/business-accounts", id, "users"],
    enabled: !!id,
  });

  const { data: companies = [] } = useQuery<CompanyWithRelations[]>({
    queryKey: ["/api/business-accounts", id, "companies"],
    enabled: !!id,
  });

  // Funciones helper para roles
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'bg-red-100 text-red-800';
      case 'BUSINESS_PLAN': return 'bg-blue-100 text-blue-800';
      case 'USER': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'Super Admin';
      case 'BUSINESS_PLAN': return 'Business Plan';
      case 'USER': return 'Usuario';
      default: return role;
    }
  };

  // Columnas para la tabla de usuarios
  const userColumns: Column<User>[] = [
    {
      key: "name",
      header: "Usuario",
      accessor: (user) => user.name,
      sortable: true,
      width: "w-1/4",
      render: (value, user) => (
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
            <span className="text-xs font-semibold text-foreground">
              {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
            </span>
          </div>
          <span className="font-medium">{value}</span>
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      accessor: (user) => user.email,
      sortable: true,
      width: "w-1/4",
    },
    {
      key: "phone",
      header: "Teléfono",
      accessor: (user) => user.phone || '-',
      sortable: true,
      width: "w-1/6",
    },
    {
      key: "role",
      header: "Rol",
      accessor: (user) => user.role,
      sortable: true,
      width: "w-1/6",
      render: (value) => (
        <Badge className={getRoleColor(value)}>
          {getRoleLabel(value)}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Fecha Registro",
      accessor: (user) => user.createdAt,
      sortable: true,
      width: "w-1/6",
      render: (value) => (
        value ? format(new Date(value), "dd/MM/yyyy", { locale: es }) : '-'
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      accessor: () => null,
      width: "w-20",
      render: (_, user) => (
        currentUser?.role === 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN' ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDeleteUser(user)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            data-testid={`button-delete-user-${user.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null
      ),
    },
  ];

  // Columnas para la tabla de empresas
  const companyColumns: Column<CompanyWithRelations>[] = [
    {
      key: "name",
      header: "Empresa",
      accessor: (company) => company.name,
      sortable: true,
      width: "w-1/4",
      render: (value, company) => (
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
            <Building className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="font-medium">{value}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Estado",
      accessor: (company) => company.status,
      sortable: true,
      width: "w-1/6",
      render: (value) => (
        <Badge variant={
          value === 'ACTIVE' ? 'default' : 
          value === 'LEAD' ? 'secondary' : 
          value === 'INACTIVE' ? 'outline' : 'destructive'
        }>
          {value === 'ACTIVE' ? 'Activa' : 
           value === 'LEAD' ? 'Lead' : 
           value === 'INACTIVE' ? 'Inactiva' : 'Bloqueada'}
        </Badge>
      ),
    },
    {
      key: "industry",
      header: "Industria",
      accessor: () => '-',
      sortable: false,
      width: "w-1/6",
    },
    {
      key: "email",
      header: "Email",
      accessor: (company) => company.email || '-',
      sortable: true,
      width: "w-1/6",
    },
    {
      key: "opportunities",
      header: "Oportunidades",
      accessor: (company) => company.opportunities.length,
      sortable: true,
      width: "w-1/6",
    },
    {
      key: "createdAt",
      header: "Fecha Registro",
      accessor: (company) => company.createdAt,
      sortable: true,
      width: "w-1/6",
      render: (value) => (
        value ? format(new Date(value), "dd/MM/yyyy", { locale: es }) : '-'
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      accessor: () => null,
      width: "w-20",
      render: (_, company) => (
        <Button
          variant="outline"
          size="sm"
          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          data-testid={`button-view-company-${company.id}`}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const { data: allModules = [] } = useQuery<Module[]>({
    queryKey: ["/api/modules"],
    enabled: !!id,
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-accounts", id, "users"] });
      toast({
        title: "Usuario eliminado",
        description: "El usuario ha sido eliminado correctamente",
      });
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el usuario",
        variant: "destructive",
      });
    },
  });

  const toggleModuleMutation = useMutation({
    mutationFn: async ({ moduleId, enable }: { moduleId: string; enable: boolean }) => {
      const endpoint = enable 
        ? `/api/business-accounts/${id}/modules/${moduleId}/enable`
        : `/api/business-accounts/${id}/modules/${moduleId}/disable`;
      await apiRequest("POST", endpoint);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-accounts", id] });
      toast({
        title: "Módulo actualizado",
        description: "El estado del módulo ha sido actualizado correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado del módulo",
        variant: "destructive",
      });
    },
  });

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  };

  const handleToggleModule = (moduleId: string, currentlyEnabled: boolean) => {
    toggleModuleMutation.mutate({ moduleId, enable: !currentlyEnabled });
  };

  const isModuleEnabled = (moduleId: string) => {
    return businessAccount?.modules?.some(m => m.id === moduleId && m.isEnabled) || false;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (!businessAccount) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Organización no encontrada</h2>
          <p className="text-muted-foreground">La organización que buscas no existe.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/business-accounts">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{businessAccount.name}</h1>
              <p className="text-muted-foreground">Gestión de organización y usuarios</p>
            </div>
          </div>
        </div>

        {/* Business Account Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Building className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <span>{businessAccount.name}</span>
                <Badge className={
                  businessAccount.isActive 
                    ? "bg-green-100 text-green-800 ml-2" 
                    : "bg-gray-100 text-gray-800 ml-2"
                }>
                  {businessAccount.isActive ? 'Activa' : 'Inactiva'}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{businessAccount.contactEmail || 'Sin email asignado'}</span>
              </div>
              {businessAccount.contactName && (
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{businessAccount.contactName}</span>
                </div>
              )}
            </div>
            
            {/* Enabled Modules */}
            <div className="mt-4">
              <h4 className="font-medium text-foreground mb-2">Módulos Habilitados</h4>
              <div className="flex flex-wrap gap-2">
                {businessAccount.modules?.filter(m => m.isEnabled).map((module) => (
                  <Badge key={module.id} className="bg-green-100 text-green-800">
                    <Settings className="h-3 w-3 mr-1" />
                    {module.name}
                  </Badge>
                )) || <span className="text-sm text-muted-foreground">Sin módulos habilitados</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Modules Management */}
        {currentUser?.role === 'SUPER_ADMIN' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Gestión de Módulos</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Habilita o deshabilita módulos para esta organización
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {allModules.filter(module => 
                  Object.values(AVAILABLE_MODULES).some(availableModule => 
                    availableModule.type === module.type
                  )
                ).map((module) => {
                  const isEnabled = isModuleEnabled(module.id);
                  return (
                    <div
                      key={module.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg"
                    >
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground">{module.name}</h4>
                        <p className="text-sm text-muted-foreground">{module.description}</p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge 
                          className={isEnabled 
                            ? "bg-green-100 text-green-800" 
                            : "bg-gray-100 text-gray-800"
                          }
                        >
                          {isEnabled ? 'Habilitado' : 'Deshabilitado'}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleModule(module.id, isEnabled)}
                          disabled={toggleModuleMutation.isPending}
                          className={isEnabled 
                            ? "text-red-600 hover:text-red-700 hover:bg-red-50" 
                            : "text-green-600 hover:text-green-700 hover:bg-green-50"
                          }
                          data-testid={`button-toggle-module-${module.type}`}
                        >
                          {isEnabled ? (
                            <ToggleRight className="h-4 w-4 mr-1" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 mr-1" />
                          )}
                          {isEnabled ? 'Deshabilitar' : 'Habilitar'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Users Management */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Usuarios ({users.length})</span>
              </CardTitle>
              {currentUser?.role === 'SUPER_ADMIN' && (
                <Button 
                  className="bg-brand-500 hover:bg-brand-600 text-white"
                  onClick={() => setShowNewUserModal(true)}
                  data-testid="button-new-user"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar Usuario
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!users.length ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No hay usuarios registrados en esta organización</p>
              </div>
            ) : (
              <DataTable
                data={users}
                columns={userColumns}
                searchPlaceholder="Buscar usuarios..."
                itemsPerPage={10}
              />
            )}
          </CardContent>
        </Card>

        {/* Companies Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Building className="h-5 w-5" />
              <span>Empresas ({companies.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!companies.length ? (
              <div className="text-center py-8">
                <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No hay empresas registradas en esta organización</p>
              </div>
            ) : (
              <DataTable
                data={companies}
                columns={companyColumns}
                searchPlaceholder="Buscar empresas..."
                itemsPerPage={10}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* New User Modal */}
      <Dialog open={showNewUserModal} onOpenChange={setShowNewUserModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar Usuario a {businessAccount.name}</DialogTitle>
          </DialogHeader>
          <UserForm 
            businessAccountId={businessAccount.id}
            onClose={() => setShowNewUserModal(false)}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/business-accounts", id, "users"] });
              setShowNewUserModal(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Eliminar Usuario"
        description={`¿Estás seguro de que quieres eliminar al usuario "${userToDelete?.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="destructive"
      />
    </>
  );
}