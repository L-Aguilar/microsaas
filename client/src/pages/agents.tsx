import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Plus, Users, Mail, Phone, Trash2 } from "lucide-react";
import { User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AgentForm from "@/components/forms/agent-form";

export default function Agents() {
  const [showNewAgentModal, setShowNewAgentModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<User | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<User | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: agents = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/agents"],
  });

  const deleteAgentMutation = useMutation({
    mutationFn: async (agentId: string) => {
      await apiRequest("DELETE", `/api/agents/${agentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Agente eliminado",
        description: "El agente ha sido eliminado correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el agente",
        variant: "destructive",
      });
    },
  });

  const handleDeleteAgent = (agent: User) => {
    setAgentToDelete(agent);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (agentToDelete) {
      deleteAgentMutation.mutate(agentToDelete.id);
      setAgentToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestión de Agentes</h1>
            <p className="text-muted-foreground">Administra tu equipo de ventas</p>
          </div>
          <Button 
            className="bg-brand-500 hover:bg-brand-600 text-white"
            onClick={() => setShowNewAgentModal(true)}
            data-testid="button-new-agent"
          >
            <Plus className="mr-2 h-4 w-4" />
            Agregar Agente
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Total Agentes</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="total-agents">
                    {agents.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Agentes Activos</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="active-agents">
                    {agents.filter(agent => agent.role === 'USER').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Administradores</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="admin-users">
                    {agents.filter(agent => agent.role === 'BUSINESS_ADMIN').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Agents List */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Agentes</CardTitle>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium text-foreground">No hay agentes</h3>
                <p className="mt-2 text-muted-foreground">Comienza agregando tu primer agente</p>
                <Button 
                  className="mt-4"
                  onClick={() => setShowNewAgentModal(true)}
                  data-testid="button-add-first-agent"
                >
                  Agregar Primer Agente
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {agents.map((agent) => (
                  <div key={agent.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <Users className="h-6 w-6 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground" data-testid={`agent-name-${agent.id}`}>
                          {agent.name}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <div className="flex items-center">
                            <Mail className="h-4 w-4 mr-1" />
                            {agent.email}
                          </div>
                          {agent.phone && (
                            <div className="flex items-center">
                              <Phone className="h-4 w-4 mr-1" />
                              {agent.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        agent.role === 'BUSINESS_ADMIN' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {agent.role}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAgent(agent)}
                        className="text-red-600 hover:text-red-800 hover:bg-red-50"
                        data-testid={`button-delete-agent-${agent.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Agent Modal */}
      <Dialog open={showNewAgentModal} onOpenChange={setShowNewAgentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar Nuevo Agente</DialogTitle>
            <DialogDescription>
              Completa la información del agente. Se enviará una invitación por email con las credenciales.
            </DialogDescription>
          </DialogHeader>
          <AgentForm onClose={() => setShowNewAgentModal(false)} />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Eliminar Agente"
        description={`¿Estás seguro de que quieres eliminar a ${agentToDelete?.name}? Esta acción no se puede deshacer.`}
        onConfirm={confirmDelete}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </>
  );
}