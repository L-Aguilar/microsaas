import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const companyStatusEnum = pgEnum('company_status', ['LEAD', 'ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED']);
export const opportunityTypeEnum = pgEnum('opportunity_type', ['NEW_CLIENT', 'ADDITIONAL_PROJECT']);
export const opportunityStatusEnum = pgEnum('opportunity_status', ['NEW', 'IN_PROGRESS', 'NEGOTIATION', 'WON', 'LOST']);
export const activityTypeEnum = pgEnum('activity_type', ['CALL', 'MEETING', 'NOTE']);
export const userRoleEnum = pgEnum('user_role', ['SUPER_ADMIN', 'BUSINESS_ADMIN', 'USER']);
export const moduleTypeEnum = pgEnum('module_type', ['USERS', 'CONTACTS', 'CRM']);
export const contactSourceEnum = pgEnum('contact_source', ['MANUAL', 'IMPORTED', 'API']);

// SaaS Plan and Billing Enums
export const billingFrequencyEnum = pgEnum('billing_frequency', ['MONTHLY', 'ANNUAL']);
export const planStatusEnum = pgEnum('plan_status', ['ACTIVE', 'INACTIVE', 'DEPRECATED']);
export const productTypeEnum = pgEnum('product_type', ['MODULE', 'USER_ADDON', 'FEATURE_ADDON', 'STORAGE_ADDON']);
export const subscriptionStatusEnum = pgEnum('subscription_status', ['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED']);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  password: text("password").notNull(),
  role: userRoleEnum("role").notNull().default('USER'),
  avatar: text("avatar"), // URL to user's profile picture
  businessAccountId: varchar("business_account_id").references(() => businessAccounts.id), // null for SUPER_ADMIN
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Modules table
export const modules = pgTable("modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: moduleTypeEnum("type").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Business Accounts table (SaaS multi-tenant)
// Contact information is stored in the associated users table
// Uses soft delete with deletedAt timestamp
export const businessAccounts = pgTable("business_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  plan: text("plan").notNull().default('BUSINESS_ADMIN'),
  isActive: boolean("is_active").default(true).notNull(),
  deletedAt: timestamp("deleted_at"), // Soft delete timestamp
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Business Account Modules (which modules each business account has enabled)
export const businessAccountModules = pgTable("business_account_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessAccountId: varchar("business_account_id").references(() => businessAccounts.id).notNull(),
  moduleId: varchar("module_id").references(() => modules.id).notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  enabledAt: timestamp("enabled_at").defaultNow().notNull(),
  enabledBy: varchar("enabled_by").references(() => users.id),
});


// Companies table (used as Contacts module)
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  status: companyStatusEnum("status").notNull().default('LEAD'),
  ownerId: varchar("owner_id").references(() => users.id),
  businessAccountId: varchar("business_account_id").references(() => businessAccounts.id).notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  website: text("website"),
  phone: text("phone"),
  industry: text("industry"),
  // New contact fields
  mobile: text("mobile"),
  companyName: text("company_name"), // Company the contact works for (different from "name" which is contact's name)
  position: text("position"),
  address: text("address"),
  city: text("city"),
  country: text("country"),
  avatar: text("avatar"), // URL to contact's profile picture
  notes: text("notes"),
  tags: text("tags").array(), // Array of tags for categorization
  source: contactSourceEnum("source").default('MANUAL'),
  createdBy: varchar("created_by").references(() => users.id),
  // Soft delete fields
  isDeleted: boolean("is_deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at"),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Opportunities table
export const opportunities = pgTable("opportunities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  type: opportunityTypeEnum("type").notNull().default('NEW_CLIENT'),
  status: opportunityStatusEnum("status").notNull().default('NEW'),
  estimatedCloseDate: timestamp("estimated_close_date"),
  notes: text("notes"),
  companyId: varchar("company_id").references(() => companies.id).notNull(),
  sellerId: varchar("seller_id").references(() => users.id).notNull(),
  businessAccountId: varchar("business_account_id").references(() => businessAccounts.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Activities table
export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  opportunityId: varchar("opportunity_id").references(() => opportunities.id).notNull(),
  authorId: varchar("author_id").references(() => users.id).notNull(),
  type: activityTypeEnum("type").notNull(),
  details: text("details"),
  activityDate: timestamp("activity_date").notNull(),
  isTask: boolean("is_task").default(false).notNull(),
  reminderDate: timestamp("reminder_date"),
  businessAccountId: varchar("business_account_id").references(() => businessAccounts.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  businessAccountId: true, // Assigned automatically by the backend
  createdBy: true, // Assigned automatically by the backend
  isDeleted: true, // Managed by backend
  deletedAt: true, // Managed by backend
}).extend({
  website: z.string().optional(),
  mobile: z.string().optional(),
  companyName: z.string().optional(),
  position: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  avatar: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  source: z.enum(['MANUAL', 'IMPORTED', 'API']).optional(),
}).refine((data) => {
  // At least one of email or phone must be provided
  const hasEmail = data.email && data.email.trim() !== '';
  const hasPhone = data.phone && data.phone.trim() !== '';
  return hasEmail || hasPhone;
}, {
  message: "Debe proporcionar al menos un correo electrónico o teléfono",
  path: ["email"], // Will show error on email field
});

export const insertOpportunitySchema = createInsertSchema(opportunities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
});

export const insertModuleSchema = createInsertSchema(modules).omit({
  id: true,
  createdAt: true,
});

export const insertBusinessAccountSchema = createInsertSchema(businessAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBusinessAccountModuleSchema = createInsertSchema(businessAccountModules).omit({
  id: true,
  enabledAt: true,
});

// Update schemas
const baseCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  website: z.string().optional(),
  mobile: z.string().optional(),
  companyName: z.string().optional(),
  position: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  avatar: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  source: z.enum(['MANUAL', 'IMPORTED', 'API']).optional(),
});

export const updateCompanySchema = baseCompanySchema.partial();
export const updateOpportunitySchema = insertOpportunitySchema.partial();
export const updateUserSchema = insertUserSchema.partial();

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type UpdateCompany = z.infer<typeof updateCompanySchema>;
export type Opportunity = typeof opportunities.$inferSelect;
export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;
export type UpdateOpportunity = z.infer<typeof updateOpportunitySchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Module = typeof modules.$inferSelect;
export type InsertModule = z.infer<typeof insertModuleSchema>;
export type BusinessAccount = typeof businessAccounts.$inferSelect;
export type InsertBusinessAccount = z.infer<typeof insertBusinessAccountSchema>;
export type BusinessAccountModule = typeof businessAccountModules.$inferSelect;
export type InsertBusinessAccountModule = z.infer<typeof insertBusinessAccountModuleSchema>;

// SaaS Plans Types (to be added at end of file after table definitions)

// Extended types with relations
export type OpportunityWithRelations = Opportunity & {
  company: CompanyWithRelations;
  seller: User;
  activities: Activity[];
};

export type CompanyWithRelations = Company & {
  owner: User | null;
  opportunities: Opportunity[];
  businessAccount: BusinessAccount;
};

export type BusinessAccountWithRelations = BusinessAccount & {
  contactEmail: string | null; // Email from the BUSINESS_ADMIN user
  contactName: string | null; // Name from the BUSINESS_ADMIN user
  contactPhone: string | null; // Phone from the BUSINESS_ADMIN user
  modules: ModuleWithStatus[];
  users: User[];
  companies: Company[];
};

export type ModuleWithStatus = Module & {
  isEnabled: boolean;
  enabledAt?: Date | null;
  enabledBy?: User | null;
};

export type UserWithBusinessAccount = User & {
  businessAccount: BusinessAccount | null;
};

export type ActivityWithRelations = Activity & {
  author: User;
  opportunity: OpportunityWithRelations;
};

// SaaS Plans Extended Types with Relations (moved to end of file)

// Plan Limit Check Types
export type LimitCheckResult = {
  canProceed: boolean;
  currentCount: number;
  limit: number | null; // null = unlimited
  message?: string;
};

export type ModulePermissions = {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canView: boolean;
  itemLimit: number | null; // null = unlimited
  currentCount: number;
  isAtLimit: boolean;
  isNearLimit: boolean;
};

// Module constants - ONLY modules that actually exist in the system
export const AVAILABLE_MODULES = {
  USERS: {
    name: 'Usuarios',
    type: 'USERS' as const,
    description: 'Gestión de usuarios y permisos dentro de la organización',
    hasLimits: true,
    defaultLimit: 5
  },
  CONTACTS: {
    name: 'Contactos',
    type: 'CONTACTS' as const, 
    description: 'Gestión de contactos y clientes',
    hasLimits: true,
    defaultLimit: 100
  },
  CRM: {
    name: 'CRM',
    type: 'CRM' as const,
    description: 'Gestión de relaciones con clientes, oportunidades y actividades',
    hasLimits: false,
    defaultLimit: null
  }
} as const;

// SaaS Plans table
export const plans = pgTable("plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull().default('0.00'), // Legacy field for compatibility
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }),
  annualPrice: decimal("annual_price", { precision: 10, scale: 2 }),
  billingFrequency: billingFrequencyEnum("billing_frequency").notNull().default('MONTHLY'), // Legacy field
  trialDays: integer("trial_days").notNull().default(14),
  status: planStatusEnum("status").notNull().default('ACTIVE'),
  isDefault: boolean("is_default").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  features: text("features").array(), // JSON array of feature descriptions
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Independent Products table (add-ons, extra features, etc.)
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  type: productTypeEnum("type").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(), // Legacy field for compatibility
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }),
  annualPrice: decimal("annual_price", { precision: 10, scale: 2 }),
  billingFrequency: billingFrequencyEnum("billing_frequency").notNull().default('MONTHLY'), // Legacy field
  moduleType: moduleTypeEnum("module_type"), // For MODULE and FEATURE_ADDON types
  isActive: boolean("is_active").default(true).notNull(),
  metadata: text("metadata"), // JSON for extra configuration
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Plan Modules - defines what modules are included in each plan and their limits
export const planModules = pgTable("plan_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").references(() => plans.id).notNull(),
  moduleType: moduleTypeEnum("module_type").notNull(),
  isIncluded: boolean("is_included").default(true).notNull(),
  itemLimit: integer("item_limit"), // null = unlimited, number = limit (e.g., max users, companies)
  features: text("features").array(), // Specific features for this module in this plan
});

// Business Account Plans - current plan subscription for each business account
export const businessAccountPlans = pgTable("business_account_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessAccountId: varchar("business_account_id").references(() => businessAccounts.id).notNull(),
  planId: varchar("plan_id").references(() => plans.id).notNull(),
  status: subscriptionStatusEnum("status").notNull().default('TRIAL'),
  trialStartDate: timestamp("trial_start_date").defaultNow(),
  trialEndDate: timestamp("trial_end_date"),
  subscriptionStartDate: timestamp("subscription_start_date"),
  subscriptionEndDate: timestamp("subscription_end_date"),
  autoRenew: boolean("auto_renew").default(true).notNull(),
  billingFrequency: billingFrequencyEnum("billing_frequency").notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull().default('0.00'),
  currency: text("currency").default('USD').notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Business Account Products - additional products/add-ons subscribed by business accounts
export const businessAccountProducts = pgTable("business_account_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessAccountId: varchar("business_account_id").references(() => businessAccounts.id).notNull(),
  productId: varchar("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").default(1).notNull(), // for USER_ADDON etc.
  status: subscriptionStatusEnum("status").notNull().default('ACTIVE'),
  subscriptionStartDate: timestamp("subscription_start_date").defaultNow(),
  subscriptionEndDate: timestamp("subscription_end_date"),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  billingFrequency: billingFrequencyEnum("billing_frequency").notNull(),
  autoRenew: boolean("auto_renew").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Plan Usage Tracking - tracks current usage for limit enforcement
export const planUsage = pgTable("plan_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessAccountId: varchar("business_account_id").references(() => businessAccounts.id).notNull(),
  moduleType: moduleTypeEnum("module_type").notNull(),
  currentCount: integer("current_count").default(0).notNull(),
  lastCalculated: timestamp("last_calculated").defaultNow().notNull(),
});

// Stats type for reports
export type DashboardStats = {
  totalWon: number;
  totalNegotiation: number;
  activeCompanies: number;
  activitiesToday: number;
  totalOpportunities: number;
  opportunitiesByStatus: Record<string, number>;
  amountsBySeller: Record<string, number>;
  activitiesByType: Record<string, number>;
};

// SaaS Plans Insert Schemas (after table definitions)
export const insertPlanSchema = createInsertSchema(plans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPlanModuleSchema = createInsertSchema(planModules).omit({
  id: true,
});

export const insertBusinessAccountPlanSchema = createInsertSchema(businessAccountPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBusinessAccountProductSchema = createInsertSchema(businessAccountProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPlanUsageSchema = createInsertSchema(planUsage).omit({
  id: true,
  lastCalculated: true,
});

// SaaS Plans Types
export type Plan = typeof plans.$inferSelect;
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type PlanModule = typeof planModules.$inferSelect;
export type InsertPlanModule = z.infer<typeof insertPlanModuleSchema>;
export type BusinessAccountPlan = typeof businessAccountPlans.$inferSelect;
export type InsertBusinessAccountPlan = z.infer<typeof insertBusinessAccountPlanSchema>;
export type BusinessAccountProduct = typeof businessAccountProducts.$inferSelect;
export type InsertBusinessAccountProduct = z.infer<typeof insertBusinessAccountProductSchema>;
export type PlanUsage = typeof planUsage.$inferSelect;
export type InsertPlanUsage = z.infer<typeof insertPlanUsageSchema>;

// SaaS Plans Extended Types with Relations
export type PlanWithModules = Plan & {
  modules: PlanModule[];
};

export type BusinessAccountPlanWithRelations = BusinessAccountPlan & {
  plan: PlanWithModules;
  businessAccount: BusinessAccount;
};

export type BusinessAccountProductWithRelations = BusinessAccountProduct & {
  product: Product;
  businessAccount: BusinessAccount;
};

export type BusinessAccountWithPlan = BusinessAccount & {
  currentPlan?: BusinessAccountPlanWithRelations;
  additionalProducts: BusinessAccountProductWithRelations[];
  usage: PlanUsage[];
};
