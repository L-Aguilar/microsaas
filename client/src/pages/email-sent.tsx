import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartLine, Mail, ArrowLeft, Key } from "lucide-react";
import { Link } from "wouter";
import { getCurrentThemeConfig } from "@shared/schema";

export default function EmailSent() {
  const themeConfig = getCurrentThemeConfig();

  return (
    <div className="min-h-screen w-full flex bg-gray-50">
      {/* Left Column - Message */}
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                <Key className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">¡Cuenta creada exitosamente!</CardTitle>
            <CardDescription>
              Te hemos enviado tus credenciales de acceso por email
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                <strong>¡Tu empresa está registrada!</strong> Revisa tu email para encontrar tu 
                contraseña temporal y empezar a usar Controly.
              </p>
            </div>
            
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                Si no encuentras el email, revisa tu carpeta de spam o correo no deseado.
              </p>
              <p>
                <strong>Importante:</strong> Cambia tu contraseña después del primer inicio de sesión por seguridad.
              </p>
            </div>

            <div className="pt-4">
              <Link href="/login">
                <Button className="w-full">
                  <Key className="mr-2 h-4 w-4" />
                  Ir a Iniciar Sesión
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column - Informative Image */}
      <div className="flex-1 bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center p-8">
        <div className="text-white text-center max-w-md">
          <div className="mb-8">
            <div className="w-32 h-32 mx-auto mb-6 bg-white/20 rounded-full flex items-center justify-center">
              <ChartLine className="w-16 h-16" />
            </div>
            <h2 className="text-3xl font-bold mb-4">{themeConfig.name}</h2>
            <p className="text-xl text-white/90 mb-8">
              ¡Tu empresa ya está registrada!
            </p>
          </div>
          
          <div className="space-y-6 text-left">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-xs font-bold">1</span>
              </div>
              <div>
                <h3 className="font-semibold">Revisa tu email</h3>
                <p className="text-white/80 text-sm">Encuentra tu contraseña temporal</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-xs font-bold">2</span>
              </div>
              <div>
                <h3 className="font-semibold">Inicia sesión</h3>
                <p className="text-white/80 text-sm">Usa tus credenciales para acceder</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-xs font-bold">3</span>
              </div>
              <div>
                <h3 className="font-semibold">Haz crecer tu negocio</h3>
                <p className="text-white/80 text-sm">Gestiona clientes y oportunidades fácilmente</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}