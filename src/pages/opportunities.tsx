import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Plus, Eye, Edit, Trash2, Calendar, Building, User, Target } from "lucide-react";
import { OpportunityWithRelations, CompanyWithRelations, User as UserType } from "@shared/schema";
import OpportunityForm from "@/components/forms/opportunity-form";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DataTable, Column } from "@/components/ui/data-table";
import { DateRangeFilter } from "@/components/ui/date-range-filter";

export default function Opportunities() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sellerFilter, setSellerFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ startDate: Date | undefined; endDate: Date | undefined }>({
    startDate: undefined,
    endDate: undefined,
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [opportunityToDelete, setOpportunityToDelete] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<OpportunityWithRelations | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: opportunities = [], isLoading } = useQuery<OpportunityWithRelations[]>({
    queryKey: ["/api/opportunities"],
  });

  const { data: companies = [] } = useQuery<CompanyWithRelations[]>({
    queryKey: ["/api/companies"],
  });

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const deleteOpportunityMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/opportunities/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/stats"] });
      toast({
        title: "Éxito",
        description: "Oportunidad eliminada correctamente",
      });
    },
    onError: (error: any) => {
      console.error("Error deleting opportunity:", error);
      
      // Check if it's our specific validation error
      if (error?.response?.data?.code === "HAS_ACTIVITIES") {
        toast({
          title: "No se puede eliminar",
          description: error.response.data.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "No se pudo eliminar la oportunidad",
          variant: "destructive",
        });
      }
    },
  });

  // Filter opportunities
  const filteredOpportunities = opportunities.filter(opportunity => {
    const matchesStatus = statusFilter === "all" || opportunity.status === statusFilter;
    const matchesSeller = sellerFilter === "all" || opportunity.sellerId === sellerFilter;
    const matchesCompany = companyFilter === "all" || opportunity.companyId === companyFilter;
    
    // Filtro de fechas
    let matchesDate = true;
    if (dateRange.startDate || dateRange.endDate) {
      const opportunityDate = new Date(opportunity.createdAt);
      if (dateRange.startDate && opportunityDate < dateRange.startDate) {
        matchesDate = false;
      }
      if (dateRange.endDate && opportunityDate > dateRange.endDate) {
        matchesDate = false;
      }
    }
    
    return matchesStatus && matchesSeller && matchesCompany && matchesDate;
  });

  // Sort by last activity (most recent first)
  const sortedOpportunities = [...filteredOpportunities].sort((a, b) => {
    const aLastActivity = a.activities.length > 0 
      ? Math.max(...a.activities.map(activity => new Date(activity.createdAt).getTime()))
      : new Date(a.createdAt).getTime();
    const bLastActivity = b.activities.length > 0
      ? Math.max(...b.activities.map(activity => new Date(activity.createdAt).getTime()))
      : new Date(b.createdAt).getTime();
    
    return bLastActivity - aLastActivity;
  });

  const handleEdit = (opportunity: OpportunityWithRelations) => {
    setEditingOpportunity(opportunity);
    setShowEditModal(true);
  };

  const handleDelete = (id: string) => {
    setOpportunityToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (opportunityToDelete) {
      deleteOpportunityMutation.mutate(opportunityToDelete);
      setOpportunityToDelete(null);
    }
  };

  const statusColors = {
    NEW: "bg-blue-100 text-blue-800",
    QUALIFYING: "bg-yellow-100 text-yellow-800",
    PROPOSAL: "bg-purple-100 text-purple-800",
    NEGOTIATION: "bg-orange-100 text-orange-800",
    WON: "bg-green-100 text-green-800",
    LOST: "bg-red-100 text-red-800",
    ON_HOLD: "bg-gray-100 text-gray-800",
  };

  const statusLabels = {
    NEW: "Nueva",
    QUALIFYING: "Calificando",
    PROPOSAL: "Propuesta",
    NEGOTIATION: "Negociación",
    WON: "Ganada",
    LOST: "Perdida",
    ON_HOLD: "En Espera",
  };

  const typeLabels = {
    NEW_CLIENT: "Nuevo Cliente",
    ADDITIONAL_PROJECT: "Proyecto Adicional",
  };

  // Definir columnas de la tabla
  const columns: Column<OpportunityWithRelations>[] = [
    {
      key: "title",
      header: "Oportunidad",
      accessor: (opportunity) => opportunity.title,
      sortable: true,
      width: "w-1/4",
      render: (value, opportunity) => (
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-gray-400" />
          <span className="font-medium">{value}</span>
        </div>
      ),
    },
    {
      key: "company",
      header: "Empresa",
      accessor: (opportunity) => opportunity.company.name,
      sortable: true,
      width: "w-1/6",
      render: (value, opportunity) => (
        <div className="flex items-center gap-2">
          <Building className="h-4 w-4 text-gray-400" />
          <span className="text-sm">{value}</span>
        </div>
      ),
    },
    {
      key: "seller",
      header: "Vendedor",
      accessor: (opportunity) => opportunity.seller.name,
      sortable: true,
      width: "w-1/6",
      render: (value, opportunity) => (
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-gray-400" />
          <span className="text-sm">{value}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Estado",
      accessor: (opportunity) => opportunity.status,
      sortable: true,
      width: "w-1/6",
      render: (value) => (
        <Badge className={statusColors[value as keyof typeof statusColors]}>
          {statusLabels[value as keyof typeof statusLabels]}
        </Badge>
      ),
    },
    {
      key: "type",
      header: "Tipo",
      accessor: (opportunity) => opportunity.type,
      sortable: true,
      width: "w-1/6",
      render: (value) => (
        <span className="text-sm text-gray-600">
          {typeLabels[value as keyof typeof typeLabels]}
        </span>
      ),
    },
    {
      key: "estimatedCloseDate",
      header: "Fecha Estimada",
      accessor: (opportunity) => opportunity.estimatedCloseDate,
      sortable: true,
      width: "w-1/6",
      render: (value) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">
            {value ? format(new Date(value), 'dd/MM/yyyy', { locale: es }) : '-'}
          </span>
        </div>
      ),
    },
    {
      key: "createdAt",
      header: "Fecha de Creación",
      accessor: (opportunity) => opportunity.createdAt,
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
      render: (_, opportunity) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              // Navegar a la página de detalles
              window.location.href = `/opportunities/${opportunity.id}`;
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
              handleEdit(opportunity);
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
              handleDelete(opportunity.id);
            }}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const handleRowClick = (opportunity: OpportunityWithRelations) => {
    // Navegar a la página de detalles
    window.location.href = `/opportunities/${opportunity.id}`;
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
          <h1 className="text-3xl font-bold tracking-tight">Oportunidades</h1>
          <p className="text-muted-foreground">
            Gestiona las oportunidades de venta y seguimiento de clientes.
          </p>
        </div>
                    <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Oportunidad
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Target className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Oportunidades</p>
                <p className="text-2xl font-bold text-foreground">{opportunities.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Target className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Ganadas</p>
                <p className="text-2xl font-bold text-foreground">
                  {opportunities.filter(opp => opp.status === 'WON').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Target className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">En Negociación</p>
                <p className="text-2xl font-bold text-foreground">
                  {opportunities.filter(opp => opp.status === 'NEGOTIATION').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Target className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Nuevas</p>
                <p className="text-2xl font-bold text-foreground">
                  {opportunities.filter(opp => opp.status === 'NEW').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Filtros Avanzados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Estado</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="NEW">Nueva</SelectItem>
                  <SelectItem value="QUALIFYING">Calificando</SelectItem>
                  <SelectItem value="PROPOSAL">Propuesta</SelectItem>
                  <SelectItem value="NEGOTIATION">Negociación</SelectItem>
                  <SelectItem value="WON">Ganada</SelectItem>
                  <SelectItem value="LOST">Perdida</SelectItem>
                  <SelectItem value="ON_HOLD">En Espera</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Vendedor</label>
              <Select value={sellerFilter} onValueChange={setSellerFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los vendedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los vendedores</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Empresa</label>
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las empresas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las empresas</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Rango de Fechas</label>
              <DateRangeFilter
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
                onDateChange={(startDate, endDate) => setDateRange({ startDate, endDate })}
                placeholder="Filtrar por fecha"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Lista de Oportunidades
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={opportunities}
            columns={columns}
            searchPlaceholder="Buscar oportunidades por título, empresa..."
                            itemsPerPage={10}
            onRowClick={handleRowClick}
          />
        </CardContent>
      </Card>

      {/* Modal para nueva oportunidad */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl">
          <OpportunityForm
            onSuccess={() => {
              setShowCreateModal(false);
              queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
            }}
            onCancel={() => setShowCreateModal(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Modal para editar oportunidad */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl">
          {editingOpportunity && (
            <OpportunityForm
              opportunity={editingOpportunity}
              onSuccess={() => {
                setShowEditModal(false);
                setEditingOpportunity(null);
                queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
              }}
              onCancel={() => {
                setShowEditModal(false);
                setEditingOpportunity(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación para eliminar */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Eliminar Oportunidad"
        description="¿Estás seguro de que quieres eliminar esta oportunidad? Esta acción no se puede deshacer."
        onConfirm={confirmDelete}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </div>
  );
}
