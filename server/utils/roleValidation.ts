import { secureLog } from './secureLogger';

export type UserRole = 'SUPER_ADMIN' | 'BUSINESS_ADMIN' | 'USER';

interface RoleHierarchy {
  [key: string]: UserRole[];
}

interface AuditContext {
  performedBy: string;
  businessAccountId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Role hierarchy definition
 * Each role can assign/manage the roles listed in their array
 */
const ROLE_HIERARCHY: RoleHierarchy = {
  'SUPER_ADMIN': ['BUSINESS_ADMIN', 'USER'],
  'BUSINESS_ADMIN': ['USER'],
  'USER': [] // Users cannot assign roles to others
};

/**
 * Validates if a user with a specific role can assign/modify another role
 * @param assignerRole - The role of the user performing the action
 * @param targetRole - The role being assigned/modified
 * @param auditContext - Context for audit logging
 * @returns boolean indicating if the action is allowed
 */
export function validateRoleAssignment(
  assignerRole: UserRole, 
  targetRole: UserRole,
  auditContext: AuditContext
): boolean {
  try {
    const allowedRoles = ROLE_HIERARCHY[assignerRole] || [];
    const isValid = allowedRoles.includes(targetRole);
    
    // Audit log the validation attempt
    secureLog({
      level: isValid ? 'info' : 'warn',
      action: 'ROLE_VALIDATION',
      details: {
        assignerRole,
        targetRole,
        isValid,
        allowedRoles,
        performedBy: auditContext.performedBy,
        businessAccountId: auditContext.businessAccountId,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent
      }
    });
    
    return isValid;
  } catch (error) {
    // Log security error and deny by default
    secureLog({
      level: 'error',
      action: 'ROLE_VALIDATION_ERROR',
      details: {
        assignerRole,
        targetRole,
        error: error.message,
        performedBy: auditContext.performedBy
      }
    });
    
    return false;
  }
}

/**
 * Validates if a user can modify another user's information
 * @param assignerRole - The role of the user performing the action
 * @param assignerBusinessAccountId - Business account of the assigner
 * @param targetBusinessAccountId - Business account of the target user
 * @param targetRole - Role of the target user being modified
 * @param auditContext - Context for audit logging
 * @returns boolean indicating if the modification is allowed
 */
export function validateUserModification(
  assignerRole: UserRole,
  assignerBusinessAccountId: string | null,
  targetBusinessAccountId: string | null,
  targetRole: UserRole,
  auditContext: AuditContext
): boolean {
  try {
    // SUPER_ADMIN can modify users across all business accounts
    if (assignerRole === 'SUPER_ADMIN') {
      const canModify = validateRoleAssignment(assignerRole, targetRole, auditContext);
      return canModify;
    }
    
    // BUSINESS_ADMIN and USER can only modify users within their business account
    if (assignerBusinessAccountId !== targetBusinessAccountId) {
      secureLog({
        level: 'warn',
        action: 'CROSS_ACCOUNT_MODIFICATION_BLOCKED',
        details: {
          assignerRole,
          assignerBusinessAccountId,
          targetBusinessAccountId,
          targetRole,
          performedBy: auditContext.performedBy,
          ipAddress: auditContext.ipAddress
        }
      });
      return false;
    }
    
    // Validate role assignment within the same business account
    return validateRoleAssignment(assignerRole, targetRole, auditContext);
    
  } catch (error) {
    secureLog({
      level: 'error',
      action: 'USER_MODIFICATION_VALIDATION_ERROR',
      details: {
        assignerRole,
        assignerBusinessAccountId,
        targetBusinessAccountId,
        targetRole,
        error: error.message,
        performedBy: auditContext.performedBy
      }
    });
    
    return false;
  }
}

/**
 * Validates if a user can delete another user
 * @param assignerRole - The role of the user performing the deletion
 * @param assignerId - ID of the user performing the deletion
 * @param targetUserId - ID of the user being deleted
 * @param targetRole - Role of the user being deleted
 * @param auditContext - Context for audit logging
 * @returns boolean indicating if the deletion is allowed
 */
export function validateUserDeletion(
  assignerRole: UserRole,
  assignerId: string,
  targetUserId: string,
  targetRole: UserRole,
  auditContext: AuditContext
): boolean {
  try {
    // Users cannot delete themselves
    if (assignerId === targetUserId) {
      secureLog({
        level: 'warn',
        action: 'SELF_DELETION_BLOCKED',
        details: {
          assignerId,
          targetUserId,
          performedBy: auditContext.performedBy,
          ipAddress: auditContext.ipAddress
        }
      });
      return false;
    }
    
    // BUSINESS_ADMIN cannot delete other BUSINESS_ADMIN users
    if (assignerRole === 'BUSINESS_ADMIN' && targetRole === 'BUSINESS_ADMIN') {
      secureLog({
        level: 'warn',
        action: 'PEER_ADMIN_DELETION_BLOCKED',
        details: {
          assignerRole,
          targetRole,
          assignerId,
          targetUserId,
          performedBy: auditContext.performedBy,
          ipAddress: auditContext.ipAddress
        }
      });
      return false;
    }
    
    // Use role validation for other cases
    return validateRoleAssignment(assignerRole, targetRole, auditContext);
    
  } catch (error) {
    secureLog({
      level: 'error',
      action: 'USER_DELETION_VALIDATION_ERROR',
      details: {
        assignerRole,
        assignerId,
        targetUserId,
        targetRole,
        error: error.message,
        performedBy: auditContext.performedBy
      }
    });
    
    return false;
  }
}

/**
 * Get available roles that a user can assign based on their role
 * @param assignerRole - The role of the user
 * @returns Array of roles that can be assigned
 */
export function getAssignableRoles(assignerRole: UserRole): UserRole[] {
  return ROLE_HIERARCHY[assignerRole] || [];
}

/**
 * Validates if a role is valid
 * @param role - The role to validate
 * @returns boolean indicating if the role is valid
 */
export function isValidRole(role: string): role is UserRole {
  return ['SUPER_ADMIN', 'BUSINESS_ADMIN', 'USER'].includes(role);
}