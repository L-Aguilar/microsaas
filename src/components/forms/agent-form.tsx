import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertUserSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import PhoneInput from "@/components/ui/phone-input";
import { cleanPhoneNumber } from "@/lib/phoneUtils";
import { z } from "zod";

const agentFormSchema = insertUserSchema.extend({
  role: z.enum(['ADMIN', 'AGENT']).default('AGENT'),
}).omit({ password: true });

type AgentFormData = z.infer<typeof agentFormSchema>;

interface AgentFormProps {
  onClose: () => void;
}

export default function AgentForm({ onClose }: AgentFormProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [countryCode, setCountryCode] = useState("+52");
  const [phoneNumber, setPhoneNumber] = useState("");

  const form = useForm<AgentFormData>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      role: 'AGENT',
    },
  });

  const createAgentMutation = useMutation({
    mutationFn: async (data: AgentFormData) => {
      const response = await apiRequest("POST", "/api/agents", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Agente creado exitosamente",
        description: `Se ha enviado una invitación por email a ${data.agent.email}`,
      });
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error al crear agente",
        description: error.message || "Ocurrió un error inesperado",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AgentFormData) => {
    // Clean and format the phone number before submitting
    const cleanedPhone = cleanPhoneNumber(phoneNumber ? countryCode + phoneNumber : "");
    const submitData = {
      ...data,
      phone: cleanedPhone
    };
    createAgentMutation.mutate(submitData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre completo</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Juan Pérez"
                  data-testid="input-agent-name"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input 
                  type="email"
                  placeholder="juan@empresa.com"
                  data-testid="input-agent-email"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <PhoneInput
          label="Teléfono"
          countryCode={countryCode}
          phoneNumber={phoneNumber}
          onCountryCodeChange={setCountryCode}
          onPhoneNumberChange={(fullNumber) => {
            // Extract just the number part (remove country code)
            const numberPart = fullNumber.replace(countryCode, '');
            setPhoneNumber(numberPart);
          }}
          placeholder="123 456 7890"
          testId="input-agent-phone"
          error={form.formState.errors.phone?.message}
        />

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rol</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-agent-role">
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="AGENT">Agente</SelectItem>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            data-testid="button-cancel-agent"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="bg-brand-500 hover:bg-brand-600"
            disabled={createAgentMutation.isPending}
            data-testid="button-create-agent"
          >
            {createAgentMutation.isPending ? "Creando..." : "Crear Agente"}
          </Button>
        </div>
      </form>
    </Form>
  );
}