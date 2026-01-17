import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Building, Users, Globe, ArrowRight, LogOut } from "lucide-react";
import { useLocation } from "wouter";
import { getCurrentThemeConfig } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

export default function OnboardingProfile() {
  const themeConfig = getCurrentThemeConfig();
  const [_, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const { logout } = useAuth();
  const [formData, setFormData] = useState({
    industry: "",
    employeeCount: "",
    website: ""
  });

  const industries = [
    "Tecnología",
    "Salud", 
    "Educación",
    "Finanzas",
    "Retail",
    "Manufactura",
    "Servicios",
    "Construcción",
    "Agricultura",
    "Turismo",
    "Medios",
    "Logística",
    "Inmobiliaria",
    "Consultoría",
    "Otro"
  ];

  const employeeCounts = [
    "1-10",
    "11-50",
    "51-200", 
    "201-500",
    "501-1000",
    "1000+"
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.industry || !formData.employeeCount) {
      alert("Por favor complete los campos requeridos");
      return;
    }

    setLoading(true);
    
    try {
      // Get business account ID from localStorage or auth context
      const user = JSON.parse(localStorage.getItem('crm_auth_user') || '{}');
      const businessAccountId = user.businessAccountId;
      
      if (!businessAccountId) {
        throw new Error("No se encontró la información de la empresa");
      }

      const response = await fetch("/api/onboarding/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessAccountId,
          industry: formData.industry,
          employeeCount: formData.employeeCount,
          website: formData.website || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al guardar el perfil");
      }

      console.log("✅ Profile saved successfully");
      setLocation("/onboarding/plans");
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("Error al guardar el perfil: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setShowLogoutDialog(true);
  };

  const confirmLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen w-full bg-gray-50">
      {/* Progress Steps - Top */}
      <div className="w-full bg-gradient-to-r from-brand-500 to-brand-700 py-8">
        <div className="max-w-2xl mx-auto px-8">
          <div className="text-white text-center mb-6">
            <h2 className="text-2xl font-bold mb-2">{themeConfig.name}</h2>
            <p className="text-white/90">Configuración inicial</p>
          </div>
          
          <div className="flex justify-center space-x-8">
            {/* Step 1 - Active */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-brand-600 font-bold">1</span>
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-white">Perfil de empresa</h3>
                <p className="text-white/80 text-sm">Información básica sobre tu negocio</p>
              </div>
            </div>
            
            {/* Step 2 */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white/60 font-bold">2</span>
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-white/60">Seleccionar plan</h3>
                <p className="text-white/50 text-sm">Elige el plan que mejor se adapte</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Centered */}
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="w-full max-w-lg relative">
          {/* Logout Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="absolute top-4 right-4 text-gray-500 hover:text-red-500"
          >
            <LogOut className="h-4 w-4" />
            <span className="ml-1">Salir</span>
          </Button>
          
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-brand-500 rounded-full flex items-center justify-center">
                <Building className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Perfil de tu empresa</CardTitle>
            <CardDescription>
              Cuéntanos más sobre tu empresa para personalizar tu experiencia
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="industry" className="text-sm font-medium">
                  Industria <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.industry}
                  onValueChange={(value) => setFormData({ ...formData, industry: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tu industria" />
                  </SelectTrigger>
                  <SelectContent>
                    {industries.map((industry) => (
                      <SelectItem key={industry} value={industry}>
                        {industry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="employeeCount" className="text-sm font-medium">
                  Número de empleados <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.employeeCount}
                  onValueChange={(value) => setFormData({ ...formData, employeeCount: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el tamaño de tu empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {employeeCounts.map((count) => (
                      <SelectItem key={count} value={count}>
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4" />
                          <span>{count} empleados</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website" className="text-sm font-medium">
                  Sitio web <span className="text-gray-400">(opcional)</span>
                </Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="website"
                    type="url"
                    placeholder="https://tu-empresa.com"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  "Guardando..."
                ) : (
                  <>
                    Continuar
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      
      {/* Logout Confirmation Dialog */}
      <ConfirmationDialog
        open={showLogoutDialog}
        onOpenChange={setShowLogoutDialog}
        title="Cerrar sesión"
        description="¿Estás seguro de que quieres cerrar sesión? Se perderá el progreso actual del onboarding y tendrás que empezar de nuevo."
        onConfirm={confirmLogout}
        confirmText="Sí, cerrar sesión"
        cancelText="Cancelar"
        variant="destructive"
      />
    </div>
  );
}