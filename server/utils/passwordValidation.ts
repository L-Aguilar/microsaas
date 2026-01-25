import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { secureLog } from './secureLogger';

/**
 * Enhanced password schema with enterprise security standards
 */
export const passwordSchema = z.string()
  .min(12, "La contraseña debe tener al menos 12 caracteres")
  .max(128, "La contraseña no puede exceder 128 caracteres")
  .regex(/[A-Z]/, "Debe contener al menos una letra mayúscula")
  .regex(/[a-z]/, "Debe contener al menos una letra minúscula")
  .regex(/[0-9]/, "Debe contener al menos un número")
  .regex(/[^A-Za-z0-9]/, "Debe contener al menos un símbolo especial")
  .refine((password) => !containsCommonPasswords(password), {
    message: "La contraseña es muy común. Elige una contraseña más segura."
  })
  .refine((password) => !containsSequentialChars(password), {
    message: "La contraseña no puede contener secuencias consecutivas (ej: 123, abc)"
  });

/**
 * List of common passwords to block
 */
const COMMON_PASSWORDS = [
  'password123',
  'admin123',
  'password',
  'admin',
  '123456789',
  'qwerty123',
  'password1',
  'admin1234',
  'contraseña',
  'administrador'
];

/**
 * Password history to prevent reuse
 * In production, this should be stored in database per user
 */
interface PasswordHistory {
  userId: string;
  hashedPasswords: string[];
  maxHistory: number;
}

const passwordHistoryStore = new Map<string, PasswordHistory>();

/**
 * Check if password contains common/weak passwords
 */
function containsCommonPasswords(password: string): boolean {
  const lowerPassword = password.toLowerCase();
  return COMMON_PASSWORDS.some(common => 
    lowerPassword.includes(common.toLowerCase())
  );
}

/**
 * Check if password contains sequential characters
 */
function containsSequentialChars(password: string): boolean {
  const sequences = [
    '123456789',
    'abcdefghijklmnopqrstuvwxyz',
    'qwertyuiop',
    'asdfghjkl',
    'zxcvbnm'
  ];
  
  const lowerPassword = password.toLowerCase();
  
  for (const seq of sequences) {
    for (let i = 0; i <= seq.length - 3; i++) {
      if (lowerPassword.includes(seq.substring(i, i + 3))) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Validate password strength with detailed feedback
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
  score: number; // 0-100
} {
  try {
    const result = passwordSchema.safeParse(password);
    
    let score = 0;
    const errors: string[] = [];
    
    if (result.success) {
      // Calculate password strength score
      score += password.length >= 12 ? 25 : 0; // Length
      score += /[A-Z]/.test(password) ? 15 : 0; // Uppercase
      score += /[a-z]/.test(password) ? 15 : 0; // Lowercase
      score += /[0-9]/.test(password) ? 15 : 0; // Numbers
      score += /[^A-Za-z0-9]/.test(password) ? 15 : 0; // Special chars
      score += password.length >= 16 ? 10 : 0; // Extra length bonus
      score += (/[^A-Za-z0-9].*[^A-Za-z0-9]/.test(password)) ? 5 : 0; // Multiple special chars
      
      return { isValid: true, errors: [], score };
    } else {
      return { 
        isValid: false, 
        errors: result.error.errors.map(e => e.message),
        score 
      };
    }
  } catch (error) {
    secureLog({
      level: 'error',
      action: 'PASSWORD_VALIDATION_ERROR',
      details: { error: error.message }
    });
    
    return {
      isValid: false,
      errors: ['Error validando la contraseña'],
      score: 0
    };
  }
}

/**
 * Hash password with strong settings
 */
export function hashPasswordSecure(password: string): string {
  // Use bcrypt with cost factor 12 (recommended for 2024)
  const saltRounds = 12;
  return bcrypt.hashSync(password, saltRounds);
}

/**
 * Verify password against hash with timing attack protection
 */
export async function verifyPasswordSecure(
  password: string, 
  hashedPassword: string
): Promise<boolean> {
  try {
    // Use bcrypt's built-in timing attack protection
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    secureLog({
      level: 'error',
      action: 'PASSWORD_VERIFICATION_ERROR',
      details: { error: error.message }
    });
    
    // Always return false on error for security
    return false;
  }
}

/**
 * Check if password was recently used (prevents reuse)
 */
export function checkPasswordHistory(
  userId: string, 
  newPassword: string,
  maxHistory: number = 5
): { canUse: boolean; message?: string } {
  try {
    const history = passwordHistoryStore.get(userId);
    
    if (!history) {
      return { canUse: true };
    }
    
    // Check against recent passwords
    for (const oldHash of history.hashedPasswords) {
      if (bcrypt.compareSync(newPassword, oldHash)) {
        return { 
          canUse: false, 
          message: `No puedes reutilizar una de tus últimas ${maxHistory} contraseñas` 
        };
      }
    }
    
    return { canUse: true };
  } catch (error) {
    secureLog({
      level: 'error',
      action: 'PASSWORD_HISTORY_CHECK_ERROR',
      details: { 
        userId,
        error: error.message 
      }
    });
    
    // Allow on error, but log it
    return { canUse: true };
  }
}

/**
 * Add password to history after successful change
 */
export function addToPasswordHistory(
  userId: string, 
  hashedPassword: string,
  maxHistory: number = 5
): void {
  try {
    let history = passwordHistoryStore.get(userId);
    
    if (!history) {
      history = {
        userId,
        hashedPasswords: [],
        maxHistory
      };
    }
    
    // Add new password to history
    history.hashedPasswords.unshift(hashedPassword);
    
    // Keep only the last N passwords
    if (history.hashedPasswords.length > maxHistory) {
      history.hashedPasswords = history.hashedPasswords.slice(0, maxHistory);
    }
    
    passwordHistoryStore.set(userId, history);
    
    secureLog({
      level: 'info',
      action: 'PASSWORD_HISTORY_UPDATED',
      details: { 
        userId,
        historyCount: history.hashedPasswords.length 
      }
    });
  } catch (error) {
    secureLog({
      level: 'error',
      action: 'PASSWORD_HISTORY_UPDATE_ERROR',
      details: { 
        userId,
        error: error.message 
      }
    });
  }
}

/**
 * Generate secure random password
 */
export function generateSecurePassword(length: number = 16): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one of each required character type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Uppercase
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Lowercase  
  password += '0123456789'[Math.floor(Math.random() * 10)]; // Number
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // Special
  
  // Fill remaining length with random characters
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password to randomize positions
  return password.split('').sort(() => Math.random() - 0.5).join('');
}