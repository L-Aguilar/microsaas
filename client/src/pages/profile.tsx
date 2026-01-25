import React from 'react';
import { ProfileForm } from '@/components/forms/ProfileForm';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Settings, Shield, Calendar, MapPin, Phone, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ProfilePage() {
  const { user } = useAuth();

  const getRoleInfo = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return {
          label: 'Super Administrador',
          description: 'Acceso completo al sistema',
          color: 'bg-red-100 text-red-800',
          icon: Shield
        };
      case 'BUSINESS_ADMIN':
        return {
          label: 'Administrador de Empresa',
          description: 'Gestión completa de la empresa',
          color: 'bg-purple-100 text-purple-800',
          icon: Settings
        };
      case 'USER':
        return {
          label: 'Usuario',
          description: 'Acceso a módulos asignados',
          color: 'bg-blue-100 text-blue-800',
          icon: User
        };
      default:
        return {
          label: role,
          description: '',
          color: 'bg-gray-100 text-gray-800',
          icon: User
        };
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  const roleInfo = getRoleInfo(user.role);
  const RoleIcon = roleInfo.icon;

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center gap-2">
          <User className="h-6 w-6 text-brand-600" />
          <h1 className="text-3xl font-bold text-foreground">Mi Perfil</h1>
        </div>
        <p className="text-muted-foreground">
          Administra tu información personal y configuración de cuenta
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Overview Card */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader className="text-center pb-3">
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full bg-gradient-to-r from-brand-400 to-brand-600 flex items-center justify-center text-white text-2xl font-bold">
                    {user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 h-6 w-6 rounded-full ${roleInfo.color} flex items-center justify-center`}>
                    <RoleIcon className="h-3 w-3" />
                  </div>
                </div>
              </div>
              <CardTitle className="text-xl">{user.name}</CardTitle>
              <CardDescription className="text-sm">{user.email}</CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Role Badge */}
              <div className="text-center">
                <Badge className={`${roleInfo.color} px-3 py-1`}>
                  <RoleIcon className="h-3 w-3 mr-1" />
                  {roleInfo.label}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  {roleInfo.description}
                </p>
              </div>

              {/* Account Info */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium truncate">{user.email}</span>
                </div>
                
                {user.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Teléfono:</span>
                    <span className="font-medium">{user.phone}</span>
                  </div>
                )}

                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Miembro desde:</span>
                  <span className="font-medium">
                    {format(new Date(user.createdAt), 'MMM yyyy', { locale: es })}
                  </span>
                </div>

                {user.businessAccountId && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Empresa:</span>
                    <span className="font-medium">
                      {user.businessAccountId}
                    </span>
                  </div>
                )}
              </div>

              {/* Account Status */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Estado de la cuenta:</span>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <div className="h-2 w-2 rounded-full bg-green-500 mr-1"></div>
                    Activo
                  </Badge>
                </div>
                {user.lastPasswordChange && (
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-muted-foreground">Última actualización:</span>
                    <span className="font-medium text-xs">
                      {format(new Date(user.lastPasswordChange), 'dd/MM/yyyy', { locale: es })}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profile Form */}
        <div className="lg:col-span-2">
          <ProfileForm />
        </div>
      </div>
    </div>
  );
}