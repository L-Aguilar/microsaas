import Sidebar from "./sidebar";
import Header from "./header";
import { useSidebar } from "@/contexts/sidebar-context";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: React.ReactNode;
  onNewOpportunity?: () => void;
  onNewCompany?: () => void;
}

export default function MainLayout({ children, onNewOpportunity, onNewCompany }: MainLayoutProps) {
  const { isCollapsed, isMobile, isOpen, closeSidebar } = useSidebar();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      {/* Mobile overlay */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}
      
      <main className={cn(
        "min-h-screen transition-all duration-300",
        !isMobile && (isCollapsed ? "ml-16" : "ml-64"),
        isMobile && "ml-0"
      )}>
        <Header onNewOpportunity={onNewOpportunity} onNewCompany={onNewCompany} />
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
