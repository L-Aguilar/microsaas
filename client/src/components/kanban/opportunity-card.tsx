import { Calendar } from "lucide-react";
import { OpportunityWithRelations } from "@shared/schema";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface OpportunityCardProps {
  opportunity: OpportunityWithRelations;
}

export default function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", opportunity.id);
  };

  const getSellerInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getSellerColorClass = (sellerId: string) => {
    const colors = ['bg-blue-100 text-blue-600', 'bg-purple-100 text-purple-600', 'bg-green-100 text-green-600'];
    const index = sellerId.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div
      className="bg-background rounded-xl border border-border shadow-sm hover:shadow-md cursor-move transition-smooth p-4 group"
      draggable
      onDragStart={handleDragStart}
      data-testid={`opportunity-card-${opportunity.id}`}
    >
      {/* Card Title */}
      <h4 className="font-medium text-sm text-foreground mb-3 leading-snug group-hover:text-primary transition-colors" data-testid={`opportunity-title-${opportunity.id}`}>
        {opportunity.title}
      </h4>
      
      {/* Company */}
      <p className="text-xs text-muted-foreground mb-3 flex items-center" data-testid={`opportunity-company-${opportunity.id}`}>
        <span className="w-2 h-2 bg-primary/60 rounded-full mr-2"></span>
        {opportunity.company.name}
      </p>
      
      {/* Footer */}
      <div className="flex items-center justify-between">
        {/* Date */}
        <div className="flex items-center text-xs text-muted-foreground">
          <Calendar className="mr-1.5 h-3 w-3" />
          <span>
            {opportunity.estimatedCloseDate
              ? format(new Date(opportunity.estimatedCloseDate), "dd MMM", { locale: es })
              : "Sin fecha"
            }
          </span>
        </div>
        
        {/* Avatar */}
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium ${getSellerColorClass(opportunity.sellerId)}`}>
          {getSellerInitials(opportunity.seller.name)}
        </div>
      </div>
    </div>
  );
}
