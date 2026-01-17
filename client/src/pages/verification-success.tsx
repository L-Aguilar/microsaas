import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartLine, CheckCircle, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { getCurrentThemeConfig } from "@shared/schema";

export default function VerificationSuccess() {
  const themeConfig = getCurrentThemeConfig();

  return (
    <div className="min-h-screen w-full flex bg-gray-50">
      {/* Left Column - Success Message */}
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">¡Cuenta verificada!</CardTitle>
            <CardDescription>
              Tu email ha sido confirmado exitosamente
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                <strong>¡Bienvenido a {themeConfig.name}!</strong><br />
                Hemos enviado tu contraseña temporal a tu email.
              </p>
            </div>
            
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                Revisa tu bandeja de entrada para obtener tu contraseña temporal 
                e iniciar sesión por primera vez.
              </p>
              <p>
                <strong>Importante:</strong> Cambia tu contraseña temporal inmediatamente después 
                de iniciar sesión por seguridad.
              </p>
            </div>

            <div className="pt-4">
              <Link href="/login">
                <Button className="w-full">
                  Iniciar Sesión
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column - Next Steps */}
      <div className="flex-1 bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center p-8">
        <div className="text-white text-center max-w-md">
          <div className="mb-8">
            <div className="w-32 h-32 mx-auto mb-6 bg-white/20 rounded-full flex items-center justify-center">
              <ChartLine className="w-16 h-16" />
            </div>
            <h2 className="text-3xl font-bold mb-4">¡Todo listo!</h2>
            <p className="text-xl text-white/90 mb-8">
              Ahora puedes comenzar a usar {themeConfig.name}
            </p>
          </div>
          
          <div className="space-y-6 text-left">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-xs font-bold">✓</span>
              </div>
              <div>
                <h3 className="font-semibold">Cuenta creada</h3>
                <p className="text-white/80 text-sm">Tu empresa ya está registrada en el sistema</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-xs font-bold">✓</span>
              </div>
              <div>
                <h3 className="font-semibold">Email verificado</h3>
                <p className="text-white/80 text-sm">Tu dirección de email ha sido confirmada</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-white/30 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <ArrowRight className="w-3 h-3" />
              </div>
              <div>
                <h3 className="font-semibold">Siguiente: Configurar</h3>
                <p className="text-white/80 text-sm">Personaliza tu cuenta y comienza a gestionar</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}