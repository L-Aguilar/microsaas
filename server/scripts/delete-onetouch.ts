import 'dotenv/config';
import { db } from '../db.ts';
import { businessAccounts, users, companies, opportunities, activities, businessAccountModules, userPermissions } from '../../shared/schema.ts';
import { like, eq } from 'drizzle-orm';

async function deleteOneTouch() {
  try {
    console.log('🔍 Buscando empresa OneTouch...');
    
    // Find OneTouch business account (case insensitive)
    const onetouch = await db.select().from(businessAccounts)
      .where(like(businessAccounts.name, '%OneTouch%'));
    
    if (onetouch.length === 0) {
      console.log('❌ No se encontró ninguna empresa OneTouch');
      return;
    }
    
    console.log('✅ Empresa(s) OneTouch encontrada(s):');
    onetouch.forEach(account => {
      console.log(`  - ID: ${account.id}, Nombre: ${account.name}, Plan: ${account.planId}`);
    });
    
    for (const account of onetouch) {
      console.log(`\n🗑️  Eliminando cuenta de negocio: ${account.name} (${account.id})`);
      
      // Delete related records first (in proper order to respect foreign keys)
      console.log('  - Eliminando actividades...');
      const deletedActivities = await db.delete(activities).where(eq(activities.businessAccountId, account.id));
      console.log(`    ✓ ${deletedActivities.rowCount || 0} actividades eliminadas`);
      
      console.log('  - Eliminando oportunidades...');
      const deletedOpportunities = await db.delete(opportunities).where(eq(opportunities.businessAccountId, account.id));
      console.log(`    ✓ ${deletedOpportunities.rowCount || 0} oportunidades eliminadas`);
      
      console.log('  - Eliminando empresas/contactos...');
      const deletedCompanies = await db.delete(companies).where(eq(companies.businessAccountId, account.id));
      console.log(`    ✓ ${deletedCompanies.rowCount || 0} empresas eliminadas`);
      
      console.log('  - Eliminando permisos de usuario...');
      const deletedPermissions = await db.delete(userPermissions).where(eq(userPermissions.businessAccountId, account.id));
      console.log(`    ✓ ${deletedPermissions.rowCount || 0} permisos eliminados`);
      
      console.log('  - Eliminando configuraciones de módulos...');
      const deletedModules = await db.delete(businessAccountModules).where(eq(businessAccountModules.businessAccountId, account.id));
      console.log(`    ✓ ${deletedModules.rowCount || 0} configuraciones de módulos eliminadas`);
      
      console.log('  - Eliminando usuarios...');
      const deletedUsers = await db.delete(users).where(eq(users.businessAccountId, account.id));
      console.log(`    ✓ ${deletedUsers.rowCount || 0} usuarios eliminados`);
      
      console.log('  - Eliminando cuenta de negocio...');
      const deletedAccount = await db.delete(businessAccounts).where(eq(businessAccounts.id, account.id));
      console.log(`    ✓ Cuenta eliminada`);
      
      console.log(`✅ Cuenta ${account.name} eliminada completamente`);
    }
    
    console.log('\n🎉 OneTouch eliminado exitosamente. Ahora puedes crear la empresa de cero.');
    
  } catch (error) {
    console.error('❌ Error al eliminar OneTouch:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

// Run the deletion
deleteOneTouch().catch(console.error);