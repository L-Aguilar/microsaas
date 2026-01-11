import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useModulePermissions } from "@/hooks/use-module-permissions";
import { Badge } from "@/components/ui/badge";
import { 
  Trophy, 
  Handshake, 
  Building, 
  TrendingUp, 
  Users, 
  DollarSign,
  Activity,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Calendar,
  TrendingDown,
  Eye,
  Zap
} from "lucide-react";
import { OpportunityWithRelations, CompanyWithRelations } from "@shared/schema";

interface ReportStats {
  totalWon: number;
  totalNegotiation: number;
  activeCompanies: number;
  activitiesToday: number;
  opportunitiesByStatus: Record<string, number>;
  amountsBySeller: Record<string, number>;
  activitiesByType: Record<string, number>;
}

export default function Reports() {
  const { canView, isLoading: permissionsLoading } = useModulePermissions('REPORTS');
  
  const { data: stats, isLoading: statsLoading } = useQuery<ReportStats>({
    queryKey: ["/api/reports/stats"],
    enabled: canView, // Solo cargar datos si tiene permisos
  });

  const { data: opportunities = [] } = useQuery<OpportunityWithRelations[]>({
    queryKey: ["/api/opportunities"],
    enabled: canView, // Solo cargar datos si tiene permisos
  });

  const { data: companies = [] } = useQuery<CompanyWithRelations[]>({
    queryKey: ["/api/companies"],
  });

  // Verificar permisos primero
  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <BarChart3 className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Módulo de Reportes No Disponible</h3>
          <p className="text-gray-600">Este módulo no está incluido en tu plan actual.</p>
        </div>
      </div>
    );
  }

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  const statusLabels = {
    NEW: "Nuevas",
    IN_PROGRESS: "En Proceso",
    NEGOTIATION: "Negociación",
    WON: "Ganadas",
    LOST: "Perdidas",
  };

  const activityLabels = {
    CALL: "Llamadas",
    MEETING: "Reuniones",
    NOTE: "Notas",
  };

  // Calculate additional metrics for executive dashboard
  const totalOpportunities = opportunities.length;
  const wonOpportunities = opportunities.filter(opp => opp.status === 'WON').length;
  const lostOpportunities = opportunities.filter(opp => opp.status === 'LOST').length;
  const inProgressOpportunities = opportunities.filter(opp => 
    ['NEW', 'IN_PROGRESS', 'NEGOTIATION'].includes(opp.status)
  ).length;
  const onHoldOpportunities = 0; // Currently no ON_HOLD status in schema
  
  const conversionRate = totalOpportunities > 0 ? (wonOpportunities / totalOpportunities) * 100 : 0;
  const lossRate = totalOpportunities > 0 ? (lostOpportunities / totalOpportunities) * 100 : 0;
  
  // Note: amount field is not currently in the schema, so we use count instead
  const totalAmount = opportunities.length;
  const averageAmount = totalOpportunities > 0 ? totalAmount / totalOpportunities : 0;
  
  // Calculate average time in pipeline (simplified)
  const avgTimeInPipeline = totalOpportunities > 0 ? Math.round(totalOpportunities * 2.5) : 0; // days
  
  // Get top performers
  const topPerformers = Object.entries(stats?.amountsBySeller || {})
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3);
  
  // Get opportunities needing attention (stale or on hold)
  const staleOpportunities = opportunities.filter(opp => {
    const daysSinceUpdate = Math.floor((Date.now() - new Date(opp.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceUpdate > 7 && !['WON', 'LOST'].includes(opp.status);
  });

  return (
    <div className="space-y-6">
      {/* Executive Summary Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Resumen Ejecutivo</h1>
            <p className="text-gray-600 mt-1">Vista general del rendimiento de la empresa</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Última actualización</p>
            <p className="text-sm font-medium text-gray-900">{new Date().toLocaleDateString('es-ES')}</p>
          </div>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border border-green-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tasa de Conversión</p>
                <p className="text-3xl font-bold text-green-600">{conversionRate.toFixed(1)}%</p>
                <p className="text-xs text-green-600 mt-1">
                  {wonOpportunities} de {totalOpportunities} oportunidades
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Target className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-blue-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pipeline Activo</p>
                <p className="text-3xl font-bold text-blue-600">{inProgressOpportunities}</p>
                <p className="text-xs text-blue-600 mt-1">
                  {onHoldOpportunities} en espera
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-orange-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tiempo Promedio</p>
                <p className="text-3xl font-bold text-orange-600">{avgTimeInPipeline}</p>
                <p className="text-xs text-orange-600 mt-1">días en pipeline</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-red-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tasa de Pérdida</p>
                <p className="text-3xl font-bold text-red-600">{lossRate.toFixed(1)}%</p>
                <p className="text-xs text-red-600 mt-1">
                  {lostOpportunities} oportunidades perdidas
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Critical Alerts & Actions Needed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Opportunities Needing Attention */}
        <Card className="border border-amber-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center text-amber-700">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Oportunidades que Requieren Atención
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {staleOpportunities.length > 0 ? (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <AlertTriangle className="h-5 w-5 text-amber-600 mr-2" />
                      <div>
                        <p className="font-medium text-amber-800">{staleOpportunities.length} oportunidades sin actualizar</p>
                        <p className="text-sm text-amber-600">Más de 7 días sin actividad</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {staleOpportunities.slice(0, 5).map((opp) => (
                      <div key={opp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{opp.title}</p>
                          <p className="text-xs text-gray-500">{opp.company.name}</p>
                        </div>
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          {Math.floor((Date.now() - new Date(opp.updatedAt).getTime()) / (1000 * 60 * 60 * 24))} días
                        </Badge>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                  <p className="text-green-600 font-medium">¡Excelente!</p>
                  <p className="text-sm text-gray-500">Todas las oportunidades están al día</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Performers */}
        <Card className="border border-green-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center text-green-700">
              <Trophy className="mr-2 h-5 w-5" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topPerformers.length > 0 ? (
                topPerformers.map(([seller, count], index) => (
                  <div key={seller} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                        index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-amber-600'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="ml-3">
                        <p className="font-medium text-sm">{seller}</p>
                        <p className="text-xs text-gray-500">{count} oportunidades</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">{count}</p>
                      <p className="text-xs text-gray-500">
                        {totalOpportunities > 0 ? Math.round((count / totalOpportunities) * 100) : 0}%
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">No hay datos de vendedores</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Health */}
        <Card className="border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="mr-2 h-5 w-5" />
              Salud del Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Nuevas</span>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ 
                        width: `${totalOpportunities > 0 ? ((stats?.opportunitiesByStatus?.NEW || 0) / totalOpportunities) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                  <span className="text-sm font-semibold text-foreground min-w-[2rem]">
                    {stats?.opportunitiesByStatus?.NEW || 0}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">En Calificación</span>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-indigo-500 h-2 rounded-full" 
                      style={{ 
                        width: `${totalOpportunities > 0 ? ((stats?.opportunitiesByStatus?.QUALIFYING || 0) / totalOpportunities) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                  <span className="text-sm font-semibold text-foreground min-w-[2rem]">
                    {stats?.opportunitiesByStatus?.QUALIFYING || 0}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">En Propuesta</span>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-purple-500 h-2 rounded-full" 
                      style={{ 
                        width: `${totalOpportunities > 0 ? ((stats?.opportunitiesByStatus?.PROPOSAL || 0) / totalOpportunities) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                  <span className="text-sm font-semibold text-foreground min-w-[2rem]">
                    {stats?.opportunitiesByStatus?.PROPOSAL || 0}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">En Negociación</span>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-orange-500 h-2 rounded-full" 
                      style={{ 
                        width: `${totalOpportunities > 0 ? ((stats?.opportunitiesByStatus?.NEGOTIATION || 0) / totalOpportunities) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                  <span className="text-sm font-semibold text-foreground min-w-[2rem]">
                    {stats?.opportunitiesByStatus?.NEGOTIATION || 0}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">Total Pipeline</span>
                  <span className="text-2xl font-bold text-primary">{totalOpportunities}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company Portfolio */}
        <Card className="border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Building className="mr-2 h-5 w-5" />
              Portfolio de Empresas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Empresas Activas</span>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ 
                        width: `${companies.length > 0 ? ((stats?.activeCompanies || 0) / companies.length) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                  <span className="text-sm font-semibold text-green-600 min-w-[2rem]">
                    {stats?.activeCompanies || 0}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Leads</span>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ 
                        width: `${companies.length > 0 ? (companies.filter(c => c.status === 'LEAD').length / companies.length) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                  <span className="text-sm font-semibold text-blue-600 min-w-[2rem]">
                    {companies.filter(c => c.status === 'LEAD').length}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Inactivas</span>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gray-500 h-2 rounded-full" 
                      style={{ 
                        width: `${companies.length > 0 ? (companies.filter(c => c.status === 'INACTIVE').length / companies.length) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                  <span className="text-sm font-semibold text-gray-600 min-w-[2rem]">
                    {companies.filter(c => c.status === 'INACTIVE').length}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Bloqueadas</span>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-red-500 h-2 rounded-full" 
                      style={{ 
                        width: `${companies.length > 0 ? (companies.filter(c => c.status === 'BLOCKED').length / companies.length) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                  <span className="text-sm font-semibold text-red-600 min-w-[2rem]">
                    {companies.filter(c => c.status === 'BLOCKED').length}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">Total Empresas</span>
                  <span className="text-2xl font-bold text-primary">{companies.length}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Executive Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Key Insights */}
        <Card className="border border-blue-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center text-blue-700">
              <Eye className="mr-2 h-5 w-5" />
              Insights Clave
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-800">Rendimiento del Equipo</p>
                <p className="text-xs text-blue-600 mt-1">
                  {topPerformers.length > 0 ? 
                    `${topPerformers[0][0]} lidera con ${topPerformers[0][1]} oportunidades` : 
                    'No hay datos de rendimiento'
                  }
                </p>
              </div>
              
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm font-medium text-green-800">Estado del Pipeline</p>
                <p className="text-xs text-green-600 mt-1">
                  {inProgressOpportunities > 0 ? 
                    `${inProgressOpportunities} oportunidades en progreso` : 
                    'Pipeline vacío'
                  }
                </p>
              </div>
              
              <div className="p-3 bg-orange-50 rounded-lg">
                <p className="text-sm font-medium text-orange-800">Tiempo de Ciclo</p>
                <p className="text-xs text-orange-600 mt-1">
                  Promedio de {avgTimeInPipeline} días por oportunidad
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Items */}
        <Card className="border border-amber-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center text-amber-700">
              <Zap className="mr-2 h-5 w-5" />
              Acciones Requeridas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {staleOpportunities.length > 0 && (
                <div className="p-3 bg-amber-50 rounded-lg">
                  <p className="text-sm font-medium text-amber-800">Seguimiento Urgente</p>
                  <p className="text-xs text-amber-600 mt-1">
                    {staleOpportunities.length} oportunidades necesitan seguimiento inmediato
                  </p>
                </div>
              )}
              
              {onHoldOpportunities > 0 && (
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <p className="text-sm font-medium text-yellow-800">Oportunidades en Espera</p>
                  <p className="text-xs text-yellow-600 mt-1">
                    {onHoldOpportunities} oportunidades están en espera
                  </p>
                </div>
              )}
              
              {lossRate > 20 && (
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-sm font-medium text-red-800">Alta Tasa de Pérdida</p>
                  <p className="text-xs text-red-600 mt-1">
                    Tasa de pérdida del {lossRate.toFixed(1)}% - Revisar proceso de ventas
                  </p>
                </div>
              )}
              
              {staleOpportunities.length === 0 && onHoldOpportunities === 0 && lossRate <= 20 && (
                <div className="text-center py-4">
                  <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-green-600">¡Todo bajo control!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Performance Summary */}
        <Card className="border border-green-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center text-green-700">
              <TrendingUp className="mr-2 h-5 w-5" />
              Resumen de Rendimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{conversionRate.toFixed(1)}%</p>
                <p className="text-sm text-green-600">Tasa de Conversión</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-xl font-bold text-blue-600">{wonOpportunities}</p>
                  <p className="text-xs text-gray-500">Ganadas</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-red-600">{lostOpportunities}</p>
                  <p className="text-xs text-gray-500">Perdidas</p>
                </div>
              </div>
              
              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Actividades Hoy</span>
                  <span className="text-lg font-bold text-primary">{stats?.activitiesToday || 0}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
