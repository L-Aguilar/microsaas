import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Building, ArrowLeft, Search, Calendar, DollarSign, User, Eye, Edit } from "lucide-react";
import { CompanyWithRelations, OpportunityWithRelations } from "@shared/schema";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import CompanyForm from "@/components/forms/company-form";
import { DataTable, Column } from "@/components/ui/data-table";

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const { data: company, isLoading } = useQuery<CompanyWithRelations>({
    queryKey: [`/api/companies/${id}`],
    enabled: !!id,
  });

  const { data: opportunities = [] } = useQuery<OpportunityWithRelations[]>({
    queryKey: ["/api/opportunities"],
  });

  // Filter opportunities for this company
  const companyOpportunities = opportunities.filter(opp => opp.companyId === id);

  const statusColors = {
    NEW: "bg-blue-100 text-blue-800",
    IN_PROGRESS: "bg-purple-100 text-purple-800",
    NEGOTIATION: "bg-orange-100 text-orange-800",
    WON: "bg-green-100 text-green-800",
    LOST: "bg-red-100 text-red-800",
  };

  const statusLabels = {
    NEW: "Nueva",
    IN_PROGRESS: "En Proceso",
    NEGOTIATION: "Negociación",
    WON: "Ganada",
    LOST: "Perdida",
  };

  const companyStatusColors = {
    LEAD: "bg-blue-100 text-blue-800",
    ACTIVE: "bg-green-100 text-green-800",
    INACTIVE: "bg-gray-100 text-gray-800",
    BLOCKED: "bg-red-100 text-red-800",
    DELETED: "bg-red-100 text-red-800",
  };

  const companyStatusLabels = {
    LEAD: "Lead",
    ACTIVE: "Activa",
    INACTIVE: "Inactiva",
    BLOCKED: "Bloqueada",
    DELETED: "Eliminada",
  };

  const handleViewOpportunity = (opportunityId: string) => {
    setLocation(`/opportunities/${opportunityId}`);
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(parseFloat(amount));
  };

  // Definir columnas para la tabla de oportunidades
  const opportunityColumns: Column<OpportunityWithRelations>[] = [
    {
      key: "title",
      header: "Título",
      accessor: (opportunity) => opportunity.title,
      sortable: true,
      width: "w-1/3",
      render: (value, opportunity) => (
        <div>
          <p className="font-medium">{value}</p>
          {opportunity.notes && (
            <p className="text-sm text-muted-foreground truncate max-w-xs">
              {opportunity.notes}
            </p>
          )}
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
      key: "sellerName",
      header: "Vendedor",
      accessor: (opportunity) => opportunity.seller?.name || 'Sin vendedor',
      sortable: true,
      width: "w-1/6",
      render: (value) => (
        <div className="flex items-center space-x-2">
          <User className="h-4 w-4 text-gray-400" />
          <span>{value}</span>
        </div>
      ),
    },
    {
      key: "estimatedCloseDate",
      header: "Fecha de Cierre",
      accessor: (opportunity) => opportunity.estimatedCloseDate,
      sortable: true,
      width: "w-1/6",
      render: (value) => (
        value ? (
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span>
              {format(new Date(value), "dd/MM/yyyy", { locale: es })}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">Sin fecha</span>
        )
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      accessor: () => null,
      width: "w-20",
      render: (_, opportunity) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleViewOpportunity(opportunity.id)}
          data-testid={`button-view-opportunity-${opportunity.id}`}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Cargando empresa...</p>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Building className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Empresa no encontrada</h3>
          <p className="mt-1 text-sm text-gray-500">La empresa que buscas no existe o fue eliminada.</p>
          <div className="mt-6">
            <Button onClick={() => setLocation("/companies")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a empresas
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={() => setLocation("/companies")}
            data-testid="button-back"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Detalle de Empresa</h1>
            <p className="text-muted-foreground">Información completa y historial de oportunidades</p>
          </div>
        </div>
        <Button
          onClick={() => setIsEditModalOpen(true)}
          className="bg-black hover:bg-gray-800 text-white"
          data-testid="button-edit-company"
        >
          <Edit className="mr-2 h-4 w-4" />
          Editar Empresa
        </Button>
      </div>

      {/* Company Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold" data-testid="company-name">
                {company.name}
              </h2>
              <Badge className={companyStatusColors[company.status]}>
                {companyStatusLabels[company.status]}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {company.contactName && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Contacto</label>
                <p className="text-sm font-medium text-foreground" data-testid="company-contact">
                  {company.contactName}
                </p>
              </div>
            )}
            {company.email && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Correo</label>
                <a 
                  href={`mailto:${company.email}`} 
                  className="text-sm font-medium text-brand-500 hover:underline"
                  data-testid="company-email"
                >
                  {company.email}
                </a>
              </div>
            )}
            {company.phone && company.phone.trim() !== '' && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Teléfono</label>
                <a 
                  href={`tel:${company.phone}`} 
                  className="text-sm font-medium text-brand-500 hover:underline"
                  data-testid="company-phone"
                >
                  {company.phone}
                </a>
              </div>
            )}
            {company.website && company.website.trim() !== '' && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Sitio Web</label>
                <a 
                  href={company.website.startsWith('http') ? company.website : `https://${company.website}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-sm font-medium text-brand-500 hover:underline"
                  data-testid="company-website"
                >
                  {company.website}
                </a>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-muted-foreground">Total Oportunidades</label>
              <p className="text-sm font-medium text-foreground" data-testid="company-opportunities-count">
                {companyOpportunities.length}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Fecha de Creación</label>
              <p className="text-sm font-medium text-foreground" data-testid="company-created">
                {format(new Date(company.createdAt), "dd/MM/yyyy", { locale: es })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Opportunities Table */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Oportunidades</CardTitle>
        </CardHeader>
        <CardContent>
          {companyOpportunities.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No hay oportunidades</h3>
              <p className="mt-1 text-sm text-gray-500">
                Esta empresa aún no tiene oportunidades registradas.
              </p>
            </div>
          ) : (
            <DataTable
              data={companyOpportunities}
              columns={opportunityColumns}
              searchPlaceholder="Buscar oportunidades por título, notas o vendedor..."
              itemsPerPage={10}
            />
          )}
        </CardContent>
      </Card>

      {/* Edit Company Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md">
          <CompanyForm
            company={company}
            onSuccess={() => setIsEditModalOpen(false)}
            onCancel={() => setIsEditModalOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}