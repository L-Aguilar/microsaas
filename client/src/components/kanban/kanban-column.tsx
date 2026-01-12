import { useState } from "react";
import { OpportunityWithRelations } from "@shared/schema";
import OpportunityCard from "./opportunity-card";

interface KanbanColumnProps {
  title: string;
  status: string;
  color: string;
  opportunities: OpportunityWithRelations[];
  onDrop: (opportunityId: string, newStatus: string) => void;
}

export default function KanbanColumn({ title, status, color, opportunities, onDrop }: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const opportunityId = e.dataTransfer.getData("text/plain");
    if (opportunityId) {
      onDrop(opportunityId, status);
    }
  };

  const colorClasses = {
    purple: "bg-purple-100 text-purple-800",
    blue: "bg-blue-100 text-blue-800",
    yellow: "bg-yellow-100 text-yellow-800",
    orange: "bg-orange-100 text-orange-800",
    green: "bg-green-100 text-green-800",
    red: "bg-red-100 text-red-800",
  };

  return (
    <div 
      className={`flex flex-col w-72 sm:w-80 min-w-[18rem] sm:min-w-80 bg-muted/30 rounded-xl p-3 transition-smooth ${
        isDragOver ? 'bg-muted/60 ring-2 ring-primary/20' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-testid={`kanban-column-${status.toLowerCase()}`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3 px-2">
        <h3 className="font-semibold text-sm text-foreground">{title}</h3>
        <span className={`${colorClasses[color as keyof typeof colorClasses]} text-xs font-medium px-2 py-1 rounded-lg`}>
          {opportunities.length}
        </span>
      </div>
      
      {/* Scrollable Cards Container */}
      <div className="flex-1 overflow-y-auto max-h-[calc(100vh-320px)] sm:max-h-[calc(100vh-280px)] space-y-3 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        {opportunities.map((opportunity) => (
          <OpportunityCard key={opportunity.id} opportunity={opportunity} />
        ))}
        
        {/* Empty state */}
        {opportunities.length === 0 && (
          <div className="flex items-center justify-center h-20 text-muted-foreground text-sm border-2 border-dashed border-border rounded-lg">
            Suelta aquí las tarjetas
          </div>
        )}
      </div>
    </div>
  );
}
