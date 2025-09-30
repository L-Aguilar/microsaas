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
      accessor: (company) => "N/A",
      sortable: false,
      width: "w-1/6",
      render: (value) => (
        <span className="text-sm text-gray-600">
          N/A
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
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(company.id);
            }}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Empresas</h1>
          <p className="text-muted-foreground">
            Gestiona las empresas y clientes de tu organización.
          </p>
        </div>
                    <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Empresa
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
                <p className="text-sm font-medium text-muted-foreground">Total Empresas</p>
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
            Lista de Empresas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={companies}
            columns={columns}
            searchPlaceholder="Buscar empresas por nombre, contacto..."
                            itemsPerPage={10}
            onRowClick={handleRowClick}
          />
        </CardContent>
      </Card>

      {/* Modal para nueva empresa */}
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

      {/* Modal para editar empresa */}
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
        title="Eliminar Empresa"
        description="¿Estás seguro de que quieres eliminar esta empresa? Esta acción no se puede deshacer."
        onConfirm={confirmDelete}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </div>
  );
}
