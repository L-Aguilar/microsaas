import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { insertCompanySchema, Company } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PhoneInput from "@/components/ui/phone-input";
import { cleanPhoneNumber } from "@/lib/phoneUtils";
import { z } from "zod";

type FormData = z.infer<typeof insertCompanySchema>;

interface CompanyFormProps {
  company?: Company;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function CompanyForm({ company, onSuccess, onCancel }: CompanyFormProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = !!company;

  const [countryCode, setCountryCode] = useState("+504");
  const [phoneNumber, setPhoneNumber] = useState("");

  const form = useForm<FormData>({
    resolver: zodResolver(insertCompanySchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      status: "LEAD",
      contactName: "",
      email: "",
      website: "",
      phone: "",
      industry: "",
    },
  });

  // Reset form and parse phone number when company data changes
  useEffect(() => {
    if (company) {
      // Reset form with current company data
      form.reset({
        name: company.name || "",
        status: company.status || "LEAD",
        contactName: company.contactName || "",
        email: company.email || "",
        website: company.website || "",
        phone: company.phone || "",
        industry: company.industry || "",
      });

      // Parse existing phone number
      if (company.phone) {
        const phone = company.phone;
        if (phone.startsWith('+')) {
          const match = phone.match(/^(\+\d{1,4})(.*)/);
          if (match) {
            setCountryCode(match[1]);
            setPhoneNumber(match[2].replace(/\s/g, '')); // Remove spaces from number part
          }
        } else {
          setCountryCode("+504");
          setPhoneNumber(phone.replace(/\s/g, '')); // Remove spaces from number part
        }
      } else {
        setCountryCode("+504");
        setPhoneNumber("");
      }
    } else {
      // Reset to default values for new company
      form.reset({
        name: "",
        status: "LEAD",
        contactName: "",
        email: "",
        website: "",
        phone: "",
        industry: "",
      });
      setCountryCode("+504");
      setPhoneNumber("");
    }
  }, [company, form]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const url = isEditing ? `/api/companies/${company.id}` : "/api/companies";
      const method = isEditing ? "PUT" : "POST";
      const response = await apiRequest(method, url, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      // Also invalidate the specific company query if editing
      if (isEditing && company) {
        queryClient.invalidateQueries({ queryKey: [`/api/companies/${company.id}`] });
      }
      toast({
        title: "Éxito",
        description: `Empresa ${isEditing ? "actualizada" : "creada"} correctamente`,
      });
      onSuccess?.();
    },
    onError: () => {
      toast({
        title: "Error",
        description: `No se pudo ${isEditing ? "actualizar" : "crear"} la empresa`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    // Clean and format the phone number before submitting
    const cleanedPhone = phoneNumber ? cleanPhoneNumber(countryCode + phoneNumber) : "";
    const submitData = {
      ...data,
      phone: cleanedPhone || null, // Send null if no phone number
      email: data.email?.trim() || null,   // Send null if no email
    };
    
    // Manual validation check
    if (!submitData.email && !submitData.phone) {
      form.setError("email", {
        message: "Debe proporcionar al menos un correo electrónico o teléfono"
      });
      return;
    }
    
    mutation.mutate(submitData);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditing ? "Editar Empresa" : "Nueva Empresa"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
        <div>
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            placeholder="Nombre de la empresa"
            {...form.register("name")}
            data-testid="input-name"
            className="mt-1"
          />
          {form.formState.errors.name && (
            <p className="text-sm text-destructive mt-1">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="status">Estado</Label>
          <Select onValueChange={(value) => form.setValue("status", value as any)} defaultValue={form.getValues("status")}>
            <SelectTrigger data-testid="select-status" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LEAD">Lead</SelectItem>
              <SelectItem value="ACTIVE">Activo</SelectItem>
              <SelectItem value="INACTIVE">Inactivo</SelectItem>
              <SelectItem value="BLOCKED">Bloqueado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="contactName">Nombre de Contacto</Label>
          <Input
            id="contactName"
            placeholder="Nombre del contacto principal"
            {...form.register("contactName")}
            data-testid="input-contact-name"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="email">Correo Electrónico</Label>
          <Input
            id="email"
            type="email"
            placeholder="contacto@empresa.com"
            {...form.register("email", {
              onChange: (e) => {
                // Clear email error when user types something
                if (e.target.value.trim() && form.formState.errors.email) {
                  form.clearErrors("email");
                }
              }
            })}
            data-testid="input-email"
            className="mt-1"
          />
          {form.formState.errors.email && (
            <p className="text-sm text-destructive mt-1">{form.formState.errors.email.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="website">Sitio Web (opcional)</Label>
          <Input
            id="website"
            type="url"
            placeholder="ejemplo.com"
            {...form.register("website", {
              onChange: (e) => {
                let value = e.target.value.trim();
                
                // If user enters a domain without protocol, add https://
                if (value && !value.startsWith('http://') && !value.startsWith('https://')) {
                  // Check if it looks like a domain (contains a dot and doesn't start with www.)
                  if (value.includes('.') && !value.startsWith('www.')) {
                    value = 'https://' + value;
                  } else if (value.startsWith('www.')) {
                    value = 'https://' + value;
                  }
                  // Update the input value
                  e.target.value = value;
                  form.setValue("website", value);
                }
              }
            })}
            data-testid="input-website"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="industry">Industria (opcional)</Label>
          <Input
            id="industry"
            placeholder="Tecnología, Manufactura, Servicios..."
            {...form.register("industry")}
            data-testid="input-industry"
            className="mt-1"
          />
        </div>

        <PhoneInput
          label="Teléfono"
          countryCode={countryCode}
          phoneNumber={phoneNumber}
          onCountryCodeChange={setCountryCode}
          onPhoneNumberChange={(fullNumber) => {
            // Extract just the number part (remove country code)
            const numberPart = fullNumber.replace(countryCode, '');
            setPhoneNumber(numberPart);
            // Update form value for validation
            form.setValue("phone", fullNumber);
            // Clear any previous email error when phone is provided
            if (numberPart && form.formState.errors.email) {
              form.clearErrors("email");
            }
          }}
          placeholder="123 456 7890"
          testId="input-phone"
          error={form.formState.errors.phone?.message}
        />

        <div className="flex flex-col-reverse sm:flex-row justify-end space-y-2 space-y-reverse sm:space-y-0 sm:space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={mutation.isPending}
            className="bg-brand-500 hover:bg-brand-600"
            data-testid="button-submit"
          >
            {mutation.isPending ? (isEditing ? "Actualizando..." : "Creando...") : (isEditing ? "Actualizar Empresa" : "Crear Empresa")}
          </Button>
        </div>
      </form>
    </>
  );
}
