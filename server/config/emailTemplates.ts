// Brevo Template IDs Configuration
// Create these templates in Brevo Dashboard: app.brevo.com/templates

export const BREVO_TEMPLATES = {
  // Authentication Templates
  PASSWORD_RECOVERY: {
    id: 2, // Replace with actual Brevo template ID
    name: 'Password Recovery',
    description: 'Send temporary password to users',
    variables: ['name', 'newPassword', 'loginUrl', 'company']
  },

  BUSINESS_WELCOME: {
    id: 1, // Brevo template ID confirmed
    name: 'Business Welcome with Password',
    description: 'Welcome new business with login credentials',
    variables: ['companyName', 'responsibleName', 'tempPassword', 'loginUrl', 'supportEmail']
  },

  // Notification Templates  
  REMINDER_NOTIFICATION: {
    id: 5, // Replace with actual Brevo template ID
    name: 'Reminder Notification',
    description: 'Send scheduled reminders',
    variables: ['name', 'reminderTitle', 'reminderDescription', 'dueDate', 'dashboardUrl']
  },

  EMERGENCY_ALERT: {
    id: 6, // Replace with actual Brevo template ID
    name: 'Emergency Alert',
    description: 'Critical system notifications',
    variables: ['name', 'alertType', 'alertMessage', 'actionRequired']
  },

  // Test Templates
  TEST_EMAIL: {
    id: 7, // Replace with actual Brevo template ID
    name: 'Test Email',
    description: 'System test and configuration verification',
    variables: ['recipientName', 'testMessage', 'timestamp']
  }
} as const;

// Template type definitions
export type TemplateType = keyof typeof BREVO_TEMPLATES;

// Helper function to get template info
export function getTemplateInfo(templateType: TemplateType) {
  return BREVO_TEMPLATES[templateType];
}

// Validation function for template variables
export function validateTemplateVariables(templateType: TemplateType, variables: Record<string, any>): boolean {
  const template = BREVO_TEMPLATES[templateType];
  const requiredVars = template.variables;
  
  for (const requiredVar of requiredVars) {
    if (!(requiredVar in variables)) {
      console.error(`Missing required variable '${requiredVar}' for template ${template.name}`);
      return false;
    }
  }
  
  return true;
}