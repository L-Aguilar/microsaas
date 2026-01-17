import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Handshake, Building, CheckSquare, Plus, Users, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import KanbanBoard from "@/components/kanban/kanban-board";
import ActivityTimeline from "@/components/activity/activity-timeline";
import OpportunityForm from "@/components/forms/opportunity-form";
import CompanyForm from "@/components/forms/company-form";
import AlertsPanel from "@/components/alerts/alerts-panel";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { OpportunityWithRelations, CompanyWithRelations, DashboardStats } from "@shared/schema";

interface DashboardProps {
  showNewOpportunityModal?: boolean;
  setShowNewOpportunityModal?: (open: boolean) => void;
  showNewCompanyModal?: boolean;
  setShowNewCompanyModal?: (open: boolean) => void;
}

export default function Dashboard({ 
  showNewOpportunityModal = false, 
  setShowNewOpportunityModal = () => {},
  showNewCompanyModal = false,
  setShowNewCompanyModal = () => {}
}: DashboardProps = {}) {
  const { user } = useAuth();

  // SUPER_ADMIN sees platform-wide data
  const { data: businessAccounts = [] } = useQuery<any[]>({
    queryKey: ["/api/business-accounts"],
    enabled: user?.role === 'SUPER_ADMIN',
  });

  // All roles see organization-specific data
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/reports/stats"],
    enabled: !!user,
  });

  const { data: opportunities = [] } = useQuery<OpportunityWithRelations[]>({
    queryKey: ["/api/opportunities"],
    enabled: !!user,
  });

  const { data: companies = [] } = useQuery<CompanyWithRelations[]>({
    queryKey: ["/api/companies"],
    enabled: !!user,
  });

  // SUPER_ADMIN dashboard cards
  const superAdminStatsCards = [
    {
      title: "Cuentas de Negocio",
      value: businessAccounts.length.toLocaleString(),
      icon: Building,
      bgColor: "bg-blue-100",
      iconColor: "text-blue-600",
      testId: "stat-business-accounts",
    },
    {
      title: "Cuentas Activas",
      value: businessAccounts.filter((acc: any) => acc.isActive).length.toLocaleString(),
      icon: CheckSquare,
      bgColor: "bg-green-100",
      iconColor: "text-green-600",
      testId: "stat-active-accounts",
    },
    {
      title: "Total Usuarios",
      value: businessAccounts.reduce((sum: number, acc: any) => sum + acc.users.length, 0).toLocaleString(),
      icon: Users,
      bgColor: "bg-purple-100",
      iconColor: "text-purple-600",
      testId: "stat-total-users",
    },
  ];

  // Regular dashboard cards for BUSINESS_ADMIN and USER roles
  const regularStatsCards = [
    {
      title: "Oportunidades Ganadas",
      value: stats?.totalWon?.toLocaleString() || '0',
      icon: Trophy,
      bgColor: "bg-green-100",
      iconColor: "text-green-600",
      testId: "stat-won",
    },
    {
      title: "En Negociación",
      value: stats?.totalNegotiation?.toLocaleString() || '0',
      icon: Handshake,
      bgColor: "bg-blue-100",
      iconColor: "text-blue-600",
      testId: "stat-negotiation",
    },
    {
      title: "Empresas Activas",
      value: stats?.activeCompanies?.toLocaleString() || '0',
      icon: Building,
      bgColor: "bg-purple-100",
      iconColor: "text-purple-600",
      testId: "stat-companies",
    },
    {
      title: "Actividades Hoy",
      value: stats?.activitiesToday?.toLocaleString() || '0',
      icon: CheckSquare,
      bgColor: "bg-orange-100",
      iconColor: "text-orange-600",
      testId: "stat-activities",
    },
  ];

  const statsCards = user?.role === 'SUPER_ADMIN' ? superAdminStatsCards : regularStatsCards;

  return (
    <>
      <div className="space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {statsCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} className="bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-smooth">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-muted-foreground truncate">{stat.title}</p>
                      <p className="text-2xl sm:text-3xl font-bold text-foreground mt-2" data-testid={stat.testId}>
                        {stat.value}
                      </p>
                    </div>
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 ml-3">
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Content based on user role */}
        {user?.role === 'SUPER_ADMIN' ? (
          /* SUPER_ADMIN: Platform Overview */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {/* Business Accounts Overview */}
            <Card className="bg-card border border-border rounded-xl shadow-sm">
              <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-border">
                <h2 className="text-lg sm:text-xl font-semibold text-foreground">Cuentas de Negocio</h2>
                <p className="text-sm text-muted-foreground">Organizaciones en la plataforma</p>
              </div>
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-3 sm:space-y-4 max-h-80 overflow-y-auto">
                  {businessAccounts.map((account: any) => (
                    <div key={account.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-muted/50 rounded-lg space-y-2 sm:space-y-0">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground truncate">{account.name}</div>
                        <div className="text-sm text-muted-foreground truncate">{account.contactEmail || 'Sin email asignado'}</div>
                      </div>
                      <div className="flex items-center justify-between sm:flex-col sm:items-end sm:text-right">
                        <div className="text-sm font-medium text-foreground">
                          {account.users.length} usuarios
                        </div>
                        <div className={`text-xs px-2 py-1 rounded-full ${
                          account.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {account.isActive ? 'Activa' : 'Inactiva'}
                        </div>
                      </div>
                    </div>
                  ))}
                  {businessAccounts.length === 0 && (
                    <div className="text-center py-8">
                      <Building className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">No hay cuentas de negocio</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Platform Statistics */}
            <Card className="bg-card border border-border rounded-xl shadow-sm">
              <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-border">
                <h2 className="text-lg sm:text-xl font-semibold text-foreground">Estadísticas de la Plataforma</h2>
                <p className="text-sm text-muted-foreground">Resumen general del sistema</p>
              </div>
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-6">
                  {/* Active Business Accounts */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                        <span className="font-medium text-foreground">Cuentas Activas</span>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-green-600">
                          {businessAccounts.filter((acc: any) => acc.isActive).length}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({businessAccounts.length ? Math.round(businessAccounts.filter((acc: any) => acc.isActive).length / businessAccounts.length * 100) : 0}%)
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-muted/50 rounded-xl h-4 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-green-500 to-green-400 h-4 rounded-xl transition-all duration-700 ease-out shadow-sm" 
                        style={{ 
                          width: `${businessAccounts.length ? Math.round(businessAccounts.filter((acc: any) => acc.isActive).length / businessAccounts.length * 100) : 0}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Total Users */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
                        <span className="font-medium text-foreground">Total Usuarios</span>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-purple-600">
                          {businessAccounts.reduce((sum: number, acc: any) => sum + acc.users.length, 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Enabled Modules */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
                        <span className="font-medium text-foreground">Módulos Activos</span>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-orange-600">
                          {businessAccounts.reduce((sum: number, acc: any) => sum + acc.modules.filter((m: any) => m.isEnabled).length, 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Regular users: CRM Dashboard */
          <div>
            {/* Alerts Panel */}
            <AlertsPanel />

            {/* Kanban Board */}
            <KanbanBoard opportunities={opportunities} />

            {/* Recent Activities & Opportunities Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mt-6 lg:mt-8">
              <ActivityTimeline showBorder={true} />
              
              {/* Opportunities Statistics Chart */}
              <Card className="bg-card border border-border rounded-xl shadow-sm">
                <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-border">
                  <h2 className="text-lg sm:text-xl font-semibold text-foreground">Estadísticas de Oportunidades</h2>
                  <p className="text-sm text-muted-foreground">Distribución por estado</p>
                </div>
                <CardContent className="p-4 sm:p-6">
                  <div className="space-y-6">
                    {/* Won Opportunities */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                          <span className="font-medium text-foreground">Ganadas</span>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold text-green-600">{stats?.opportunitiesByStatus?.WON || 0}</span>
                          <span className="text-xs text-muted-foreground ml-1">
                            ({stats?.totalOpportunities ? Math.round((stats.opportunitiesByStatus?.WON || 0) / stats.totalOpportunities * 100) : 0}%)
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-muted/50 rounded-xl h-4 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-green-500 to-green-400 h-4 rounded-xl transition-all duration-700 ease-out shadow-sm" 
                          style={{ 
                            width: `${stats?.totalOpportunities ? Math.round((stats.opportunitiesByStatus?.WON || 0) / stats.totalOpportunities * 100) : 0}%`,
                          }}
                        ></div>
                      </div>
                    </div>

                    {/* In Progress */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                          <span className="font-medium text-foreground">En Progreso</span>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold text-blue-600">
                            {((stats?.opportunitiesByStatus?.NEW || 0) + 
                              (stats?.opportunitiesByStatus?.QUALIFYING || 0) + 
                              (stats?.opportunitiesByStatus?.PROPOSAL || 0))}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">
                            ({stats?.totalOpportunities ? Math.round(((stats?.opportunitiesByStatus?.NEW || 0) + (stats?.opportunitiesByStatus?.QUALIFYING || 0) + (stats?.opportunitiesByStatus?.PROPOSAL || 0)) / stats.totalOpportunities * 100) : 0}%)
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-muted/50 rounded-xl h-4 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-blue-400 h-4 rounded-xl transition-all duration-700 ease-out shadow-sm" 
                          style={{ 
                            width: `${stats?.totalOpportunities ? Math.round(((stats?.opportunitiesByStatus?.NEW || 0) + (stats?.opportunitiesByStatus?.QUALIFYING || 0) + (stats?.opportunitiesByStatus?.PROPOSAL || 0)) / stats.totalOpportunities * 100) : 0}%`,
                          }}
                        ></div>
                      </div>
                    </div>

                    {/* Lost Opportunities */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                          <span className="font-medium text-foreground">Perdidas</span>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold text-red-600">{stats?.opportunitiesByStatus?.LOST || 0}</span>
                          <span className="text-xs text-muted-foreground ml-1">
                            ({stats?.totalOpportunities ? Math.round((stats.opportunitiesByStatus?.LOST || 0) / stats.totalOpportunities * 100) : 0}%)
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-muted/50 rounded-xl h-4 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-red-500 to-red-400 h-4 rounded-xl transition-all duration-700 ease-out shadow-sm" 
                          style={{ 
                            width: `${stats?.totalOpportunities ? Math.round((stats.opportunitiesByStatus?.LOST || 0) / stats.totalOpportunities * 100) : 0}%`,
                          }}
                        ></div>
                      </div>
                    </div>

                    {/* Total */}
                    <div className="pt-4 border-t border-border">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">Total de Oportunidades</span>
                        <span className="text-2xl font-bold text-primary">{stats?.totalOpportunities || 0}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* New Opportunity Modal */}
      <Dialog open={showNewOpportunityModal} onOpenChange={setShowNewOpportunityModal}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[95vh] overflow-y-auto">
          <OpportunityForm 
            onSuccess={() => setShowNewOpportunityModal(false)}
            onCancel={() => setShowNewOpportunityModal(false)} 
          />
        </DialogContent>
      </Dialog>

      {/* New Company Modal */}
      <Dialog open={showNewCompanyModal} onOpenChange={setShowNewCompanyModal}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[95vh] overflow-y-auto">
          <CompanyForm 
            onSuccess={() => setShowNewCompanyModal(false)}
            onCancel={() => setShowNewCompanyModal(false)} 
          />
        </DialogContent>
      </Dialog>
    </>
  );
}