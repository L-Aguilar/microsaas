import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { ActivityWithRelations } from "@shared/schema";
import ActivityItem from "./activity-item";

interface ActivityTimelineProps {
  showOpportunityLink?: boolean;
  showBorder?: boolean;
  maxItems?: number;
}

export default function ActivityTimeline({ 
  showOpportunityLink = true,
  showBorder = false,
  maxItems = 4 
}: ActivityTimelineProps = {}) {
  const { data: activities = [] } = useQuery<ActivityWithRelations[]>({
    queryKey: ["/api/activities"],
  });

  // Sort activities by creation date (most recent first)
  const sortedActivities = [...activities]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, maxItems); // Show only the specified number of most recent

  return (
    <Card className="border border-border shadow-sm">
      <div className="px-4 sm:px-6 py-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Actividades Recientes</h2>
      </div>
      <CardContent className="p-4 sm:p-6">
        <div className="activity-timeline relative pl-6 sm:pl-8 space-y-4 sm:space-y-6">
          {sortedActivities.map((activity, index) => (
            <ActivityItem 
              key={activity.id} 
              activity={activity}
              showOpportunityLink={showOpportunityLink}
              showBorder={showBorder && index < sortedActivities.length - 1} // No border on last item
            />
          ))}
          {sortedActivities.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay actividades recientes
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
