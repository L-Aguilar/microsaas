#!/usr/bin/env node

/**
 * Script para enviar recordatorios automáticos
 * Se puede ejecutar manualmente o programar con cron
 * 
 * Uso:
 * - Manual: node scripts/send-reminders.js
 * - Cron: 0 9 * * * cd /path/to/project && node scripts/send-reminders.js
 */

import { ReminderService } from '../server/services/reminderService.js';

async function sendReminders() {
  console.log('🚀 Iniciando envío de recordatorios automáticos...');
  console.log(`📅 Fecha: ${new Date().toLocaleString('es-ES')}`);
  
  try {
    // Initialize reminder service (no longer needs storage parameter)
    const reminderService = new ReminderService();
    
    // Send daily reminders
    const result = await reminderService.sendDailyReminders();
    
    console.log('✅ Proceso completado:');
    console.log(`   📧 Recordatorios enviados: ${result.sent}`);
    console.log(`   ❌ Errores: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.log('\n❌ Errores encontrados:');
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    // Exit with appropriate code
    process.exit(result.errors.length > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  sendReminders();
}

export { sendReminders };
