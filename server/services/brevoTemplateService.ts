import * as brevo from '@getbrevo/brevo';
import { BREVO_TEMPLATES, TemplateType, validateTemplateVariables } from '../config/emailTemplates';

// Initialize Brevo API
const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY || '');

export interface BrevoTemplateParams {
  to: string;
  toName?: string;
  templateType: TemplateType;
  variables: Record<string, any>;
  from?: string;
  fromName?: string;
}

export async function sendBrevoTemplate(params: BrevoTemplateParams): Promise<boolean> {
  if (!process.env.BREVO_API_KEY) {
    console.error('BREVO_API_KEY environment variable is not set');
    return false;
  }

  try {
    const template = BREVO_TEMPLATES[params.templateType];
    
    // Validate required variables
    if (!validateTemplateVariables(params.templateType, params.variables)) {
      return false;
    }

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    
    // Set recipient
    sendSmtpEmail.to = [{
      email: params.to,
      name: params.toName || 'Usuario'
    }];
    
    // Set sender - use verified email from Brevo account
    sendSmtpEmail.sender = {
      email: params.from || 'hello@controly.co',
      name: params.fromName || 'Controly'
    };
    
    // Set template ID and variables
    sendSmtpEmail.templateId = template.id;
    sendSmtpEmail.params = params.variables;

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    
    console.log(`✅ Brevo template '${template.name}' sent successfully. Status:`, result.response?.statusCode);
    console.log('📧 Template ID:', template.id, '| Message ID:', result.body?.messageId);
    
    return true;
    
  } catch (error) {
    console.error(`❌ Error sending Brevo template '${params.templateType}':`, error);
    return false;
  }
}

// Specific template functions for easier usage
export async function sendPasswordRecoveryTemplate(params: {
  to: string;
  toName: string;
  newPassword: string;
  company?: string;
}): Promise<boolean> {
  return sendBrevoTemplate({
    to: params.to,
    toName: params.toName,
    templateType: 'PASSWORD_RECOVERY',
    variables: {
      name: params.toName,
      newPassword: params.newPassword,
      loginUrl: process.env.BASE_URL || 'http://localhost:5173',
      company: params.company || 'Controly'
    }
  });
}

export async function sendBusinessWelcomeTemplate(params: {
  to: string;
  companyName: string;
  responsibleName: string;
  tempPassword: string;
}): Promise<boolean> {
  return sendBrevoTemplate({
    to: params.to,
    toName: params.responsibleName,
    templateType: 'BUSINESS_WELCOME',
    variables: {
      companyName: params.companyName,
      responsibleName: params.responsibleName,
      tempPassword: params.tempPassword,
      loginUrl: process.env.BASE_URL || 'http://localhost:5173',
      supportEmail: 'hello@controly.co'
    }
  });
}

export async function sendReminderTemplate(params: {
  to: string;
  toName: string;
  reminderTitle: string;
  reminderDescription: string;
  dueDate: string;
}): Promise<boolean> {
  return sendBrevoTemplate({
    to: params.to,
    toName: params.toName,
    templateType: 'REMINDER_NOTIFICATION',
    variables: {
      name: params.toName,
      reminderTitle: params.reminderTitle,
      reminderDescription: params.reminderDescription,
      dueDate: params.dueDate,
      dashboardUrl: process.env.BASE_URL || 'http://localhost:5173'
    }
  });
}

export async function sendTestTemplate(params: {
  to: string;
  toName?: string;
}): Promise<boolean> {
  return sendBrevoTemplate({
    to: params.to,
    toName: params.toName || 'Usuario',
    templateType: 'TEST_EMAIL',
    variables: {
      recipientName: params.toName || 'Usuario',
      testMessage: 'Este es un email de prueba del sistema Controly',
      timestamp: new Date().toLocaleString('es-ES', { timeZone: 'America/Tegucigalpa' })
    }
  });
}