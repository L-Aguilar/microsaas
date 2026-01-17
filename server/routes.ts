import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import crypto from "crypto";
import { insertUserSchema, updateUserSchema, insertCompanySchema, updateCompanySchema, insertOpportunitySchema, updateOpportunitySchema, insertActivitySchema, insertModuleSchema, insertBusinessAccountSchema, insertBusinessAccountModuleSchema, insertPlanSchema, insertProductSchema, insertPlanModuleSchema } from "@shared/schema";
import { generateSecurePassword, generateAlphanumericPassword, hashPassword, verifyPassword } from "./utils/password";
import bcrypt from "bcryptjs";
import { sendWelcomeEmail } from "./utils/email";
import { sendEmail, sendWelcomeEmail as sendBrevoWelcomeEmail } from "./services/emailService";
import { ReminderService } from "./services/reminderService";
import { secureLog } from "./utils/secureLogger";
import { generateToken } from "./utils/jwt.js";
import { requireAuth, requireRole, requireSuperAdmin, requireBusinessAccount, authLimiter } from "./middleware/jwtAuth.js";
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
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      jwtConfigured: !!process.env.JWT_SECRET,
      dbConfigured: !!process.env.SUPABASE_DATABASE_URL,
      corsOrigin: process.env.CORS_ORIGIN || 'default'
    });
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

  // Simple database connection test
  app.get("/api/test-db-connection", async (req, res) => {
    try {
      const result = await pool.query('SELECT NOW() as current_time');
      res.json({ 
        status: "connected",
        time: result.rows[0].current_time,
        message: "Database connection successful"
      });
    } catch (error) {
      res.status(500).json({ 
        status: "failed",
        error: (error as Error).message 
      });
    }
  });

  // Add missing columns to users table
  app.post("/api/migrate-users-table", async (req, res) => {
    try {
      // Add missing columns to existing users table
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS phone VARCHAR,
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
      `);
      
      res.json({ message: "Users table migration completed successfully", status: "success" });
    } catch (error) {
      console.error("Migration error:", error);
      res.status(500).json({ message: "Migration failed", error: (error as Error).message });
    }
  });

  // Auto-setup database tables (run migration)
  app.post("/api/setup-database", async (req, res) => {
    try {
      // Run the migration script automatically
      const migrationSQL = `
        -- Crear tablas principales
        CREATE TABLE IF NOT EXISTS sessions (
          sid VARCHAR PRIMARY KEY,
          sess JSON NOT NULL,
          expire TIMESTAMP NOT NULL
        );

        CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions(expire);

        CREATE TABLE IF NOT EXISTS business_accounts (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR NOT NULL,
          email VARCHAR,
          status VARCHAR DEFAULT 'ACTIVE',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS modules (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR NOT NULL,
          type VARCHAR NOT NULL,
          description VARCHAR,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR NOT NULL,
          email VARCHAR UNIQUE NOT NULL,
          password VARCHAR NOT NULL,
          role VARCHAR NOT NULL DEFAULT 'USER',
          business_account_id VARCHAR REFERENCES business_accounts(id),
          phone VARCHAR,
          is_active BOOLEAN DEFAULT true,
          email_verified BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS business_account_modules (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          business_account_id VARCHAR NOT NULL REFERENCES business_accounts(id),
          module_id VARCHAR NOT NULL REFERENCES modules(id),
          is_enabled BOOLEAN DEFAULT true,
          enabled_by VARCHAR REFERENCES users(id),
          enabled_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS companies (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR NOT NULL,
          email VARCHAR,
          phone VARCHAR,
          website VARCHAR,
          industry VARCHAR,
          status VARCHAR DEFAULT 'LEAD',
          business_account_id VARCHAR NOT NULL REFERENCES business_accounts(id),
          owner_id VARCHAR REFERENCES users(id),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS opportunities (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          title VARCHAR NOT NULL,
          type VARCHAR DEFAULT 'NEW_CLIENT',
          status VARCHAR DEFAULT 'NEW',
          amount NUMERIC,
          probability INTEGER DEFAULT 0,
          estimated_close_date DATE,
          company_id VARCHAR NOT NULL REFERENCES companies(id),
          seller_id VARCHAR REFERENCES users(id),
          business_account_id VARCHAR NOT NULL REFERENCES business_accounts(id),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS activities (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          opportunity_id VARCHAR NOT NULL REFERENCES opportunities(id),
          author_id VARCHAR NOT NULL REFERENCES users(id),
          type VARCHAR DEFAULT 'NOTE',
          summary VARCHAR NOT NULL,
          details TEXT,
          activity_date TIMESTAMP DEFAULT NOW(),
          business_account_id VARCHAR NOT NULL REFERENCES business_accounts(id),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS pending_registrations (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          business_account_id VARCHAR NOT NULL REFERENCES business_accounts(id),
          company_name VARCHAR NOT NULL,
          responsible_name VARCHAR NOT NULL,
          email VARCHAR UNIQUE NOT NULL,
          phone VARCHAR NOT NULL,
          verification_token VARCHAR NOT NULL,
          token_expiry TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );

        -- Insertar módulos iniciales
        INSERT INTO modules (id, name, type, description) VALUES
        ('mod-users', 'Gestión de Usuarios', 'USERS', 'Permite gestionar usuarios del sistema'),
        ('mod-companies', 'Gestión de Empresas', 'COMPANIES', 'Permite gestionar empresas y clientes'),
        ('mod-crm', 'Sistema CRM', 'CRM', 'Sistema completo de gestión de relaciones con clientes')
        ON CONFLICT (id) DO NOTHING;
      `;

      // Execute migration
      await pool.query(migrationSQL);
      
      res.json({ 
        message: "Database tables created successfully",
        status: "success"
      });
    } catch (error) {
      res.status(500).json({ 
        error: "Migration failed",
        message: (error as Error).message 
      });
    }
  });

  // Debug endpoint to check actual data in tables
  app.get("/api/debug-data", async (req, res) => {
    try {
      const results = {};
      
      // Check users
      const usersResult = await pool.query('SELECT id, email, role FROM users LIMIT 5');
      results.users = usersResult.rows;
      
      // Check business accounts
      const baResult = await pool.query('SELECT id, name FROM business_accounts LIMIT 5');
      results.businessAccounts = baResult.rows;
      
      // Check modules
      const modulesResult = await pool.query('SELECT id, name, type FROM modules LIMIT 5');
      results.modules = modulesResult.rows;
      
      // Check companies
      const companiesResult = await pool.query('SELECT id, name, business_account_id FROM companies LIMIT 5');
      results.companies = companiesResult.rows;
      
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: "Data debug failed", message: (error as Error).message });
    }
  });

  // Auth routes (JWT-based, no session middleware needed)
  app.post("/api/auth/login", authLimiter, async (req, res) => {
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

      // Verify password - support both bcrypt (legacy) and custom hash
      let isValidPassword = false;
      if (user.password.startsWith('$2b$')) {
        // Legacy bcrypt hash
        isValidPassword = bcrypt.compareSync(password, user.password);
      } else {
        // Custom hash function
        isValidPassword = verifyPassword(password, user.password);
      }
      
      if (!isValidPassword) {
        // Security audit log for failed login
        secureLog.audit('USER_LOGIN_FAILED', user.id, { 
          email: user.email, 
          reason: 'INVALID_PASSWORD',
          ip: req.ip 
        });
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // ENHANCED: Verify business account is still active (if user has one)
      if (user.businessAccountId) {
        console.log(`🔍 LOGIN: Checking business account ${user.businessAccountId} for user ${user.email}`);
        const businessAccount = await storage.getBusinessAccount(user.businessAccountId);
        console.log(`🔍 LOGIN: getBusinessAccount returned:`, businessAccount ? 'FOUND' : 'NOT FOUND');
        
        if (!businessAccount) {
          console.log(`🚨 Login failed: Business account ${user.businessAccountId} not found (likely deleted)`);
          secureLog.audit('USER_LOGIN_FAILED', user.id, { 
            email: user.email, 
            reason: 'BUSINESS_ACCOUNT_DELETED',
            businessAccountId: user.businessAccountId,
            ip: req.ip 
          });
          return res.status(401).json({ 
            message: "Esta organización ya no existe. Contacta al administrador si necesitas acceso" 
          });
        }
        
        if (!businessAccount.isActive) {
          console.log(`🚨 Login failed: Business account ${user.businessAccountId} is inactive`);
          secureLog.audit('USER_LOGIN_FAILED', user.id, { 
            email: user.email, 
            reason: 'BUSINESS_ACCOUNT_INACTIVE',
            businessAccountId: user.businessAccountId,
            ip: req.ip 
          });
          return res.status(401).json({ 
            message: "Esta organización está inactiva. Contacta al administrador" 
          });
        }
        
        if (businessAccount.deletedAt) {
          console.log(`🚨 Login failed: Business account ${user.businessAccountId} is soft-deleted`);
          secureLog.audit('USER_LOGIN_FAILED', user.id, { 
            email: user.email, 
            reason: 'BUSINESS_ACCOUNT_SOFT_DELETED',
            businessAccountId: user.businessAccountId,
            ip: req.ip 
          });
          return res.status(401).json({ 
            message: "Esta organización ha sido eliminada. Contacta al administrador si necesitas acceso" 
          });
        }
      }

      // Generate JWT token instead of session
      const token = generateToken(user);

      // Security audit log
      secureLog.audit('USER_LOGIN_SUCCESS', user.id, { 
        email: user.email, 
        role: user.role,
        ip: req.ip 
      });

      res.json({ 
        token,
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

  // Get current user (JWT-protected)
  app.get("/api/auth/user", requireAuth, async (req, res) => {
    res.json({ ...req.user, password: undefined });
  });

  // Registration endpoint
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { companyName, responsibleName, email, phone } = req.body;
      
      // Validate required fields
      if (!companyName || !responsibleName || !email || !phone) {
        return res.status(400).json({ 
          message: "All fields are required", 
          fields: { companyName, responsibleName, email, phone } 
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      // Check if email already exists and analyze the situation
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        console.log(`📧 REGISTER: Found existing user with email ${email}`);
        console.log(`👤 REGISTER: User role: ${existingUser.role}, deleted: ${existingUser.isDeleted || existingUser.deletedAt ? 'YES' : 'NO'}`);
        
        // If user is marked as deleted, hide that information for security
        if (existingUser.isDeleted || existingUser.deletedAt) {
          console.log(`🚨 REGISTER: User ${email} is deleted, returning generic error`);
          return res.status(401).json({ message: "Credenciales incorrectas" });
        }
        
        // Check business account status if user has one
        if (existingUser.businessAccountId) {
          console.log(`🔍 REGISTER: Checking business account ${existingUser.businessAccountId}`);
          const businessAccount = await storage.getBusinessAccount(existingUser.businessAccountId);
          
          if (!businessAccount || businessAccount.deletedAt) {
            console.log(`🏢 REGISTER: Business account is deleted/missing`);
            
            // Only BUSINESS_ADMIN can reactivate their company
            if (existingUser.role === 'BUSINESS_ADMIN') {
              console.log(`✅ REGISTER: BUSINESS_ADMIN can reactivate account`);
              return res.status(422).json({ 
                message: "Tu empresa fue eliminada. ¿Deseas reactivar tu cuenta?",
                canReactivate: true,
                userId: existingUser.id,
                companyName: businessAccount?.name || 'Empresa anterior'
              });
            } else {
              console.log(`❌ REGISTER: USER role cannot reactivate, must contact admin`);
              return res.status(403).json({ 
                message: "Esta empresa ya no está activa. Contacta al administrador" 
              });
            }
          } else if (!businessAccount.isActive) {
            console.log(`🏢 REGISTER: Business account is inactive`);
            return res.status(403).json({ 
              message: "Esta empresa está inactiva. Contacta al administrador" 
            });
          } else {
            // Business account is active, user should login instead
            console.log(`✅ REGISTER: User and business account are active`);
            return res.status(409).json({ 
              message: "Email ya registrado. Inicia sesión con tu cuenta existente" 
            });
          }
        } else {
          // User exists but has no business account (shouldn't happen for non-SUPER_ADMIN)
          console.log(`⚠️ REGISTER: User exists but has no business account`);
          return res.status(409).json({ 
            message: "Email ya registrado. Inicia sesión con tu cuenta existente" 
          });
        }
      }

      // Generate temporary password
      const tempPassword = crypto.randomBytes(6).toString('base64').slice(0, 12);

      // Create business account
      const businessAccount = await storage.createBusinessAccount({
        name: companyName
      });

      // Create admin user for the business account
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      
      await storage.createUser({
        name: responsibleName,
        email: email,
        phone: phone,
        password: hashedPassword,
        role: 'BUSINESS_ADMIN',
        businessAccountId: businessAccount.id
      });

      console.log(`✅ Business account created: ${companyName} (ID: ${businessAccount.id})`);
      console.log(`✅ User created: ${responsibleName} (${email}) with temp password: ${tempPassword}`);

      // Send welcome email with Brevo template
      let emailSent = false;
      
      // Try Brevo template first
      if (process.env.BREVO_API_KEY && !process.env.BREVO_API_KEY.includes('xxxxxxxx')) {
        try {
          const { sendBusinessWelcomeTemplate } = await import('./services/brevoTemplateService');
          
          emailSent = await sendBusinessWelcomeTemplate({
            to: email,
            companyName: companyName,
            responsibleName: responsibleName,
            tempPassword: tempPassword
          });
          
          if (emailSent) {
            console.log(`✅ Welcome email sent via Brevo template to ${email}`);
          }
        } catch (error) {
          console.error('❌ Brevo template failed:', error);
        }
      }

      if (!emailSent) {
        // If template fails, send basic email fallback
        console.log('📧 Falling back to basic email...');
        const { sendEmail } = await import('./services/emailService');
        
        emailSent = await sendEmail({
          to: email,
          toName: responsibleName,
          from: process.env.FROM_EMAIL || 'noreply@controly.co',
          fromName: process.env.FROM_NAME || 'Controly',
          subject: '¡Bienvenido a Controly! - Tu cuenta está lista',
          htmlContent: `
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1>¡Bienvenido a Controly!</h1>
                <p>Tu cuenta está lista para usar</p>
              </div>
              <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                <h2>¡Hola ${responsibleName}!</h2>
                <p>¡Gracias por registrar <strong>${companyName}</strong> en Controly!</p>
                <p>Tu cuenta ha sido creada exitosamente. Aquí están tus credenciales de acceso:</p>
                
                <div style="background: #fff; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
                  <p><strong>Email:</strong> ${email}</p>
                  <p><strong>Contraseña temporal:</strong> <span style="font-size: 18px; font-weight: bold; color: #667eea;">${tempPassword}</span></p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.BASE_URL || 'http://localhost:5173'}" style="background-color: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                    Iniciar Sesión
                  </a>
                </div>
                
                <p style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;">
                  <strong>⚠️ Importante:</strong> Te recomendamos cambiar esta contraseña después de tu primer inicio de sesión por seguridad.
                </p>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
                <p style="color: #666; font-size: 14px;">
                  Si necesitas ayuda, contáctanos en <a href="mailto:hello@controly.co">hello@controly.co</a>
                </p>
              </div>
            </div>
          `,
          textContent: `
            ¡Bienvenido a Controly!
            
            Hola ${responsibleName},
            
            ¡Gracias por registrar ${companyName} en Controly!
            Tu cuenta ha sido creada exitosamente.
            
            Credenciales de acceso:
            Email: ${email}
            Contraseña temporal: ${tempPassword}
            
            Inicia sesión en: ${process.env.BASE_URL || 'http://localhost:5173'}
            
            IMPORTANTE: Te recomendamos cambiar esta contraseña después de tu primer inicio de sesión por seguridad.
            
            Si necesitas ayuda, contáctanos en hello@controly.co
          `
        });
      }

      if (!emailSent) {
        return res.status(500).json({ message: "Error sending welcome email" });
      }

      res.json({ 
        message: "Registration successful! Check your email for login credentials.",
        email: email,
        company: companyName 
      });

    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Email verification endpoint
  app.get("/verify-email", async (req, res) => {
    try {
      const { token } = req.query;

      if (!token) {
        return res.status(400).send(`
          <html><body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>Token de verificación requerido</h1>
            <p>El enlace de verificación es inválido.</p>
          </body></html>
        `);
      }

      // Find pending registration
      const pendingResult = await pool.query(`
        SELECT pr.*, ba.id as business_account_id 
        FROM pending_registrations pr
        JOIN business_accounts ba ON pr.business_account_id = ba.id
        WHERE pr.verification_token = $1 AND pr.token_expiry > NOW()
      `, [token]);

      if (pendingResult.rows.length === 0) {
        return res.status(400).send(`
          <html><body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>Enlace de verificación inválido o expirado</h1>
            <p>El enlace de verificación ha expirado o no es válido. Por favor, intenta registrarte nuevamente.</p>
            <a href="/login" style="background-color: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Volver al login</a>
          </body></html>
        `);
      }

      const pending = pendingResult.rows[0];

      // Generate temporary password for first login
      const tempPassword = generateAlphanumericPassword(12);
      const { hashPassword } = await import('./utils/password');
      const hashedPassword = hashPassword(tempPassword);

      // Create user account
      const userResult = await pool.query(`
        INSERT INTO users (
          business_account_id, name, email, password, role, 
          phone, is_active, email_verified, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, 'BUSINESS_ADMIN', $5, true, true, NOW(), NOW())
        RETURNING id
      `, [
        pending.business_account_id, 
        pending.responsible_name, 
        pending.email, 
        hashedPassword,
        pending.phone
      ]);

      // Assign default plan (free plan)
      const defaultPlanResult = await pool.query(`
        SELECT id FROM plans WHERE is_default = true AND status = 'ACTIVE' LIMIT 1
      `);

      if (defaultPlanResult.rows.length > 0) {
        const planId = defaultPlanResult.rows[0].id;
        await pool.query(`
          INSERT INTO business_account_plans (business_account_id, plan_id, status, trial_ends_at, created_at, updated_at)
          VALUES ($1, $2, 'TRIAL', NOW() + INTERVAL '30 days', NOW(), NOW())
        `, [pending.business_account_id, planId]);
      }

      // Remove pending registration
      await pool.query('DELETE FROM pending_registrations WHERE verification_token = $1', [token]);

      // Send welcome email with temporary password
      const { sendEmail } = await import('./services/emailService');
      await sendEmail({
        to: pending.email,
        toName: pending.responsible_name,
        from: process.env.FROM_EMAIL || 'noreply@bizflowcrm.com',
        fromName: process.env.FROM_NAME || 'BizFlowCRM',
        subject: '¡Cuenta verificada! - Tu contraseña temporal',
        htmlContent: `
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1>🎉 ¡Tu cuenta está lista!</h1>
              <p>BizFlowCRM - ${pending.company_name}</p>
            </div>
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <h2>¡Hola ${pending.responsible_name}!</h2>
              <p>Tu email ha sido verificado exitosamente. Tu cuenta en BizFlowCRM está lista para usar.</p>
              
              <div style="background: #fff; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
                <h3>Tu contraseña temporal:</h3>
                <div style="font-size: 24px; font-weight: bold; color: #667eea; letter-spacing: 2px; margin: 10px 0;">
                  ${tempPassword}
                </div>
              </div>
              
              <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;">
                <strong>⚠️ Importante:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>Esta es una contraseña temporal</li>
                  <li>Cámbiala inmediatamente después de iniciar sesión</li>
                  <li>No compartas esta contraseña con nadie</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.BASE_URL || 'http://localhost:8080'}/login" style="background-color: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                  🚀 Iniciar Sesión
                </a>
              </div>
              
              <p>¡Bienvenido a BizFlowCRM! Estamos emocionados de ayudarte a hacer crecer tu negocio.</p>
            </div>
          </div>
        `,
        textContent: `
          ¡Tu cuenta está lista!
          
          Hola ${pending.responsible_name},
          
          Tu email ha sido verificado exitosamente. Tu cuenta en BizFlowCRM está lista para usar.
          
          Tu contraseña temporal es: ${tempPassword}
          
          IMPORTANTE:
          - Esta es una contraseña temporal
          - Cámbiala inmediatamente después de iniciar sesión
          - No compartas esta contraseña con nadie
          
          Inicia sesión en: ${process.env.BASE_URL || 'http://localhost:8080'}/login
          
          ¡Bienvenido a BizFlowCRM!
        `
      });

      // Redirect to success page
      res.redirect('/verification-success');

    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).send(`
        <html><body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>Error de verificación</h1>
          <p>Hubo un error al verificar tu email. Por favor, intenta nuevamente.</p>
          <a href="/login" style="background-color: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Volver al login</a>
        </body></html>
      `);
    }
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

  // Reactivate business account for BUSINESS_ADMIN
  app.post("/api/auth/reactivate-account", async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ message: "User ID is required" });
      }

      console.log(`🔄 REACTIVATE: Attempting to reactivate account for user ${userId}`);

      // Get user by ID
      const user = await storage.getUser(userId);
      if (!user) {
        console.log(`❌ REACTIVATE: User ${userId} not found`);
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      console.log(`👤 REACTIVATE: Found user ${user.email}, role: ${user.role}`);

      // Security: Only BUSINESS_ADMIN can reactivate
      if (user.role !== 'BUSINESS_ADMIN') {
        console.log(`🚨 REACTIVATE: User ${user.email} is not BUSINESS_ADMIN (${user.role})`);
        return res.status(403).json({ message: "Solo los administradores pueden reactivar empresas" });
      }

      // User must have a business account ID
      if (!user.businessAccountId) {
        console.log(`❌ REACTIVATE: User ${user.email} has no business account ID`);
        return res.status(400).json({ message: "Usuario no tiene empresa asociada" });
      }

      // Get business account (should exist but be soft-deleted)
      const businessAccount = await storage.getBusinessAccount(user.businessAccountId);
      
      if (!businessAccount) {
        console.log(`❌ REACTIVATE: Business account ${user.businessAccountId} not found (hard-deleted)`);
        return res.status(404).json({ 
          message: "La empresa no puede ser reactivada. Contacta al administrador" 
        });
      }

      console.log(`🏢 REACTIVATE: Found business account ${businessAccount.name}, deletedAt: ${businessAccount.deletedAt ? 'YES' : 'NO'}, isActive: ${businessAccount.isActive}`);

      // Check if business account is actually deleted
      if (!businessAccount.deletedAt && businessAccount.isActive) {
        console.log(`⚠️ REACTIVATE: Business account is already active`);
        return res.status(400).json({ message: "La empresa ya está activa" });
      }

      // Reactivate the existing business account - restore to active status
      const updatedAccount = await storage.updateBusinessAccount(user.businessAccountId, {
        isActive: true,
        deletedAt: null,
        updatedAt: new Date()
      });
      
      if (!updatedAccount) {
        console.log(`❌ REACTIVATE: Failed to reactivate business account ${user.businessAccountId}`);
        return res.status(500).json({ message: "Error al reactivar la empresa" });
      }

      console.log(`✅ REACTIVATE: Business account ${businessAccount.name} reactivated successfully`);

      // Generate JWT token for immediate login (businessAccountId remains the same)
      const token = generateToken(user);

      // Return success with user data and token for immediate login
      res.json({
        message: `Empresa "${businessAccount.name}" reactivada exitosamente`,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          businessAccountId: user.businessAccountId
        },
        businessAccount: {
          id: businessAccount.id,
          name: businessAccount.name
        }
      });

    } catch (error) {
      console.error("❌ Account reactivation error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // TEMPORARY: Fix business account plan field
  app.post("/api/debug/fix-plan", async (req, res) => {
    try {
      const { businessAccountId } = req.body;
      
      if (!businessAccountId) {
        return res.status(400).json({ message: "businessAccountId required" });
      }
      
      // Get the current plan from business_account_plans
      const planResult = await pool.query(`
        SELECT p.name, bap.plan_id 
        FROM business_account_plans bap
        JOIN plans p ON bap.plan_id = p.id
        WHERE bap.business_account_id = $1 AND bap.status IN ('TRIAL', 'ACTIVE')
        ORDER BY bap.created_at DESC
        LIMIT 1
      `, [businessAccountId]);
      
      if (planResult.rows.length === 0) {
        return res.status(404).json({ message: "No active plan found for business account" });
      }
      
      const planName = planResult.rows[0].name;
      
      // Update business account plan field
      await pool.query(
        'UPDATE business_accounts SET plan = $1, updated_at = NOW() WHERE id = $2',
        [planName, businessAccountId]
      );
      
      console.log(`🔧 Fixed business account plan: ${businessAccountId} -> ${planName}`);
      
      res.json({ 
        message: "Business account plan field updated",
        businessAccountId,
        planName
      });
    } catch (error) {
      console.error("Fix plan error:", error);
      res.status(500).json({ message: "Error", error: error.message });
    }
  });

  // TEMPORARY: Debug endpoint for permissions
  app.get("/api/debug/permissions", async (req, res) => {
    try {
      const { businessAccountId, moduleType } = req.query as { businessAccountId: string; moduleType: string };
      
      if (!businessAccountId || !moduleType) {
        return res.status(400).json({ message: "businessAccountId and moduleType required" });
      }
      
      // Check business account
      const baResult = await pool.query('SELECT * FROM business_accounts WHERE id = $1', [businessAccountId]);
      console.log('🏢 Business Account:', baResult.rows[0]);
      
      // Check plan
      const planResult = await pool.query('SELECT * FROM plans WHERE name = $1', [baResult.rows[0]?.plan]);
      console.log('📋 Plan:', planResult.rows[0]);
      
      // Check plan modules
      const planModulesResult = await pool.query(
        'SELECT * FROM plan_modules WHERE plan_id = $1 AND module_type = $2', 
        [planResult.rows[0]?.id, moduleType]
      );
      console.log('🔧 Plan Modules:', planModulesResult.rows);
      
      // The problematic query
      const problemQuery = await pool.query(`
        SELECT pm.*, p.name as plan_name, ba.plan as ba_plan
        FROM business_accounts ba
        JOIN plans p ON ba.plan = p.name
        JOIN plan_modules pm ON p.id = pm.plan_id
        WHERE ba.id = $1 AND pm.module_type = $2 AND pm.is_included = true
      `, [businessAccountId, moduleType]);
      
      console.log('🔍 Problem Query Result:', problemQuery.rows);
      
      res.json({
        businessAccount: baResult.rows[0],
        plan: planResult.rows[0],
        planModules: planModulesResult.rows,
        problemQueryResult: problemQuery.rows
      });
    } catch (error) {
      console.error("Debug permissions error:", error);
      res.status(500).json({ message: "Error", error: error.message });
    }
  });

  // TEMPORARY: Debug endpoint to delete user
  app.delete("/api/debug/delete-user", async (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) {
        return res.status(400).json({ message: "Email required" });
      }
      
      const result = await pool.query(
        'DELETE FROM users WHERE email = $1 RETURNING id, email, name', 
        [email]
      );
      
      if (result.rows.length > 0) {
        const deletedUser = result.rows[0];
        console.log(`🗑️ Usuario eliminado: ${deletedUser.email}`);
        res.json({ 
          message: "Usuario eliminado", 
          user: deletedUser 
        });
      } else {
        res.status(404).json({ message: "Usuario no encontrado" });
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Error interno" });
    }
  });


  // Using imported JWT middleware instead of local session middleware
  
  // Helper function for multiple role support (temporary)
  const requireAnyRole = (roles: string[]) => {
    return (req: any, res: any, next: any) => {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      next();
    };
  };

  // Middleware for business account data isolation (assumes JWT auth already verified)
  const requireBusinessAccountWithId = (req: any, res: any, next: any) => {
    const user = req.user;
    
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
      
      // UPDATED: Use unified permission system instead of storage.hasModuleEnabled
      try {
        const { unifiedPermissionService } = await import('./services/unifiedPermissionService');
        const hasAccess = await unifiedPermissionService.hasModuleAccess(user.businessAccountId, moduleType);
        
        if (!hasAccess) {
          return res.status(403).json({ message: `Module ${moduleType} not enabled for your organization` });
        }
        
        next();
      } catch (error) {
        console.error('requireModule error:', error);
        return res.status(500).json({ message: 'Error checking module permissions' });
      }
    };
  };

  // Get current user's business account modules (for sidebar navigation)
  app.get("/api/user/business-account/modules", requireAuth, requireBusinessAccountWithId, async (req: any, res) => {
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

  // Debug endpoint for permissions testing
  app.get("/api/debug/permissions/:moduleType", requireAuth, async (req: any, res) => {
    const moduleType = req.params.moduleType;
    const user = req.user;
    
    try {
      if (user.role === 'SUPER_ADMIN') {
        return res.json({ hasAccess: true, reason: 'SUPER_ADMIN bypass' });
      }
      
      if (!user.businessAccountId) {
        return res.json({ hasAccess: false, reason: 'No business account ID' });
      }
      
      console.log(`🔍 Debug: Checking ${moduleType} access for business account ${user.businessAccountId}`);
      
      const { unifiedPermissionService } = await import('./services/unifiedPermissionService');
      const fullResult = await unifiedPermissionService.getModuleAccess(user.businessAccountId, moduleType);
      const hasAccess = await unifiedPermissionService.hasModuleAccess(user.businessAccountId, moduleType);
      
      console.log(`📊 Debug result:`, {
        businessAccountId: user.businessAccountId,
        moduleType,
        hasAccess,
        fullResult
      });
      
      res.json({
        businessAccountId: user.businessAccountId,
        moduleType,
        hasAccess,
        fullResult,
        user: {
          id: user.id,
          role: user.role,
          businessAccountId: user.businessAccountId
        }
      });
    } catch (error) {
      console.error('Debug permissions error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Simple table structure check
  app.get("/api/debug/table-structure/:tableName", requireAuth, async (req: any, res) => {
    const tableName = req.params.tableName;
    
    try {
      console.log(`🔍 Checking structure of table: ${tableName}`);
      
      const result = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      
      res.json({
        tableName,
        columns: result.rows
      });
    } catch (error) {
      console.error('Table structure check error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Check business account plan and modules
  app.get("/api/debug/business-account/:businessAccountId/plan", requireAuth, async (req: any, res) => {
    const businessAccountId = req.params.businessAccountId;
    
    try {
      console.log(`🔍 Checking plan for business account: ${businessAccountId}`);
      
      // Get business account info
      const businessAccountQuery = await pool.query(`
        SELECT * FROM business_accounts WHERE id = $1
      `, [businessAccountId]);
      
      if (businessAccountQuery.rows.length === 0) {
        return res.status(404).json({ error: 'Business account not found' });
      }
      
      const businessAccount = businessAccountQuery.rows[0];
      console.log(`📊 Business account:`, businessAccount);
      
      // Get plan info
      const planQuery = await pool.query(`
        SELECT * FROM plans WHERE name = $1
      `, [businessAccount.plan]);
      
      const plan = planQuery.rows[0] || null;
      console.log(`📋 Plan:`, plan);
      
      // Get plan modules
      let planModules = [];
      if (plan) {
        const modulesQuery = await pool.query(`
          SELECT * FROM plan_modules WHERE plan_id = $1 ORDER BY module_type
        `, [plan.id]);
        planModules = modulesQuery.rows;
      }
      
      console.log(`📦 Plan modules: ${planModules.length} modules`);
      
      res.json({
        businessAccount: {
          id: businessAccount.id,
          name: businessAccount.name,
          plan: businessAccount.plan
        },
        planDetails: plan,
        planModules: planModules.map(module => ({
          moduleType: module.module_type,
          isIncluded: module.is_included,
          itemLimit: module.item_limit,
          features: module.features
        }))
      });
      
    } catch (error) {
      console.error('Business account plan check error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // List all plans with their modules
  app.get("/api/debug/all-plans", requireAuth, async (req: any, res) => {
    try {
      console.log(`🔍 Fetching all plans and their modules`);
      
      const plansQuery = await pool.query(`
        SELECT p.*, 
               array_agg(
                 json_build_object(
                   'module_type', pm.module_type,
                   'is_included', pm.is_included,
                   'item_limit', pm.item_limit
                 )
               ) as modules
        FROM plans p
        LEFT JOIN plan_modules pm ON p.id = pm.plan_id
        GROUP BY p.id, p.name, p.price, p.description
        ORDER BY p.name
      `);
      
      res.json({
        plans: plansQuery.rows.map(plan => ({
          id: plan.id,
          name: plan.name,
          price: plan.price,
          description: plan.description,
          isActive: plan.is_active,
          modules: plan.modules.filter(m => m.module_type) // Remove null entries
        }))
      });
      
    } catch (error) {
      console.error('All plans fetch error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Fix business account plan assignment
  app.post("/api/debug/fix-business-account-plan", requireAuth, async (req: any, res) => {
    const { businessAccountId, newPlanName } = req.body;
    const user = req.user;
    
    try {
      console.log(`🔧 Fixing plan for business account: ${businessAccountId} → ${newPlanName}`);
      console.log(`👤 Requested by: ${user.email} (${user.role})`);
      
      // Verify the new plan exists
      const planCheck = await pool.query(`
        SELECT id, name FROM plans WHERE name = $1 AND is_active = true
      `, [newPlanName]);
      
      if (planCheck.rows.length === 0) {
        return res.status(400).json({ error: `Plan "${newPlanName}" not found or inactive` });
      }
      
      // Update business account plan
      const updateResult = await pool.query(`
        UPDATE business_accounts 
        SET plan = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `, [newPlanName, businessAccountId]);
      
      if (updateResult.rows.length === 0) {
        return res.status(404).json({ error: 'Business account not found' });
      }
      
      console.log(`✅ Plan updated successfully`);
      
      res.json({
        success: true,
        businessAccountId,
        oldPlan: updateResult.rows[0].plan, // This will be the new plan, but we log the change
        newPlan: newPlanName,
        updatedBy: user.email,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Fix business account plan error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add module to plan
  app.post("/api/debug/add-module-to-plan", requireAuth, async (req: any, res) => {
    const { planName, moduleType, itemLimit = null } = req.body;
    const user = req.user;
    
    try {
      console.log(`🔧 Adding ${moduleType} module to plan: ${planName} (limit: ${itemLimit || 'unlimited'})`);
      
      // Get plan ID
      const planQuery = await pool.query(`
        SELECT id FROM plans WHERE name = $1
      `, [planName]);
      
      if (planQuery.rows.length === 0) {
        return res.status(404).json({ error: `Plan "${planName}" not found` });
      }
      
      const planId = planQuery.rows[0].id;
      
      // Add module to plan (or update if exists)
      const insertResult = await pool.query(`
        INSERT INTO plan_modules (id, plan_id, module_type, is_included, item_limit)
        VALUES (gen_random_uuid()::text, $1, $2, true, $3)
        ON CONFLICT (plan_id, module_type) 
        DO UPDATE SET 
          is_included = true,
          item_limit = EXCLUDED.item_limit
        RETURNING *
      `, [planId, moduleType, itemLimit]);
      
      console.log(`✅ Module added/updated successfully`);
      
      res.json({
        success: true,
        planName,
        moduleType,
        itemLimit,
        addedBy: user.email,
        timestamp: new Date().toISOString(),
        module: insertResult.rows[0]
      });
      
    } catch (error) {
      console.error('Add module to plan error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Execute corrective migration endpoint
  app.post("/api/debug/run-migration/:migrationFile", requireAuth, async (req: any, res) => {
    const migrationFile = req.params.migrationFile;
    const user = req.user;
    
    try {
      console.log(`🔧 Running migration: ${migrationFile}`);
      console.log(`👤 Requested by: ${user.email} (${user.role})`);
      
      // Read migration file
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const migrationPath = path.join(process.cwd(), 'server', 'migrations', `${migrationFile}.sql`);
      const migrationSQL = await fs.readFile(migrationPath, 'utf8');
      
      console.log(`📄 Migration size: ${migrationSQL.length} characters`);
      
      // Execute migration
      const startTime = Date.now();
      const result = await pool.query(migrationSQL);
      const duration = Date.now() - startTime;
      
      console.log(`✅ Migration completed in ${duration}ms`);
      
      res.json({
        success: true,
        migrationFile,
        duration,
        executedBy: user.email,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Migration execution error:', error);
      res.status(500).json({ 
        error: error.message,
        migrationFile,
        executedBy: user.email 
      });
    }
  });

  // System-wide audit endpoint for debugging permissions
  app.get("/api/debug/system-audit", requireAuth, async (req: any, res) => {
    const user = req.user;
    
    try {
      console.log('🔍 Starting system-wide permissions audit...');
      
      const auditResults: any = {
        timestamp: new Date().toISOString(),
        requestedBy: user.email,
        plans: [],
        businessAccounts: [],
        issues: []
      };

      // 1. Audit all plans and their modules
      const plansQuery = await pool.query(`
        SELECT p.id, p.name, p.price, p.description,
               array_agg(
                 json_build_object(
                   'module_type', pm.module_type,
                   'item_limit', pm.item_limit,
                   'can_create', pm.can_create,
                   'can_edit', pm.can_edit,
                   'can_delete', pm.can_delete,
                   'can_view', pm.can_view
                 )
               ) as modules
        FROM plans p
        LEFT JOIN plan_modules pm ON p.id = pm.plan_id
        GROUP BY p.id, p.name, p.price, p.description
        ORDER BY p.name
      `);
      
      auditResults.plans = plansQuery.rows.map(plan => ({
        id: plan.id,
        name: plan.name,
        price: plan.price,
        modules: plan.modules.filter(m => m.module_type) // Remove null entries
      }));

      // 2. Audit all business accounts
      const businessAccountsQuery = await pool.query(`
        SELECT ba.id, ba.name, ba.plan_id, p.name as plan_name,
               (SELECT COUNT(*) FROM users WHERE business_account_id = ba.id) as user_count
        FROM business_accounts ba
        LEFT JOIN plans p ON ba.plan_id = p.id
        ORDER BY ba.name
      `);
      
      const { unifiedPermissionService } = await import('./services/unifiedPermissionService');
      
      for (const account of businessAccountsQuery.rows) {
        const accountAudit: any = {
          id: account.id,
          name: account.name,
          planId: account.plan_id,
          planName: account.plan_name,
          userCount: account.user_count,
          modulePermissions: {}
        };
        
        if (!account.plan_id) {
          auditResults.issues.push(`${account.name}: No plan assigned`);
        }
        
        // Test unified permissions for standard modules
        const testModules = ['USERS', 'CRM', 'COMPANIES'];
        
        for (const moduleType of testModules) {
          try {
            const permResult = await unifiedPermissionService.getModuleAccess(account.id, moduleType);
            accountAudit.modulePermissions[moduleType] = {
              hasAccess: permResult.hasAccess,
              source: permResult.source,
              permissions: permResult.permissions
            };
            
            if (!permResult.hasAccess && account.plan_id) {
              auditResults.issues.push(`${account.name}: ${moduleType} denied despite having plan ${account.plan_name}`);
            }
          } catch (error) {
            accountAudit.modulePermissions[moduleType] = {
              error: error.message
            };
            auditResults.issues.push(`${account.name}: ${moduleType} error - ${error.message}`);
          }
        }
        
        auditResults.businessAccounts.push(accountAudit);
      }

      // 3. Check system integrity
      const functionCheck = await pool.query(`
        SELECT proname FROM pg_proc 
        WHERE proname = 'get_effective_permissions'
      `);
      
      if (functionCheck.rows.length === 0) {
        auditResults.issues.push('CRITICAL: get_effective_permissions function missing');
      }

      const viewCheck = await pool.query(`
        SELECT viewname FROM pg_views 
        WHERE viewname = 'v_unified_permissions'
      `);
      
      if (viewCheck.rows.length === 0) {
        auditResults.issues.push('CRITICAL: v_unified_permissions view missing');
      }

      console.log(`🔍 Audit complete: ${auditResults.plans.length} plans, ${auditResults.businessAccounts.length} accounts, ${auditResults.issues.length} issues`);
      
      res.json(auditResults);
    } catch (error) {
      console.error('System audit error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Business Accounts routes (SUPER_ADMIN only)
  app.get("/api/business-accounts", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const accounts = await storage.getBusinessAccounts();
      res.json(accounts);
    } catch (error) {
      console.error("Error fetching business accounts:", error);
      res.status(500).json({ message: "Failed to fetch business accounts" });
    }
  });

  app.post("/api/business-accounts", requireAuth, requireSuperAdmin, async (req, res) => {
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

  app.get("/api/business-accounts/:id", requireAuth, requireSuperAdmin, async (req, res) => {
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

  app.put("/api/business-accounts/:id", requireAuth, requireSuperAdmin, async (req, res) => {
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

  app.delete("/api/business-accounts/:id", requireAuth, requireSuperAdmin, async (req, res) => {
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
  app.get("/api/business-accounts/:id", requireAuth, requireSuperAdmin, async (req, res) => {
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
  app.get("/api/business-accounts/:id/users", requireAuth, requireSuperAdmin, async (req, res) => {
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
  app.get("/api/business-accounts/:id/companies", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const companies = await storage.getCompanies(req.params.id);
      res.json(companies);
    } catch (error) {
      console.error("Error fetching business account companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  // Create user for a specific business account (SUPER_ADMIN)
  app.post("/api/business-accounts/:id/users", requireAuth, requireSuperAdmin, async (req, res) => {
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

  // Users routes (only for BUSINESS_ADMIN within their organization)
  app.get("/api/users", requireAuth, requireAnyRole(['SUPER_ADMIN', 'BUSINESS_ADMIN']), requireBusinessAccountWithId, requireModule('USERS'), async (req: any, res) => {
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

  app.post("/api/users", requireAuth, requireAnyRole(['SUPER_ADMIN', 'BUSINESS_ADMIN']), requireBusinessAccountWithId, requireModule('USERS'), checkPlanLimits('USERS', 'create'), async (req: any, res) => {
    try {
      let userData = insertUserSchema.parse(req.body);
      
      // Generate secure password if not provided or empty
      if (!userData.password || userData.password.trim() === '') {
        const { generateSecurePassword } = await import('./utils/password');
        userData.password = generateSecurePassword(12);
      }
      
      // Automatically assign to the BUSINESS_ADMIN user's business account
      userData = { ...userData, businessAccountId: req.businessAccountId };
      
      const user = await storage.createUser(userData);
      res.json({ ...user, password: undefined });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(400).json({ message: "Invalid user data" });
    }
  });

  app.put("/api/users/:id", requireAuth, requireAnyRole(['SUPER_ADMIN', 'BUSINESS_ADMIN']), requireBusinessAccountWithId, requireModule('USERS'), async (req: any, res) => {
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

  app.delete("/api/users/:id", requireAuth, requireAnyRole(['SUPER_ADMIN', 'BUSINESS_ADMIN']), requireBusinessAccountWithId, requireModule('USERS'), checkPlanLimits('USERS', 'delete'), updateUsageAfterAction('USERS'), async (req: any, res) => {
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
  app.put("/api/users/:id/password", requireAuth, async (req: any, res) => {
    try {
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
  app.put("/api/users/:id/profile", requireAuth, async (req: any, res) => {
    try {
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
  app.get("/api/agents", requireAuth, requireAnyRole(['SUPER_ADMIN', 'BUSINESS_ADMIN']), requireBusinessAccount, async (req: any, res) => {
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
  app.get("/api/companies", requireAuth, requireBusinessAccountWithId, requireModule('CONTACTS'), async (req: any, res) => {
    try {
      let businessAccountId;
      if (req.user.role === 'SUPER_ADMIN') {
        // SUPER_ADMIN can see all companies or filter by businessAccountId
        businessAccountId = req.query.businessAccountId || null; // null = all companies
      } else {
        businessAccountId = req.businessAccountId;
      }
      const companies = await storage.getCompanies(businessAccountId);
      res.json(companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  app.get("/api/companies/:id", requireBusinessAccount, requireModule('CONTACTS'), async (req: any, res) => {
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

  app.post("/api/companies", requireBusinessAccount, requireModule('CONTACTS'), checkPlanLimits('CONTACTS', 'create'), async (req: any, res) => {
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

  app.put("/api/companies/:id", requireBusinessAccount, requireModule('CONTACTS'), async (req: any, res) => {
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

  app.delete("/api/companies/:id", requireBusinessAccount, requireModule('CONTACTS'), checkPlanLimits('CONTACTS', 'delete'), updateUsageAfterAction('CONTACTS'), async (req: any, res) => {
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
  app.get("/api/business-accounts/:businessAccountId/modules", requireAuth, requireAnyRole(['SUPER_ADMIN', 'BUSINESS_ADMIN']), async (req: any, res) => {
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

  app.post("/api/business-accounts/:businessAccountId/modules/:moduleId/enable", requireAuth, requireAnyRole(['SUPER_ADMIN', 'BUSINESS_ADMIN']), async (req: any, res) => {
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

  app.post("/api/business-accounts/:businessAccountId/modules/:moduleId/disable", requireAuth, requireAnyRole(['SUPER_ADMIN', 'BUSINESS_ADMIN']), async (req: any, res) => {
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

  // Admin endpoint to check database tables
  app.get("/api/admin/check-tables", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      
      const businessAccountsResult = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'business_accounts'
      `);
      
      res.json({ 
        tables: result.rows,
        business_accounts_columns: businessAccountsResult.rows 
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin endpoint to check OneTouch onboarding status
  app.get("/api/admin/check-onetouch", async (req, res) => {
    try {
      // Get OneTouch business account
      const businessAccountResult = await pool.query(`
        SELECT id, name, email, onboarding_completed, profile_completed, plan_selected
        FROM business_accounts 
        WHERE name ILIKE '%onetouch%' OR email ILIKE '%onetouch%'
      `);
      
      if (businessAccountResult.rows.length === 0) {
        return res.json({ message: "OneTouch business account not found" });
      }
      
      const businessAccount = businessAccountResult.rows[0];
      
      // Get users for this business account
      const usersResult = await pool.query(`
        SELECT id, name, email, business_account_id, role
        FROM users 
        WHERE business_account_id = $1
      `, [businessAccount.id]);
      
      // Check company profile
      const profileResult = await pool.query(`
        SELECT * FROM company_profiles 
        WHERE business_account_id = $1
      `, [businessAccount.id]);
      
      // Check business account plans  
      const planResult = await pool.query(`
        SELECT * FROM business_account_plans 
        WHERE business_account_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `, [businessAccount.id]);
      
      res.json({
        business_account: businessAccount,
        users: usersResult.rows,
        has_profile: profileResult.rows.length > 0,
        profile_data: profileResult.rows[0] || null,
        has_plan: planResult.rows.length > 0,
        plan_data: planResult.rows[0] || null
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin endpoint to verify database structure
  app.get("/api/admin/verify-db-structure", async (req, res) => {
    try {
      const checks = {
        business_accounts: {},
        users: {},
        company_profiles: {},
        business_account_plans: {}
      };

      // Check business_accounts table
      const baResult = await pool.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'business_accounts' 
        ORDER BY ordinal_position
      `);
      checks.business_accounts.columns = baResult.rows;

      const baCount = await pool.query(`SELECT COUNT(*) as count FROM business_accounts`);
      checks.business_accounts.count = parseInt(baCount.rows[0].count);

      // Check users table
      const usersResult = await pool.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        ORDER BY ordinal_position
      `);
      checks.users.columns = usersResult.rows;

      const usersCount = await pool.query(`SELECT COUNT(*) as count FROM users`);
      checks.users.count = parseInt(usersCount.rows[0].count);

      // Check onboarding tables
      const cpResult = await pool.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'company_profiles' 
        ORDER BY ordinal_position
      `);
      checks.company_profiles.columns = cpResult.rows;

      const bapResult = await pool.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'business_account_plans' 
        ORDER BY ordinal_position
      `);
      checks.business_account_plans.columns = bapResult.rows;

      res.json(checks);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin endpoint to get all users and business accounts overview
  app.get("/api/admin/system-overview", async (req, res) => {
    try {
      // Get all business accounts with onboarding status
      const businessAccounts = await pool.query(`
        SELECT 
          id, name, email, 
          onboarding_completed, profile_completed, plan_selected,
          created_at
        FROM business_accounts 
        ORDER BY created_at DESC
      `);

      // Get all users grouped by business account
      const users = await pool.query(`
        SELECT 
          id, name, email, role, business_account_id,
          created_at
        FROM users 
        ORDER BY business_account_id, created_at DESC
      `);

      // Get users by type
      const usersByType = await pool.query(`
        SELECT 
          role, 
          COUNT(*) as count,
          ARRAY_AGG(email ORDER BY created_at DESC) as emails
        FROM users 
        GROUP BY role
      `);

      // Get business accounts with user counts
      const accountsWithUsers = await pool.query(`
        SELECT 
          ba.id, ba.name, ba.onboarding_completed,
          COUNT(u.id) as user_count,
          ARRAY_AGG(u.email ORDER BY u.created_at DESC) as user_emails
        FROM business_accounts ba
        LEFT JOIN users u ON ba.id = u.business_account_id
        GROUP BY ba.id, ba.name, ba.onboarding_completed
        ORDER BY ba.created_at DESC
      `);

      res.json({
        summary: {
          total_business_accounts: businessAccounts.rows.length,
          total_users: users.rows.length,
        },
        business_accounts: businessAccounts.rows,
        users_by_type: usersByType.rows,
        accounts_with_users: accountsWithUsers.rows,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // TEMPORARY: Reset password for luis@onetouch.hn
  app.post("/api/admin/reset-luis-password", async (req, res) => {
    try {
      const newPassword = 'Luis123!';
      const hashedPassword = bcrypt.hashSync(newPassword, 12);
      
      const result = await pool.query(`
        UPDATE users 
        SET password = $1, updated_at = NOW()
        WHERE email = $2
        RETURNING id, name, email, role
      `, [hashedPassword, 'luis@onetouch.hn']);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      
      console.log('✅ Password reset for luis@onetouch.hn - new password: Luis123!');
      res.json({ 
        message: "Password reset successfully", 
        user: result.rows[0],
        newPassword: newPassword
      });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Emergency: Reset all non-super-admin user passwords  
  app.post("/api/admin/emergency-password-reset", async (req, res) => {
    try {
      const defaultPassword = "temp123456";
      const hashedPassword = bcrypt.hashSync(defaultPassword, 12);
      
      // Reset passwords for all users except SUPER_ADMIN
      const updateResult = await pool.query(`
        UPDATE users 
        SET password = $1, updated_at = NOW()
        WHERE role != 'SUPER_ADMIN'
        RETURNING id, name, email, role, business_account_id
      `, [hashedPassword]);
      
      res.json({
        message: "Emergency password reset completed",
        temporary_password: defaultPassword, 
        affected_users: updateResult.rows,
        instructions: "All non-super-admin users can now login with: " + defaultPassword
      });
    } catch (error) {
      console.error("Emergency password reset failed:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create user permissions table
  app.post("/api/admin/create-user-permissions-table", async (req, res) => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_permissions (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR NOT NULL,
          business_account_id VARCHAR NOT NULL,
          module_type VARCHAR NOT NULL, -- 'USERS', 'COMPANIES', 'CRM', 'REPORTS'
          can_view BOOLEAN DEFAULT TRUE,
          can_create BOOLEAN DEFAULT FALSE,
          can_edit BOOLEAN DEFAULT FALSE,
          can_delete BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          created_by VARCHAR, -- ID del BUSINESS_ADMIN que asignó permisos
          UNIQUE(user_id, module_type)
        )
      `);

      await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_permissions_business ON user_permissions(business_account_id)`);
      
      res.json({ message: "User permissions table created successfully" });
    } catch (error) {
      console.error("Error creating user permissions table:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // User permissions management endpoints (only for BUSINESS_ADMIN)
  
  // Get permissions for a specific user
  app.get("/api/users/:userId/permissions", requireAuth, requireAnyRole(['SUPER_ADMIN', 'BUSINESS_ADMIN']), async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Verify user belongs to same business account (except for SUPER_ADMIN)
      if (req.user.role !== 'SUPER_ADMIN') {
        const user = await storage.getUser(userId);
        if (!user || user.businessAccountId !== req.businessAccountId) {
          return res.status(403).json({ message: "Access denied to user" });
        }
      }
      
      const permissions = await pool.query(`
        SELECT module_type, can_view, can_create, can_edit, can_delete
        FROM user_permissions 
        WHERE user_id = $1
        ORDER BY module_type
      `, [userId]);
      
      // Convert to object format for easier frontend consumption
      const permissionsObj = {};
      permissions.rows.forEach(row => {
        permissionsObj[row.module_type] = {
          canView: row.can_view,
          canCreate: row.can_create,
          canEdit: row.can_edit,
          canDelete: row.can_delete
        };
      });
      
      res.json(permissionsObj);
    } catch (error) {
      console.error("Error getting user permissions:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Set permissions for a specific user
  app.post("/api/users/:userId/permissions", requireAuth, requireAnyRole(['SUPER_ADMIN', 'BUSINESS_ADMIN']), async (req: any, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const { userId } = req.params;
      const { moduleType, canView, canCreate, canEdit, canDelete } = req.body;
      
      // ENHANCED VALIDATION: Comprehensive security checks
      if (req.user.role !== 'SUPER_ADMIN') {
        // Get user with business account validation in transaction
        const userResult = await client.query(`
          SELECT id, business_account_id, role 
          FROM users 
          WHERE id = $1 AND deleted_at IS NULL
          FOR UPDATE
        `, [userId]);
        
        const user = userResult.rows[0];
        if (!user || user.business_account_id !== req.businessAccountId) {
          await client.query('ROLLBACK');
          return res.status(403).json({ message: "Access denied to user" });
        }
        
        // SECURITY: Prevent privilege escalation
        if (user.role === 'BUSINESS_ADMIN' || user.role === 'SUPER_ADMIN') {
          await client.query('ROLLBACK');
          return res.status(403).json({ message: "Cannot modify admin permissions" });
        }
        
        // BUSINESS_ADMIN cannot modify their own permissions
        if (userId === req.user.id) {
          await client.query('ROLLBACK');
          return res.status(403).json({ message: "Cannot modify your own permissions" });
        }
      }
      
      // VALIDATION: Ensure module type is valid
      const validModules = ['USERS', 'COMPANIES', 'CRM', 'REPORTS'];
      if (!validModules.includes(moduleType)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: "Invalid module type" });
      }
      
      // Upsert permissions
      await pool.query(`
        INSERT INTO user_permissions (user_id, business_account_id, module_type, can_view, can_create, can_edit, can_delete, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (user_id, module_type)
        DO UPDATE SET 
          can_view = EXCLUDED.can_view,
          can_create = EXCLUDED.can_create,
          can_edit = EXCLUDED.can_edit,
          can_delete = EXCLUDED.can_delete,
          updated_at = NOW(),
          created_by = EXCLUDED.created_by
      `, [userId, req.businessAccountId, moduleType, canView, canCreate, canEdit, canDelete, req.user.id]);
      
      res.json({ message: "Permissions updated successfully" });
    } catch (error) {
      console.error("Error setting user permissions:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Bulk update permissions for a user (all modules at once)
  app.put("/api/users/:userId/permissions", requireAuth, requireAnyRole(['SUPER_ADMIN', 'BUSINESS_ADMIN']), async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { permissions } = req.body; // { USERS: { canView: true, ... }, COMPANIES: { ... } }
      
      // Verify user belongs to same business account (except for SUPER_ADMIN)
      if (req.user.role !== 'SUPER_ADMIN') {
        const user = await storage.getUser(userId);
        if (!user || user.businessAccountId !== req.businessAccountId) {
          return res.status(403).json({ message: "Access denied to user" });
        }
        
        // BUSINESS_ADMIN cannot modify their own permissions
        if (userId === req.user.id) {
          return res.status(403).json({ message: "Cannot modify your own permissions" });
        }
      }
      
      // Begin transaction
      await pool.query('BEGIN');
      
      try {
        // Delete existing permissions for this user
        await pool.query('DELETE FROM user_permissions WHERE user_id = $1', [userId]);
        
        // Insert new permissions
        for (const [moduleType, perms] of Object.entries(permissions)) {
          await pool.query(`
            INSERT INTO user_permissions (user_id, business_account_id, module_type, can_view, can_create, can_edit, can_delete, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [userId, req.businessAccountId, moduleType, perms.canView, perms.canCreate, perms.canEdit, perms.canDelete, req.user.id]);
        }
        
        await pool.query('COMMIT');
        res.json({ message: "All permissions updated successfully" });
      } catch (error) {
        await pool.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error("Error bulk updating user permissions:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin endpoint to run simple onboarding migration
  app.post("/api/admin/migrate-onboarding-simple", async (req, res) => {
    try {
      console.log('🚀 Starting simple onboarding migration...');
      
      // Execute SQL statements directly
      const statements = [
        'ALTER TABLE business_accounts ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE',
        'ALTER TABLE business_accounts ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE',
        'ALTER TABLE business_accounts ADD COLUMN IF NOT EXISTS plan_selected BOOLEAN DEFAULT FALSE',
        `CREATE TABLE IF NOT EXISTS company_profiles (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            business_account_id VARCHAR NOT NULL,
            industry VARCHAR(100),
            employee_count VARCHAR(50),
            website VARCHAR(255),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(business_account_id)
        )`,
        `CREATE TABLE IF NOT EXISTS business_account_plans (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            business_account_id VARCHAR NOT NULL,
            plan_name VARCHAR(100) NOT NULL,
            billing_cycle VARCHAR(20) CHECK (billing_cycle IN ('monthly', 'annual')) DEFAULT 'monthly',
            price_per_month DECIMAL(10,2),
            features TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )`,
        'CREATE INDEX IF NOT EXISTS idx_business_accounts_onboarding ON business_accounts(onboarding_completed)',
        'CREATE INDEX IF NOT EXISTS idx_company_profiles_business_id ON company_profiles(business_account_id)',
        'CREATE INDEX IF NOT EXISTS idx_business_plans_active ON business_account_plans(business_account_id, is_active)'
      ];
      
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await pool.query(statement.trim());
            console.log('✅ Executed:', statement.trim().substring(0, 50) + '...');
          } catch (err) {
            console.log('⚠️ Statement failed (may already exist):', err.message);
          }
        }
      }
      
      console.log('✅ Simple onboarding migration executed successfully');
      res.json({ message: "Simple onboarding migration completed successfully" });
    } catch (error) {
      console.error("Error running simple onboarding migration:", error);
      res.status(500).json({ message: "Migration failed", error: error.message });
    }
  });

  // Admin endpoint to run onboarding migration
  app.post("/api/admin/migrate-onboarding", async (req, res) => {
    try {
      console.log('🚀 Starting onboarding migration...');
      
      // Step 1: Add columns to business_accounts
      try {
        await pool.query(`
          ALTER TABLE business_accounts 
          ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE
        `);
        await pool.query(`
          ALTER TABLE business_accounts 
          ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE
        `);
        await pool.query(`
          ALTER TABLE business_accounts 
          ADD COLUMN IF NOT EXISTS plan_selected BOOLEAN DEFAULT FALSE
        `);
        console.log('✅ Added onboarding fields to business_accounts');
      } catch (alterError) {
        console.log('⚠️ Column additions already exist or failed:', alterError.message);
      }

      // Step 2: Create company_profiles table without foreign key
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS company_profiles (
              id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
              business_account_id VARCHAR NOT NULL,
              industry VARCHAR(100),
              employee_count VARCHAR(50),
              website VARCHAR(255),
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW(),
              UNIQUE(business_account_id)
          )
        `);
        console.log('✅ Created company_profiles table');
      } catch (createError) {
        console.log('⚠️ company_profiles table already exists or failed:', createError.message);
      }

      // Step 3: Create business_account_plans table without foreign key
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS business_account_plans (
              id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
              business_account_id VARCHAR NOT NULL,
              plan_name VARCHAR(100) NOT NULL,
              billing_cycle VARCHAR(20) CHECK (billing_cycle IN ('monthly', 'annual')) DEFAULT 'monthly',
              price_per_month DECIMAL(10,2),
              features TEXT,
              is_active BOOLEAN DEFAULT TRUE,
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        console.log('✅ Created business_account_plans table');
      } catch (createError) {
        console.log('⚠️ business_account_plans table already exists or failed:', createError.message);
      }

      // Step 4: Create indexes
      try {
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_business_accounts_onboarding ON business_accounts(onboarding_completed)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_company_profiles_business_id ON company_profiles(business_account_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_business_plans_active ON business_account_plans(business_account_id, is_active)`);
        console.log('✅ Created indexes');
      } catch (indexError) {
        console.log('⚠️ Indexes already exist or failed:', indexError.message);
      }
      
      console.log('✅ Onboarding migration executed successfully');
      res.json({ message: "Onboarding migration completed successfully" });
    } catch (error) {
      console.error("Error running onboarding migration:", error);
      res.status(500).json({ message: "Migration failed", error: error.message });
    }
  });

  // Middleware to check onboarding status
  async function checkOnboardingStatus(businessAccountId: string) {
    const result = await pool.query(`
      SELECT 
        onboarding_completed,
        profile_completed,
        plan_selected
      FROM business_accounts 
      WHERE id = $1
    `, [businessAccountId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const account = result.rows[0];
    return {
      onboarding_completed: account.onboarding_completed,
      profile_completed: account.profile_completed,
      plan_selected: account.plan_selected,
      needs_profile: !account.profile_completed,
      needs_plan: !account.plan_selected,
      needs_onboarding: !account.onboarding_completed
    };
  }

  // Endpoint to get onboarding status for a business account
  app.get("/api/onboarding/status/:businessAccountId", async (req, res) => {
    try {
      const { businessAccountId } = req.params;
      const status = await checkOnboardingStatus(businessAccountId);
      
      if (!status) {
        return res.status(404).json({ error: "Business account not found" });
      }
      
      res.json(status);
    } catch (error) {
      console.error("Error checking onboarding status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Endpoint to get available plans for onboarding (no auth required)
  app.get("/api/onboarding/plans", async (req, res) => {
    try {
      const plans = await storage.getPlans();
      const activePlans = plans.filter(plan => plan.status === 'ACTIVE');
      res.json(activePlans);
    } catch (error) {
      console.error("Error fetching plans for onboarding:", error);
      res.status(500).json({ error: "Failed to fetch plans" });
    }
  });

  // Endpoint to save company profile
  app.post("/api/onboarding/profile", async (req, res) => {
    try {
      const { businessAccountId, industry, employeeCount, website } = req.body;
      
      if (!businessAccountId || !industry || !employeeCount) {
        return res.status(400).json({ error: "businessAccountId, industry, and employeeCount are required" });
      }
      
      // Insert or update company profile
      await pool.query(`
        INSERT INTO company_profiles (business_account_id, industry, employee_count, website)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (business_account_id) 
        DO UPDATE SET 
          industry = $2,
          employee_count = $3,
          website = $4,
          updated_at = NOW()
      `, [businessAccountId, industry, employeeCount, website || null]);
      
      // Update business account profile_completed flag
      await pool.query(`
        UPDATE business_accounts 
        SET profile_completed = true, updated_at = NOW()
        WHERE id = $1
      `, [businessAccountId]);
      
      console.log(`✅ Profile saved for business account: ${businessAccountId}`);
      res.json({ success: true, message: "Profile saved successfully" });
    } catch (error) {
      console.error("Error saving company profile:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Endpoint to save plan selection
  app.post("/api/onboarding/plan", async (req, res) => {
    try {
      const { businessAccountId, planId, billingCycle } = req.body;
      
      if (!businessAccountId || !planId || !billingCycle) {
        return res.status(400).json({ error: "businessAccountId, planId, and billingCycle are required" });
      }
      
      // Get plan details to calculate trial end date and pricing
      const plan = await storage.getPlan(planId);
      if (!plan) {
        return res.status(404).json({ error: "Plan not found" });
      }
      
      // Calculate trial end date based on plan's trial days
      const trialStartDate = new Date();
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + plan.trialDays);
      
      // Determine price based on billing cycle
      let totalAmount = 0;
      if (billingCycle === 'monthly') {
        totalAmount = parseFloat(plan.monthlyPrice || plan.price);
      } else if (billingCycle === 'annual') {
        totalAmount = parseFloat(plan.annualPrice || plan.price) * 12;
      }
      
      // First, deactivate any existing plans for this business account
      await pool.query(`
        UPDATE business_account_plans 
        SET status = 'CANCELLED', updated_at = NOW()
        WHERE business_account_id = $1 AND status IN ('TRIAL', 'ACTIVE')
      `, [businessAccountId]);
      
      // Create new business account plan using the correct storage function
      const newSubscription = await storage.createBusinessAccountPlan({
        businessAccountId,
        planId,
        status: 'TRIAL',
        trialStartDate,
        trialEndDate,
        subscriptionStartDate: null,
        subscriptionEndDate: null,
        autoRenew: true,
        billingFrequency: billingCycle.toUpperCase(),
        totalAmount,
        currency: 'USD'
      });
      
      // CRITICAL FIX: Update business account plan field for UnifiedPermissionService
      await pool.query(
        'UPDATE business_accounts SET plan = $1, plan_selected = true, updated_at = NOW() WHERE id = $2',
        [plan.name, businessAccountId]
      );
      
      console.log(`✅ Updated business account plan field: ${businessAccountId} -> ${plan.name}`);
      
      // Enable modules included in the plan automatically
      const planModules = await storage.getPlanModules(planId);
      const includedModules = planModules.filter(module => module.isIncluded);
      
      // Helper function to get moduleId from moduleType
      const getModuleId = async (moduleType: string): Promise<string | null> => {
        const moduleQuery = await pool.query('SELECT id FROM modules WHERE type = $1', [moduleType]);
        return moduleQuery.rows.length > 0 ? moduleQuery.rows[0].id : null;
      };
      
      // Get SUPER_ADMIN user ID for automatic module enabling
      const systemUserResult = await pool.query('SELECT id FROM users WHERE role = \'SUPER_ADMIN\' LIMIT 1');
      const systemUserId = systemUserResult.rows.length > 0 ? systemUserResult.rows[0].id : null;
      
      const enabledModuleTypes = [];
      for (const module of includedModules) {
        try {
          const moduleId = await getModuleId(module.moduleType);
          if (moduleId && systemUserId) {
            await storage.enableModuleForBusinessAccount(businessAccountId, moduleId, systemUserId);
            enabledModuleTypes.push(module.moduleType);
            console.log(`✅ Enabled module ${module.moduleType} (${moduleId}) for business account ${businessAccountId}`);
          } else {
            console.warn(`⚠️ Missing requirements - Module ID: ${moduleId}, System User: ${systemUserId}`);
          }
        } catch (moduleError) {
          console.warn(`⚠️ Could not enable module ${module.moduleType}:`, moduleError.message);
          // Continue with other modules even if one fails
        }
      }
      
      console.log(`✅ Plan selected for business account: ${businessAccountId} - ${plan.name} (Trial until ${trialEndDate.toISOString()})`);
      res.json({ 
        success: true, 
        message: "Plan selected successfully",
        subscription: newSubscription,
        enabledModules: enabledModuleTypes
      });
    } catch (error) {
      console.error("Error saving plan selection:", error);
      res.status(500).json({ error: "Internal server error", details: error.message });
    }
  });

  // Endpoint to complete onboarding
  app.post("/api/onboarding/complete", async (req, res) => {
    try {
      const { businessAccountId } = req.body;
      
      if (!businessAccountId) {
        return res.status(400).json({ error: "businessAccountId is required" });
      }
      
      // Check if profile and plan are completed
      const status = await checkOnboardingStatus(businessAccountId);
      
      if (!status) {
        return res.status(404).json({ error: "Business account not found" });
      }
      
      // Check if there's an active subscription (instead of relying on plan_selected flag)
      const hasActivePlan = await pool.query(`
        SELECT id FROM business_account_plans 
        WHERE business_account_id = $1 AND status IN ('TRIAL', 'ACTIVE')
      `, [businessAccountId]);
      
      if (!status.profile_completed || hasActivePlan.rows.length === 0) {
        return res.status(400).json({ 
          error: "Cannot complete onboarding: profile and plan selection must be completed first",
          status: { ...status, has_active_plan: hasActivePlan.rows.length > 0 }
        });
      }
      
      // Mark onboarding as completed AND plan as selected
      await pool.query(`
        UPDATE business_accounts 
        SET onboarding_completed = true, plan_selected = true, updated_at = NOW()
        WHERE id = $1
      `, [businessAccountId]);
      
      console.log(`✅ Onboarding completed for business account: ${businessAccountId}`);
      res.json({ success: true, message: "Onboarding completed successfully" });
    } catch (error) {
      console.error("Error completing onboarding:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin endpoint to delete business account by email
  app.delete("/api/admin/delete-business-by-email/:email", async (req, res) => {
    try {
      const { email } = req.params;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      // Find user and business account
      const userQuery = await pool.query(`
        SELECT u.id as user_id, u.name as user_name, u.business_account_id, ba.name as business_name
        FROM users u 
        JOIN business_accounts ba ON u.business_account_id = ba.id 
        WHERE u.email = $1
      `, [email]);
      
      if (userQuery.rows.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const user = userQuery.rows[0];
      
      // Delete user first (foreign key constraint)
      await pool.query('DELETE FROM users WHERE id = $1', [user.user_id]);
      console.log(`✅ Deleted user: ${user.user_name} (${email})`);
      
      // Delete business account
      await pool.query('DELETE FROM business_accounts WHERE id = $1', [user.business_account_id]);
      console.log(`✅ Deleted business account: ${user.business_name}`);
      
      res.json({ 
        message: "Business account and user deleted successfully",
        deletedUser: user.user_name,
        deletedBusiness: user.business_name,
        email: email
      });
      
    } catch (error) {
      console.error("Error deleting business account:", error);
      res.status(500).json({ message: "Failed to delete business account" });
    }
  });

  // Test Brevo template endpoint
  app.post("/api/test-business-welcome", async (req, res) => {
    try {
      const { to, companyName, responsibleName, tempPassword } = req.body;
      
      if (!to || !companyName || !responsibleName || !tempPassword) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      const { sendBusinessWelcomeTemplate } = await import('./services/brevoTemplateService');
      
      const success = await sendBusinessWelcomeTemplate({
        to,
        companyName,
        responsibleName,
        tempPassword
      });
      
      if (success) {
        res.json({ message: "Business welcome template sent successfully", status: "success" });
      } else {
        res.status(500).json({ message: "Failed to send template", status: "error" });
      }
    } catch (error) {
      console.error("Error testing template:", error);
      res.status(500).json({ message: "Failed to send template", status: "error" });
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

  app.delete("/api/plan-modules/:planId", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      await storage.deletePlanModules(req.params.planId);
      res.json({ message: "Plan modules deleted successfully" });
    } catch (error) {
      console.error("Error deleting plan modules:", error);
      res.status(500).json({ message: "Error al eliminar módulos del plan" });
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
      const userId = req.user.id; // Pass user ID for custom permissions check
      
      const permissions = await planService.getModulePermissions(businessAccountId, moduleType, userId);
      res.json(permissions);
    } catch (error) {
      console.error("Error getting module permissions:", error);
      res.status(500).json({ message: "Error al obtener permisos del módulo" });
    }
  });


  const httpServer = createServer(app);
  return httpServer;
}
