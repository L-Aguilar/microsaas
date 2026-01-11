import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { insertActivitySchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RichTextEditor from "@/components/ui/rich-text-editor";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { z } from "zod";

const formSchema = insertActivitySchema.omit({
  businessAccountId: true, // El backend lo asigna automáticamente
}).extend({
  activityDate: z.string(),
  reminderDate: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ActivityFormProps {
  opportunityId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function ActivityForm({ opportunityId, onSuccess, onCancel }: ActivityFormProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, isLoading } = useAuth();
  const [isTask, setIsTask] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      opportunityId,
      authorId: user?.id || "",
      type: "CALL",
      details: "",
      activityDate: new Date().toISOString().slice(0, 10), // YYYY-MM-DD format
      isTask: false,
      reminderDate: "",
    },
  });

  // Update authorId when user loads
  React.useEffect(() => {
    if (user?.id) {
      form.setValue('authorId', user.id);
    }
  }, [user, form]);

  const createActivityMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { activityDate, reminderDate, ...payload } = data;
      const finalPayload = {
        ...payload,
        authorId: user?.id || payload.authorId, // Ensure authorId is set
        activityDate: new Date(activityDate).toISOString(),
        reminderDate: reminderDate ? new Date(reminderDate).toISOString() : null,
      };
      const response = await apiRequest("POST", "/api/activities", finalPayload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      toast({
        title: "Éxito",
        description: "Actividad creada correctamente",
      });
      onSuccess?.();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear la actividad",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createActivityMutation.mutate(data);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Manually trigger validation
    form.handleSubmit(onSubmit, (errors) => {
      console.error("❌ Activity form validation failed:", errors);
      toast({
        title: "Error de validación",
        description: "Por favor completa todos los campos obligatorios",
        variant: "destructive",
      });
    })(e);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Nueva Actividad</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="type">Tipo de Actividad *</Label>
          <Select onValueChange={(value) => form.setValue("type", value as any)} defaultValue="CALL">
            <SelectTrigger data-testid="select-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CALL">Llamada</SelectItem>
              <SelectItem value="MEETING">Reunión</SelectItem>
              <SelectItem value="NOTE">Nota</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="details">Detalles</Label>
          <RichTextEditor
            content={form.watch("details") || ""}
            onChange={(content) => form.setValue("details", content)}
            placeholder="Descripción detallada de la actividad"
            className="min-h-[200px]"
          />
        </div>

        <div>
          <Label htmlFor="activityDate">Fecha de Creación</Label>
          <Input
            id="activityDate"
            type="date"
            max={new Date().toISOString().split('T')[0]}
            {...form.register("activityDate")}
            data-testid="input-activity-date"
          />
          {form.formState.errors.activityDate && (
            <p className="text-sm text-destructive mt-1">{form.formState.errors.activityDate.message}</p>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <Switch
            id="isTask"
            checked={isTask}
            onCheckedChange={(checked) => {
              setIsTask(checked);
              form.setValue("isTask", checked);
            }}
            className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-300 border border-gray-400"
            data-testid="switch-is-task"
          />
          <Label htmlFor="isTask" className="text-sm font-medium">Asignar tarea</Label>
        </div>

        {isTask && (
          <div>
            <Label htmlFor="reminderDate">Fecha de Recordatorio</Label>
            <Input
              id="reminderDate"
              type="date"
              {...form.register("reminderDate")}
              data-testid="input-reminder-date"
            />
            {form.formState.errors.reminderDate && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.reminderDate.message}</p>
            )}
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={createActivityMutation.isPending}
            className="bg-brand-500 hover:bg-brand-600"
            data-testid="button-submit"
          >
            {createActivityMutation.isPending ? "Creando..." : "Crear Actividad"}
          </Button>
        </div>
      </form>
    </>
  );
}
