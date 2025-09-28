import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { OpportunityWithRelations } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import KanbanColumn from "./kanban-column";

interface KanbanBoardProps {
  opportunities: OpportunityWithRelations[];
}

const statusColumns = [
  { id: "NEW", title: "Nuevas", color: "purple" },
  { id: "QUALIFYING", title: "Calificación", color: "blue" },
  { id: "PROPOSAL", title: "Propuesta", color: "yellow" },
  { id: "NEGOTIATION", title: "Negociación", color: "orange" },
  { id: "WON", title: "Ganadas", color: "green" },
  { id: "LOST", title: "Perdidas", color: "red" },
];

export default function KanbanBoard({ opportunities }: KanbanBoardProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateOpportunityMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PUT", `/api/opportunities/${id}`, { status });
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all related queries to keep dashboard synchronized
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({
        title: "Éxito",
        description: "Oportunidad actualizada correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la oportunidad",
        variant: "destructive",
      });
    },
  });

  const handleDrop = (opportunityId: string, newStatus: string) => {
    updateOpportunityMutation.mutate({ id: opportunityId, status: newStatus });
  };

  const groupedOpportunities = statusColumns.reduce((acc, column) => {
    acc[column.id] = opportunities.filter(opp => opp.status === column.id);
    return acc;
  }, {} as Record<string, OpportunityWithRelations[]>);

  return (
    <Card className="bg-card border border-border rounded-xl shadow-sm">
      <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-border">
        <h2 className="text-lg sm:text-xl font-semibold text-foreground">Pipeline de Oportunidades</h2>
        <p className="text-sm text-muted-foreground hidden sm:block">Arrastra las tarjetas para cambiar el estado</p>
        <p className="text-sm text-muted-foreground sm:hidden">Toca para ver detalles</p>
      </div>
      <CardContent className="p-0">
        {/* Horizontal scrollable container like Trello */}
        <div className="overflow-x-auto overflow-y-hidden">
          <div className="flex gap-3 sm:gap-4 p-4 sm:p-6 min-w-max">
            {statusColumns.map((column) => (
              <KanbanColumn
                key={column.id}
                title={column.title}
                status={column.id}
                color={column.color}
                opportunities={groupedOpportunities[column.id] || []}
                onDrop={handleDrop}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
