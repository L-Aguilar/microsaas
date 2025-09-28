import * as brevo from '@getbrevo/brevo';

// Initialize Brevo API
const apiInstance = new brevo.TransactionalEmailsApi();

// Set API key
apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY || '');

export interface EmailParams {
  to: string;
  toName?: string;
  from: string;
  fromName?: string;
  subject: string;
  htmlContent?: string;
  textContent?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!process.env.BREVO_API_KEY) {
    console.error('BREVO_API_KEY environment variable is not set');
    return false;
  }

  try {
    const sendSmtpEmail = new brevo.SendSmtpEmail();
    
    sendSmtpEmail.to = [
      {
        email: params.to,
        name: params.toName || 'Usuario'
      }
    ];
    
    sendSmtpEmail.sender = {
      email: params.from,
      name: params.fromName || 'CRM Moderno'
    };
    
    sendSmtpEmail.subject = params.subject;
    
    if (params.htmlContent) {
      sendSmtpEmail.htmlContent = params.htmlContent;
    }
    
    if (params.textContent) {
      sendSmtpEmail.textContent = params.textContent;
    }

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    
    console.log('Email sent successfully via Brevo. Status:', result.response?.statusCode);
    console.log('Message ID:', result.body?.messageId);
    
    return true;
    
  } catch (error) {
    console.error('Error sending email via Brevo:', error);
    return false;
  }
}

// Helper function for common use cases
export async function sendWelcomeEmail(userEmail: string, userName: string): Promise<boolean> {
  return sendEmail({
    to: userEmail,
    toName: userName,
    from: 'noreply@crm-moderno.com',
    fromName: 'CRM Moderno',
    subject: 'Bienvenido a CRM Moderno',
    htmlContent: `
      <h1>¡Bienvenido ${userName}!</h1>
      <p>Tu cuenta ha sido creada exitosamente en CRM Moderno.</p>
      <p>Ya puedes comenzar a gestionar tus clientes y oportunidades de negocio.</p>
      <p>¡Que tengas mucho éxito!</p>
    `,
    textContent: `¡Bienvenido ${userName}! Tu cuenta ha sido creada exitosamente en CRM Moderno. Ya puedes comenzar a gestionar tus clientes y oportunidades de negocio. ¡Que tengas mucho éxito!`
  });
}

export async function sendPasswordResetEmail(userEmail: string, resetToken: string): Promise<boolean> {
  const resetUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/reset-password?token=${resetToken}`;
  
  return sendEmail({
    to: userEmail,
    from: 'noreply@crm-moderno.com',
    fromName: 'CRM Moderno',
    subject: 'Restablecer contraseña - CRM Moderno',
    htmlContent: `
      <h1>Restablecer contraseña</h1>
      <p>Has solicitado restablecer tu contraseña en CRM Moderno.</p>
      <p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
      <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Restablecer contraseña</a>
      <p>Si no solicitaste este cambio, puedes ignorar este email.</p>
      <p>Este enlace expirará en 1 hora.</p>
    `,
    textContent: `Has solicitado restablecer tu contraseña en CRM Moderno. Visita este enlace para crear una nueva contraseña: ${resetUrl}. Si no solicitaste este cambio, puedes ignorar este email. Este enlace expirará en 1 hora.`
  });
}

// Template-based email function for password recovery
export async function sendBrevoWelcomeEmail(params: {
  to: string;
  subject: string;
  template: string;
  data: any;
}): Promise<boolean> {
  if (!process.env.BREVO_API_KEY) {
    console.error('BREVO_API_KEY environment variable is not set');
    return false;
  }

  try {
    let htmlContent = '';
    let textContent = '';

    if (params.template === 'password-recovery') {
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Recuperación de Contraseña - ShimliAdmin</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .password-box { background: #fff; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
            .password { font-size: 24px; font-weight: bold; color: #667eea; letter-spacing: 2px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Recuperación de Contraseña</h1>
              <p>ShimliAdmin - Sistema de Gestión</p>
            </div>
            <div class="content">
              <h2>Hola ${params.data.name},</h2>
              <p>Hemos recibido una solicitud para recuperar tu contraseña en ShimliAdmin.</p>
              <p>Tu nueva contraseña temporal es:</p>
              
              <div class="password-box">
                <div class="password">${params.data.newPassword}</div>
              </div>
              
              <div class="warning">
                <strong>⚠️ Importante:</strong>
                <ul>
                  <li>Esta es una contraseña temporal generada automáticamente</li>
                  <li>Te recomendamos cambiarla inmediatamente después de iniciar sesión</li>
                  <li>No compartas esta contraseña con nadie</li>
                </ul>
              </div>
              
              <p>Puedes iniciar sesión ahora con esta contraseña:</p>
              <a href="${params.data.loginUrl}" class="button">🚀 Iniciar Sesión</a>
              
              <p>Si no solicitaste este cambio de contraseña, por favor contacta al administrador del sistema.</p>
              
              <div class="footer">
                <p>Este email fue enviado automáticamente por ShimliAdmin</p>
                <p>© ${new Date().getFullYear()} ShimliAdmin - Todos los derechos reservados</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      textContent = `
        Recuperación de Contraseña - ShimliAdmin
        
        Hola ${params.data.name},
        
        Hemos recibido una solicitud para recuperar tu contraseña en ShimliAdmin.
        
        Tu nueva contraseña temporal es: ${params.data.newPassword}
        
        IMPORTANTE:
        - Esta es una contraseña temporal generada automáticamente
        - Te recomendamos cambiarla inmediatamente después de iniciar sesión
        - No compartas esta contraseña con nadie
        
        Puedes iniciar sesión en: ${params.data.loginUrl}
        
        Si no solicitaste este cambio de contraseña, por favor contacta al administrador del sistema.
        
        Este email fue enviado automáticamente por ShimliAdmin
        © ${new Date().getFullYear()} ShimliAdmin - Todos los derechos reservados
      `;
    }

    // Use the direct sendEmail function instead of Brevo API
    return sendEmail({
      to: params.to,
      toName: params.data.name,
      from: process.env.FROM_EMAIL || 'noreply@sheilim.com',
      fromName: process.env.FROM_NAME || 'ShimliAdmin',
      subject: params.subject,
      htmlContent,
      textContent
    });

  } catch (error) {
    console.error('Error sending template email:', error);
    return false;
  }
}