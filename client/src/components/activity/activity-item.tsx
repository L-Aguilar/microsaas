import { ActivityWithRelations } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import HtmlContent from "@/components/ui/html-content";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface ActivityItemProps {
  activity: ActivityWithRelations;
  showOpportunityLink?: boolean;
  showBorder?: boolean;
}

const activityTypeColors = {
  CALL: "bg-blue-100 text-blue-800",
  MEETING: "bg-green-100 text-green-800",
  NOTE: "bg-gray-100 text-gray-800",
};

const activityTypeLabels = {
  CALL: "Llamada",
  MEETING: "Reunión",
  NOTE: "Nota",
};

export default function ActivityItem({ 
  activity, 
  showOpportunityLink = true,
  showBorder = false 
}: ActivityItemProps) {
  const [location, setLocation] = useLocation();
  const timeAgo = formatDistanceToNow(new Date(activity.createdAt), {
    addSuffix: true,
    locale: es,
  });

  // Verificar si estamos dentro de la oportunidad actual
  const isInsideOpportunity = location.includes(`/opportunities/${activity.opportunityId}`);

  const handleViewOpportunity = () => {
    if (activity.opportunityId) {
      setLocation(`/opportunities/${activity.opportunityId}`);
    }
  };

  return (
    <>
      <div 
        className={`timeline-item relative ${activity.opportunityId && showOpportunityLink ? 'cursor-pointer hover:bg-gray-50 rounded-lg p-3 -m-3 transition-colors' : 'p-4'}`} 
        data-testid={`activity-item-${activity.id}`}
        onClick={activity.opportunityId && showOpportunityLink ? handleViewOpportunity : undefined}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <span className={`${activityTypeColors[activity.type]} text-xs px-3 py-1.5 rounded-full font-medium`}>
                {activityTypeLabels[activity.type]}
              </span>
              {activity.isTask && (
                <span className="text-xs bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-full font-medium">
                  Tarea
                </span>
              )}
            </div>
            
            {activity.details && (
              <div className="text-sm text-gray-700 mb-3 leading-relaxed" data-testid={`activity-details-${activity.id}`}>
                <HtmlContent content={activity.details} className="text-sm text-gray-700 prose-p:my-1 prose-p:leading-relaxed" />
              </div>
            )}
            
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="font-medium">{timeAgo}</span>
              <span>•</span>
              <span>{activity.author?.name || "Usuario desconocido"}</span>
              {activity.isTask && activity.reminderDate && (
                <>
                  <span>•</span>
                  <span className="text-orange-600 font-medium">
                    Recordatorio: {new Date(activity.reminderDate).toLocaleDateString()}
                  </span>
                </>
              )}
            </div>
          </div>
          
          {activity.opportunityId && showOpportunityLink && !isInsideOpportunity && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleViewOpportunity();
              }}
              className="h-8 px-3 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex-shrink-0"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Ver
            </Button>
          )}
        </div>
      </div>
      {showBorder && (
        <div className="border-b border-gray-200 my-4"></div>
      )}
    </>
  );
}
