"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withTransaction = withTransaction;
exports.getUserForUpdate = getUserForUpdate;
exports.updateUserAtomic = updateUserAtomic;
exports.deleteUserAtomic = deleteUserAtomic;
exports.createUserAtomic = createUserAtomic;
exports.updateUserPermissionsAtomic = updateUserPermissionsAtomic;
var db_1 = require("../db");
var secureLogger_1 = require("./secureLogger");
/**
 * Execute a function within a database transaction with proper error handling
 * and audit logging
 */
function withTransaction(operation, context) {
    return __awaiter(this, void 0, void 0, function () {
        var client, result, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, db_1.pool.connect()];
                case 1:
                    client = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 6, 8, 9]);
                    return [4 /*yield*/, client.query('BEGIN')];
                case 3:
                    _a.sent();
                    (0, secureLogger_1.secureLog)({
                        level: 'info',
                        action: 'TRANSACTION_START',
                        details: {
                            action: context.action,
                            userId: context.userId,
                            businessAccountId: context.businessAccountId,
                            ipAddress: context.ipAddress
                        }
                    });
                    return [4 /*yield*/, operation(client)];
                case 4:
                    result = _a.sent();
                    return [4 /*yield*/, client.query('COMMIT')];
                case 5:
                    _a.sent();
                    (0, secureLogger_1.secureLog)({
                        level: 'info',
                        action: 'TRANSACTION_COMMIT',
                        details: {
                            action: context.action,
                            userId: context.userId,
                            businessAccountId: context.businessAccountId,
                            ipAddress: context.ipAddress
                        }
                    });
                    return [2 /*return*/, result];
                case 6:
                    error_1 = _a.sent();
                    return [4 /*yield*/, client.query('ROLLBACK')];
                case 7:
                    _a.sent();
                    (0, secureLogger_1.secureLog)({
                        level: 'error',
                        action: 'TRANSACTION_ROLLBACK',
                        details: {
                            action: context.action,
                            userId: context.userId,
                            businessAccountId: context.businessAccountId,
                            ipAddress: context.ipAddress,
                            error: (error_1 === null || error_1 === void 0 ? void 0 : error_1.message) || 'Unknown error'
                        }
                    });
                    throw error_1;
                case 8:
                    client.release();
                    return [7 /*endfinally*/];
                case 9: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get user with row-level lock for atomic updates
 */
function getUserForUpdate(client, userId) {
    return __awaiter(this, void 0, void 0, function () {
        var result, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, client.query("\n      SELECT \n        id, name, email, phone, role, business_account_id,\n        created_at, updated_at, password as hashed_password, avatar\n      FROM users \n      WHERE id = $1\n      FOR UPDATE\n    ", [userId])];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.rows[0] || null];
                case 2:
                    error_2 = _a.sent();
                    (0, secureLogger_1.secureLog)({
                        level: 'error',
                        action: 'GET_USER_FOR_UPDATE_ERROR',
                        details: {
                            userId: userId,
                            error: (error_2 === null || error_2 === void 0 ? void 0 : error_2.message) || 'Unknown error'
                        }
                    });
                    throw error_2;
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Atomically update user with validation
 */
function updateUserAtomic(userId, updates, validationFn, context) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            return [2 /*return*/, withTransaction(function (client) { return __awaiter(_this, void 0, void 0, function () {
                    var existingUser, isValid, UPDATABLE_FIELDS, filteredUpdates, updateFields, values, paramIndex, query, result;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, getUserForUpdate(client, userId)];
                            case 1:
                                existingUser = _a.sent();
                                if (!existingUser) {
                                    throw new Error('Usuario no encontrado');
                                }
                                return [4 /*yield*/, validationFn(existingUser)];
                            case 2:
                                isValid = _a.sent();
                                if (!isValid) {
                                    throw new Error('Validación falló: operación no permitida');
                                }
                                UPDATABLE_FIELDS = {
                                    'name': 'name',
                                    'email': 'email',
                                    'phone': 'phone',
                                    'avatar': 'avatar',
                                    'role': 'role',
                                    'businessAccountId': 'business_account_id'
                                };
                                filteredUpdates = {};
                                Object.entries(updates).forEach(function (_a) {
                                    var key = _a[0], value = _a[1];
                                    if (key in UPDATABLE_FIELDS && value !== undefined && value !== null) {
                                        filteredUpdates[key] = value;
                                    }
                                });
                                if (Object.keys(filteredUpdates).length === 0) {
                                    return [2 /*return*/, existingUser];
                                }
                                updateFields = [];
                                values = [];
                                paramIndex = 1;
                                Object.entries(filteredUpdates).forEach(function (_a) {
                                    var key = _a[0], value = _a[1];
                                    var columnName = UPDATABLE_FIELDS[key];
                                    updateFields.push("".concat(columnName, " = $").concat(paramIndex));
                                    values.push(value);
                                    paramIndex++;
                                });
                                // Add updated_at timestamp
                                updateFields.push("updated_at = $".concat(paramIndex));
                                values.push(new Date());
                                paramIndex++;
                                // Add user id for WHERE clause
                                values.push(userId);
                                query = "\n      UPDATE users \n      SET ".concat(updateFields.join(', '), "\n      WHERE id = $").concat(paramIndex, "\n      RETURNING id, name, email, phone, role, avatar, business_account_id, created_at, updated_at\n    ");
                                (0, secureLogger_1.secureLog)({
                                    level: 'debug',
                                    action: 'UPDATE_USER_SQL_DEBUG',
                                    details: {
                                        userId: userId,
                                        query: query.substring(0, 200),
                                        updatableFields: Object.keys(filteredUpdates),
                                        paramCount: values.length
                                    }
                                });
                                return [4 /*yield*/, client.query(query, values)];
                            case 3:
                                result = _a.sent();
                                if (result.rows.length === 0) {
                                    throw new Error('Usuario no encontrado después de actualizar');
                                }
                                (0, secureLogger_1.secureLog)({
                                    level: 'info',
                                    action: 'USER_UPDATED_ATOMIC',
                                    details: {
                                        userId: userId,
                                        updates: Object.keys(filteredUpdates),
                                        performedBy: context.userId,
                                        businessAccountId: context.businessAccountId,
                                        ipAddress: context.ipAddress
                                    }
                                });
                                return [2 /*return*/, result.rows[0]];
                        }
                    });
                }); }, context)];
        });
    });
}
/**
 * Atomically delete user with validation
 */
function deleteUserAtomic(userId, validationFn, context) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            return [2 /*return*/, withTransaction(function (client) { return __awaiter(_this, void 0, void 0, function () {
                    var existingUser, isValid;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, getUserForUpdate(client, userId)];
                            case 1:
                                existingUser = _a.sent();
                                if (!existingUser) {
                                    throw new Error('Usuario no encontrado');
                                }
                                return [4 /*yield*/, validationFn(existingUser)];
                            case 2:
                                isValid = _a.sent();
                                if (!isValid) {
                                    throw new Error('Validación falló: eliminación no permitida');
                                }
                                // Mark user as inactive (soft delete approach without explicit is_deleted column)
                                return [4 /*yield*/, client.query("\n      UPDATE users \n      SET email = CONCAT('deleted_', id, '_', email), updated_at = NOW()\n      WHERE id = $1\n    ", [userId])];
                            case 3:
                                // Mark user as inactive (soft delete approach without explicit is_deleted column)
                                _a.sent();
                                (0, secureLogger_1.secureLog)({
                                    level: 'info',
                                    action: 'USER_DELETED_ATOMIC',
                                    details: {
                                        userId: userId,
                                        userName: existingUser.name,
                                        userEmail: existingUser.email,
                                        performedBy: context.userId,
                                        businessAccountId: context.businessAccountId,
                                        ipAddress: context.ipAddress
                                    }
                                });
                                return [2 /*return*/, true];
                        }
                    });
                }); }, context)];
        });
    });
}
/**
 * Atomically create user with validation
 */
function createUserAtomic(userData, validationFn, context) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            return [2 /*return*/, withTransaction(function (client) { return __awaiter(_this, void 0, void 0, function () {
                    var isValid, existingUser, fields, values, placeholders, paramIndex, query, result;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, validationFn(userData)];
                            case 1:
                                isValid = _a.sent();
                                if (!isValid) {
                                    throw new Error('Validación falló: creación no permitida');
                                }
                                return [4 /*yield*/, client.query("\n      SELECT id FROM users \n      WHERE email = $1\n    ", [userData.email])];
                            case 2:
                                existingUser = _a.sent();
                                if (existingUser.rows.length > 0) {
                                    throw new Error('Ya existe un usuario con este email');
                                }
                                fields = ['id', 'created_at', 'updated_at'];
                                values = [require('crypto').randomUUID(), new Date(), new Date()];
                                placeholders = ['$1', '$2', '$3'];
                                paramIndex = 4;
                                // Add provided fields
                                Object.entries(userData).forEach(function (_a) {
                                    var key = _a[0], value = _a[1];
                                    if (value !== undefined && key !== 'id' && key !== 'created_at' && key !== 'updated_at') {
                                        fields.push(key);
                                        values.push(value);
                                        placeholders.push("$".concat(paramIndex));
                                        paramIndex++;
                                    }
                                });
                                query = "\n      INSERT INTO users (".concat(fields.join(', '), ")\n      VALUES (").concat(placeholders.join(', '), ")\n      RETURNING *\n    ");
                                return [4 /*yield*/, client.query(query, values)];
                            case 3:
                                result = _a.sent();
                                (0, secureLogger_1.secureLog)({
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
                                return [2 /*return*/, result.rows[0]];
                        }
                    });
                }); }, context)];
        });
    });
}
/**
 * Atomically update user permissions
 */
function updateUserPermissionsAtomic(userId, permissions, validationFn, context) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            return [2 /*return*/, withTransaction(function (client) { return __awaiter(_this, void 0, void 0, function () {
                    var existingUser, isValid, _i, _a, _b, moduleType, perms;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0: return [4 /*yield*/, getUserForUpdate(client, userId)];
                            case 1:
                                existingUser = _c.sent();
                                if (!existingUser) {
                                    throw new Error('Usuario no encontrado');
                                }
                                return [4 /*yield*/, validationFn(existingUser)];
                            case 2:
                                isValid = _c.sent();
                                if (!isValid) {
                                    throw new Error('Validación falló: actualización de permisos no permitida');
                                }
                                // Delete existing permissions for this user
                                return [4 /*yield*/, client.query("\n      DELETE FROM user_permissions \n      WHERE user_id = $1\n    ", [userId])];
                            case 3:
                                // Delete existing permissions for this user
                                _c.sent();
                                _i = 0, _a = Object.entries(permissions);
                                _c.label = 4;
                            case 4:
                                if (!(_i < _a.length)) return [3 /*break*/, 7];
                                _b = _a[_i], moduleType = _b[0], perms = _b[1];
                                return [4 /*yield*/, client.query("\n        INSERT INTO user_permissions (\n          user_id, module_type, business_account_id, can_view, can_create, can_edit, can_delete\n        ) VALUES ($1, $2, $3, $4, $5, $6, $7)\n      ", [
                                        userId,
                                        moduleType,
                                        existingUser.businessAccountId,
                                        perms.canView || false,
                                        perms.canCreate || false,
                                        perms.canEdit || false,
                                        perms.canDelete || false
                                    ])];
                            case 5:
                                _c.sent();
                                _c.label = 6;
                            case 6:
                                _i++;
                                return [3 /*break*/, 4];
                            case 7:
                                (0, secureLogger_1.secureLog)({
                                    level: 'info',
                                    action: 'USER_PERMISSIONS_UPDATED_ATOMIC',
                                    details: {
                                        userId: userId,
                                        userName: existingUser.name,
                                        modules: Object.keys(permissions),
                                        performedBy: context.userId,
                                        businessAccountId: context.businessAccountId,
                                        ipAddress: context.ipAddress
                                    }
                                });
                                return [2 /*return*/];
                        }
                    });
                }); }, context)];
        });
    });
}
