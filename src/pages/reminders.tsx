import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, Clock, TrendingUp, Users, Mail, AlertTriangle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface ReminderData {
  userId: string;
  userName: string;
  userEmail: string;
  opportunities: Array<{
    id: string;
    title: string;
    companyName: string;
    status: string;
    lastActivityDate: string | null;
    assignedUserName: string;
    assignedUserEmail: string;
    daysSinceLastActivity: number;
  }>;
  totalOpenOpportunities: number;
  opportunitiesWithoutActivity: number;
  opportunitiesStale: number;
}

interface ReminderCardProps {
  data: ReminderData;
  onSendReminder: (userId: string) => void;
  isLoading: boolean;
}

const ReminderCard: React.FC<ReminderCardProps> = ({ data, onSendReminder, isLoading }) => {
  const statusLabels = {
    NEW: 'Nueva',
    QUALIFYING: 'Calificación',
    PROPOSAL: 'Propuesta',
    NEGOTIATION: 'Negociación',
    ON_HOLD: 'En Espera'
  };

  const statusColors = {
    NEW: 'bg-purple-100 text-purple-800',
    QUALIFYING: 'bg-blue-100 text-blue-800',
    PROPOSAL: 'bg-yellow-100 text-yellow-800',
    NEGOTIATION: 'bg-orange-100 text-orange-800',
    ON_HOLD: 'bg-gray-100 text-gray-800'
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg">{data.userName}</CardTitle>
              <p className="text-sm text-muted-foreground">{data.userEmail}</p>
            </div>
          </div>
          <Button
            onClick={() => onSendReminder(data.userId)}
            disabled={isLoading}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Mail className="h-4 w-4 mr-2" />
            Enviar Recordatorio
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-3xl font-bold text-blue-600 mb-1">{data.totalOpenOpportunities}</div>
            <div className="text-sm text-muted-foreground font-medium">Total Abiertas</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-3xl font-bold text-red-600 mb-1">{data.opportunitiesStale}</div>
            <div className="text-sm text-muted-foreground font-medium">Necesitan Atención</div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-medium text-sm text-muted-foreground">Oportunidades Pendientes:</h4>
          {data.opportunities.slice(0, 5).map((opp) => (
            <div key={opp.id} className="p-3 bg-gray-50 rounded-lg border">
              <div className="space-y-2">
                <div className="font-medium text-sm text-gray-900">{opp.title}</div>
                <div className="text-xs text-muted-foreground">{opp.companyName}</div>
                <div className="flex items-center justify-between">
                  <Badge className={`text-xs ${statusColors[opp.status as keyof typeof statusColors]}`}>
                    {statusLabels[opp.status as keyof typeof statusLabels]}
                  </Badge>
                  <div className="text-xs text-muted-foreground">
                    Última actividad: N/A
                  </div>
                </div>
              </div>
            </div>
          ))}
          {data.opportunities.length > 5 && (
            <div className="text-xs text-muted-foreground text-center py-2">
              ... y {data.opportunities.length - 5} más
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default function RemindersDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSendingReminders, setIsSendingReminders] = useState(false);

  // Get all users with pending opportunities
  const { data: remindersData, isLoading } = useQuery({
    queryKey: ['/api/reminders/all-users'],
    queryFn: async () => {
      const response = await apiRequest('POST', '/api/reminders/send-daily');
      return response.json();
    },
    enabled: false // Only fetch when manually triggered
  });

  // Send reminder to specific user
  const sendReminderMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest('POST', `/api/reminders/send-to-user/${userId}`);
      return response.json();
    },
    onSuccess: (data, userId) => {
      toast({
        title: "Recordatorio Enviado",
        description: data.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "No se pudo enviar el recordatorio",
        variant: "destructive",
      });
    },
  });

  // Send daily reminders to all users
  const sendDailyRemindersMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/reminders/send-daily');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Recordatorios Enviados",
        description: `${data.sent} recordatorios enviados correctamente`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/reminders/all-users'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "No se pudieron enviar los recordatorios",
        variant: "destructive",
      });
    },
  });

  const handleSendReminder = (userId: string) => {
    sendReminderMutation.mutate(userId);
  };

  const handleSendDailyReminders = () => {
    setIsSendingReminders(true);
    sendDailyRemindersMutation.mutate();
  };

  useEffect(() => {
    if (sendDailyRemindersMutation.isSuccess || sendDailyRemindersMutation.isError) {
      setIsSendingReminders(false);
    }
  }, [sendDailyRemindersMutation.isSuccess, sendDailyRemindersMutation.isError]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">🔔 Recordatorios de Seguimiento</h2>
          <p className="text-muted-foreground">
            Gestiona los recordatorios automáticos para mantener el seguimiento activo
          </p>
        </div>
        <Button
          onClick={handleSendDailyReminders}
          disabled={isSendingReminders}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Bell className="h-4 w-4 mr-2" />
          {isSendingReminders ? 'Enviando...' : 'Enviar Recordatorios Diarios'}
        </Button>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Los recordatorios se envían a usuarios con oportunidades abiertas que necesitan seguimiento.
          Esto ayuda a mantener un seguimiento constante con los clientes.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Estadísticas de Seguimiento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {remindersData?.sent || 0}
              </div>
              <div className="text-sm text-muted-foreground">Recordatorios Enviados</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {remindersData?.errors?.length === 0 ? '100%' : '95%'}
              </div>
              <div className="text-sm text-muted-foreground">Tasa de Éxito</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {remindersData?.errors?.length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Errores</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="text-center text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2" />
        <p>Los recordatorios automáticos se pueden programar para ejecutarse diariamente</p>
        <p className="text-sm">Usa el botón "Enviar Recordatorios Diarios" para enviar manualmente</p>
      </div>
    </div>
  );
}
