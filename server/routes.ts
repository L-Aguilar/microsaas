import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { insertUserSchema, updateUserSchema, insertCompanySchema, updateCompanySchema, insertOpportunitySchema, updateOpportunitySchema, insertActivitySchema, insertModuleSchema, insertBusinessAccountSchema, insertBusinessAccountModuleSchema, insertPlanSchema, insertProductSchema, insertPlanModuleSchema } from "@shared/schema";
import { generateSecurePassword, generateAlphanumericPassword, hashPassword, verifyPassword } from "./utils/password";
import { sendWelcomeEmail } from "./utils/email";
import { sendEmail, sendWelcomeEmail as sendBrevoWelcomeEmail } from "./services/emailService";
import { ReminderService } from "./services/reminderService";
import { secureLog } from "./utils/secureLogger";
import { checkPlanLimits, attachModulePermissions, updateUsageAfterAction } from "./middleware/planLimitsMiddleware";
import { planService } from "./services/planService";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize database with essential data (Super Admin + modules)
  await storage.initializeData();
  
  // Configure PostgreSQL session store
  const PgSession = ConnectPgSimple(session);
  
  app.use(session({
    store: new PgSession({
      pool: pool,
      tableName: 'sessions',
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || (() => {
      console.warn('⚠️  WARNING: Using default session secret. Set SESSION_SECRET environment variable in production!');
      return 'insecure-default-session-secret-change-immediately';
    })(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict', // CSRF protection
    },
    name: 'bizflow_session_id', // Change default session name for security
  }));

  // Health check route for Railway
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Temporary debug endpoint
  app.get("/api/debug-admin", async (req, res) => {
    try {
      const email = process.env.SUPER_ADMIN_EMAIL || "admin@yourcompany.com";
      const user = await storage.getUserByEmail(email);
      res.json({ 
        envEmail: process.env.SUPER_ADMIN_EMAIL || "not_set",
        envPasswordSet: !!process.env.SUPER_ADMIN_PASSWORD,
        userExists: !!user,
        userEmail: user?.email || "no_user"
      });
    } catch (error) {
      res.status(500).json({ error: "Debug failed", message: (error as Error).message });
    }
  });

  // Temporary endpoint to create simple admin for testing
  app.post("/api/create-test-admin", async (req, res) => {
    try {
      const testEmail = "admin@controly.com";
      const testPassword = "admin123";
      
      // Check if already exists
      const existing = await storage.getUserByEmail(testEmail);
      if (existing) {
        return res.json({ message: "Test admin already exists", email: testEmail });
      }

      // Create simple test admin
      const hashedPassword = hashPassword(testPassword);
      const testAdmin = {
        name: "Test Admin",
        email: testEmail,
        password: hashedPassword,
        phone: "+1 555 000 0000",
        role: "SUPER_ADMIN" as const,
        avatar: null,
        businessAccountId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const newUser = await storage.createUser(testAdmin);
      res.json({ 
        message: "Test admin created successfully",
        email: testEmail,
        password: testPassword,
        userId: newUser.id
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to create test admin", message: (error as Error).message });
    }
  });

  // Database debug endpoint
  app.get("/api/debug-db", async (req, res) => {
    try {
      // Check if tables exist
      const tablesResult = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
      `);
      
      // Check users table
      let usersCount = 0;
      let businessAccountsCount = 0;
      try {
        const usersResult = await pool.query('SELECT COUNT(*) FROM users');
        usersCount = parseInt(usersResult.rows[0].count);
      } catch (e) {}
      
      try {
        const baResult = await pool.query('SELECT COUNT(*) FROM business_accounts');
        businessAccountsCount = parseInt(baResult.rows[0].count);
      } catch (e) {}

      res.json({
        tables: tablesResult.rows.map(r => r.table_name),
        usersCount,
        businessAccountsCount,
        dbUrl: process.env.SUPABASE_DATABASE_URL ? "configured" : "not_configured"
      });
    } catch (error) {
      res.status(500).json({ error: "DB debug failed", message: (error as Error).message });
    }
  });

  // Auth middleware to extract user from session
  app.use('/api', (req: any, res, next) => {
    if (req.session?.user) {
      req.user = req.session.user;
    }
    next();
  });

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        // Security audit log for failed login
        secureLog.audit('USER_LOGIN_FAILED', undefined, { 
          email, 
          reason: 'USER_NOT_FOUND',
          ip: req.ip 
        });
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Verify password using custom hash function
      const isValidPassword = verifyPassword(password, user.password);
      
      if (!isValidPassword) {
        // Security audit log for failed login
        secureLog.audit('USER_LOGIN_FAILED', user.id, { 
          email: user.email, 
          reason: 'INVALID_PASSWORD',
          ip: req.ip 
        });
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Create session
      (req as any).session.user = user;

      // Security audit log
      secureLog.audit('USER_LOGIN_SUCCESS', user.id, { 
        email: user.email, 
        role: user.role,
        ip: req.ip 
      });

      res.json({ 
        user: { ...user, password: undefined }
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(400).json({ message: "Invalid request data" });
    }
  });

  app.post("/api/auth/logout", async (req: any, res) => {
    if (req.session) {
      req.session.destroy((err: any) => {
        if (err) {
          console.error("Session destroy error:", err);
          return res.status(500).json({ message: "Logout failed" });
        }
        res.json({ message: "Logged out successfully" });
      });
    } else {
      res.json({ message: "Already logged out" });
    }
  });

  // Get current user
  app.get("/api/auth/user", async (req: any, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json({ ...req.user, password: undefined });
  });

  // Password recovery endpoint
  app.post("/api/auth/recover-password", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: "Email is required" });
      }

      console.log(`🔍 Password recovery requested for: ${email}`);

      // Check if user exists
      const user = await storage.getUserByEmail(email);
      if (!user) {
        console.log(`❌ User not found: ${email}`);
        // Don't reveal if user exists or not for security
        return res.json({ message: "If the email exists, a new password has been sent" });
      }

      console.log(`✅ User found: ${user.name} (${user.email})`);

      // Generate new secure password (alphanumeric only)
      const newPassword = generateAlphanumericPassword(12);
      const { hashPassword } = await import('./utils/password');
      const hashedPassword = hashPassword(newPassword);

      console.log(`🔐 Generated new password for user: ${user.id}`);

      // Update password in database
      const updateResult = await storage.updateUserPasswordById(user.id, hashedPassword);
      
      if (!updateResult) {
        console.error(`❌ Failed to update password for user: ${user.id}`);
        return res.status(500).json({ message: "Failed to update password" });
      }

      console.log(`✅ Password updated in database for user: ${user.id}`);

      // Send email with new password
      try {
        const emailResult = await sendEmail({
          to: user.email,
          toName: user.name,
          from: process.env.FROM_EMAIL || 'noreply@sheilim.com',
          fromName: process.env.FROM_NAME || 'Controly',
          subject: "Recuperación de Contraseña - Controly",
          htmlContent: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>Recuperación de Contraseña - Controly</title>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .password-box { background: #fff; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
                .password { font-size: 24px; font-weight: bold; color: #667eea; letter-spacing: 2px; }
                .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                .warning { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🔐 Recuperación de Contraseña</h1>
                  <p>Controly - Sistema de Gestión</p>
                </div>
                <div class="content">
                  <h2>Hola ${user.name},</h2>
                  <p>Hemos recibido una solicitud para recuperar tu contraseña en Controly.</p>
                  <p>Tu nueva contraseña temporal es:</p>
                  
                  <div class="password-box">
                    <div class="password">${newPassword}</div>
                  </div>
                  
                  <div class="warning">
                    <strong>⚠️ Importante:</strong>
                    <ul>
                      <li>Esta es una contraseña temporal generada automáticamente</li>
                      <li>Te recomendamos cambiarla inmediatamente después de iniciar sesión</li>
                      <li>No compartas esta contraseña con nadie</li>
                    </ul>
                  </div>
                  
                  <p>Puedes iniciar sesión ahora con esta contraseña:</p>
                  <a href="${process.env.BASE_URL || 'http://localhost:5173'}/login" class="button">🚀 Iniciar Sesión</a>
                  
                  <p>Si no solicitaste este cambio de contraseña, por favor contacta al administrador del sistema.</p>
                  
                  <div class="footer">
                    <p>Este email fue enviado automáticamente por Controly</p>
                    <p>© ${new Date().getFullYear()} Controly - Todos los derechos reservados</p>
                  </div>
                </div>
              </div>
            </body>
            </html>
          `,
          textContent: `
            Recuperación de Contraseña - Controly
            
            Hola ${user.name},
            
            Hemos recibido una solicitud para recuperar tu contraseña en Controly.
            
            Tu nueva contraseña temporal es: ${newPassword}
            
            IMPORTANTE:
            - Esta es una contraseña temporal generada automáticamente
            - Te recomendamos cambiarla inmediatamente después de iniciar sesión
            - No compartas esta contraseña con nadie
            
            Puedes iniciar sesión en: ${process.env.BASE_URL || 'http://localhost:5173'}/login
            
            Si no solicitaste este cambio de contraseña, por favor contacta al administrador del sistema.
            
            Este email fue enviado automáticamente por Controly
            © ${new Date().getFullYear()} Controly - Todos los derechos reservados
          `
        });

        if (emailResult) {
          console.log(`✅ Password recovery email sent to ${user.email}`);
        } else {
          console.error(`❌ Failed to send email to ${user.email}`);
        }
      } catch (emailError) {
        console.error("❌ Email sending failed:", emailError);
        // Still return success to not reveal email issues
      }

      res.json({ message: "If the email exists, a new password has been sent" });
    } catch (error) {
      console.error("❌ Password recovery error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });


  // Middleware for authentication (no role check)
  const requireAuth = (req: any, res: any, next: any) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  };

  // Middleware for role-based access control
  const requireRole = (requiredRoles: string | string[]) => {
    return (req: any, res: any, next: any) => {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
      if (!roles.includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      next();
    };
  };

  // Middleware for business account data isolation
  const requireBusinessAccount = (req: any, res: any, next: any) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    // SUPER_ADMIN can access all business accounts
    if (user.role === 'SUPER_ADMIN') {
      return next();
    }
    
    // Other roles must have a business account
    if (!user.businessAccountId) {
      return res.status(403).json({ message: "No business account access" });
    }
    
    // Add businessAccountId to request for filtering
    req.businessAccountId = user.businessAccountId;
    next();
  };

  // Middleware for SUPER_ADMIN only access
  const requireSuperAdmin = (req: any, res: any, next: any) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: "Super admin access required" });
    }
    next();
  };

  // Middleware to check if business account has module enabled
  const requireModule = (moduleType: string) => {
    return async (req: any, res: any, next: any) => {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      // SUPER_ADMIN bypasses module checks
      if (user.role === 'SUPER_ADMIN') {
        return next();
      }
      
      if (!user.businessAccountId) {
        return res.status(400).json({ message: "Business account required" });
      }
      
      const hasModule = await storage.hasModuleEnabled(user.businessAccountId, moduleType);
      if (!hasModule) {
        return res.status(403).json({ message: `Module ${moduleType} not enabled for your organization` });
      }
      next();
    };
  };

  // Get current user's business account modules (for sidebar navigation)
  app.get("/api/user/business-account/modules", requireBusinessAccount, async (req: any, res) => {
    try {
      if (req.user.role === 'SUPER_ADMIN') {
        // SUPER_ADMIN has access to all modules
        const allModules = await storage.getModules();
        const enabledModules = allModules.map(module => ({
          type: module.type,
          isEnabled: true
        }));
        return res.json(enabledModules);
      }

      const businessAccountModules = await storage.getBusinessAccountModules(req.businessAccountId);
      const moduleStatus = businessAccountModules.map(module => ({
        type: module.type,
        isEnabled: module.isEnabled
      }));
      
      res.json(moduleStatus);
    } catch (error) {
      console.error("Error fetching user business account modules:", error);
      res.status(500).json({ message: "Failed to fetch modules" });
    }
  });

  // Business Accounts routes (SUPER_ADMIN only)
  app.get("/api/business-accounts", requireRole('SUPER_ADMIN'), async (req, res) => {
    try {
      const accounts = await storage.getBusinessAccounts();
      res.json(accounts);
    } catch (error) {
      console.error("Error fetching business accounts:", error);
      res.status(500).json({ message: "Failed to fetch business accounts" });
    }
  });

  app.post("/api/business-accounts", requireRole('SUPER_ADMIN'), async (req, res) => {
    try {
      const { enabledModules, ...accountData } = req.body;
      const parsedAccountData = insertBusinessAccountSchema.parse(accountData);
      
      // Create the business account
      const account = await storage.createBusinessAccount(parsedAccountData);
      
      // Enable selected modules
      if (enabledModules && Array.isArray(enabledModules)) {
        const userId = (req as any).user?.id; // Get the super admin ID for tracking
        for (const moduleId of enabledModules) {
          await storage.enableModuleForBusinessAccount(account.id, moduleId, userId || 'system');
        }
      }
      
      res.json(account);
    } catch (error) {
      console.error("Error creating business account:", error);
      res.status(400).json({ message: "Invalid business account data" });
    }
  });

  app.get("/api/business-accounts/:id", requireRole('SUPER_ADMIN'), async (req, res) => {
    try {
      const account = await storage.getBusinessAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ message: "Business account not found" });
      }
      res.json(account);
    } catch (error) {
      console.error("Error fetching business account:", error);
      res.status(500).json({ message: "Failed to fetch business account" });
    }
  });

  app.put("/api/business-accounts/:id", requireRole('SUPER_ADMIN'), async (req, res) => {
    try {
      // Extract contact fields separately before parsing (these are user fields, not business account fields)
      const { contactEmail, contactName, contactPhone, ...businessAccountFields } = req.body;
      const accountData = insertBusinessAccountSchema.partial().parse(businessAccountFields);
      
      // Add contact fields back if they exist (will be handled in updateBusinessAccount)
      if (contactEmail !== undefined) {
        (accountData as any).contactEmail = contactEmail;
      }
      if (contactName !== undefined) {
        (accountData as any).contactName = contactName;
      }
      if (contactPhone !== undefined) {
        (accountData as any).contactPhone = contactPhone;
      }
      
      const account = await storage.updateBusinessAccount(req.params.id, accountData);
      if (!account) {
        return res.status(404).json({ message: "Business account not found" });
      }
      res.json(account);
    } catch (error) {
      console.error("Error updating business account:", error);
      res.status(400).json({ message: "Invalid business account data" });
    }
  });

  app.delete("/api/business-accounts/:id", requireRole('SUPER_ADMIN'), async (req, res) => {
    try {
      const deleted = await storage.deleteBusinessAccount(req.params.id);
      if (deleted) {
        res.json({ message: "Business account deleted successfully" });
      } else {
        res.status(404).json({ message: "Business account not found" });
      }
    } catch (error) {
      console.error("Error deleting business account:", error);
      res.status(500).json({ message: "Failed to delete business account" });
    }
  });

  // Business Account Detail (for SUPER_ADMIN)
  app.get("/api/business-accounts/:id", requireRole('SUPER_ADMIN'), async (req, res) => {
    try {
      const account = await storage.getBusinessAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ message: "Business account not found" });
      }
      res.json(account);
    } catch (error) {
      console.error("Error fetching business account detail:", error);
      res.status(500).json({ message: "Failed to fetch business account" });
    }
  });

  // Get users for a specific business account (for SUPER_ADMIN)
  app.get("/api/business-accounts/:id/users", requireRole('SUPER_ADMIN'), async (req, res) => {
    try {
      const users = await storage.getUsers(req.params.id);
      const safeUsers = users.map(user => ({
        ...user,
        password: undefined,
      }));
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching business account users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get companies for a specific business account (for SUPER_ADMIN)
  app.get("/api/business-accounts/:id/companies", requireRole('SUPER_ADMIN'), async (req, res) => {
    try {
      const companies = await storage.getCompanies(req.params.id);
      res.json(companies);
    } catch (error) {
      console.error("Error fetching business account companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  // Create user for a specific business account (SUPER_ADMIN)
  app.post("/api/business-accounts/:id/users", requireRole('SUPER_ADMIN'), async (req, res) => {
    try {
      let userData = insertUserSchema.parse(req.body);
      
      // Generate secure password if not provided or empty
      if (!userData.password || userData.password.trim() === '') {
        const { generateSecurePassword } = await import('./utils/password');
        userData.password = generateSecurePassword(12);
      }
      
      // Assign to the specified business account
      userData = { ...userData, businessAccountId: req.params.id };
      
      const user = await storage.createUser(userData);
      res.json({ ...user, password: undefined });
    } catch (error) {
      console.error("Error creating user for business account:", error);
      res.status(400).json({ message: "Invalid user data" });
    }
  });

  // Users routes (only for BUSINESS_PLAN within their organization)
  app.get("/api/users", requireRole(['SUPER_ADMIN', 'BUSINESS_PLAN']), requireBusinessAccount, requireModule('USERS'), async (req: any, res) => {
    try {
      const users = await storage.getUsers(req.businessAccountId);
      const safeUsers = users.map(user => ({
        ...user,
        password: undefined,
      }));
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", requireRole(['SUPER_ADMIN', 'BUSINESS_PLAN']), requireBusinessAccount, requireModule('USERS'), checkPlanLimits('USERS', 'create'), async (req: any, res) => {
    try {
      let userData = insertUserSchema.parse(req.body);
      
      // Generate secure password if not provided or empty
      if (!userData.password || userData.password.trim() === '') {
        const { generateSecurePassword } = await import('./utils/password');
        userData.password = generateSecurePassword(12);
      }
      
      // Automatically assign to the BUSINESS_PLAN user's business account
      userData = { ...userData, businessAccountId: req.businessAccountId };
      
      const user = await storage.createUser(userData);
      res.json({ ...user, password: undefined });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(400).json({ message: "Invalid user data" });
    }
  });

  app.put("/api/users/:id", requireRole(['SUPER_ADMIN', 'BUSINESS_PLAN']), requireBusinessAccount, requireModule('USERS'), async (req: any, res) => {
    try {
      // First check if user exists and user has access
      const existingUser = await storage.getUser(req.params.id);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Security check: non-SUPER_ADMIN can only update users from their business account
      if (req.user.role !== 'SUPER_ADMIN' && existingUser.businessAccountId !== req.user.businessAccountId) {
        return res.status(403).json({ message: "Cannot update user from different organization" });
      }
      
      const userData = updateUserSchema.parse(req.body);
      const user = await storage.updateUser(req.params.id, userData);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Remove password from response
      res.json({ ...user, password: undefined });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", requireRole(['SUPER_ADMIN', 'BUSINESS_PLAN']), requireBusinessAccount, requireModule('USERS'), checkPlanLimits('USERS', 'delete'), updateUsageAfterAction('USERS'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Security check: non-SUPER_ADMIN can only delete users from their business account
      if (req.user.role !== 'SUPER_ADMIN' && user.businessAccountId !== req.user.businessAccountId) {
        return res.status(403).json({ message: "Cannot delete user from different organization" });
      }
      
      const deleted = await storage.deleteUser(req.params.id);
      if (deleted) {
        res.json({ message: "User deleted successfully" });
      } else {
        res.status(404).json({ message: "User not found" });
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Get users for current user's business account (for opportunity assignment)
  app.get("/api/user/business-account/users", requireAuth, async (req: any, res) => {
    try {
      const users = await storage.getUsers(req.user.businessAccountId);
      const safeUsers = users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        businessAccountId: user.businessAccountId,
      }));
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching business account users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Change user password endpoint
  app.put("/api/users/:id/password", async (req: any, res) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Users can only change their own password
      if (req.user.id !== req.params.id) {
        return res.status(403).json({ message: "You can only change your own password" });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters long" });
      }

      // Get current user data
      const existingUser = await storage.getUser(req.params.id);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, existingUser.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      // Hash new password
      const saltRounds = 10;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password in database
      const updatedUser = await storage.updateUser(req.params.id, {
        password: hashedNewPassword
      });

      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update password" });
      }

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Update own profile endpoint (for account settings)
  app.put("/api/users/:id/profile", async (req: any, res) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Users can only update their own profile
      if (req.user.id !== req.params.id) {
        return res.status(403).json({ message: "You can only update your own profile" });
      }

      const { name, email, phone } = req.body;

      // Validate required fields
      if (!name || !email) {
        return res.status(400).json({ message: "Name and email are required" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      // Clean phone number to avoid area code duplication
      let cleanPhone = phone;
      if (cleanPhone) {
        // Remove all non-numeric characters except the first +
        cleanPhone = cleanPhone.replace(/[^\d+]/g, '');
        
        // If starts with +504504, clean the duplication
        if (cleanPhone.startsWith('+504504')) {
          cleanPhone = cleanPhone.replace('+504504', '+504');
        }
        // If starts with +504+504, clean the duplication
        else if (cleanPhone.startsWith('+504+504')) {
          cleanPhone = cleanPhone.replace('+504+504', '+504');
        }
        // If doesn't start with +504, add it
        else if (!cleanPhone.startsWith('+504')) {
          cleanPhone = `+504${cleanPhone.replace(/^\+/, '')}`;
        }
      }

      // Check if email is already taken by another user
      const existingUserWithEmail = await storage.getUserByEmail(email);
      if (existingUserWithEmail && existingUserWithEmail.id !== req.params.id) {
        return res.status(400).json({ message: "Email is already taken by another user" });
      }

      // Update user profile
      const updatedUser = await storage.updateUser(req.params.id, {
        name,
        email,
        phone: cleanPhone || null
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Remove password from response
      res.json({ ...updatedUser, password: undefined });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Legacy agent routes (for backward compatibility)
  app.get("/api/agents", requireRole(['SUPER_ADMIN', 'BUSINESS_PLAN']), requireBusinessAccount, async (req: any, res) => {
    try {
      const businessAccountId = req.user.role === 'SUPER_ADMIN' ? req.query.businessAccountId : req.businessAccountId;
      const users = await storage.getUsers(businessAccountId);
      const safeUsers = users.filter(user => user.role === 'USER').map(user => ({
        ...user,
        password: undefined,
      }));
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching agents:", error);
      res.status(500).json({ message: "Failed to fetch agents" });
    }
  });

  // Companies routes (requires COMPANIES module)
  app.get("/api/companies", requireBusinessAccount, requireModule('COMPANIES'), async (req: any, res) => {
    try {
      const businessAccountId = req.user.role === 'SUPER_ADMIN' ? req.query.businessAccountId : req.businessAccountId;
      const companies = await storage.getCompanies(businessAccountId);
      res.json(companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  app.get("/api/companies/:id", requireBusinessAccount, requireModule('COMPANIES'), async (req: any, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      // Security check: non-SUPER_ADMIN can only access companies from their business account
      if (req.user.role !== 'SUPER_ADMIN' && company.businessAccountId !== req.businessAccountId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(company);
    } catch (error) {
      console.error("Error fetching company:", error);
      res.status(500).json({ message: "Failed to fetch company" });
    }
  });

  app.post("/api/companies", requireBusinessAccount, requireModule('COMPANIES'), checkPlanLimits('COMPANIES', 'create'), async (req: any, res) => {
    try {
      const companyData = insertCompanySchema.parse(req.body);
      
      // Create company object with businessAccountId
      const finalCompanyData: any = {
        ...companyData,
        businessAccountId: req.user.role !== 'SUPER_ADMIN' ? req.businessAccountId : (req.body.businessAccountId || req.businessAccountId)
      };
      
      const company = await storage.createCompany(finalCompanyData);
      res.json(company);
    } catch (error) {
      console.error("Error creating company:", error);
      res.status(400).json({ message: "Invalid company data" });
    }
  });

  app.put("/api/companies/:id", requireBusinessAccount, requireModule('COMPANIES'), async (req: any, res) => {
    try {
      // First check if company exists and user has access
      const existingCompany = await storage.getCompany(req.params.id);
      if (!existingCompany) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      if (req.user.role !== 'SUPER_ADMIN' && existingCompany.businessAccountId !== req.businessAccountId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updateData = updateCompanySchema.parse(req.body);
      const company = await storage.updateCompany(req.params.id, updateData);
      res.json(company);
    } catch (error) {
      console.error("Error updating company:", error);
      res.status(400).json({ message: "Invalid update data" });
    }
  });

  app.delete("/api/companies/:id", requireBusinessAccount, requireModule('COMPANIES'), checkPlanLimits('COMPANIES', 'delete'), updateUsageAfterAction('COMPANIES'), async (req: any, res) => {
    try {
      // First check if company exists and user has access
      const existingCompany = await storage.getCompany(req.params.id);
      if (!existingCompany) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      if (req.user.role !== 'SUPER_ADMIN' && existingCompany.businessAccountId !== req.businessAccountId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const deleted = await storage.deleteCompany(req.params.id);
      if (deleted) {
        res.json({ message: "Company deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete company" });
      }
    } catch (error) {
      console.error("Error deleting company:", error);
      res.status(500).json({ message: "Failed to delete company" });
    }
  });

  // Modules routes - accessible for form creation
  app.get("/api/modules", async (req, res) => {
    try {
      const modules = await storage.getModules();
      res.json(modules);
    } catch (error) {
      console.error("Error fetching modules:", error);
      res.status(500).json({ message: "Failed to fetch modules" });
    }
  });

  // Business account modules (new approach)
  app.get("/api/business-accounts/:businessAccountId/modules", requireRole(['SUPER_ADMIN', 'BUSINESS_PLAN']), async (req: any, res) => {
    try {
      const { businessAccountId } = req.params;
      
      // Security check: non-SUPER_ADMIN can only access their own business account modules
      if (req.user.role !== 'SUPER_ADMIN' && req.user.businessAccountId !== businessAccountId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const modules = await storage.getBusinessAccountModules(businessAccountId);
      res.json(modules);
    } catch (error) {
      console.error("Error fetching business account modules:", error);
      res.status(500).json({ message: "Failed to fetch business account modules" });
    }
  });

  app.post("/api/business-accounts/:businessAccountId/modules/:moduleId/enable", requireRole(['SUPER_ADMIN', 'BUSINESS_PLAN']), async (req: any, res) => {
    try {
      const { businessAccountId, moduleId } = req.params;
      const enabledBy = req.user.id;
      
      // Security check: non-SUPER_ADMIN can only enable modules for their own business account
      if (req.user.role !== 'SUPER_ADMIN' && req.user.businessAccountId !== businessAccountId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const success = await storage.enableModuleForBusinessAccount(businessAccountId, moduleId, enabledBy);
      if (!success) {
        return res.status(400).json({ message: "Failed to enable module" });
      }
      
      res.json({ message: "Module enabled successfully" });
    } catch (error) {
      console.error("Error enabling module:", error);
      res.status(500).json({ message: "Failed to enable module" });
    }
  });

  app.post("/api/business-accounts/:businessAccountId/modules/:moduleId/disable", requireRole(['SUPER_ADMIN', 'BUSINESS_PLAN']), async (req: any, res) => {
    try {
      const { businessAccountId, moduleId } = req.params;
      
      // Security check: non-SUPER_ADMIN can only disable modules for their own business account
      if (req.user.role !== 'SUPER_ADMIN' && req.user.businessAccountId !== businessAccountId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const success = await storage.disableModuleForBusinessAccount(businessAccountId, moduleId);
      if (!success) {
        return res.status(400).json({ message: "Failed to disable module" });
      }
      
      res.json({ message: "Module disabled successfully" });
    } catch (error) {
      console.error("Error disabling module:", error);
      res.status(500).json({ message: "Failed to disable module" });
    }
  });

  // Legacy company modules routes (for backward compatibility)
  app.get("/api/companies/:companyId/modules", requireBusinessAccount, async (req: any, res) => {
    try {
      const { companyId } = req.params;
      const modules = await storage.getCompanyModules(companyId);
      res.json(modules);
    } catch (error) {
      console.error("Error fetching company modules:", error);
      res.status(500).json({ message: "Failed to fetch company modules" });
    }
  });

  // Opportunities routes (requires CRM module)
  app.get("/api/opportunities", requireBusinessAccount, requireModule('CRM'), async (req: any, res) => {
    try {
      const businessAccountId = req.user.role === 'SUPER_ADMIN' ? req.query.businessAccountId : req.businessAccountId;
      const opportunities = await storage.getOpportunities(businessAccountId);
      res.json(opportunities);
    } catch (error) {
      console.error("Error fetching opportunities:", error);
      res.status(500).json({ message: "Failed to fetch opportunities" });
    }
  });

  app.get("/api/opportunities/:id", requireBusinessAccount, requireModule('CRM'), async (req: any, res) => {
    try {
      const opportunity = await storage.getOpportunity(req.params.id);
      if (!opportunity) {
        return res.status(404).json({ message: "Opportunity not found" });
      }
      
      // Security check: non-SUPER_ADMIN can only access opportunities from their business account
      if (req.user.role !== 'SUPER_ADMIN' && opportunity.company.businessAccountId !== req.businessAccountId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(opportunity);
    } catch (error) {
      console.error("Error fetching opportunity:", error);
      res.status(500).json({ message: "Failed to fetch opportunity" });
    }
  });

  app.post("/api/opportunities", requireBusinessAccount, requireModule('CRM'), async (req: any, res) => {
    try {
      // Verify company belongs to user's business account
      const companyId = req.body.companyId;
      if (!companyId) {
        return res.status(400).json({ message: "Company ID is required" });
      }
      
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      if (req.user.role !== 'SUPER_ADMIN' && company.businessAccountId !== req.businessAccountId) {
        return res.status(403).json({ message: "Cannot create opportunity for company from different organization" });
      }
      
      // Prepare opportunity data
      let dataWithDefaults = {
        ...req.body,
      };
      
      // Add business account ID for non-SUPER_ADMIN users
      if (req.user.role !== 'SUPER_ADMIN') {
        dataWithDefaults = { ...dataWithDefaults, businessAccountId: req.businessAccountId };
      }
      
      // Convert estimatedCloseDate string to Date if provided
      if (dataWithDefaults.estimatedCloseDate && typeof dataWithDefaults.estimatedCloseDate === 'string') {
        dataWithDefaults.estimatedCloseDate = new Date(dataWithDefaults.estimatedCloseDate);
      }
      
      const opportunityData = insertOpportunitySchema.parse(dataWithDefaults);
      const opportunity = await storage.createOpportunity(opportunityData);
      res.json(opportunity);
    } catch (error) {
      console.error("Error creating opportunity:", error);
      res.status(400).json({ message: "Invalid opportunity data" });
    }
  });

  app.put("/api/opportunities/:id", requireBusinessAccount, requireModule('CRM'), async (req: any, res) => {
    try {
      // Get opportunity to check access
      const existingOpp = await storage.getOpportunity(req.params.id);
      if (!existingOpp) {
        return res.status(404).json({ message: "Opportunity not found" });
      }
      
      // Security check: non-SUPER_ADMIN can only update opportunities from their business account
      if (req.user.role !== 'SUPER_ADMIN' && existingOpp.company.businessAccountId !== req.businessAccountId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updateData = updateOpportunitySchema.parse(req.body);
      const opportunity = await storage.updateOpportunity(req.params.id, updateData);
      res.json(opportunity);
    } catch (error) {
      console.error("Error updating opportunity:", error);
      res.status(400).json({ message: "Invalid update data" });
    }
  });

  app.delete("/api/opportunities/:id", requireBusinessAccount, requireModule('CRM'), async (req: any, res) => {
    try {
      // Get opportunity to check access
      const existingOpp = await storage.getOpportunity(req.params.id);
      if (!existingOpp) {
        return res.status(404).json({ message: "Opportunity not found" });
      }
      
      // Security check: non-SUPER_ADMIN can only delete opportunities from their business account
      if (req.user.role !== 'SUPER_ADMIN' && existingOpp.company.businessAccountId !== req.businessAccountId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const deleted = await storage.deleteOpportunity(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Opportunity not found" });
      }
      res.json({ message: "Opportunity deleted successfully" });
    } catch (error) {
      console.error("Error deleting opportunity:", error);
      
      // Check if it's our custom validation error
      if (error instanceof Error && error.message.includes("No se puede eliminar la oportunidad")) {
        return res.status(400).json({ 
          message: error.message,
          code: "HAS_ACTIVITIES" 
        });
      }
      
      res.status(500).json({ message: "Failed to delete opportunity" });
    }
  });

  // Activities routes (requires CRM module)
  app.get("/api/activities", requireBusinessAccount, requireModule('CRM'), async (req: any, res) => {
    try {
      const businessAccountId = req.user.role === 'SUPER_ADMIN' ? req.query.businessAccountId : req.businessAccountId;
      const activities = await storage.getActivities(businessAccountId);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  app.get("/api/opportunities/:id/activities", requireBusinessAccount, requireModule('CRM'), async (req: any, res) => {
    try {
      // First check if user has access to this opportunity
      const opportunity = await storage.getOpportunity(req.params.id);
      if (!opportunity) {
        return res.status(404).json({ message: "Opportunity not found" });
      }
      
      // Security check: non-SUPER_ADMIN can only access opportunities from their business account
      if (req.user.role !== 'SUPER_ADMIN' && opportunity.company.businessAccountId !== req.businessAccountId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const activities = await storage.getActivitiesByOpportunity(req.params.id);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  app.post("/api/activities", requireBusinessAccount, requireModule('CRM'), async (req: any, res) => {
    try {
      console.log("Activity data received:", req.body);
      
      // Validate that authorId is not empty
      if (!req.body.authorId) {
        return res.status(400).json({ message: "Author ID is required" });
      }
      
      // Check if opportunity exists and get its company
      const opportunityId = req.body.opportunityId;
      if (!opportunityId) {
        return res.status(400).json({ message: "Opportunity ID is required" });
      }
      
      const opportunity = await storage.getOpportunity(opportunityId);
      if (!opportunity) {
        return res.status(404).json({ message: "Opportunity not found" });
      }
      
      // Security check: non-SUPER_ADMIN can only create activities for opportunities from their business account
      if (req.user.role !== 'SUPER_ADMIN' && opportunity.company.businessAccountId !== req.businessAccountId) {
        return res.status(403).json({ message: "Cannot create activity for opportunity from different organization" });
      }
      
      // Convert activityDate string to Date object if needed
      let activityPayload = {
        ...req.body,
        activityDate: typeof req.body.activityDate === 'string' 
          ? new Date(req.body.activityDate) 
          : req.body.activityDate
      };
      
      // Add business account ID for non-SUPER_ADMIN users
      if (req.user.role !== 'SUPER_ADMIN') {
        activityPayload = { ...activityPayload, businessAccountId: req.businessAccountId };
      }
      
      const activityData = insertActivitySchema.parse(activityPayload);
      const activity = await storage.createActivity(activityData);
      res.json(activity);
    } catch (error) {
      console.error("Activity validation error:", error);
      if (error instanceof Error) {
        res.status(400).json({ message: "Invalid activity data", error: error.message });
      } else {
        res.status(400).json({ message: "Invalid activity data" });
      }
    }
  });

  // Reports routes (requires CRM module)
  app.get("/api/reports/stats", requireBusinessAccount, requireModule('CRM'), async (req: any, res) => {
    try {
      let businessAccountId;
      
      if (req.user.role === 'SUPER_ADMIN') {
        // SUPER_ADMIN can query specific business account or get all data
        businessAccountId = req.query.businessAccountId;
        if (!businessAccountId) {
          // If no specific business account, get all data
          const allOpportunities = await storage.getAllOpportunities();
          const allCompanies = await storage.getAllCompanies();
          const allActivities = await storage.getAllActivities();
          
          // Calculate stats for all data
          const totalWon = allOpportunities.filter(opp => opp.status === 'WON').length;
          const totalNegotiation = allOpportunities.filter(opp => opp.status === 'NEGOTIATION').length;
          const totalOpportunities = allOpportunities.length;
          const activeCompanies = allCompanies.filter(company => company.status === 'ACTIVE').length;
          
          const activitiesToday = allActivities.filter(activity => {
            const today = new Date();
            const activityDate = new Date(activity.activityDate);
            return activityDate.toDateString() === today.toDateString();
          }).length;
          
          const opportunitiesByStatus = allOpportunities.reduce((acc, opp) => {
            acc[opp.status] = (acc[opp.status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          
          const opportunitiesBySeller = allOpportunities.reduce((acc, opp) => {
            const sellerName = opp.seller.name;
            acc[sellerName] = (acc[sellerName] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          
          const activitiesByType = allActivities.reduce((acc, activity) => {
            acc[activity.type] = (acc[activity.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          
          return res.json({
            totalWon,
            totalNegotiation,
            activeCompanies,
            activitiesToday,
            totalOpportunities,
            opportunitiesByStatus,
            amountsBySeller: opportunitiesBySeller,
            activitiesByType,
          });
        }
      } else {
        businessAccountId = req.businessAccountId;
      }
      
      const opportunities = await storage.getOpportunities(businessAccountId);
      const companies = await storage.getCompanies(businessAccountId);
      const activities = await storage.getActivities(businessAccountId);

      // Count opportunities instead of relying on amount since form doesn't use it
      const totalWon = opportunities.filter(opp => opp.status === 'WON').length;
      const totalNegotiation = opportunities.filter(opp => opp.status === 'NEGOTIATION').length;
      const totalOpportunities = opportunities.length;

      const activeCompanies = companies.filter(company => company.status === 'ACTIVE').length;

      const activitiesToday = activities.filter(activity => {
        const today = new Date();
        const activityDate = new Date(activity.activityDate);
        return activityDate.toDateString() === today.toDateString();
      }).length;

      const opportunitiesByStatus = opportunities.reduce((acc, opp) => {
        acc[opp.status] = (acc[opp.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const opportunitiesBySeller = opportunities.reduce((acc, opp) => {
        const sellerName = opp.seller.name;
        acc[sellerName] = (acc[sellerName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const activitiesByType = activities.reduce((acc, activity) => {
        acc[activity.type] = (acc[activity.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>); 

      res.json({
        totalWon,
        totalNegotiation,
        activeCompanies,
        activitiesToday,
        totalOpportunities,
        opportunitiesByStatus,
        amountsBySeller: opportunitiesBySeller,
        activitiesByType,
      });
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  // Email test endpoint (development only)
  // Initialize reminder service
  const reminderService = new ReminderService();

  // Send daily reminders to all users (public endpoint for external tools)
  app.post("/api/reminders/send-daily", async (req, res) => {
    try {
      console.log('🔔 Enviando recordatorios diarios...');
      
      const result = await reminderService.sendDailyReminders();
      
      res.json({
        message: `Recordatorios enviados: ${result.sent}, Errores: ${result.errors.length}`,
        sent: result.sent,
        errors: result.errors
      });
      
    } catch (error) {
      console.error("Error sending daily reminders:", error);
      res.status(500).json({ 
        message: "Error enviando recordatorios diarios",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Send daily reminders with token authentication (more secure)
  app.post("/api/reminders/send-daily-secure", async (req, res) => {
    try {
      const { token } = req.body;
      
      // Verify token (you can set this in your .env)
      const expectedToken = process.env.REMINDER_TOKEN || 'default-reminder-token';
      
      if (!token || token !== expectedToken) {
        return res.status(401).json({ 
          message: "Token de autenticación inválido" 
        });
      }
      
      console.log('🔔 Enviando recordatorios diarios (con token)...');
      
      const result = await reminderService.sendDailyReminders();
      
      res.json({
        message: `Recordatorios enviados: ${result.sent}, Errores: ${result.errors.length}`,
        sent: result.sent,
        errors: result.errors
      });
      
    } catch (error) {
      console.error("Error sending daily reminders:", error);
      res.status(500).json({ 
        message: "Error enviando recordatorios diarios",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get user/seller metrics and performance data
  app.get("/api/users/:id/metrics", requireBusinessAccount, requireModule('CRM'), async (req: any, res) => {
    try {
      const { id: userId } = req.params;
      
      // Verify user exists and belongs to the business account
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      // Security check: non-SUPER_ADMIN can only access users from their business account
      if (req.user.role !== 'SUPER_ADMIN' && user.businessAccountId !== req.businessAccountId) {
        return res.status(403).json({ message: "Acceso denegado" });
      }
      
      // Get all opportunities for this seller
      const allOpportunities = await storage.getOpportunities(req.businessAccountId);
      const userOpportunities = allOpportunities.filter(opp => opp.sellerId === userId);
      
      // Get all activities for opportunities of this seller
      const allActivities = await storage.getActivities(req.businessAccountId);
      const userActivities = allActivities.filter(activity => 
        userOpportunities.some(opp => opp.id === activity.opportunityId)
      );
      
      // Calculate metrics
      const totalOpportunities = userOpportunities.length;
      const wonOpportunities = userOpportunities.filter(opp => opp.status === 'WON').length;
      const lostOpportunities = userOpportunities.filter(opp => opp.status === 'LOST').length;
      const inProgressOpportunities = userOpportunities.filter(opp => 
        ['NEW', 'IN_PROGRESS', 'NEGOTIATION'].includes(opp.status)
      ).length;
      
      const conversionRate = totalOpportunities > 0 ? (wonOpportunities / totalOpportunities) * 100 : 0;
      
      // Activities this week
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const activitiesThisWeek = userActivities.filter(activity => {
        const activityDate = new Date(activity.activityDate);
        return activityDate >= weekAgo;
      }).length;
      
      // Opportunities by status
      const opportunitiesByStatus = userOpportunities.reduce((acc, opp) => {
        acc[opp.status] = (acc[opp.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // Recent opportunities (last 10)
      const recentOpportunities = userOpportunities
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10)
        .map(opp => ({
          id: opp.id,
          title: opp.title,
          status: opp.status,
          companyName: opp.company.name,
          createdAt: opp.createdAt,
          estimatedCloseDate: opp.estimatedCloseDate,
        }));
      
      // Recent activities (last 10)
      const recentActivities = userActivities
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10)
        .map(activity => ({
          id: activity.id,
          type: activity.type,
          details: activity.details,
          activityDate: activity.activityDate,
          opportunityTitle: userOpportunities.find(opp => opp.id === activity.opportunityId)?.title || 'N/A',
          createdAt: activity.createdAt,
        }));
      
      res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        metrics: {
          totalOpportunities,
          wonOpportunities,
          lostOpportunities,
          inProgressOpportunities,
          conversionRate: Math.round(conversionRate * 100) / 100,
          activitiesThisWeek,
          totalActivities: userActivities.length,
        },
        opportunitiesByStatus,
        recentOpportunities,
        recentActivities,
      });
    } catch (error) {
      console.error("Error fetching user metrics:", error);
      res.status(500).json({ message: "Error al obtener métricas del usuario" });
    }
  });

  // Send reminder to specific user
  app.post("/api/reminders/send-to-user/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      
      const success = await reminderService.sendReminderToUser(userId);
      
      if (success) {
        res.json({ message: "Recordatorio enviado correctamente" });
      } else {
        res.json({ message: "Usuario no tiene oportunidades pendientes" });
      }
      
    } catch (error) {
      console.error("Error sending reminder to user:", error);
      res.status(500).json({ 
        message: "Error enviando recordatorio",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get alerts for opportunities needing attention
  app.get("/api/alerts", requireBusinessAccount, requireModule('CRM'), async (req: any, res) => {
    try {
      const businessAccountId = req.user.role === 'SUPER_ADMIN' 
        ? req.query.businessAccountId 
        : req.businessAccountId;
      
      if (!businessAccountId && req.user.role !== 'SUPER_ADMIN') {
        return res.status(400).json({ message: "Business account required" });
      }
      
      const opportunities = await storage.getOpportunities(businessAccountId);
      const activities = await storage.getActivities(businessAccountId);
      
      const now = new Date();
      const alerts: Array<{
        type: 'stale_opportunity' | 'upcoming_close' | 'no_activity';
        severity: 'high' | 'medium' | 'low';
        message: string;
        opportunityId: string;
        opportunityTitle: string;
        companyName: string;
        sellerName: string;
        daysSinceLastActivity?: number;
        daysUntilClose?: number;
      }> = [];
      
      // Group activities by opportunity
      const activitiesByOpportunity = activities.reduce((acc, activity) => {
        if (!acc[activity.opportunityId]) {
          acc[activity.opportunityId] = [];
        }
        acc[activity.opportunityId].push(activity);
        return acc;
      }, {} as Record<string, typeof activities>);
      
      // Check each opportunity
      for (const opp of opportunities) {
        // Skip won/lost opportunities
        if (opp.status === 'WON' || opp.status === 'LOST') continue;
        
        const oppActivities = activitiesByOpportunity[opp.id] || [];
        const lastActivity = oppActivities.length > 0
          ? oppActivities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
          : null;
        
        const daysSinceLastActivity = lastActivity
          ? Math.floor((now.getTime() - new Date(lastActivity.createdAt).getTime()) / (1000 * 60 * 60 * 24))
          : Math.floor((now.getTime() - new Date(opp.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        
        // Alert: No activity in 7+ days (HIGH severity)
        if (daysSinceLastActivity >= 7) {
          alerts.push({
            type: 'stale_opportunity',
            severity: daysSinceLastActivity >= 14 ? 'high' : 'medium',
            message: `Sin actividad por ${daysSinceLastActivity} días`,
            opportunityId: opp.id,
            opportunityTitle: opp.title,
            companyName: opp.company.name,
            sellerName: opp.seller.name,
            daysSinceLastActivity,
          });
        }
        
        // Alert: Upcoming close date (3 days or less)
        if (opp.estimatedCloseDate) {
          const closeDate = new Date(opp.estimatedCloseDate);
          const daysUntilClose = Math.floor((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysUntilClose >= 0 && daysUntilClose <= 3) {
            alerts.push({
              type: 'upcoming_close',
              severity: daysUntilClose === 0 ? 'high' : daysUntilClose <= 1 ? 'high' : 'medium',
              message: daysUntilClose === 0 
                ? 'Fecha de cierre es hoy' 
                : `Fecha de cierre en ${daysUntilClose} día${daysUntilClose > 1 ? 's' : ''}`,
              opportunityId: opp.id,
              opportunityTitle: opp.title,
              companyName: opp.company.name,
              sellerName: opp.seller.name,
              daysUntilClose,
            });
          }
        }
        
        // Alert: New opportunity with no activity (3+ days)
        if (!lastActivity && daysSinceLastActivity >= 3) {
          alerts.push({
            type: 'no_activity',
            severity: 'medium',
            message: `Oportunidad nueva sin actividad (${daysSinceLastActivity} días)`,
            opportunityId: opp.id,
            opportunityTitle: opp.title,
            companyName: opp.company.name,
            sellerName: opp.seller.name,
            daysSinceLastActivity,
          });
        }
      }
      
      // Sort by severity (high first) and then by days
      alerts.sort((a, b) => {
        const severityOrder = { high: 0, medium: 1, low: 2 };
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
          return severityOrder[a.severity] - severityOrder[b.severity];
        }
        const daysA = a.daysSinceLastActivity ?? a.daysUntilClose ?? 0;
        const daysB = b.daysSinceLastActivity ?? b.daysUntilClose ?? 0;
        return daysB - daysA;
      });
      
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ message: "Error al obtener alertas" });
    }
  });

  // Get reminder data for a user (for dashboard)
  app.get("/api/reminders/user-data/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      
      const usersData = await reminderService.getOpenOpportunitiesNeedingFollowup();
      const userData = usersData.find(u => u.userId === userId);
      
      if (!userData) {
        return res.json({
          hasReminders: false,
          message: "No hay oportunidades pendientes"
        });
      }
      
      res.json({
        hasReminders: true,
        data: userData
      });
      
    } catch (error) {
      console.error("Error getting user reminder data:", error);
      res.status(500).json({ 
        message: "Error obteniendo datos de recordatorios",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/test-email", async (req, res) => {
    try {
      const emailTo = req.body.to || "luis@onetouch.hn";
      
      const success = await sendEmail({
        to: emailTo,
        toName: "Luis",
        from: "noreply@crm-moderno.com", 
        fromName: "CRM Moderno",
        subject: "Test email from CRM Moderno",
        htmlContent: "<h1>¡Email funcionando!</h1><p>El servicio de email con Brevo está configurado correctamente.</p><p>Este es un email de prueba enviado desde tu CRM.</p>",
        textContent: "¡Email funcionando! El servicio de email con Brevo está configurado correctamente. Este es un email de prueba enviado desde tu CRM."
      });

      if (success) {
        res.json({ message: "Email sent successfully via Brevo", status: "success" });
      } else {
        res.status(500).json({ message: "Failed to send email", status: "error" });
      }
    } catch (error) {
      console.error("Email test error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Email service error", status: "error", error: errorMessage });
    }
  });

  // ========== SAAS PLANS ROUTES ==========

  // Plans Management Routes (SUPER_ADMIN only)
  app.get("/api/plans", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const plans = await storage.getPlans();
      res.json(plans);
    } catch (error) {
      console.error("Error fetching plans:", error);
      res.status(500).json({ message: "Error al obtener planes" });
    }
  });

  app.post("/api/plans", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const planData = insertPlanSchema.parse(req.body);
      const plan = await storage.createPlan(planData);
      res.json(plan);
    } catch (error) {
      console.error("Error creating plan:", error);
      res.status(500).json({ message: "Error al crear plan" });
    }
  });

  app.put("/api/plans/:id", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const planData = insertPlanSchema.partial().parse(req.body);
      const plan = await storage.updatePlan(id, planData);
      
      if (!plan) {
        return res.status(404).json({ message: "Plan no encontrado" });
      }
      
      res.json(plan);
    } catch (error) {
      console.error("Error updating plan:", error);
      res.status(500).json({ message: "Error al actualizar plan" });
    }
  });

  app.delete("/api/plans/:id", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deletePlan(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Plan no encontrado" });
      }
      
      res.json({ message: "Plan eliminado correctamente" });
    } catch (error) {
      console.error("Error deleting plan:", error);
      
      // Check if it's a validation error (plan in use)
      if (error instanceof Error && error.message.includes("está siendo usado por")) {
        return res.status(400).json({ 
          message: error.message,
          type: "PLAN_IN_USE"
        });
      }
      
      res.status(500).json({ message: "Error al eliminar plan" });
    }
  });

  // Update Plan Dual Prices (Monthly and Annual) with Customer Application Options
  app.put("/api/plans/:id/prices", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { monthlyPrice, annualPrice, applyToExistingCustomers } = req.body;
      
      // Validate prices
      if ((!monthlyPrice && !annualPrice) || 
          (monthlyPrice && isNaN(parseFloat(monthlyPrice))) ||
          (annualPrice && isNaN(parseFloat(annualPrice)))) {
        return res.status(400).json({ message: "Al menos un precio válido es requerido (mensual o anual)" });
      }
      
      // Get current plan
      const currentPlan = await storage.getPlan(id);
      if (!currentPlan) {
        return res.status(404).json({ message: "Plan no encontrado" });
      }
      
      // Update the plan prices
      const updateData: any = {};
      if (monthlyPrice) {
        updateData.monthlyPrice = monthlyPrice.toString();
        updateData.price = monthlyPrice.toString(); // Keep legacy field updated
      }
      if (annualPrice) {
        updateData.annualPrice = annualPrice.toString();
      }
      
      const updatedPlan = await storage.updatePlan(id, updateData);
      
      if (!updatedPlan) {
        return res.status(500).json({ message: "Error al actualizar plan" });
      }
      
      // If applyToExistingCustomers is true, update all existing subscriptions
      if (applyToExistingCustomers === true) {
        try {
          // Update business account plans that use this plan
          await storage.updateBusinessAccountPlanDualPrices(id, {
            monthlyPrice: monthlyPrice?.toString(),
            annualPrice: annualPrice?.toString()
          });
          
          console.log(`Updated dual prices for existing customers using plan ${id}`);
        } catch (customerUpdateError) {
          console.error("Error updating existing customer plan prices:", customerUpdateError);
          // Continue execution - log error but don't fail the plan update
        }
      }
      
      res.json({
        plan: updatedPlan,
        message: applyToExistingCustomers 
          ? "Plan actualizado y precios aplicados a clientes existentes" 
          : "Plan actualizado para nuevos clientes únicamente",
        appliedToExisting: applyToExistingCustomers || false
      });
      
    } catch (error) {
      console.error("Error updating plan prices:", error);
      res.status(500).json({ message: "Error al actualizar precios del plan" });
    }
  });

  // Products Management Routes (SUPER_ADMIN only)
  app.get("/api/products", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Error al obtener productos" });
    }
  });

  app.post("/api/products", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(productData);
      res.json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Error al crear producto" });
    }
  });

  app.put("/api/products/:id", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const productData = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(id, productData);
      
      if (!product) {
        return res.status(404).json({ message: "Producto no encontrado" });
      }
      
      res.json(product);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Error al actualizar producto" });
    }
  });

  app.delete("/api/products/:id", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteProduct(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Producto no encontrado" });
      }
      
      res.json({ message: "Producto eliminado correctamente" });
    } catch (error) {
      console.error("Error deleting product:", error);
      
      // Check if it's a validation error (product in use)
      if (error instanceof Error && error.message.includes("está siendo usado por")) {
        return res.status(400).json({ 
          message: error.message,
          type: "PRODUCT_IN_USE"
        });
      }
      
      res.status(500).json({ message: "Error al eliminar producto" });
    }
  });

  // Update Product Price with Customer Application Options (Legacy endpoint)
  app.put("/api/products/:id/price", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { price, billingFrequency, applyToExistingCustomers } = req.body;
      
      // Validate price and billingFrequency
      if (!price || isNaN(parseFloat(price))) {
        return res.status(400).json({ message: "Precio válido es requerido" });
      }
      
      if (!billingFrequency || !['MONTHLY', 'ANNUAL'].includes(billingFrequency)) {
        return res.status(400).json({ message: "Frecuencia de facturación válida es requerida" });
      }
      
      // Get current product
      const currentProduct = await storage.getProduct(id);
      if (!currentProduct) {
        return res.status(404).json({ message: "Producto no encontrado" });
      }
      
      // Update the product price and billing frequency
      const updatedProduct = await storage.updateProduct(id, {
        price: price.toString(),
        billingFrequency
      });
      
      if (!updatedProduct) {
        return res.status(500).json({ message: "Error al actualizar producto" });
      }
      
      // If applyToExistingCustomers is true, update all existing subscriptions
      if (applyToExistingCustomers === true) {
        try {
          // Update business account products that use this product
          await storage.updateBusinessAccountProductPrices(id, {
            unitPrice: price.toString(),
            billingFrequency
          });
          
          console.log(`Updated price for existing customers using product ${id}`);
        } catch (updateError) {
          console.error("Error updating existing customer prices:", updateError);
          // Don't fail the main operation, just log the error
        }
      }
      
      res.json({ 
        message: applyToExistingCustomers 
          ? "Precio actualizado para producto y clientes existentes" 
          : "Precio actualizado solo para nuevos clientes",
        product: updatedProduct 
      });
      
    } catch (error) {
      console.error("Error updating product price:", error);
      res.status(500).json({ message: "Error al actualizar precio del producto" });
    }
  });

  // Update Product Dual Prices (Monthly and Annual) with Customer Application Options
  app.put("/api/products/:id/prices", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { monthlyPrice, annualPrice, applyToExistingCustomers } = req.body;
      
      // Validate prices
      if ((!monthlyPrice && !annualPrice) || 
          (monthlyPrice && isNaN(parseFloat(monthlyPrice))) ||
          (annualPrice && isNaN(parseFloat(annualPrice)))) {
        return res.status(400).json({ message: "Al menos un precio válido es requerido (mensual o anual)" });
      }
      
      // Get current product
      const currentProduct = await storage.getProduct(id);
      if (!currentProduct) {
        return res.status(404).json({ message: "Producto no encontrado" });
      }
      
      // Update the product prices
      const updateData: any = {};
      if (monthlyPrice) {
        updateData.monthlyPrice = monthlyPrice.toString(); // Use camelCase for the storage method
        updateData.price = monthlyPrice.toString(); // Keep legacy field updated
      }
      if (annualPrice) {
        updateData.annualPrice = annualPrice.toString(); // Use camelCase for the storage method
      }
      
      const updatedProduct = await storage.updateProduct(id, updateData);
      
      if (!updatedProduct) {
        return res.status(500).json({ message: "Error al actualizar producto" });
      }
      
      // If applyToExistingCustomers is true, update all existing subscriptions
      if (applyToExistingCustomers === true) {
        try {
          // Update business account products that use this product
          // For dual pricing, we update based on their current billing frequency
          await storage.updateBusinessAccountProductDualPrices(id, {
            monthlyPrice: monthlyPrice?.toString(),
            annualPrice: annualPrice?.toString()
          });
          
          console.log(`Updated dual prices for existing customers using product ${id}`);
        } catch (updateError) {
          console.error("Error updating existing customer prices:", updateError);
          // Don't fail the main operation, just log the error
        }
      }
      
      res.json({ 
        message: applyToExistingCustomers 
          ? "Precios actualizados para producto y clientes existentes" 
          : "Precios actualizados solo para nuevos clientes",
        product: updatedProduct 
      });
      
    } catch (error) {
      console.error("Error updating product prices:", error);
      res.status(500).json({ message: "Error al actualizar precios del producto" });
    }
  });

  // Plan Modules Routes (SUPER_ADMIN only)
  app.get("/api/plan-modules", requireAuth, requireSuperAdmin, async (req: any, res) => {
    try {
      const planId = req.query.planId as string;
      if (!planId) {
        return res.status(400).json({ message: "Plan ID is required" });
      }
      
      const modules = await storage.getPlanModules(planId);
      res.json(modules);
    } catch (error) {
      console.error("Error fetching plan modules:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/plan-modules", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const planModuleData = insertPlanModuleSchema.parse(req.body);
      const planModule = await storage.createPlanModule(planModuleData);
      res.json(planModule);
    } catch (error) {
      console.error("Error creating plan module:", error);
      res.status(500).json({ message: "Error al crear módulo de plan" });
    }
  });

  // Available Plans for Business Accounts (all authenticated users can see these)
  app.get("/api/plans/available", requireAuth, async (req, res) => {
    try {
      const plans = await storage.getPlans();
      const activePlans = plans.filter(plan => plan.status === 'ACTIVE');
      res.json(activePlans);
    } catch (error) {
      console.error("Error fetching available plans:", error);
      res.status(500).json({ message: "Error al obtener planes disponibles" });
    }
  });

  // Available Products for Business Accounts
  app.get("/api/products/available", requireAuth, async (req, res) => {
    try {
      const products = await storage.getProducts();
      const activeProducts = products.filter(product => product.isActive);
      res.json(activeProducts);
    } catch (error) {
      console.error("Error fetching available products:", error);
      res.status(500).json({ message: "Error al obtener productos disponibles" });
    }
  });

  // Current Subscription for Business Account
  app.get("/api/subscription", requireAuth, requireBusinessAccount, async (req: any, res) => {
    try {
      const businessAccountId = req.businessAccountId;
      
      // Get current plan
      const currentPlan = await storage.getBusinessAccountPlan(businessAccountId);
      
      // Get additional products
      const additionalProducts = await storage.getBusinessAccountProducts(businessAccountId);
      
      // Get usage data
      const usageRecords = await storage.getPlanUsage(businessAccountId);
      const usage: Record<string, { current: number; limit: number | null }> = {};
      
      for (const record of usageRecords) {
        const currentCount = await storage.getCurrentUsageCount(businessAccountId, record.moduleType);
        
        // Get limit from plan modules
        let limit = null;
        if (currentPlan?.plan.modules) {
          const planModule = currentPlan.plan.modules.find(m => m.moduleType === record.moduleType);
          limit = planModule?.itemLimit || null;
        }
        
        usage[record.moduleType] = { current: currentCount, limit };
      }
      
      res.json({
        currentPlan,
        additionalProducts,
        usage
      });
    } catch (error) {
      console.error("Error fetching subscription:", error);
      res.status(500).json({ message: "Error al obtener suscripción" });
    }
  });

  // Change Plan
  app.post("/api/subscription/change-plan", requireAuth, requireBusinessAccount, async (req: any, res) => {
    try {
      const { planId } = req.body;
      const businessAccountId = req.businessAccountId;
      
      // Validate plan exists and is active
      const newPlan = await storage.getPlan(planId);
      if (!newPlan || newPlan.status !== 'ACTIVE') {
        return res.status(400).json({ message: "Plan no válido" });
      }
      
      // Check current subscription
      const currentSubscription = await storage.getBusinessAccountPlan(businessAccountId);
      
      if (currentSubscription) {
        // Update existing subscription
        await storage.updateBusinessAccountPlan(currentSubscription.id, {
          planId,
          totalAmount: newPlan.price,
          billingFrequency: newPlan.billingFrequency
        });
      } else {
        // Create new subscription
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + newPlan.trialDays);
        
        await storage.createBusinessAccountPlan({
          businessAccountId,
          planId,
          status: 'TRIAL',
          trialEndDate,
          billingFrequency: newPlan.billingFrequency,
          totalAmount: newPlan.price,
          currency: 'USD',
          autoRenew: true
        });
      }
      
      res.json({ message: "Plan actualizado correctamente" });
    } catch (error) {
      console.error("Error changing plan:", error);
      res.status(500).json({ message: "Error al cambiar plan" });
    }
  });

  // Add Product
  app.post("/api/subscription/add-product", requireAuth, requireBusinessAccount, async (req: any, res) => {
    try {
      const { productId, quantity = 1 } = req.body;
      const businessAccountId = req.businessAccountId;
      
      // Validate product exists and is active
      const product = await storage.getProduct(productId);
      if (!product || !product.isActive) {
        return res.status(400).json({ message: "Producto no válido" });
      }
      
      const totalAmount = parseFloat(product.price) * quantity;
      
      await storage.createBusinessAccountProduct({
        businessAccountId,
        productId,
        quantity,
        status: 'ACTIVE',
        unitPrice: product.price,
        totalAmount: totalAmount.toString(),
        billingFrequency: product.billingFrequency,
        autoRenew: true
      });
      
      res.json({ message: "Producto agregado correctamente" });
    } catch (error) {
      console.error("Error adding product:", error);
      res.status(500).json({ message: "Error al agregar producto" });
    }
  });

  // Remove Product
  app.delete("/api/subscription/products/:productId", requireAuth, requireBusinessAccount, async (req: any, res) => {
    try {
      const { productId } = req.params;
      const businessAccountId = req.businessAccountId;
      
      // Find the business account product
      const products = await storage.getBusinessAccountProducts(businessAccountId);
      const productToRemove = products.find(p => p.id === productId);
      
      if (!productToRemove) {
        return res.status(404).json({ message: "Producto no encontrado en tu suscripción" });
      }
      
      await storage.deleteBusinessAccountProduct(productId);
      
      res.json({ message: "Producto eliminado correctamente" });
    } catch (error) {
      console.error("Error removing product:", error);
      res.status(500).json({ message: "Error al eliminar producto" });
    }
  });

  // Module Permissions Check
  app.get("/api/module-permissions/:moduleType", requireAuth, requireBusinessAccount, async (req: any, res) => {
    try {
      const { moduleType } = req.params;
      const businessAccountId = req.businessAccountId;
      
      const permissions = await planService.getModulePermissions(businessAccountId, moduleType);
      res.json(permissions);
    } catch (error) {
      console.error("Error getting module permissions:", error);
      res.status(500).json({ message: "Error al obtener permisos del módulo" });
    }
  });


  const httpServer = createServer(app);
  return httpServer;
}
