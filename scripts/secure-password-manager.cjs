#!/usr/bin/env node

/**
 * Gestor Seguro de Contraseñas para ShimliAdmin
 * 
 * Este script genera contraseñas seguras y las almacena de forma segura
 * NO almacena contraseñas en texto plano en el código
 */

require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

class SecurePasswordManager {
  constructor() {
    this.pool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  /**
   * Genera una contraseña segura aleatoria
   */
  generateSecurePassword(length = 16) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    // Asegurar al menos un carácter de cada tipo
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[crypto.randomInt(26)];
    password += 'abcdefghijklmnopqrstuvwxyz'[crypto.randomInt(26)];
    password += '0123456789'[crypto.randomInt(10)];
    password += '!@#$%^&*'[crypto.randomInt(8)];
    
    // Completar el resto
    for (let i = 4; i < length; i++) {
      password += charset[crypto.randomInt(charset.length)];
    }
    
    // Mezclar la contraseña
    return password.split('').sort(() => crypto.randomInt(3) - 1).join('');
  }

  /**
   * Resetea la contraseña de un usuario de forma segura
   */
  async resetUserPassword(email) {
    try {
      // Generar nueva contraseña
      const newPassword = this.generateSecurePassword();
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      
      // Actualizar en base de datos
      const result = await this.pool.query(
        'UPDATE users SET password = $1, updated_at = NOW() WHERE email = $2 RETURNING id, name, email',
        [hashedPassword, email]
      );
      
      if (result.rows.length === 0) {
        throw new Error(`Usuario no encontrado: ${email}`);
      }
      
      const user = result.rows[0];
      
      console.log('✅ Contraseña actualizada exitosamente');
      console.log(`👤 Usuario: ${user.name} (${user.email})`);
      console.log(`🔑 Nueva contraseña: ${newPassword}`);
      console.log('⚠️  IMPORTANTE: Guarda esta contraseña de forma segura');
      console.log('⚠️  La contraseña NO se mostrará nuevamente');
      
      return { user, password: newPassword };
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      throw error;
    }
  }

  /**
   * Verifica que un usuario existe sin exponer información sensible
   */
  async verifyUserExists(email) {
    try {
      const result = await this.pool.query(
        'SELECT id, name, email FROM users WHERE email = $1',
        [email]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error verificando usuario:', error.message);
      return null;
    }
  }

  /**
   * Lista usuarios sin exponer contraseñas
   */
  async listUsers() {
    try {
      const result = await this.pool.query(
        'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
      );
      
      return result.rows;
    } catch (error) {
      console.error('❌ Error listando usuarios:', error.message);
      return [];
    }
  }

  async close() {
    await this.pool.end();
  }
}

// CLI Interface
async function main() {
  const manager = new SecurePasswordManager();
  
  try {
    const command = process.argv[2];
    const email = process.argv[3];
    
    switch (command) {
      case 'reset':
        if (!email) {
          console.log('❌ Uso: node secure-password-manager.js reset <email>');
          process.exit(1);
        }
        
        const user = await manager.verifyUserExists(email);
        if (!user) {
          console.log(`❌ Usuario no encontrado: ${email}`);
          process.exit(1);
        }
        
        await manager.resetUserPassword(email);
        break;
        
      case 'list':
        const users = await manager.listUsers();
        console.log('\n👥 Usuarios en el sistema:');
        users.forEach(user => {
          console.log(`  • ${user.name} (${user.email}) - ${user.role}`);
        });
        break;
        
      case 'verify':
        if (!email) {
          console.log('❌ Uso: node secure-password-manager.js verify <email>');
          process.exit(1);
        }
        
        const existingUser = await manager.verifyUserExists(email);
        if (existingUser) {
          console.log(`✅ Usuario encontrado: ${existingUser.name} (${existingUser.email})`);
        } else {
          console.log(`❌ Usuario no encontrado: ${email}`);
        }
        break;
        
      default:
        console.log('🔐 Gestor Seguro de Contraseñas - ShimliAdmin');
        console.log('');
        console.log('Comandos disponibles:');
        console.log('  reset <email>    - Resetea contraseña de un usuario');
        console.log('  list             - Lista todos los usuarios');
        console.log('  verify <email>   - Verifica si un usuario existe');
        console.log('');
        console.log('Ejemplos:');
        console.log('  node secure-password-manager.js reset luis@sheilim.com');
        console.log('  node secure-password-manager.js list');
        console.log('  node secure-password-manager.js verify admin@example.com');
        break;
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await manager.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = SecurePasswordManager;
