import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const companyStatusEnum = pgEnum('company_status', ['LEAD', 'ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED']);
export const opportunityTypeEnum = pgEnum('opportunity_type', ['NEW_CLIENT', 'ADDITIONAL_PROJECT']);
export const opportunityStatusEnum = pgEnum('opportunity_status', ['NEW', 'QUALIFYING', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST', 'ON_HOLD']);
export const activityTypeEnum = pgEnum('activity_type', ['CALL', 'MEETING', 'AGREEMENT', 'NOTE']);
export const userRoleEnum = pgEnum('user_role', ['SUPER_ADMIN', 'BUSINESS_PLAN', 'USER']);
export const moduleTypeEnum = pgEnum('module_type', ['USERS', 'COMPANIES', 'CRM', 'BILLING', 'INVENTORY', 'HR', 'ANALYTICS']);

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
  plan: text("plan").notNull().default('BUSINESS_PLAN'),
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


// Companies table
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
  industry: text("industry"), // Optional industry field
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
  businessAccountId: true, // Omit this field - it's assigned automatically by the backend
}).extend({
  website: z.string().optional(),
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
}).extend({
  website: z.string().optional(),
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
  contactEmail: string | null; // Email from the BUSINESS_PLAN user
  contactName: string | null; // Name from the BUSINESS_PLAN user
  contactPhone: string | null; // Phone from the BUSINESS_PLAN user
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

// Module constants - Only modules that are fully implemented
export const AVAILABLE_MODULES = {
  USERS: {
    name: 'Usuarios',
    type: 'USERS' as const,
    description: 'Gestión de usuarios y permisos dentro de la organización'
  },
  COMPANIES: {
    name: 'Empresas',
    type: 'COMPANIES' as const,
    description: 'Gestión de empresas y contactos comerciales'
  },
  CRM: {
    name: 'CRM',
    type: 'CRM' as const,
    description: 'Gestión de relaciones con clientes, oportunidades y actividades'
  }
} as const;

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
