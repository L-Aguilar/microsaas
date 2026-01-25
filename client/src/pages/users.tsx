import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Plus, Users, Mail, Phone, Trash2, Edit, Eye, TrendingUp, Target, Activity, Award, BarChart3, ArrowRight, Shield, Zap, CheckCircle, UserX, User as UserIcon } from "lucide-react";
import { User, OpportunityWithRelations } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useModulePermissions } from "@/hooks/use-module-permissions";
import UserForm from "@/components/forms/user-form";
import { RequireModulePage } from "@/components/auth/RequireModuleAccess";
import { DataTable, Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useLocation } from "wouter";
import { UserLimitsIndicator } from "@/components/ui/UserLimitsIndicator";
import { UserActivationToggle } from "@/components/ui/UserActivationToggle";
import { UpsellModal } from "@/components/modals/UpsellModal";
import { useUpsellOpportunities } from "@/hooks/use-account-status";

interface UserMetrics {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  metrics: {
    totalOpportunities: number;
    wonOpportunities: number;
    lostOpportunities: number;
    inProgressOpportunities: number;
    conversionRate: number;
    activitiesThisWeek: number;
    totalActivities: number;
  };
  opportunitiesByStatus: Record<string, number>;
  recentOpportunities: Array<{
    id: string;
    title: string;
    status: string;
    companyName: string;
    createdAt: string;
    estimatedCloseDate: string | null;
  }>;
  recentActivities: Array<{
    id: string;
    type: string;
    details: string;
    activityDate: string;
    opportunityTitle: string;
    createdAt: string;
  }>;
}

export default function UsersPage() {
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // User limits and upselling functionality
  const { opportunities, hasUserLimitOpportunity } = useUpsellOpportunities();
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const { user: currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const { canCreate, canEdit, canDelete, isAtLimit, currentCount, itemLimit } = useModulePermissions('USERS');

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });


  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Usuario eliminado",
        description: "El usuario ha sido eliminado correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el usuario",
        variant: "destructive",
      });
    },
  });

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setShowEditUserModal(true);
  };

  const handleViewProfile = (user: User) => {
    setLocation(`/users/profile/${user.id}`);
  };


  const confirmDelete = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
      setUserToDelete(null);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-red-100 text-red-800';
      case 'BUSINESS_ADMIN':
        return 'bg-purple-100 text-purple-800';
      case 'USER':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'Super Admin';
      case 'BUSINESS_ADMIN':
        return 'Admin Empresa';
      case 'USER':
        return 'Vendedor';
      default:
        return role;
    }
  };

  const statusLabels = {
    NEW: "Nueva",
    IN_PROGRESS: "En Proceso",
    NEGOTIATION: "Negociación",
    WON: "Ganada",
    LOST: "Perdida",
  };

  const activityTypeLabels = {
    CALL: "Llamada",
    MEETING: "Reunión",
    NOTE: "Nota",
  };

  // Access is controlled by RequireModulePage wrapper

  // Filter out SUPER_ADMIN from the list (they shouldn't be managed here)
  const displayUsers = users.filter(user => user.role !== 'SUPER_ADMIN');

  const columns: Column<User>[] = [
    {
      key: "name",
      header: "Nombre",
      accessor: (user) => user.name,
      sortable: true,
      width: "w-1/4",
    },
    {
      key: "email",
      header: "Email",
      accessor: (user) => user.email,
      sortable: true,
      width: "w-1/4",
      render: (value) => (
        <div className="flex items-center space-x-2">
          <Mail className="h-4 w-4 text-gray-400" />
          <span>{value}</span>
        </div>
      ),
    },
    {
      key: "phone",
      header: "Teléfono",
      accessor: (user) => user.phone || 'No especificado',
      sortable: true,
      width: "w-1/6",
      render: (value) => (
        <div className="flex items-center space-x-2">
          <Phone className="h-4 w-4 text-gray-400" />
          <span>{value}</span>
        </div>
      ),
    },
    {
      key: "role",
      header: "Rol",
      accessor: (user) => user.role,
      sortable: true,
      width: "w-1/8",
      render: (value) => (
        <Badge className={getRoleColor(value)}>
          {getRoleLabel(value)}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Estado",
      accessor: (user) => (user as any).isActive ? "Activo" : "Inactivo",
      sortable: true,
      width: "w-1/6",
      render: (_, user) => (
        currentUser?.role === 'BUSINESS_ADMIN' && user.role === 'USER' ? (
          <UserActivationToggle
            userId={user.id}
            userName={user.name}
            isActive={(user as any).isActive !== false}
            onActivationChange={() => {
              // Refresh user list
              queryClient.invalidateQueries({ queryKey: ['/api/users'] });
            }}
          />
        ) : (
          <Badge variant={(user as any).isActive !== false ? "default" : "secondary"}>
            {(user as any).isActive !== false ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Activo
              </>
            ) : (
              <>
                <UserX className="h-3 w-3 mr-1" />
                Inactivo
              </>
            )}
          </Badge>
        )
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      accessor: () => "",
      sortable: false,
      width: "w-1/4",
      render: (_, user) => (
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleViewProfile(user)}
            className="h-8"
          >
            <UserIcon className="h-4 w-4 mr-1" />
            Ver Perfil
          </Button>
          {/* Edit button - any user with edit permissions can edit other users except BUSINESS_ADMIN */}
          {user.role !== 'BUSINESS_ADMIN' && canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEditUser(user)}
              className="h-8"
              disabled={!canEdit}
              title={!canEdit ? "No tienes permisos para editar usuarios" : "Editar información y permisos"}
            >
              <Shield className="h-4 w-4 mr-1" />
              Editar
            </Button>
          )}
          {user.role !== 'BUSINESS_ADMIN' && canDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDeleteUser(user)}
              className="h-8 text-destructive hover:text-destructive"
              disabled={!canDelete}
              title={!canDelete ? "No tienes permisos para eliminar usuarios" : ""}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <RequireModulePage module="USERS">
      <div className="space-y-6">
      {/* Enhanced User Limits Indicator */}
      {itemLimit && currentUser?.role === 'BUSINESS_ADMIN' && (
        <UserLimitsIndicator
          currentUsers={currentCount || 0}
          totalLimit={itemLimit}
          activeUsers={users?.filter(u => (u as any).isActive !== false).length || 0}
        />
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Vendedores</h1>
          <p className="text-muted-foreground mt-1">Gestiona tu equipo de ventas y sus métricas</p>
        </div>
        <Button 
          onClick={() => setShowNewUserModal(true)} 
          className="bg-brand-500 hover:bg-brand-600"
          disabled={!canCreate || isAtLimit}
          title={!canCreate ? "No tienes permisos para crear usuarios" : 
                 isAtLimit ? `Has alcanzado el límite de ${itemLimit} usuarios` : ""}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Vendedor
          {isAtLimit && itemLimit && (
            <span className="ml-2 text-xs">({currentCount}/{itemLimit})</span>
          )}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
        </div>
      ) : displayUsers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-foreground">No hay vendedores</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Comienza agregando tu primer vendedor al equipo.
            </p>
            <div className="mt-6">
              <Button 
                onClick={() => setShowNewUserModal(true)}
                disabled={!canCreate || isAtLimit}
                title={!canCreate ? "No tienes permisos para crear usuarios" : 
                       isAtLimit ? `Has alcanzado el límite de ${itemLimit} usuarios` : ""}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Vendedor
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Lista de Vendedores</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable data={displayUsers} columns={columns} />
            </CardContent>
          </Card>
        </>
      )}


      {/* Create User Modal */}
      <Dialog open={showNewUserModal} onOpenChange={setShowNewUserModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Vendedor</DialogTitle>
            <DialogDescription>
              Agrega un nuevo vendedor a tu equipo
            </DialogDescription>
          </DialogHeader>
          <UserForm
            onSuccess={() => {
              setShowNewUserModal(false);
              queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            }}
            onCancel={() => setShowNewUserModal(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={showEditUserModal} onOpenChange={setShowEditUserModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Vendedor</DialogTitle>
            <DialogDescription>
              Modifica la información del vendedor
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <UserForm
              user={selectedUser}
              onSuccess={() => {
                setShowEditUserModal(false);
                setSelectedUser(null);
                queryClient.invalidateQueries({ queryKey: ["/api/users"] });
              }}
              onCancel={() => {
                setShowEditUserModal(false);
                setSelectedUser(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Eliminar Vendedor"
        description={`¿Estás seguro de que deseas eliminar a ${userToDelete?.name}? Esta acción no se puede deshacer.`}
      />

      {/* Upsell Modal */}
      {currentUser?.role === 'BUSINESS_ADMIN' && (
        <UpsellModal
          isOpen={showUpsellModal}
          onClose={() => setShowUpsellModal(false)}
          opportunities={opportunities}
          currentUsage={{
            users: users?.filter(u => (u as any).isActive !== false).length || 0,
            limit: itemLimit || 0
          }}
        />
      )}
      </div>
    </RequireModulePage>
  );
}
