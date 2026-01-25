import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  Shield, 
  Activity, 
  BarChart3, 
  Target, 
  Award, 
  TrendingUp, 
  Clock,
  Users,
  Building,
  Zap,
  Eye,
  Edit,
  Trash2,
  Plus,
  LogIn,
  Monitor,
  MapPin,
  ArrowLeft
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";
import { useModulePermissions } from "@/hooks/use-module-permissions";

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  createdAt?: string;
}

interface UserPermissions {
  USERS?: {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
  CONTACTS?: {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
  CRM?: {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
}

interface UserMetrics {
  totalOpportunities: number;
  wonOpportunities: number;
  lostOpportunities: number;
  inProgressOpportunities: number;
  conversionRate: number;
  activitiesThisWeek: number;
  totalActivities: number;
  totalContacts: number;
  contactsThisMonth: number;
}

interface LoginLog {
  id: string;
  loginTime: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  logoutTime?: string;
}

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const [, setLocation] = useLocation();
  const { user: currentUser } = useAuth();
  const { canView } = useModulePermissions('USERS');

  // Load user data
  const { data: user, isLoading: userLoading } = useQuery<UserData>({
    queryKey: ["/api/users", userId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/users/${userId}`);
      return await response.json();
    },
    enabled: !!userId,
  });

  // Load user permissions
  const { data: permissions, isLoading: permissionsLoading } = useQuery<UserPermissions>({
    queryKey: ["/api/users", userId, "permissions"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/users/${userId}/permissions`);
      return await response.json();
    },
    enabled: !!userId,
  });

  // Load user metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery<UserMetrics>({
    queryKey: ["/api/users", userId, "metrics"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/users/${userId}/metrics`);
      const data = await response.json();
      return data.metrics;
    },
    enabled: !!userId,
  });

  // Load login logs
  const { data: loginLogs = [], isLoading: logsLoading } = useQuery<LoginLog[]>({
    queryKey: ["/api/users", userId, "login-logs"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/users/${userId}/login-logs`);
      return await response.json();
    },
    enabled: !!userId,
  });

  const isLoading = userLoading || permissionsLoading || metricsLoading || logsLoading;

  // Access control - Use permission-based validation instead of hardcoded roles
  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Acceso Restringido</h2>
          <p className="text-muted-foreground">No tienes permisos para ver perfiles de usuario</p>
        </div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Usuario no encontrado</h2>
          <p className="text-muted-foreground">El ID de usuario no es válido</p>
        </div>
      </div>
    );
  }

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

  const getPermissionIcon = (permission: string) => {
    switch (permission) {
      case 'canView':
        return <Eye className="h-4 w-4" />;
      case 'canCreate':
        return <Plus className="h-4 w-4" />;
      case 'canEdit':
        return <Edit className="h-4 w-4" />;
      case 'canDelete':
        return <Trash2 className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  const getPermissionLabel = (permission: string) => {
    switch (permission) {
      case 'canView':
        return 'Ver';
      case 'canCreate':
        return 'Crear';
      case 'canEdit':
        return 'Editar';
      case 'canDelete':
        return 'Eliminar';
      default:
        return permission;
    }
  };

  const getModuleIcon = (module: string) => {
    switch (module) {
      case 'USERS':
        return <Users className="h-5 w-5" />;
      case 'CONTACTS':
        return <Building className="h-5 w-5" />;
      case 'CRM':
        return <Activity className="h-5 w-5" />;
      default:
        return <Shield className="h-5 w-5" />;
    }
  };

  const getModuleLabel = (module: string) => {
    switch (module) {
      case 'USERS':
        return 'Usuarios';
      case 'CONTACTS':
        return 'Contactos';
      case 'CRM':
        return 'CRM';
      default:
        return module;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Usuario no encontrado</h2>
          <p className="text-muted-foreground">El usuario solicitado no existe</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/users")}
            className="h-8"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver a Usuarios
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Perfil de Usuario</h1>
            <p className="text-muted-foreground mt-1">{user.name}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - User Info and Permissions */}
        <div className="lg:col-span-2 space-y-6">
          {/* User Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Información Personal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Nombre</p>
                      <p className="font-semibold">{user.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Email</p>
                      <p>{user.email}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Teléfono</p>
                      <p>{user.phone || 'No especificado'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Rol</p>
                      <Badge className={getRoleColor(user.role)}>
                        {getRoleLabel(user.role)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
              {user.createdAt && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Fecha de registro</p>
                      <p>{format(new Date(user.createdAt), "PPP", { locale: es })}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Permissions */}
          {permissions && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Permisos por Módulo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(permissions).map(([module, modulePerms]) => (
                    <div key={module} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        {getModuleIcon(module)}
                        <h3 className="font-semibold">{getModuleLabel(module)}</h3>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(modulePerms).map(([permission, granted]) => (
                          <div key={permission} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                            granted ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'
                          }`}>
                            {getPermissionIcon(permission)}
                            <span className="text-sm font-medium">
                              {getPermissionLabel(permission)}
                            </span>
                            {granted ? (
                              <span className="text-green-600">✓</span>
                            ) : (
                              <span className="text-gray-400">✗</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column - Metrics and Logs */}
        <div className="space-y-6">
          {/* Metrics */}
          {metrics && user.role === 'USER' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Métricas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-5 w-5 text-blue-600" />
                      <span className="text-sm font-medium text-blue-700">Oportunidades</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-800">{metrics.totalOpportunities}</p>
                    <p className="text-xs text-blue-600">Total</p>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-medium text-green-700">Ganadas</span>
                    </div>
                    <p className="text-2xl font-bold text-green-800">{metrics.wonOpportunities}</p>
                    <p className="text-xs text-green-600">Cerradas exitosamente</p>
                  </div>

                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-5 w-5 text-purple-600" />
                      <span className="text-sm font-medium text-purple-700">Tasa de Cierre</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-800">{metrics.conversionRate.toFixed(1)}%</p>
                    <p className="text-xs text-purple-600">Efectividad</p>
                  </div>

                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="h-5 w-5 text-orange-600" />
                      <span className="text-sm font-medium text-orange-700">Actividades</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-800">{metrics.activitiesThisWeek}</p>
                    <p className="text-xs text-orange-600">Esta semana</p>
                  </div>

                  {permissions?.CONTACTS?.canView && (
                    <div className="bg-cyan-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Building className="h-5 w-5 text-cyan-600" />
                        <span className="text-sm font-medium text-cyan-700">Contactos</span>
                      </div>
                      <p className="text-2xl font-bold text-cyan-800">{metrics.totalContacts}</p>
                      <p className="text-xs text-cyan-600">Total registrados</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Login Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogIn className="h-5 w-5" />
                Historial de Acceso
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loginLogs.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">
                  No hay registros de acceso disponibles
                </p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {loginLogs.slice(0, 10).map((log) => (
                    <div key={log.id} className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`p-1 rounded-full ${
                          log.success ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          <LogIn className={`h-3 w-3 ${
                            log.success ? 'text-green-600' : 'text-red-600'
                          }`} />
                        </div>
                        <Badge variant={log.success ? "default" : "destructive"} className="text-xs">
                          {log.success ? "Exitoso" : "Fallido"}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium">
                        {format(new Date(log.loginTime), "PPP 'a las' p", { locale: es })}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span>{log.ipAddress}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Monitor className="h-3 w-3" />
                        <span className="truncate">
                          {log.userAgent.split(' ')[0]}
                        </span>
                      </div>
                      {log.logoutTime && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Salió: {format(new Date(log.logoutTime), "p", { locale: es })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}