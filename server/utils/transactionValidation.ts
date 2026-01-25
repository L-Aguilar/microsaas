import { PoolClient, Pool } from 'pg';
import { pool } from '../db';
import { secureLog } from './secureLogger';
import { User } from '@shared/schema';

interface TransactionContext {
  userId?: string;
  businessAccountId?: string;
  ipAddress?: string;
  userAgent?: string;
  action: string;
}

/**
 * Execute a function within a database transaction with proper error handling
 * and audit logging
 */
export async function withTransaction<T>(
  operation: (client: PoolClient) => Promise<T>,
  context: TransactionContext
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    secureLog({
      level: 'info',
      action: 'TRANSACTION_START',
      details: {
        action: context.action,
        userId: context.userId,
        businessAccountId: context.businessAccountId,
        ipAddress: context.ipAddress
      }
    });

    const result = await operation(client);

    await client.query('COMMIT');

    secureLog({
      level: 'info',
      action: 'TRANSACTION_COMMIT',
      details: {
        action: context.action,
        userId: context.userId,
        businessAccountId: context.businessAccountId,
        ipAddress: context.ipAddress
      }
    });

    return result;
  } catch (error: any) {
    await client.query('ROLLBACK');

    secureLog({
      level: 'error',
      action: 'TRANSACTION_ROLLBACK',
      details: {
        action: context.action,
        userId: context.userId,
        businessAccountId: context.businessAccountId,
        ipAddress: context.ipAddress,
        error: error?.message || 'Unknown error'
      }
    });

    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get user with row-level lock for atomic updates
 */
export async function getUserForUpdate(
  client: PoolClient,
  userId: string
): Promise<User | null> {
  try {
    const result = await client.query(`
      SELECT 
        id, name, email, phone, role, business_account_id,
        created_at, updated_at, password as hashed_password, avatar
      FROM users 
      WHERE id = $1
      FOR UPDATE
    `, [userId]);

    return result.rows[0] || null;
  } catch (error: any) {
    secureLog({
      level: 'error',
      action: 'GET_USER_FOR_UPDATE_ERROR',
      details: {
        userId,
        error: error?.message || 'Unknown error'
      }
    });
    throw error;
  }
}

/**
 * Atomically update user with validation
 */
export async function updateUserAtomic(
  userId: string,
  updates: Partial<User>,
  validationFn: (user: User) => boolean | Promise<boolean>,
  context: TransactionContext
): Promise<User> {
  return withTransaction(async (client) => {
    // Get user with lock
    const existingUser = await getUserForUpdate(client, userId);

    if (!existingUser) {
      throw new Error('Usuario no encontrado');
    }

    // Run validation function
    const isValid = await validationFn(existingUser);
    if (!isValid) {
      throw new Error('Validación falló: operación no permitida');
    }

    // Whitelist of updatable fields - security: only allow specific fields
    const UPDATABLE_FIELDS: Record<string, string> = {
      'name': 'name',
      'email': 'email',
      'phone': 'phone',
      'avatar': 'avatar',
      'role': 'role'
    };

    // Filter updates to only include whitelisted fields
    const filteredUpdates: Record<string, any> = {};
    Object.entries(updates).forEach(([key, value]) => {
      if (key in UPDATABLE_FIELDS && value !== undefined && value !== null) {
        filteredUpdates[key] = value;
      }
    });

    if (Object.keys(filteredUpdates).length === 0) {
      return existingUser;
    }

    // Prepare update query with whitelisted fields
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.entries(filteredUpdates).forEach(([key, value]) => {
      const columnName = UPDATABLE_FIELDS[key];
      updateFields.push(`${columnName} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    });

    // Add updated_at timestamp
    updateFields.push(`updated_at = $${paramIndex}`);
    values.push(new Date());
    paramIndex++;

    // Add user id for WHERE clause
    values.push(userId);

    const query = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, email, phone, role, avatar, business_account_id, created_at, updated_at
    `;

    secureLog({
      level: 'debug',
      action: 'UPDATE_USER_SQL_DEBUG',
      details: {
        userId,
        query: query.substring(0, 200),
        updatableFields: Object.keys(filteredUpdates),
        paramCount: values.length
      }
    });

    const result = await client.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Usuario no encontrado después de actualizar');
    }

    secureLog({
      level: 'info',
      action: 'USER_UPDATED_ATOMIC',
      details: {
        userId,
        updates: Object.keys(filteredUpdates),
        performedBy: context.userId,
        businessAccountId: context.businessAccountId,
        ipAddress: context.ipAddress
      }
    });

    return result.rows[0];
  }, context);
}

/**
 * Atomically delete user with validation
 */
export async function deleteUserAtomic(
  userId: string,
  validationFn: (user: User) => boolean | Promise<boolean>,
  context: TransactionContext
): Promise<boolean> {
  return withTransaction(async (client) => {
    // Get user with lock
    const existingUser = await getUserForUpdate(client, userId);

    if (!existingUser) {
      throw new Error('Usuario no encontrado');
    }

    // Run validation function
    const isValid = await validationFn(existingUser);
    if (!isValid) {
      throw new Error('Validación falló: eliminación no permitida');
    }

    // Mark user as inactive (soft delete approach without explicit is_deleted column)
    await client.query(`
      UPDATE users 
      SET email = CONCAT('deleted_', id, '_', email), updated_at = NOW()
      WHERE id = $1
    `, [userId]);

    secureLog({
      level: 'info',
      action: 'USER_DELETED_ATOMIC',
      details: {
        userId,
        userName: existingUser.name,
        userEmail: existingUser.email,
        performedBy: context.userId,
        businessAccountId: context.businessAccountId,
        ipAddress: context.ipAddress
      }
    });

    return true;
  }, context);
}

/**
 * Atomically create user with validation
 */
export async function createUserAtomic(
  userData: Partial<User>,
  validationFn: (userData: Partial<User>) => boolean | Promise<boolean>,
  context: TransactionContext
): Promise<User> {
  return withTransaction(async (client) => {
    // Run validation function
    const isValid = await validationFn(userData);
    if (!isValid) {
      throw new Error('Validación falló: creación no permitida');
    }

    // Check if email already exists
    const existingUser = await client.query(`
      SELECT id FROM users 
      WHERE email = $1
    `, [userData.email]);

    if (existingUser.rows.length > 0) {
      throw new Error('Ya existe un usuario con este email');
    }

    // Prepare insert values
    const fields = ['id', 'created_at', 'updated_at'];
    const values = [require('crypto').randomUUID(), new Date(), new Date()];
    const placeholders = ['$1', '$2', '$3'];
    let paramIndex = 4;

    // Add provided fields
    Object.entries(userData).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'created_at' && key !== 'updated_at') {
        fields.push(key);
        values.push(value);
        placeholders.push(`$${paramIndex}`);
        paramIndex++;
      }
    });

    const query = `
      INSERT INTO users (${fields.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    const result = await client.query(query, values);

    secureLog({
      level: 'info',
      action: 'USER_CREATED_ATOMIC',
      details: {
        newUserId: result.rows[0].id,
        userName: userData.name,
        userEmail: userData.email,
        userRole: userData.role,
        performedBy: context.userId,
        businessAccountId: context.businessAccountId,
        ipAddress: context.ipAddress
      }
    });

    return result.rows[0];
  }, context);
}

/**
 * Atomically update user permissions
 */
export async function updateUserPermissionsAtomic(
  userId: string,
  permissions: Record<string, Record<string, boolean>>,
  validationFn: (user: User) => boolean | Promise<boolean>,
  context: TransactionContext
): Promise<void> {
  return withTransaction(async (client) => {
    // Get user with lock to validate
    const existingUser = await getUserForUpdate(client, userId);

    if (!existingUser) {
      throw new Error('Usuario no encontrado');
    }

    // Run validation function
    const isValid = await validationFn(existingUser);
    if (!isValid) {
      throw new Error('Validación falló: actualización de permisos no permitida');
    }

    // Delete existing permissions for this user
    await client.query(`
      DELETE FROM user_permissions 
      WHERE user_id = $1
    `, [userId]);

    // Insert new permissions
    for (const [moduleType, perms] of Object.entries(permissions)) {
      await client.query(`
        INSERT INTO user_permissions (
          user_id, module_type, business_account_id, can_view, can_create, can_edit, can_delete
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        userId,
        moduleType,
        existingUser.businessAccountId,
        perms.canView || false,
        perms.canCreate || false,
        perms.canEdit || false,
        perms.canDelete || false
      ]);
    }

    secureLog({
      level: 'info',
      action: 'USER_PERMISSIONS_UPDATED_ATOMIC',
      details: {
        userId,
        userName: existingUser.name,
        modules: Object.keys(permissions),
        performedBy: context.userId,
        businessAccountId: context.businessAccountId,
        ipAddress: context.ipAddress
      }
    });
  }, context);
}