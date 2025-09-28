import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Plus, Bell, Building, Menu } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useSidebar } from "@/contexts/sidebar-context";

const getPageInfo = (user: any) => ({
  "/": {
    title: "Dashboard",
    description: user?.role === 'SUPER_ADMIN' 
      ? "Panel de administración de la plataforma"
      : "Gestiona tus oportunidades y actividades",
  },
  "/companies": {
    title: "Empresas",
    description: "Administra tu cartera de clientes y prospectos",
  },
  "/opportunities": {
    title: "Oportunidades",
    description: "Seguimiento del pipeline de ventas",
  },
  "/reports": {
    title: "Reportes",
    description: "Análisis y métricas de rendimiento",
  },
});

interface HeaderProps {
  onNewOpportunity?: () => void;
  onNewCompany?: () => void;
}

export default function Header({ onNewOpportunity, onNewCompany }: HeaderProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const { isMobile, toggleSidebar } = useSidebar();
  const pageInfo = getPageInfo(user);
  const currentPage = pageInfo[location as keyof typeof pageInfo] || pageInfo["/"];

  return (
    <header className="bg-background border-b border-border px-4 sm:px-6 lg:px-8 py-4 lg:py-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Mobile menu button */}
          {isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="lg:hidden"
              data-testid="button-mobile-menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground tracking-tight" data-testid="text-page-title">
              {currentPage.title}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1 hidden sm:block" data-testid="text-page-description">
              {currentPage.description}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-3">
          {location === "/" && user?.role !== 'SUPER_ADMIN' && (
            <>
              <Button 
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 sm:px-4 py-2 rounded-xl font-medium transition-smooth shadow-sm"
                onClick={onNewCompany}
                data-testid="button-new-company"
              >
                <Plus className="sm:mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Empresa</span>
              </Button>
              <Button 
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 sm:px-4 py-2 rounded-xl font-medium transition-smooth shadow-sm"
                onClick={onNewOpportunity}
                data-testid="button-new-opportunity"
              >
                <Plus className="sm:mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Oportunidad</span>
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground p-3 rounded-xl transition-smooth"
            data-testid="button-notifications"
          >
            <Bell className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
