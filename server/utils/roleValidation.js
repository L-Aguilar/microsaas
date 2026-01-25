"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRoleAssignment = validateRoleAssignment;
exports.validateUserModification = validateUserModification;
exports.validateUserDeletion = validateUserDeletion;
exports.getAssignableRoles = getAssignableRoles;
exports.isValidRole = isValidRole;
var secureLogger_1 = require("./secureLogger");
/**
 * Role hierarchy definition
 * Each role can assign/manage the roles listed in their array
 */
var ROLE_HIERARCHY = {
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
function validateRoleAssignment(assignerRole, targetRole, auditContext) {
    try {
        var allowedRoles = ROLE_HIERARCHY[assignerRole] || [];
        var isValid = allowedRoles.includes(targetRole);
        // Audit log the validation attempt
        (0, secureLogger_1.secureLog)({
            level: isValid ? 'info' : 'warn',
            action: 'ROLE_VALIDATION',
            details: {
                assignerRole: assignerRole,
                targetRole: targetRole,
                isValid: isValid,
                allowedRoles: allowedRoles,
                performedBy: auditContext.performedBy,
                businessAccountId: auditContext.businessAccountId,
                ipAddress: auditContext.ipAddress,
                userAgent: auditContext.userAgent
            }
        });
        return isValid;
    }
    catch (error) {
        // Log security error and deny by default
        (0, secureLogger_1.secureLog)({
            level: 'error',
            action: 'ROLE_VALIDATION_ERROR',
            details: {
                assignerRole: assignerRole,
                targetRole: targetRole,
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
function validateUserModification(assignerRole, assignerBusinessAccountId, targetBusinessAccountId, targetRole, auditContext) {
    try {
        // SUPER_ADMIN can modify users across all business accounts
        if (assignerRole === 'SUPER_ADMIN') {
            var canModify = validateRoleAssignment(assignerRole, targetRole, auditContext);
            return canModify;
        }
        // BUSINESS_ADMIN and USER can only modify users within their business account
        if (assignerBusinessAccountId !== targetBusinessAccountId) {
            (0, secureLogger_1.secureLog)({
                level: 'warn',
                action: 'CROSS_ACCOUNT_MODIFICATION_BLOCKED',
                details: {
                    assignerRole: assignerRole,
                    assignerBusinessAccountId: assignerBusinessAccountId,
                    targetBusinessAccountId: targetBusinessAccountId,
                    targetRole: targetRole,
                    performedBy: auditContext.performedBy,
                    ipAddress: auditContext.ipAddress
                }
            });
            return false;
        }
        // Validate role assignment within the same business account
        return validateRoleAssignment(assignerRole, targetRole, auditContext);
    }
    catch (error) {
        (0, secureLogger_1.secureLog)({
            level: 'error',
            action: 'USER_MODIFICATION_VALIDATION_ERROR',
            details: {
                assignerRole: assignerRole,
                assignerBusinessAccountId: assignerBusinessAccountId,
                targetBusinessAccountId: targetBusinessAccountId,
                targetRole: targetRole,
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
function validateUserDeletion(assignerRole, assignerId, targetUserId, targetRole, auditContext) {
    try {
        // Users cannot delete themselves
        if (assignerId === targetUserId) {
            (0, secureLogger_1.secureLog)({
                level: 'warn',
                action: 'SELF_DELETION_BLOCKED',
                details: {
                    assignerId: assignerId,
                    targetUserId: targetUserId,
                    performedBy: auditContext.performedBy,
                    ipAddress: auditContext.ipAddress
                }
            });
            return false;
        }
        // BUSINESS_ADMIN cannot delete other BUSINESS_ADMIN users
        if (assignerRole === 'BUSINESS_ADMIN' && targetRole === 'BUSINESS_ADMIN') {
            (0, secureLogger_1.secureLog)({
                level: 'warn',
                action: 'PEER_ADMIN_DELETION_BLOCKED',
                details: {
                    assignerRole: assignerRole,
                    targetRole: targetRole,
                    assignerId: assignerId,
                    targetUserId: targetUserId,
                    performedBy: auditContext.performedBy,
                    ipAddress: auditContext.ipAddress
                }
            });
            return false;
        }
        // Use role validation for other cases
        return validateRoleAssignment(assignerRole, targetRole, auditContext);
    }
    catch (error) {
        (0, secureLogger_1.secureLog)({
            level: 'error',
            action: 'USER_DELETION_VALIDATION_ERROR',
            details: {
                assignerRole: assignerRole,
                assignerId: assignerId,
                targetUserId: targetUserId,
                targetRole: targetRole,
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
function getAssignableRoles(assignerRole) {
    return ROLE_HIERARCHY[assignerRole] || [];
}
/**
 * Validates if a role is valid
 * @param role - The role to validate
 * @returns boolean indicating if the role is valid
 */
function isValidRole(role) {
    return ['SUPER_ADMIN', 'BUSINESS_ADMIN', 'USER'].includes(role);
}
