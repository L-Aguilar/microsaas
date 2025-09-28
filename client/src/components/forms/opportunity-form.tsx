import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { insertOpportunitySchema, CompanyWithRelations, User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import RichTextEditor from "@/components/ui/rich-text-editor";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { z } from "zod";
import { useState, useEffect } from "react";

const formSchema = insertOpportunitySchema.omit({
  businessAccountId: true, // El backend lo asigna automáticamente
}).extend({
  estimatedCloseDate: z.string().min(1, "La fecha es obligatoria"),
  companyId: z.string().min(1, "La empresa es obligatoria"),
  sellerId: z.string().min(1, "El responsable es obligatorio"),
  title: z.string().min(1, "El título es obligatorio"),
  // Task fields
  isTask: z.boolean().optional(),
  reminderDate: z.string().optional(),
  reminderTime: z.string().optional(),
}).refine((data) => {
  // If isTask is true, reminderDate and reminderTime are required
  if (data.isTask) {
    return data.reminderDate && data.reminderTime;
  }
  return true;
}, {
  message: "La fecha y hora de recordatorio son obligatorias cuando se asigna una tarea",
  path: ["reminderDate"],
}).refine((data) => {
  // If isTask is true and reminderDate is provided, validate it's not in the past
  if (data.isTask && data.reminderDate && data.reminderTime) {
    const reminderDateTime = new Date(`${data.reminderDate}T${data.reminderTime}`);
    const now = new Date();
    return reminderDateTime > now;
  }
  return true;
}, {
  message: "La fecha y hora de recordatorio debe ser futura",
  path: ["reminderTime"],
});

type FormData = z.infer<typeof formSchema>;

interface OpportunityFormProps {
  opportunity?: any;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function OpportunityForm({ opportunity, onSuccess, onCancel }: OpportunityFormProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [isTask, setIsTask] = useState(false);
  const isEditing = !!opportunity;

  const { data: companies = [] } = useQuery<CompanyWithRelations[]>({
    queryKey: ["/api/companies"],
  });

  const { data: users = [], isLoading: usersLoading, error: usersError } = useQuery<User[]>({
    queryKey: ["/api/user/business-account/users"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      type: "NEW_CLIENT",
      status: "NEW",
      notes: "",
      estimatedCloseDate: new Date().toISOString().split('T')[0],
      companyId: "",
      sellerId: "",
      isTask: false,
      reminderDate: "",
      reminderTime: "",
    },
  });

  // Mostrar todos los usuarios y cambiar el nombre del usuario actual a "YO"
  const usersWithCurrentUser = users.map(user => ({
    ...user,
    displayName: user.id === currentUser?.id ? "YO" : user.name
  })).sort((a, b) => {
    // Poner "YO" al inicio de la lista
    if (a.displayName === "YO") return -1;
    if (b.displayName === "YO") return 1;
    return a.displayName.localeCompare(b.displayName);
  });

  // Reset form when opportunity data changes
  useEffect(() => {
    if (opportunity) {
      // Reset form with current opportunity data
      form.reset({
        title: opportunity.title || "",
        type: opportunity.type || "NEW_CLIENT",
        status: opportunity.status || "NEW",
        notes: opportunity.notes || "",
        estimatedCloseDate: opportunity.estimatedCloseDate 
          ? new Date(opportunity.estimatedCloseDate).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        companyId: opportunity.companyId || "",
        sellerId: opportunity.sellerId || "",
        isTask: false,
        reminderDate: "",
        reminderTime: "",
      });
    } else {
      // Reset to default values for new opportunity
      form.reset({
        title: "",
        type: "NEW_CLIENT",
        status: "NEW",
        notes: "",
        estimatedCloseDate: new Date().toISOString().split('T')[0],
        companyId: "",
        sellerId: "",
        isTask: false,
        reminderDate: "",
        reminderTime: "",
      });
    }
  }, [opportunity, form]);

  const createOpportunityMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { estimatedCloseDate, reminderDate, reminderTime, isTask, ...payload } = data;
      
      // Prepare opportunity data
      const opportunityPayload = {
        ...payload,
        estimatedCloseDate: estimatedCloseDate ? new Date(estimatedCloseDate).toISOString() : null,
      };
      
      // Create opportunity first
      const opportunityResponse = await apiRequest("POST", "/api/opportunities", opportunityPayload);
      const opportunity = await opportunityResponse.json();
      
      // If it's a task, create activity with reminder
      if (isTask && reminderDate && reminderTime) {
        const reminderDateTime = new Date(`${reminderDate}T${reminderTime}`);
        const activityPayload = {
          opportunityId: opportunity.id,
          type: "NOTE",
          details: `Tarea creada para: ${payload.title}`,
          activityDate: reminderDateTime.toISOString(),
          isTask: true,
          reminderDate: reminderDateTime.toISOString(),
        };
        await apiRequest("POST", "/api/activities", activityPayload);
      }
      
      return opportunity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/stats"] });
      toast({
        title: "Éxito",
        description: `Oportunidad ${isEditing ? "actualizada" : "creada"} correctamente`,
      });
      onSuccess?.();
    },
    onError: (error) => {
      console.error("🚨 Opportunity creation error:", error);
      toast({
        title: "Error",
        description: `No se pudo crear la oportunidad: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createOpportunityMutation.mutate(data);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Manually trigger validation
    form.handleSubmit(onSubmit, (errors) => {
      console.error("❌ Form validation failed:", errors);
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
        <DialogTitle>{isEditing ? "Editar Oportunidad" : "Nueva Oportunidad"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        <div>
          <Label htmlFor="title">Título *</Label>
          <Input
            id="title"
            placeholder="Nombre de la oportunidad"
            {...form.register("title")}
            data-testid="input-title"
            className="mt-1"
          />
          {form.formState.errors.title && (
            <p className="text-sm text-destructive mt-1">{form.formState.errors.title.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="type">Tipo *</Label>
            <Select onValueChange={(value) => form.setValue("type", value as any)} defaultValue="NEW_CLIENT">
              <SelectTrigger data-testid="select-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NEW_CLIENT">Nuevo Cliente</SelectItem>
                <SelectItem value="ADDITIONAL_PROJECT">Proyecto Adicional</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="status">Estado *</Label>
            <Select onValueChange={(value) => form.setValue("status", value as any)} defaultValue="NEW">
              <SelectTrigger data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NEW">Nuevo</SelectItem>
                <SelectItem value="QUALIFYING">Calificación</SelectItem>
                <SelectItem value="PROPOSAL">Propuesta</SelectItem>
                <SelectItem value="NEGOTIATION">Negociación</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="companyId">Empresa *</Label>
            <Select onValueChange={(value) => form.setValue("companyId", value)}>
              <SelectTrigger data-testid="select-company" className="mt-1">
                <SelectValue placeholder="Seleccionar empresa" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.companyId && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.companyId.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="sellerId">Responsable *</Label>
            <Select onValueChange={(value) => form.setValue("sellerId", value)}>
              <SelectTrigger data-testid="select-seller" className="mt-1">
                <SelectValue placeholder="Seleccionar responsable" />
              </SelectTrigger>
              <SelectContent>
                {usersLoading ? (
                  <SelectItem value="loading" disabled>
                    Cargando usuarios...
                  </SelectItem>
                ) : usersError ? (
                  <SelectItem value="error" disabled>
                    Error al cargar usuarios
                  </SelectItem>
                ) : usersWithCurrentUser.length > 0 ? (
                  usersWithCurrentUser.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.displayName}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-users" disabled>
                    No hay usuarios disponibles
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {form.formState.errors.sellerId && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.sellerId.message}</p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="estimatedCloseDate">Fecha de creación *</Label>
          <Input
            id="estimatedCloseDate"
            type="date"
            max={new Date().toISOString().split('T')[0]}
            {...form.register("estimatedCloseDate")}
            data-testid="input-creation-date"
            className="mt-1"
          />
          {form.formState.errors.estimatedCloseDate && (
            <p className="text-sm text-destructive mt-1">{form.formState.errors.estimatedCloseDate.message}</p>
          )}
        </div>

        {/* Task Assignment Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="assign-task"
              checked={isTask}
              onCheckedChange={(checked) => {
                setIsTask(checked);
                form.setValue("isTask", checked);
                if (!checked) {
                  form.setValue("reminderDate", "");
                  form.setValue("reminderTime", "");
                }
              }}
              data-testid="switch-assign-task"
            />
            <Label htmlFor="assign-task">Asignar tarea</Label>
          </div>

          {isTask && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 ml-6">
              <div>
                <Label htmlFor="reminderDate">Fecha de recordatorio *</Label>
                <Input
                  id="reminderDate"
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  {...form.register("reminderDate")}
                  data-testid="input-reminder-date"
                  className="mt-1"
                />
                {form.formState.errors.reminderDate && (
                  <p className="text-sm text-destructive mt-1">{form.formState.errors.reminderDate.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="reminderTime">Hora de recordatorio *</Label>
                <Input
                  id="reminderTime"
                  type="time"
                  {...form.register("reminderTime")}
                  data-testid="input-reminder-time"
                  className="mt-1"
                />
                {form.formState.errors.reminderTime && (
                  <p className="text-sm text-destructive mt-1">{form.formState.errors.reminderTime.message}</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="notes">Notas</Label>
          <RichTextEditor
            content={form.watch("notes") || ""}
            onChange={(content) => form.setValue("notes", content)}
            placeholder="Descripción o notas adicionales"
            className="min-h-[200px] sm:min-h-[220px] mt-1"
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end space-y-2 space-y-reverse sm:space-y-0 sm:space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={createOpportunityMutation.isPending}
            className="bg-brand-500 hover:bg-brand-600"
            data-testid="button-submit"
          >
            {createOpportunityMutation.isPending ? (isEditing ? "Actualizando..." : "Creando...") : (isEditing ? "Actualizar Oportunidad" : "Crear Oportunidad")}
          </Button>
        </div>
      </form>
    </>
  );
}
