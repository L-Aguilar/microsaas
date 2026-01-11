import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { 
  ArrowLeft, 
  Building, 
  User, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Plus,
  FileText,
  Globe,
  Phone
} from "lucide-react";
import { OpportunityWithRelations, ActivityWithRelations } from "@shared/schema";
import ActivityForm from "@/components/forms/activity-form";
import ActivityItem from "@/components/activity/activity-item";
import HtmlContent from "@/components/ui/html-content";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface OpportunityDetailProps {
  opportunityId: string;
}

export default function OpportunityDetail({ opportunityId }: OpportunityDetailProps) {
  const [showActivityModal, setShowActivityModal] = useState(false);

  const { data: opportunity, isLoading } = useQuery<OpportunityWithRelations>({
    queryKey: ["/api/opportunities", opportunityId],
  });

  const { data: activities = [] } = useQuery<ActivityWithRelations[]>({
    queryKey: ["/api/opportunities", opportunityId, "activities"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (!opportunity) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Oportunidad no encontrada</h3>
        <p className="mt-1 text-sm text-gray-500">
          La oportunidad que buscas no existe o ha sido eliminada.
        </p>
        <div className="mt-6">
          <Link href="/opportunities">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a Oportunidades
            </Button>
          </Link>
        </div>
      </div>
    );
  }

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

  // Sort activities by creation date (most recent first)
  const sortedActivities = [...activities].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/opportunities">
              <Button variant="outline" size="sm" data-testid="button-back">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-opportunity-title">
                {opportunity.title}
              </h1>
              <p className="text-sm text-muted-foreground">
                {opportunity.type === 'NEW_CLIENT' ? 'Nuevo Cliente' : 'Proyecto Adicional'}
              </p>
            </div>
          </div>
          <Badge className={statusColors[opportunity.status]}>
            {statusLabels[opportunity.status]}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Opportunity Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Summary Card */}
            <Card className="border border-border shadow-sm">
              <CardHeader>
                <CardTitle>Resumen de la Oportunidad</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">Vendedor</p>
                      <p className="font-medium text-foreground" data-testid="text-seller">
                        {opportunity.seller.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-5 w-5 text-orange-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">Fecha de Creación</p>
                      <p className="font-medium text-foreground" data-testid="text-creation-date">
                        {opportunity.estimatedCloseDate
                          ? format(new Date(opportunity.estimatedCloseDate), "dd 'de' MMMM, yyyy", { locale: es })
                          : "Sin fecha definida"
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {opportunity.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Notas</p>
                    <div className="text-sm text-foreground bg-muted p-3 rounded-lg" data-testid="text-notes">
                      <HtmlContent content={opportunity.notes} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Activities Timeline */}
            <Card className="border border-border shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Timeline de Actividades</CardTitle>
                  <Button
                    onClick={() => setShowActivityModal(true)}
                    className="bg-brand-500 hover:bg-brand-600 text-white"
                    data-testid="button-new-activity"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Nueva Actividad
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sortedActivities.map((activity, index) => (
                    <div key={activity.id} className="relative">
                      <ActivityItem 
                        activity={activity} 
                        showOpportunityLink={false} 
                        showBorder={index < sortedActivities.length - 1}
                      />
                    </div>
                  ))}
                  {sortedActivities.length === 0 && (
                    <div className="text-center py-12">
                      <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <p className="text-sm text-muted-foreground">
                        No hay actividades registradas para esta oportunidad
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Haz clic en "Nueva Actividad" para comenzar
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Company Information */}
          <div className="space-y-6">
            <Card className="border border-border shadow-sm">
              <CardHeader>
                <CardTitle>Información de la Empresa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground" data-testid="text-company-name">
                      {opportunity.company.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {opportunity.company.contactName || 'Sin contacto'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Estado</span>
                    <Badge className={`status-${opportunity.company.status.toLowerCase()}`}>
                      {opportunity.company.status}
                    </Badge>
                  </div>
                  
                  {opportunity.company.email && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">Correo:</span>
                      <a
                        href={`mailto:${opportunity.company.email}`}
                        className="text-sm text-brand-500 hover:underline"
                        data-testid="link-company-email"
                      >
                        {opportunity.company.email}
                      </a>
                    </div>
                  )}

                  {opportunity.company.website && (
                    <div className="flex items-center space-x-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={opportunity.company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-brand-500 hover:underline"
                        data-testid="link-company-website"
                      >
                        {opportunity.company.website}
                      </a>
                    </div>
                  )}

                  {opportunity.company.phone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-foreground" data-testid="text-company-phone">
                        {opportunity.company.phone}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="border border-border shadow-sm">
              <CardHeader>
                <CardTitle>Estadísticas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Actividades Registradas</span>
                  <span className="text-lg font-semibold text-foreground" data-testid="text-activities-count">
                    {activities.length}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Fecha de Creación</span>
                  <span className="text-sm font-medium text-foreground">
                    {format(new Date(opportunity.createdAt), "dd/MM/yyyy", { locale: es })}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Última Actualización</span>
                  <span className="text-sm font-medium text-foreground">
                    {format(new Date(opportunity.updatedAt), "dd/MM/yyyy", { locale: es })}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Activity Modal */}
      <Dialog open={showActivityModal} onOpenChange={setShowActivityModal}>
        <DialogContent className="max-w-md">
          <ActivityForm 
            opportunityId={opportunityId} 
            onSuccess={() => setShowActivityModal(false)}
            onCancel={() => setShowActivityModal(false)} 
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
