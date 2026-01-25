import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Plus, Search, Building, Edit, Trash2, Eye, Mail, Phone } from "lucide-react";
import { useLocation } from "wouter";
import { CompanyWithRelations } from "@shared/schema";
import CompanyForm from "@/components/forms/company-form";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useModulePermissions } from "@/hooks/use-module-permissions";
import { RequireModulePage } from "@/components/auth/RequireModuleAccess";
import { DataTable, Column } from "@/components/ui/data-table";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function Companies() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyWithRelations | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { canCreate, canEdit, canDelete, isAtLimit, currentCount, itemLimit } = useModulePermissions('CONTACTS');

  const { data: companies = [], isLoading } = useQuery<CompanyWithRelations[]>({
    queryKey: ["/api/companies"],
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/companies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({
        title: "Éxito",
        description: "Empresa eliminada correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar la empresa",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (company: CompanyWithRelations) => {
    setEditingCompany(company);
    setShowEditModal(true);
  };

  const handleDelete = (id: string) => {
    setCompanyToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (companyToDelete) {
      deleteCompanyMutation.mutate(companyToDelete);
      setCompanyToDelete(null);
    }
  };

  const handleViewDetails = (company: CompanyWithRelations) => {
    setLocation(`/companies/${company.id}`);
  };

  const statusColors = {
    LEAD: "bg-blue-100 text-blue-800",
    ACTIVE: "bg-green-100 text-green-800",
    INACTIVE: "bg-gray-100 text-gray-800",
    BLOCKED: "bg-red-100 text-red-800",
    DELETED: "bg-gray-100 text-gray-800",
  };

  const statusLabels = {
    LEAD: "Lead",
    ACTIVE: "Activo",
    INACTIVE: "Inactivo",
    BLOCKED: "Bloqueado",
    DELETED: "Eliminado",
  };

  // Definir columnas de la tabla
  const columns: Column<CompanyWithRelations>[] = [
    {
      key: "name",
      header: "Empresa",
      accessor: (company) => company.name,
      sortable: true,
      width: "w-1/4",
      render: (value, company) => (
        <div className="flex items-center gap-2">
          <Building className="h-4 w-4 text-gray-400" />
          <span className="font-medium">{value}</span>
        </div>
      ),
    },
    {
      key: "contactName",
      header: "Contacto",
      accessor: (company) => company.contactName,
      sortable: true,
      width: "w-1/5",
      render: (value) => (
        <span className="text-sm">{value || '-'}</span>
      ),
    },
    {
      key: "email",
      header: "Email",
      accessor: (company) => company.email,
      sortable: true,
      width: "w-1/5",
      render: (value) => (
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-gray-400" />
          <span className="font-mono text-sm">{value || '-'}</span>
        </div>
      ),
    },
    {
      key: "phone",
      header: "Teléfono",
      accessor: (company) => company.phone,
      sortable: true,
      width: "w-1/5",
      render: (value) => (
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-gray-400" />
          <span className="font-mono text-sm">{value || '-'}</span>
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
        <Badge className={statusColors[value as keyof typeof statusColors]}>
          {statusLabels[value as keyof typeof statusLabels]}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Fecha de Creación",
      accessor: (company) => company.createdAt,
      sortable: true,
      width: "w-1/6",
      render: (value) => (
        <span className="text-sm text-gray-600">
          {format(new Date(value), 'dd/MM/yyyy', { locale: es })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      accessor: () => null,
      width: "w-32",
      render: (_, company) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleViewDetails(company);
            }}
            className="h-8 w-8 p-0"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(company);
            }}
            className="h-8 w-8 p-0"
            disabled={!canEdit}
            title={!canEdit ? "No tienes permisos para editar empresas" : ""}
          >
            <Edit className="h-4 w-4" />
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(company.id);
              }}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
              disabled={!canDelete}
              title={!canDelete ? "No tienes permisos para eliminar empresas" : ""}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const handleRowClick = (company: CompanyWithRelations) => {
    handleViewDetails(company);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  return (
    <RequireModulePage module="CONTACTS">
      <div className="space-y-6">
      {/* Información de límites del plan */}
      {itemLimit && (
        <Card className={`${currentCount >= itemLimit ? 'border-red-200 bg-red-50' : 
                           currentCount >= itemLimit * 0.8 ? 'border-yellow-200 bg-yellow-50' : 
                           'border-blue-200 bg-blue-50'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Límite de Contactos</h4>
                <p className="text-sm text-muted-foreground">
                  {currentCount} de {itemLimit} contactos utilizados
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

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contactos</h1>
          <p className="text-muted-foreground">
            Gestiona los contactos y clientes de tu organización.
          </p>
        </div>
        <Button 
          onClick={() => setShowCreateModal(true)}
          disabled={!canCreate || isAtLimit}
          title={!canCreate ? "No tienes permisos para crear contactos" : 
                 isAtLimit ? `Has alcanzado el límite de ${itemLimit} contactos` : ""}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Contacto
          {isAtLimit && itemLimit && (
            <span className="ml-2 text-xs">({currentCount}/{itemLimit})</span>
          )}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Building className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Contactos</p>
                <p className="text-2xl font-bold text-foreground">{companies.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Building className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Activas</p>
                <p className="text-2xl font-bold text-foreground">
                  {companies.filter(company => company.status === 'ACTIVE').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Building className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Leads</p>
                <p className="text-2xl font-bold text-foreground">
                  {companies.filter(company => company.status === 'LEAD').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <Building className="h-6 w-6 text-gray-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Inactivas</p>
                <p className="text-2xl font-bold text-foreground">
                  {companies.filter(company => company.status === 'INACTIVE').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Lista de Contactos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={companies}
            columns={columns}
            searchPlaceholder="Buscar contactos por nombre, empresa..."
                            itemsPerPage={10}
            onRowClick={handleRowClick}
          />
        </CardContent>
      </Card>

      {/* Modal para nuevo contacto */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl">
          <CompanyForm
            onSuccess={() => {
              setShowCreateModal(false);
              queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
            }}
            onCancel={() => setShowCreateModal(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Modal para editar contacto */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl">
          {editingCompany && (
            <CompanyForm
              company={editingCompany}
              onSuccess={() => {
                setShowEditModal(false);
                setEditingCompany(null);
                queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
              }}
              onCancel={() => {
                setShowEditModal(false);
                setEditingCompany(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación para eliminar */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Eliminar Contacto"
        description="¿Estás seguro de que quieres eliminar este contacto? Esta acción no se puede deshacer."
        onConfirm={confirmDelete}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
      </div>
    </RequireModulePage>
  );
}
