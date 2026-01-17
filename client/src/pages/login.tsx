import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { ChartLine, Loader2, Eye, EyeOff, HelpCircle, Building2, User, Mail, Phone, RefreshCw } from "lucide-react";
import PhoneInput from "@/components/ui/phone-input";
import { getCurrentThemeConfig } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

type FormMode = 'login' | 'register' | 'recovery' | 'reactivate';

interface ReactivationData {
  userId: string;
  companyName: string;
  message: string;
}

export default function Login() {
  const [mode, setMode] = useState<FormMode>('login');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Registration fields
  const [companyName, setCompanyName] = useState("");
  const [responsibleName, setResponsibleName] = useState("");
  const [phone, setPhone] = useState("");
  const [isRegisterPending, setIsRegisterPending] = useState(false);
  
  // Reactivation fields
  const [reactivationData, setReactivationData] = useState<ReactivationData | null>(null);
  const [isReactivatePending, setIsReactivatePending] = useState(false);
  
  const [, setLocation] = useLocation();
  const { user, login, isLoginPending } = useAuth();
  const { toast } = useToast();
  const themeConfig = getCurrentThemeConfig();

  // Redirect to dashboard if user is already logged in
  useEffect(() => {
    if (user && !isLoginPending) {
      console.log("🚀 Redirecting user to dashboard:", user.role);
      setLocation("/");
    }
  }, [user, isLoginPending, setLocation]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ email, password });
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegisterPending(true);
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          responsibleName,
          email,
          phone
        })
      });

      if (response.ok) {
        setLocation('/email-sent');
      } else {
        const error = await response.json();
        console.error('Registration error:', error);
        
        // Check if this is a reactivation scenario (status 422)
        if (response.status === 422 && error.canReactivate) {
          console.log('🔄 Reactivation available for user:', error);
          setReactivationData({
            userId: error.userId,
            companyName: error.companyName,
            message: error.message
          });
          setMode('reactivate');
        } else {
          // Show error toast for other errors
          toast({
            title: "Error",
            description: error.message || "Error al registrar",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast({
        title: "Error",
        description: "Error de conexión. Intenta nuevamente",
        variant: "destructive",
      });
    } finally {
      setIsRegisterPending(false);
    }
  };

  const handleReactivateAccount = async () => {
    if (!reactivationData) return;
    
    setIsReactivatePending(true);
    
    try {
      const response = await fetch('/api/auth/reactivate-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: reactivationData.userId
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Account reactivated:', result);
        
        // Store JWT token and user data (similar to login)
        const { setStoredJwtToken, setStoredUser } = await import("@/lib/auth");
        setStoredJwtToken(result.token);
        setStoredUser(result.user);
        
        toast({
          title: "Cuenta reactivada",
          description: result.message || "Tu cuenta ha sido reactivada exitosamente",
        });
        
        // Redirect to dashboard
        setLocation('/');
      } else {
        const error = await response.json();
        console.error('Reactivation error:', error);
        toast({
          title: "Error",
          description: error.message || "Error al reactivar la cuenta",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Reactivation error:', error);
      toast({
        title: "Error",
        description: "Error de conexión. Intenta nuevamente",
        variant: "destructive",
      });
    } finally {
      setIsReactivatePending(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setCompanyName("");
    setResponsibleName("");
    setPhone("");
    setShowPassword(false);
    setReactivationData(null);
  };

  const switchMode = (newMode: FormMode) => {
    setMode(newMode);
    resetForm();
  };


  const renderLoginForm = () => (
    <form onSubmit={handleLoginSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          data-testid="input-email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">Contraseña</Label>
        <div className="relative">
          <Input
            id="login-password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            data-testid="input-password"
            className="pr-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={() => setShowPassword(!showPassword)}
            data-testid="button-toggle-password"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>
      </div>
      <Button 
        type="submit" 
        className="w-full" 
        disabled={isLoginPending}
        data-testid="button-login"
      >
        {isLoginPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Iniciando sesión...
          </>
        ) : (
          "Iniciar Sesión"
        )}
      </Button>
      
      <div className="space-y-2 text-center">
        <Button 
          type="button"
          variant="ghost" 
          className="text-sm text-muted-foreground hover:text-brand-500"
          onClick={() => switchMode('recovery')}
        >
          <HelpCircle className="mr-2 h-4 w-4" />
          ¿Olvidaste tu contraseña?
        </Button>
        <div className="text-sm text-muted-foreground">
          ¿No tienes cuenta?{" "}
          <Button
            type="button"
            variant="link"
            className="p-0 h-auto text-brand-500 hover:text-brand-600"
            onClick={() => switchMode('register')}
          >
            Regístrate aquí
          </Button>
        </div>
      </div>
    </form>
  );

  const renderRegisterForm = () => (
    <form onSubmit={handleRegisterSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="company-name">
          <Building2 className="inline w-4 h-4 mr-1" />
          Nombre de la empresa
        </Label>
        <Input
          id="company-name"
          type="text"
          placeholder="Mi Empresa S.A."
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="responsible-name">
          <User className="inline w-4 h-4 mr-1" />
          Nombre del responsable
        </Label>
        <Input
          id="responsible-name"
          type="text"
          placeholder="Juan Pérez"
          value={responsibleName}
          onChange={(e) => setResponsibleName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-email">
          <Mail className="inline w-4 h-4 mr-1" />
          Email del responsable
        </Label>
        <Input
          id="register-email"
          type="email"
          placeholder="juan@miempresa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <PhoneInput
        id="phone"
        label="Teléfono del responsable"
        icon={<Phone className="w-4 h-4" />}
        placeholder="123 456 7890"
        value={phone}
        onChange={setPhone}
        required
      />

      <Button 
        type="submit" 
        className="w-full" 
        disabled={isRegisterPending}
      >
        {isRegisterPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creando cuenta...
          </>
        ) : (
          "Crear Cuenta"
        )}
      </Button>
      
      <div className="text-center">
        <div className="text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Button
            type="button"
            variant="link"
            className="p-0 h-auto text-brand-500 hover:text-brand-600"
            onClick={() => switchMode('login')}
          >
            Inicia sesión aquí
          </Button>
        </div>
      </div>
    </form>
  );

  const renderRecoveryForm = () => (
    <form className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="recovery-email">Email</Label>
        <Input
          id="recovery-email"
          type="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full">
        Enviar enlace de recuperación
      </Button>
      
      <div className="text-center">
        <div className="text-sm text-muted-foreground">
          ¿Recordaste tu contraseña?{" "}
          <Button
            type="button"
            variant="link"
            className="p-0 h-auto text-brand-500 hover:text-brand-600"
            onClick={() => switchMode('login')}
          >
            Volver al login
          </Button>
        </div>
      </div>
    </form>
  );

  const renderReactivateForm = () => (
    <div className="space-y-4">
      {reactivationData && (
        <>
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
              <RefreshCw className="w-8 h-8 text-orange-500" />
            </div>
            <p className="text-sm text-muted-foreground">
              {reactivationData.message}
            </p>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="font-medium text-gray-700">
                Empresa: {reactivationData.companyName}
              </p>
              <p className="text-sm text-gray-500">
                Email: {email}
              </p>
            </div>
          </div>
          
          <Button 
            type="button"
            onClick={handleReactivateAccount}
            className="w-full" 
            disabled={isReactivatePending}
          >
            {isReactivatePending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reactivando cuenta...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reactivar mi cuenta
              </>
            )}
          </Button>
          
          <div className="text-center">
            <div className="text-sm text-muted-foreground">
              ¿Prefieres crear una cuenta nueva?{" "}
              <Button
                type="button"
                variant="link"
                className="p-0 h-auto text-brand-500 hover:text-brand-600"
                onClick={() => switchMode('register')}
              >
                Volver al registro
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const getFormTitle = () => {
    switch (mode) {
      case 'login': return 'Iniciar Sesión';
      case 'register': return 'Crear Cuenta';
      case 'recovery': return 'Recuperar Contraseña';
      case 'reactivate': return 'Reactivar Cuenta';
    }
  };

  const getFormDescription = () => {
    switch (mode) {
      case 'login': return 'Ingresa tus credenciales para acceder';
      case 'register': return 'Registra tu empresa para comenzar';
      case 'recovery': return 'Te enviaremos un enlace para restablecer tu contraseña';
      case 'reactivate': return 'Tu empresa fue eliminada, pero puedes reactivarla';
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-gray-50">
      {/* Left Column - Forms */}
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-brand-500 rounded-lg flex items-center justify-center">
                <ChartLine className="h-6 w-6 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">{getFormTitle()}</CardTitle>
            <CardDescription>{getFormDescription()}</CardDescription>
          </CardHeader>
          <CardContent>
            {mode === 'login' && renderLoginForm()}
            {mode === 'register' && renderRegisterForm()}
            {mode === 'recovery' && renderRecoveryForm()}
            {mode === 'reactivate' && renderReactivateForm()}
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
              La plataforma integral para gestionar tu negocio
            </p>
          </div>
          
          <div className="space-y-6 text-left">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <User className="w-3 h-3" />
              </div>
              <div>
                <h3 className="font-semibold">Gestión de Usuarios</h3>
                <p className="text-white/80 text-sm">Administra tu equipo y colaboradores</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <Building2 className="w-3 h-3" />
              </div>
              <div>
                <h3 className="font-semibold">Base de Contactos</h3>
                <p className="text-white/80 text-sm">Centraliza toda tu información de clientes</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <ChartLine className="w-3 h-3" />
              </div>
              <div>
                <h3 className="font-semibold">CRM Avanzado</h3>
                <p className="text-white/80 text-sm">Convierte oportunidades en ventas</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
