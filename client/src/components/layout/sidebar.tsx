import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useSidebar } from "@/contexts/sidebar-context";
import { useBusinessAccountHasModule } from "@/hooks/use-modules";
import { ChartLine, ChartPie, Building, Target, BarChart3, LogOut, Users, Menu, Settings, User, ChevronDown, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getCurrentThemeConfig } from "@shared/theme-config";

const getNavigationForRole = (userRole: string, hasUsersModule: boolean, hasCompaniesModule: boolean, hasCRMModule: boolean) => {
  const baseNavigation = [
    { name: "Dashboard", href: "/", icon: ChartPie },
  ];

  // SUPER_ADMIN has different navigation
  if (userRole === 'SUPER_ADMIN') {
    baseNavigation.push(
      { name: "Cuentas de Negocio", href: "/business-accounts", icon: Building },
      { name: "Recordatorios", href: "/reminders", icon: Bell }
    );
    return baseNavigation;
  }

  // For BUSINESS_PLAN and USER roles - Module-based navigation
  // Only show features if business account has the respective modules enabled
  
  // Users module (only for BUSINESS_PLAN)
  if (userRole === 'BUSINESS_PLAN' && hasUsersModule) {
    baseNavigation.push(
      { name: "Usuarios", href: "/users", icon: Users }
    );
  }

  // Companies module
  if (hasCompaniesModule) {
    baseNavigation.push(
      { name: "Empresas", href: "/companies", icon: Building }
    );
  }

  // CRM module
  if (hasCRMModule) {
    baseNavigation.push(
      { name: "Oportunidades", href: "/opportunities", icon: Target },
      { name: "Reportes", href: "/reports", icon: BarChart3 }
    );
  }

  // Remove modules management from BUSINESS_PLAN sidebar

  return baseNavigation;
};

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { isCollapsed, isMobile, isOpen, toggleSidebar, closeSidebar } = useSidebar();
  const { hasModule: hasUsersModule } = useBusinessAccountHasModule('USERS');
  const { hasModule: hasCompaniesModule } = useBusinessAccountHasModule('COMPANIES');
  const { hasModule: hasCRMModule } = useBusinessAccountHasModule('CRM');
  const themeConfig = getCurrentThemeConfig();

  const handleLogout = () => {
    logout();
  };

  const handleLinkClick = () => {
    if (isMobile) {
      closeSidebar();
    }
  };

  if (!user) return null;

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 bg-background border-r border-border transition-all duration-300",
      // Desktop behavior
      "lg:z-30",
      !isMobile && (isCollapsed ? "w-16" : "w-64"),
      // Mobile behavior
      "lg:translate-x-0",
      isMobile && "z-50 w-64",
      isMobile && (isOpen ? "translate-x-0" : "-translate-x-full")
    )}>
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center px-4 py-6 border-b border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="w-8 h-8 p-0 mr-2"
            data-testid="button-toggle-sidebar"
          >
            <Menu className="h-4 w-4" />
          </Button>
          {(!isMobile && isCollapsed) ? null : (
            <>
              <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center">
                <ChartLine className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="ml-3 text-lg font-semibold text-foreground tracking-tight">{themeConfig.name}</span>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-8 space-y-1">
          {getNavigationForRole(user.role, hasUsersModule, hasCompaniesModule, hasCRMModule).map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={handleLinkClick}
                className={cn(
                  "group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
                data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Icon
                  className={cn(
                    "flex-shrink-0 w-5 h-5 transition-colors duration-200",
                    (!isMobile && isCollapsed) ? "" : "mr-3"
                  )}
                  aria-hidden="true"
                />
                {(!isMobile && isCollapsed) ? null : item.name}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="flex flex-col border-t border-border">
          <div className="px-4 py-4">
            {(!isMobile && isCollapsed) ? null : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between p-2 h-auto hover:bg-accent"
                  >
                    <div className="flex flex-col items-start">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Cuenta
                      </p>
                      <p className="text-sm font-medium text-foreground truncate">
                        {user.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <Link href="/account" onClick={handleLinkClick}>
                      <User className="mr-2 h-4 w-4" />
                      Mi Cuenta
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleLogout}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar Sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {(!isMobile && isCollapsed) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors px-2"
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}