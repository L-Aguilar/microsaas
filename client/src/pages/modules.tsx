import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Building, CheckCircle, XCircle, Settings, Users } from "lucide-react";
import type { CompanyWithRelations, Module, ModuleWithStatus } from "@shared/schema";

export default function ModulesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // For SUPER_ADMIN: get business accounts; for others: get companies
  const { data: businessAccounts, isLoading: businessAccountsLoading } = useQuery({
    queryKey: ["/api/business-accounts"],
    enabled: user?.role === 'SUPER_ADMIN',
  });

  const { data: companies, isLoading: companiesLoading } = useQuery<CompanyWithRelations[]>({
    queryKey: ["/api/companies"],
    enabled: user?.role !== 'SUPER_ADMIN',
  });

  const { data: modules, isLoading: modulesLoading } = useQuery<Module[]>({
    queryKey: ["/api/modules"],
  });

  // For Business Account modules (SUPER_ADMIN)
  const enableBusinessAccountModuleMutation = useMutation({
    mutationFn: async ({ businessAccountId, moduleId }: { businessAccountId: string; moduleId: string }) => {
      await apiRequest("POST", `/api/business-accounts/${businessAccountId}/modules/${moduleId}/enable`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-accounts"] });
      toast({
        title: "Módulo habilitado",
        description: "El módulo ha sido habilitado exitosamente para la organización.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo habilitar el módulo. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  const disableBusinessAccountModuleMutation = useMutation({
    mutationFn: async ({ businessAccountId, moduleId }: { businessAccountId: string; moduleId: string }) => {
      await apiRequest("POST", `/api/business-accounts/${businessAccountId}/modules/${moduleId}/disable`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-accounts"] });
      toast({
        title: "Módulo deshabilitado",
        description: "El módulo ha sido deshabilitado exitosamente para la organización.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo deshabilitar el módulo. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  // For Company modules (BUSINESS_PLAN)
  const enableCompanyModuleMutation = useMutation({
    mutationFn: async ({ companyId, moduleId }: { companyId: string; moduleId: string }) => {
      await apiRequest("POST", `/api/companies/${companyId}/modules/${moduleId}/enable`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({
        title: "Módulo habilitado",
        description: "El módulo ha sido habilitado exitosamente para la empresa.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo habilitar el módulo. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  const disableCompanyModuleMutation = useMutation({
    mutationFn: async ({ companyId, moduleId }: { companyId: string; moduleId: string }) => {
      await apiRequest("POST", `/api/companies/${companyId}/modules/${moduleId}/disable`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({
        title: "Módulo deshabilitado",
        description: "El módulo ha sido deshabilitado exitosamente para la empresa.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo deshabilitar el módulo. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  const getBusinessAccountModuleStatus = (businessAccount: any, moduleType: string): any => {
    return businessAccount.modules?.find((m: any) => m.type === moduleType) || null;
  };

  const getCompanyModuleStatus = (company: CompanyWithRelations, moduleType: string): ModuleWithStatus | null => {
    // Companies now use business account modules, so we check the business account
    return (company.businessAccount as any)?.modules?.find((m: any) => m.type === moduleType) || null;
  };

  const handleToggleBusinessAccountModule = async (businessAccountId: string, moduleId: string, isEnabled: boolean) => {
    if (isEnabled) {
      disableBusinessAccountModuleMutation.mutate({ businessAccountId, moduleId });
    } else {
      enableBusinessAccountModuleMutation.mutate({ businessAccountId, moduleId });
    }
  };

  const handleToggleCompanyModule = async (companyId: string, moduleId: string, isEnabled: boolean) => {
    if (isEnabled) {
      disableCompanyModuleMutation.mutate({ companyId, moduleId });
    } else {
      enableCompanyModuleMutation.mutate({ companyId, moduleId });
    }
  };

  const isLoading = user?.role === 'SUPER_ADMIN' 
    ? businessAccountsLoading || modulesLoading
    : companiesLoading || modulesLoading;

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center space-x-3">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="page-title">
            Configuración de Módulos
          </h1>
          <p className="text-muted-foreground">
            {user?.role === 'SUPER_ADMIN' 
              ? 'Gestiona qué módulos están habilitados para cada organización'
              : 'Gestiona qué módulos están habilitados para cada empresa'
            }
          </p>
        </div>
      </div>

      {user?.role === 'SUPER_ADMIN' ? (
        /* SUPER_ADMIN: Business Accounts Modules Management */
        <>
          {!businessAccounts || (businessAccounts as any[]).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No hay organizaciones registradas</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {(businessAccounts as any[]).map((businessAccount: any) => (
                <Card key={businessAccount.id} className="border border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <span data-testid={`business-account-name-${businessAccount.id}`}>
                          {businessAccount.name}
                        </span>
                        <Badge className={
                          businessAccount.isActive 
                            ? "bg-green-100 text-green-800 ml-2" 
                            : "bg-gray-100 text-gray-800 ml-2"
                        }>
                          {businessAccount.isActive ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </div>
                    </CardTitle>
                    <CardDescription>
                      <div className="flex items-center space-x-4">
                        <span>{businessAccount.contactEmail || 'Sin email asignado'}</span>
                        <div className="flex items-center space-x-1">
                          <Users className="h-4 w-4" />
                          <span>{businessAccount.users?.length || 0} usuarios</span>
                        </div>
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <h4 className="font-medium text-foreground">Módulos Disponibles</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {modules?.map((module) => {
                          const moduleStatus = getBusinessAccountModuleStatus(businessAccount, module.type);
                          const isEnabled = moduleStatus?.isEnabled || false;
                          
                          return (
                            <div
                              key={module.id}
                              className="flex items-center justify-between p-4 border border-border rounded-lg bg-card"
                            >
                              <div className="flex items-center space-x-3">
                                <div className={`w-3 h-3 rounded-full ${
                                  isEnabled ? 'bg-green-500' : 'bg-gray-300'
                                }`} />
                                <div>
                                  <h5 className="font-medium text-foreground">{module.name}</h5>
                                  <p className="text-sm text-muted-foreground">{module.description}</p>
                                </div>
                              </div>
                              <Button
                                variant={isEnabled ? "destructive" : "default"}
                                size="sm"
                                onClick={() => handleToggleBusinessAccountModule(businessAccount.id, module.id, isEnabled)}
                                disabled={enableBusinessAccountModuleMutation.isPending || disableBusinessAccountModuleMutation.isPending}
                                data-testid={`button-toggle-module-${module.type}-${businessAccount.id}`}
                              >
                                {isEnabled ? (
                                  <><XCircle className="h-4 w-4 mr-1" /> Deshabilitar</>
                                ) : (
                                  <><CheckCircle className="h-4 w-4 mr-1" /> Habilitar</>
                                )}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        /* BUSINESS_PLAN: Company Modules Management */
        <>
          {!companies?.length ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No hay empresas registradas</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {companies.map((company) => (
                <Card key={company.id} className="border border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <span data-testid={`company-name-${company.id}`}>{company.name}</span>
                        <Badge className={
                          company.status === 'ACTIVE' 
                            ? "bg-green-100 text-green-800 ml-2" 
                            : "bg-gray-100 text-gray-800 ml-2"
                        }>
                          {company.status === 'ACTIVE' ? 'Activa' : company.status}
                        </Badge>
                      </div>
                    </CardTitle>
                    <CardDescription>
                      {company.contactName && (
                        <span>Contacto: {company.contactName}</span>
                      )}
                      {company.email && (
                        <span className="ml-4">Email: {company.email}</span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <h4 className="font-medium text-foreground">Módulos Disponibles</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {modules?.map((module) => {
                          const moduleStatus = getCompanyModuleStatus(company, module.type);
                          const isEnabled = moduleStatus?.isEnabled || false;
                          
                          return (
                            <div
                              key={module.id}
                              className="flex items-center justify-between p-4 border border-border rounded-lg bg-card"
                            >
                              <div className="flex items-center space-x-3">
                                <div className={`w-3 h-3 rounded-full ${
                                  isEnabled ? 'bg-green-500' : 'bg-gray-300'
                                }`} />
                                <div>
                                  <h5 className="font-medium text-foreground">{module.name}</h5>
                                  <p className="text-sm text-muted-foreground">{module.description}</p>
                                </div>
                              </div>
                              <Button
                                variant={isEnabled ? "destructive" : "default"}
                                size="sm"
                                onClick={() => handleToggleCompanyModule(company.id, module.id, isEnabled)}
                                disabled={enableCompanyModuleMutation.isPending || disableCompanyModuleMutation.isPending}
                                data-testid={`button-toggle-module-${module.type}-${company.id}`}
                              >
                                {isEnabled ? (
                                  <><XCircle className="h-4 w-4 mr-1" /> Deshabilitar</>
                                ) : (
                                  <><CheckCircle className="h-4 w-4 mr-1" /> Habilitar</>
                                )}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}