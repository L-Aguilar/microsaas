// SendGrid is not currently installed, using placeholder for now
// import sgMail from '@sendgrid/mail';

// Check if SendGrid API key is available
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@crm-moderno.com';

// SendGrid setup placeholder
// if (SENDGRID_API_KEY) {
//   sgMail.setApiKey(SENDGRID_API_KEY);
// }

export interface WelcomeEmailData {
  agentName: string;
  agentEmail: string;
  temporaryPassword: string;
  loginUrl: string;
}

/**
 * Sends a welcome email to a new agent
 */
export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('SendGrid API key not configured. Email not sent.');
    return false;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #7e02c6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .credentials { background-color: #e8f5e8; border: 1px solid #4caf50; padding: 20px; border-radius: 6px; margin: 20px 0; }
        .button { background-color: #7e02c6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; }
        .important { color: #d32f2f; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>¡Bienvenido a CRM Moderno!</h1>
        </div>
        <div class="content">
          <h2>Hola ${data.agentName},</h2>
          
          <p>Te damos la bienvenida al equipo de CRM Moderno. Tu cuenta ha sido creada y ya puedes acceder al sistema.</p>
          
          <div class="credentials">
            <h3>📧 Credenciales de Acceso</h3>
            <p><strong>Email:</strong> ${data.agentEmail}</p>
            <p><strong>Contraseña temporal:</strong> <code>${data.temporaryPassword}</code></p>
          </div>
          
          <p class="important">⚠️ Por seguridad, te recomendamos cambiar tu contraseña después de tu primer inicio de sesión.</p>
          
          <a href="${data.loginUrl}" class="button">Iniciar Sesión</a>
          
          <h3>🚀 Próximos pasos:</h3>
          <ol>
            <li>Haz clic en el botón de arriba para acceder al sistema</li>
            <li>Inicia sesión con las credenciales proporcionadas</li>
            <li>Cambia tu contraseña por una de tu elección</li>
            <li>Explora las funcionalidades del CRM</li>
          </ol>
          
          <p>Si tienes alguna pregunta o necesitas ayuda, no dudes en contactar a tu administrador.</p>
          
          <p>¡Esperamos que tengas una gran experiencia trabajando con CRM Moderno!</p>
        </div>
        <div class="footer">
          <p>Este es un email automático, por favor no respondas a este mensaje.</p>
          <p>&copy; 2025 CRM Moderno. Todos los derechos reservados.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    ¡Bienvenido a CRM Moderno!
    
    Hola ${data.agentName},
    
    Te damos la bienvenida al equipo de CRM Moderno. Tu cuenta ha sido creada y ya puedes acceder al sistema.
    
    CREDENCIALES DE ACCESO:
    Email: ${data.agentEmail}
    Contraseña temporal: ${data.temporaryPassword}
    
    IMPORTANTE: Por seguridad, te recomendamos cambiar tu contraseña después de tu primer inicio de sesión.
    
    Para acceder al sistema, visita: ${data.loginUrl}
    
    Próximos pasos:
    1. Accede al sistema con las credenciales proporcionadas
    2. Cambia tu contraseña por una de tu elección
    3. Explora las funcionalidades del CRM
    
    Si tienes alguna pregunta o necesitas ayuda, no dudes en contactar a tu administrador.
    
    ¡Esperamos que tengas una gran experiencia trabajando con CRM Moderno!
    
    ---
    Este es un email automático, por favor no respondas a este mensaje.
    © 2025 CRM Moderno. Todos los derechos reservados.
  `;

  const msg = {
    to: data.agentEmail,
    from: FROM_EMAIL,
    subject: '¡Bienvenido a CRM Moderno! - Credenciales de acceso',
    text: textContent,
    html: htmlContent,
  };

  try {
    // Placeholder for email sending - using Brevo instead
    console.log(`Email sending placeholder for ${data.agentEmail}`);
    console.log(`Subject: ${msg.subject}`);
    return true;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return false;
  }
}