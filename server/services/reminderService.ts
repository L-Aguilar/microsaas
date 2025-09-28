import { sendEmail } from './emailService';
import { pool } from '../db';

interface OpportunityReminder {
  id: string;
  title: string;
  companyName: string;
  status: string;
  lastActivityDate: string | null;
  assignedUserName: string;
  assignedUserEmail: string;
  daysSinceLastActivity: number;
}

interface UserReminderData {
  userId: string;
  userName: string;
  userEmail: string;
  opportunities: OpportunityReminder[];
  totalOpenOpportunities: number;
  opportunitiesStale: number; // Necesitan atención (sin actividad o 3+ días)
}

export class ReminderService {
  constructor() {
    // No need for storage parameter since we use pool directly
  }

  /**
   * Obtiene todas las oportunidades abiertas que necesitan seguimiento
   */
  async getOpenOpportunitiesNeedingFollowup(): Promise<UserReminderData[]> {
    const query = `
      SELECT DISTINCT
        u.id as user_id,
        u.name as user_name,
        u.email as user_email,
        o.id as opportunity_id,
        o.title as opportunity_title,
        c.name as company_name,
        o.status as opportunity_status,
        o.updated_at as opportunity_updated_at,
        MAX(a.created_at) as last_activity_date,
        CASE 
          WHEN MAX(a.created_at) IS NULL THEN 
            EXTRACT(DAY FROM NOW() - o.created_at)::INTEGER
          ELSE 
            EXTRACT(DAY FROM NOW() - MAX(a.created_at))::INTEGER
        END as days_since_last_activity
      FROM users u
      INNER JOIN opportunities o ON o.seller_id = u.id
      INNER JOIN companies c ON o.company_id = c.id
      LEFT JOIN activities a ON a.opportunity_id = o.id
      WHERE o.status NOT IN ('WON', 'LOST')
      GROUP BY u.id, u.name, u.email, o.id, o.title, c.name, o.status, o.updated_at, o.created_at
      HAVING 
        MAX(a.created_at) IS NULL 
        OR EXTRACT(DAY FROM NOW() - MAX(a.created_at)) >= 3
      ORDER BY u.name, days_since_last_activity DESC
    `;

    const result = await pool.query(query);
    
    // Agrupar por usuario
    const userMap = new Map<string, UserReminderData>();
    
    for (const row of result.rows) {
      const userId = row.user_id;
      
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          userId,
          userName: row.user_name,
          userEmail: row.user_email,
          opportunities: [],
          totalOpenOpportunities: 0,
          opportunitiesStale: 0
        });
      }
      
      const userData = userMap.get(userId)!;
      const opportunity: OpportunityReminder = {
        id: row.opportunity_id,
        title: row.opportunity_title,
        companyName: row.company_name,
        status: row.opportunity_status,
        lastActivityDate: row.last_activity_date,
        assignedUserName: row.user_name,
        assignedUserEmail: row.user_email,
        daysSinceLastActivity: row.days_since_last_activity
      };
      
      userData.opportunities.push(opportunity);
      
      // Contar estadísticas - Todo se maneja como "Necesitan Atención"
      if (row.last_activity_date === null || row.days_since_last_activity >= 3) {
        userData.opportunitiesStale++;
      }
    }
    
    // Obtener total de oportunidades abiertas por usuario
    for (const [userId, userData] of userMap) {
      const totalQuery = `
        SELECT COUNT(*) as total
        FROM opportunities o
        WHERE o.seller_id = $1
          AND o.status NOT IN ('WON', 'LOST')
      `;
      
      const totalResult = await pool.query(totalQuery, [userId]);
      userData.totalOpenOpportunities = parseInt(totalResult.rows[0].total);
    }
    
    return Array.from(userMap.values());
  }

  /**
   * Envía recordatorios a todos los usuarios con oportunidades pendientes
   */
  async sendDailyReminders(): Promise<{ sent: number; errors: string[] }> {
    console.log('🔔 Iniciando envío de recordatorios diarios...');
    
    const usersData = await this.getOpenOpportunitiesNeedingFollowup();
    const errors: string[] = [];
    let sentCount = 0;
    
    for (const userData of usersData) {
      try {
        if (userData.opportunities.length === 0) {
          continue;
        }
        
        await this.sendReminderEmail(userData);
        sentCount++;
        
        console.log(`✅ Recordatorio enviado a ${userData.userName} (${userData.userEmail}) - ${userData.opportunities.length} oportunidades pendientes`);
        
      } catch (error) {
        const errorMsg = `Error enviando recordatorio a ${userData.userEmail}: ${error}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }
    
    console.log(`📧 Recordatorios enviados: ${sentCount}, Errores: ${errors.length}`);
    
    return { sent: sentCount, errors };
  }

  /**
   * Envía recordatorio a un usuario específico
   */
  async sendReminderEmail(userData: UserReminderData): Promise<void> {
    const { userName, userEmail, opportunities, totalOpenOpportunities, opportunitiesStale } = userData;
    
    // Generar tabla HTML de oportunidades
    const opportunitiesTable = this.generateOpportunitiesTable(opportunities);
    
    // Determinar el mensaje motivacional
    const motivationalMessage = this.getMotivationalMessage(opportunitiesStale);
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Recordatorio de Seguimiento - ShimliAdmin</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .stats { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; display: flex; justify-content: space-around; }
          .stat-item { text-align: center; }
          .stat-number { font-size: 24px; font-weight: bold; color: #667eea; }
          .stat-label { font-size: 14px; color: #666; }
          .table-container { margin: 20px 0; overflow-x: auto; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background-color: #f8f9fa; font-weight: bold; color: #333; }
          .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
          .status-NEW { background-color: #e3f2fd; color: #1976d2; }
          .status-QUALIFYING { background-color: #e8f5e8; color: #388e3c; }
          .status-PROPOSAL { background-color: #fff3e0; color: #f57c00; }
          .status-NEGOTIATION { background-color: #fce4ec; color: #c2185b; }
          .status-ON_HOLD { background-color: #f3e5f5; color: #7b1fa2; }
          .days-warning { color: #d32f2f; font-weight: bold; }
          .days-normal { color: #666; }
          .cta-button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 Recordatorio de Seguimiento</h1>
            <p>¡Hola ${userName}! Es hora de dar seguimiento a tus oportunidades</p>
          </div>
          
          <div class="content">
            <h2>📊 Resumen de tus Oportunidades</h2>
            
            <div class="stats">
              <div class="stat-item">
                <div class="stat-number">${totalOpenOpportunities}</div>
                <div class="stat-label">Total Abiertas</div>
              </div>
              <div class="stat-item">
                <div class="stat-number">${opportunitiesStale}</div>
                <div class="stat-label">Necesitan Atención</div>
              </div>
            </div>
            
            <p><strong>${motivationalMessage}</strong></p>
            
            <h3>📋 Oportunidades que Requieren Seguimiento</h3>
            <div class="table-container">
              ${opportunitiesTable}
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.BASE_URL || 'http://localhost:5173'}/opportunities" class="cta-button">
                🚀 Ir a Oportunidades
              </a>
            </div>
            
            <div class="footer">
              <p>💡 <strong>Tip:</strong> Revisa tus oportunidades diariamente para mantener una comunicación efectiva con tus clientes.</p>
              <p>Este recordatorio se envía automáticamente para ayudarte a mantener un seguimiento constante.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const textContent = `
      Recordatorio de Seguimiento - ShimliAdmin
      
      Hola ${userName},
      
      Tienes ${totalOpenOpportunities} oportunidades abiertas que requieren tu atención:
      
      ${opportunities.map(opp => 
        `- ${opp.title} (${opp.companyName}) - Estado: ${opp.status} - Última actividad: ${opp.lastActivityDate ? new Date(opp.lastActivityDate).toLocaleDateString() : 'Nunca'}`
      ).join('\n')}
      
      ${motivationalMessage}
      
      Accede a tu panel: ${process.env.BASE_URL || 'http://localhost:5173'}/opportunities
      
      ¡Mantén el seguimiento constante con tus clientes!
    `;
    
    await sendEmail({
      to: userEmail,
      toName: userName,
      from: process.env.FROM_EMAIL || 'noreply@sheilim.com',
      fromName: process.env.FROM_NAME || 'ShimliAdmin',
      subject: `🔔 Recordatorio: ${totalOpenOpportunities} oportunidades requieren seguimiento`,
      htmlContent,
      textContent
    });
  }

  /**
   * Genera la tabla HTML de oportunidades
   */
  private generateOpportunitiesTable(opportunities: OpportunityReminder[]): string {
    const statusLabels = {
      NEW: 'Nueva',
      QUALIFYING: 'Calificación',
      PROPOSAL: 'Propuesta',
      NEGOTIATION: 'Negociación',
      ON_HOLD: 'En Espera'
    };
    
    const rows = opportunities.map(opp => {
      const lastActivityText = opp.lastActivityDate 
        ? new Date(opp.lastActivityDate).toLocaleDateString('es-ES')
        : 'Nunca';
      
      return `
        <tr>
          <td><strong>${opp.title}</strong></td>
          <td>${opp.companyName}</td>
          <td><span class="status-badge status-${opp.status}">${statusLabels[opp.status as keyof typeof statusLabels] || opp.status}</span></td>
          <td>${lastActivityText}</td>
        </tr>
      `;
    }).join('');
    
    return `
      <table>
        <thead>
          <tr>
            <th>Oportunidad</th>
            <th>Empresa</th>
            <th>Estado</th>
            <th>Última Actividad</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  /**
   * Genera mensaje motivacional basado en las estadísticas
   */
  private getMotivationalMessage(stale: number): string {
    if (stale > 0) {
      return `¡Atención! Es momento de ponerse en contacto con tus clientes y dar seguimiento a tus oportunidades de negocio.`;
    } else {
      return `¡Excelente trabajo! Mantén el seguimiento constante para cerrar más negocios.`;
    }
  }

  /**
   * Envía recordatorio a un usuario específico por ID
   */
  async sendReminderToUser(userId: string): Promise<boolean> {
    try {
      const usersData = await this.getOpenOpportunitiesNeedingFollowup();
      const userData = usersData.find(u => u.userId === userId);
      
      if (!userData) {
        console.log(`ℹ️ Usuario ${userId} no tiene oportunidades pendientes`);
        return false;
      }
      
      await this.sendReminderEmail(userData);
      console.log(`✅ Recordatorio enviado manualmente a ${userData.userName}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Error enviando recordatorio a usuario ${userId}:`, error);
      return false;
    }
  }
}
