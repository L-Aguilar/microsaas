import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Target, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface Alert {
  type: 'stale_opportunity' | 'upcoming_close' | 'no_activity';
  severity: 'high' | 'medium' | 'low';
  message: string;
  opportunityId: string;
  opportunityTitle: string;
  companyName: string;
  sellerName: string;
  daysSinceLastActivity?: number;
  daysUntilClose?: number;
}

export default function AlertsPanel() {
  const [, setLocation] = useLocation();
  const { data: alerts = [], isLoading } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
    refetchInterval: 60000, // Refrescar cada minuto
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Alertas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-green-500" />
            Alertas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="mx-auto h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
              <Target className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-sm font-medium text-foreground">¡Todo bajo control!</p>
            <p className="text-xs text-muted-foreground mt-1">No hay alertas pendientes</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const highPriorityAlerts = alerts.filter(a => a.severity === 'high');
  const mediumPriorityAlerts = alerts.filter(a => a.severity === 'medium');
  const lowPriorityAlerts = alerts.filter(a => a.severity === 'low');

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'low':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'stale_opportunity':
        return <Clock className="h-4 w-4" />;
      case 'upcoming_close':
        return <Target className="h-4 w-4" />;
      case 'no_activity':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Alertas
            <Badge variant="outline" className="ml-2">
              {alerts.length}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* High Priority Alerts */}
        {highPriorityAlerts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-red-600">Alta Prioridad</h4>
            {highPriorityAlerts.slice(0, 5).map((alert) => (
              <div
                key={alert.opportunityId}
                className={`p-3 rounded-lg border ${getSeverityColor(alert.severity)} cursor-pointer hover:opacity-80 transition-opacity`}
                onClick={() => setLocation(`/opportunities/${alert.opportunityId}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getAlertIcon(alert.type)}
                      <span className="text-sm font-medium">{alert.opportunityTitle}</span>
                    </div>
                    <p className="text-xs opacity-90">{alert.companyName}</p>
                    <p className="text-xs opacity-75 mt-1">{alert.message}</p>
                    <p className="text-xs opacity-60 mt-1">Vendedor: {alert.sellerName}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 opacity-50" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Medium Priority Alerts */}
        {mediumPriorityAlerts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-orange-600">Prioridad Media</h4>
            {mediumPriorityAlerts.slice(0, 3).map((alert) => (
              <div
                key={alert.opportunityId}
                className={`p-3 rounded-lg border ${getSeverityColor(alert.severity)} cursor-pointer hover:opacity-80 transition-opacity`}
                onClick={() => setLocation(`/opportunities/${alert.opportunityId}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getAlertIcon(alert.type)}
                      <span className="text-sm font-medium">{alert.opportunityTitle}</span>
                    </div>
                    <p className="text-xs opacity-90">{alert.companyName}</p>
                    <p className="text-xs opacity-75 mt-1">{alert.message}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 opacity-50" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Show more button if there are more alerts */}
        {alerts.length > 8 && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setLocation('/opportunities')}
          >
            Ver todas las alertas ({alerts.length})
          </Button>
        )}
      </CardContent>
    </Card>
  );
}


