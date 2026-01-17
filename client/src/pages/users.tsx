import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Plus, Users, Mail, Phone, Trash2, Edit, Eye, TrendingUp, Target, Activity, Award, BarChart3, ArrowRight, Shield } from "lucide-react";
import { User, OpportunityWithRelations } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useModulePermissions } from "@/hooks/use-module-permissions";
import UserForm from "@/components/forms/user-form";
import UserPermissionsForm from "@/components/forms/user-permissions-form";
import { DataTable, Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useLocation } from "wouter";

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
  const [viewingUserMetrics, setViewingUserMetrics] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [userForPermissions, setUserForPermissions] = useState<User | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const { canCreate, canEdit, canDelete, isAtLimit, currentCount, itemLimit } = useModulePermissions('USERS');

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: userMetrics, isLoading: metricsLoading } = useQuery<UserMetrics>({
    queryKey: ["/api/users", viewingUserMetrics, "metrics"],
    enabled: !!viewingUserMetrics,
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

  const handleViewMetrics = (userId: string) => {
    setViewingUserMetrics(userId);
  };

  const handleManagePermissions = (user: User) => {
    setUserForPermissions(user);
    setShowPermissionsModal(true);
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

  // Only SUPER_ADMIN and BUSINESS_ADMIN can access user management
  if (currentUser?.role !== 'BUSINESS_ADMIN' && currentUser?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Acceso Restringido</h2>
          <p className="text-muted-foreground">No tienes permisos para acceder a esta sección</p>
        </div>
      </div>
    );
  }

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
      width: "w-1/6",
      render: (value) => (
        <Badge className={getRoleColor(value)}>
          {getRoleLabel(value)}
        </Badge>
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
            onClick={() => handleViewMetrics(user.id)}
            className="h-8"
          >
            <BarChart3 className="h-4 w-4 mr-1" />
            Métricas
          </Button>
          {/* Show permissions button only for regular users, not for BUSINESS_ADMIN */}
          {user.role === 'USER' && currentUser?.role === 'BUSINESS_ADMIN' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleManagePermissions(user)}
              className="h-8"
              title="Gestionar permisos del usuario"
            >
              <Shield className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEditUser(user)}
            className="h-8"
            disabled={!canEdit}
            title={!canEdit ? "No tienes permisos para editar usuarios" : ""}
          >
            <Edit className="h-4 w-4" />
          </Button>
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
    <div className="space-y-6">
      {/* Información de límites del plan */}
      {itemLimit && (
        <Card className={`${currentCount >= itemLimit ? 'border-red-200 bg-red-50' : 
                           currentCount >= itemLimit * 0.8 ? 'border-yellow-200 bg-yellow-50' : 
                           'border-blue-200 bg-blue-50'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Límite de Usuarios</h4>
                <p className="text-sm text-muted-foreground">
                  {currentCount} de {itemLimit} usuarios utilizados
                  {currentCount >= itemLimit && " - Has alcanzado el límite de tu plan"}
                  {currentCount >= itemLimit * 0.8 && currentCount < itemLimit && " - Te acercas al límite de tu plan"}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-16 bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${currentCount >= itemLimit ? 'bg-red-500' : 
                                                    currentCount >= itemLimit * 0.8 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min((currentCount / itemLimit) * 100, 100)}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium">{Math.round((currentCount / itemLimit) * 100)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
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

      {/* User Metrics Modal */}
      <Dialog open={!!viewingUserMetrics} onOpenChange={(open) => !open && setViewingUserMetrics(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {userMetrics ? `Métricas de ${userMetrics.user.name}` : 'Cargando métricas...'}
            </DialogTitle>
            <DialogDescription>
              Rendimiento y actividad del vendedor
            </DialogDescription>
          </DialogHeader>

          {metricsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
            </div>
          ) : userMetrics ? (
            <div className="space-y-6 mt-4">
              {/* Metrics Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Oportunidades</p>
                        <p className="text-2xl font-bold">{userMetrics.metrics.totalOpportunities}</p>
                      </div>
                      <Target className="h-8 w-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Ganadas</p>
                        <p className="text-2xl font-bold text-green-600">{userMetrics.metrics.wonOpportunities}</p>
                      </div>
                      <Award className="h-8 w-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Tasa de Cierre</p>
                        <p className="text-2xl font-bold">{userMetrics.metrics.conversionRate.toFixed(1)}%</p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Actividades (Semana)</p>
                        <p className="text-2xl font-bold">{userMetrics.metrics.activitiesThisWeek}</p>
                      </div>
                      <Activity className="h-8 w-8 text-orange-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Opportunities by Status */}
              <Card>
                <CardHeader>
                  <CardTitle>Oportunidades por Estado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {Object.entries(userMetrics.opportunitiesByStatus).map(([status, count]) => (
                      <div key={status} className="text-center p-4 bg-gray-50 rounded-lg">
                        <p className="text-2xl font-bold">{count}</p>
                        <p className="text-sm text-muted-foreground">{statusLabels[status as keyof typeof statusLabels] || status}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Opportunities */}
              <Card>
                <CardHeader>
                  <CardTitle>Oportunidades Recientes</CardTitle>
                </CardHeader>
                <CardContent>
                  {userMetrics.recentOpportunities.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No hay oportunidades</p>
                  ) : (
                    <div className="space-y-3">
                      {userMetrics.recentOpportunities.map((opp) => (
                        <div
                          key={opp.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                          onClick={() => {
                            setViewingUserMetrics(null);
                            setLocation(`/opportunities/${opp.id}`);
                          }}
                        >
                          <div className="flex-1">
                            <p className="font-medium">{opp.title}</p>
                            <p className="text-sm text-muted-foreground">{opp.companyName}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(opp.createdAt), "PPP", { locale: es })}
                            </p>
                          </div>
                          <div className="flex items-center space-x-3">
                            <Badge className={
                              opp.status === 'WON' ? 'bg-green-100 text-green-800' :
                              opp.status === 'LOST' ? 'bg-red-100 text-red-800' :
                              opp.status === 'NEGOTIATION' ? 'bg-orange-100 text-orange-800' :
                              'bg-blue-100 text-blue-800'
                            }>
                              {statusLabels[opp.status as keyof typeof statusLabels] || opp.status}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-gray-400" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Activities */}
              <Card>
                <CardHeader>
                  <CardTitle>Actividades Recientes</CardTitle>
                </CardHeader>
                <CardContent>
                  {userMetrics.recentActivities.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No hay actividades</p>
                  ) : (
                    <div className="space-y-3">
                      {userMetrics.recentActivities.map((activity) => (
                        <div key={activity.id} className="p-3 border rounded-lg">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <Badge variant="outline">
                                  {activityTypeLabels[activity.type as keyof typeof activityTypeLabels] || activity.type}
                                </Badge>
                                <span className="text-sm font-medium">{activity.opportunityTitle}</span>
                              </div>
                              {activity.details && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2" dangerouslySetInnerHTML={{ __html: activity.details }} />
                              )}
                              <p className="text-xs text-muted-foreground mt-2">
                                {format(new Date(activity.activityDate), "PPP 'a las' p", { locale: es })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

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

      {/* User Permissions Modal */}
      {userForPermissions && (
        <UserPermissionsForm
          user={userForPermissions}
          isOpen={showPermissionsModal}
          onClose={() => {
            setShowPermissionsModal(false);
            setUserForPermissions(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Eliminar Vendedor"
        description={`¿Estás seguro de que deseas eliminar a ${userToDelete?.name}? Esta acción no se puede deshacer.`}
      />
    </div>
  );
}
