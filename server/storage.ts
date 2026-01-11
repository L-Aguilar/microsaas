import { type User, type InsertUser, type UpdateUser, type Company, type InsertCompany, type UpdateCompany, type Opportunity, type InsertOpportunity, type UpdateOpportunity, type Activity, type InsertActivity, type OpportunityWithRelations, type CompanyWithRelations, type ActivityWithRelations, type Module, type InsertModule, type BusinessAccount, type InsertBusinessAccount, type BusinessAccountModule, type InsertBusinessAccountModule, type ModuleWithStatus, type BusinessAccountWithRelations, type UserWithBusinessAccount, type Plan, type InsertPlan, type Product, type InsertProduct, type PlanModule, type InsertPlanModule, type BusinessAccountPlan, type InsertBusinessAccountPlan, type BusinessAccountProduct, type InsertBusinessAccountProduct, type PlanUsage, type InsertPlanUsage, type PlanWithModules, type BusinessAccountPlanWithRelations, AVAILABLE_MODULES } from "@shared/schema";
import { pool } from "./db";
import { randomUUID } from "crypto";

export interface IStorage {
  // Business Accounts (SaaS multi-tenant)
  getBusinessAccounts(): Promise<BusinessAccountWithRelations[]>;
  getBusinessAccount(id: string): Promise<BusinessAccountWithRelations | undefined>;
  createBusinessAccount(account: InsertBusinessAccount): Promise<BusinessAccount>;
  updateBusinessAccount(id: string, account: Partial<InsertBusinessAccount>): Promise<BusinessAccount | undefined>;
  deleteBusinessAccount(id: string): Promise<boolean>;

  // Users (filtered by business account)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: UpdateUser): Promise<User | undefined>;
  updateUserPassword(email: string, hashedPassword: string): Promise<boolean>;
  updateUserPasswordById(userId: string, hashedPassword: string): Promise<boolean>;
  getUsers(businessAccountId?: string): Promise<User[]>; // Optional filtering for SUPER_ADMIN
  deleteUser(id: string): Promise<boolean>;

  // Companies (filtered by business account)
  getCompanies(businessAccountId?: string): Promise<CompanyWithRelations[]>;
  getAllCompanies(): Promise<CompanyWithRelations[]>; // Alias for getCompanies() without filter
  getCompany(id: string): Promise<CompanyWithRelations | undefined>;
  createCompany(company: InsertCompany & { businessAccountId: string }): Promise<Company>;
  updateCompany(id: string, company: UpdateCompany): Promise<Company | undefined>;
  deleteCompany(id: string): Promise<boolean>;

  // Opportunities (filtered by business account)
  getOpportunities(businessAccountId?: string): Promise<OpportunityWithRelations[]>;
  getAllOpportunities(): Promise<OpportunityWithRelations[]>; // Alias for getOpportunities() without filter
  getOpportunity(id: string): Promise<OpportunityWithRelations | undefined>;
  getOpportunitiesByCompany(companyId: string): Promise<OpportunityWithRelations[]>;
  createOpportunity(opportunity: InsertOpportunity): Promise<Opportunity>;
  updateOpportunity(id: string, opportunity: UpdateOpportunity): Promise<Opportunity | undefined>;
  deleteOpportunity(id: string): Promise<boolean>;

  // Activities (filtered by business account)
  getActivities(businessAccountId?: string): Promise<ActivityWithRelations[]>;
  getAllActivities(): Promise<ActivityWithRelations[]>; // Alias for getActivities() without filter
  getActivitiesByOpportunity(opportunityId: string): Promise<ActivityWithRelations[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;

  // Modules (global and business account specific)
  getModules(): Promise<Module[]>;
  getBusinessAccountModules(businessAccountId: string): Promise<ModuleWithStatus[]>;
  enableModuleForBusinessAccount(businessAccountId: string, moduleId: string, enabledBy: string): Promise<boolean>;
  disableModuleForBusinessAccount(businessAccountId: string, moduleId: string): Promise<boolean>;
  hasModuleEnabled(businessAccountId: string, moduleType: string): Promise<boolean>;

  // SaaS Plans Management
  getPlans(): Promise<Plan[]>;
  getPlan(id: string): Promise<Plan | undefined>;
  createPlan(plan: InsertPlan): Promise<Plan>;
  updatePlan(id: string, plan: Partial<InsertPlan>): Promise<Plan | undefined>;
  isPlanInUse(planId: string): Promise<{ inUse: boolean; count: number; companies: string[] }>;
  deletePlan(id: string): Promise<boolean>;

  // Products Management
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  isProductInUse(productId: string): Promise<{ inUse: boolean; count: number; companies: string[] }>;
  deleteProduct(id: string): Promise<boolean>;

  // Plan Modules Management
  getPlanModules(planId: string): Promise<PlanModule[]>;
  createPlanModule(planModule: InsertPlanModule): Promise<PlanModule>;
  updatePlanModule(id: string, planModule: Partial<InsertPlanModule>): Promise<PlanModule | undefined>;
  deletePlanModule(id: string): Promise<boolean>;

  // Business Account Subscriptions
  getBusinessAccountPlan(businessAccountId: string): Promise<BusinessAccountPlanWithRelations | undefined>;
  createBusinessAccountPlan(subscription: InsertBusinessAccountPlan): Promise<BusinessAccountPlan>;
  updateBusinessAccountPlan(id: string, subscription: Partial<InsertBusinessAccountPlan>): Promise<BusinessAccountPlan | undefined>;

  // Business Account Products
  getBusinessAccountProducts(businessAccountId: string): Promise<BusinessAccountProduct[]>;
  createBusinessAccountProduct(product: InsertBusinessAccountProduct): Promise<BusinessAccountProduct>;
  updateBusinessAccountProduct(id: string, product: Partial<InsertBusinessAccountProduct>): Promise<BusinessAccountProduct | undefined>;
  deleteBusinessAccountProduct(id: string): Promise<boolean>;
  updateBusinessAccountProductPrices(productId: string, priceUpdate: { unitPrice: string; billingFrequency: string }): Promise<boolean>;
  updateBusinessAccountProductDualPrices(productId: string, priceUpdate: { monthlyPrice?: string; annualPrice?: string }): Promise<boolean>;
  updateBusinessAccountPlanDualPrices(planId: string, priceUpdate: { monthlyPrice?: string; annualPrice?: string }): Promise<boolean>;

  // Plan Usage Tracking
  getPlanUsage(businessAccountId: string): Promise<PlanUsage[]>;
  updatePlanUsage(usage: InsertPlanUsage): Promise<PlanUsage>;
  getCurrentUsageCount(businessAccountId: string, moduleType: string): Promise<number>;

  // Legacy methods for backward compatibility (will be removed)
  getCompanyModules(companyId: string): Promise<ModuleWithStatus[]>;
  enableModuleForCompany(companyId: string, moduleId: string, enabledBy: string): Promise<boolean>;
  disableModuleForCompany(companyId: string, moduleId: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private companies: Map<string, Company>;
  private opportunities: Map<string, Opportunity>;
  private activities: Map<string, Activity>;
  private modules: Map<string, Module>;
  private businessAccounts: Map<string, BusinessAccount>;
  private businessAccountModules: Map<string, BusinessAccountModule>;

  constructor() {
    this.users = new Map();
    this.companies = new Map();
    this.opportunities = new Map();
    this.activities = new Map();
    this.modules = new Map();
    this.businessAccounts = new Map();
    this.businessAccountModules = new Map();

    // Initialize with sample data
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Create global modules from AVAILABLE_MODULES
    const moduleEntries = Object.values(AVAILABLE_MODULES);
    
    for (const moduleConfig of moduleEntries) {
      const module: Module = {
        id: randomUUID(),
        name: moduleConfig.name,
        type: moduleConfig.type,
        description: moduleConfig.description,
        isActive: true,
        createdAt: new Date(),
      };
      this.modules.set(module.id, module);
    }

    // Create SUPER_ADMIN user from environment variables
    const superAdminUser: User = {
      id: randomUUID(),
      name: "Super Admin",
      email: process.env.SUPER_ADMIN_EMAIL || "admin@yourcompany.com",
      phone: "+52 555 000 0000",
      password: process.env.SUPER_ADMIN_PASSWORD || "CHANGE_THIS_PASSWORD", // Should be hashed in real implementation
      role: "SUPER_ADMIN",
      avatar: null,
      businessAccountId: null, // Super admin doesn't belong to any business account
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.set(superAdminUser.id, superAdminUser);
  }

  // Business Accounts methods
  async getBusinessAccounts(): Promise<BusinessAccountWithRelations[]> {
    const accountsArray = Array.from(this.businessAccounts.values());
    const accountsWithRelations = await Promise.all(
      accountsArray.map(async account => ({
        ...account,
        contactEmail: null, // Add missing property
        contactName: null, // Add missing property
        contactPhone: null, // Add missing property
        modules: await this.getBusinessAccountModules(account.id),
        users: Array.from(this.users.values()).filter(user => user.businessAccountId === account.id),
        companies: Array.from(this.companies.values()).filter(company => company.businessAccountId === account.id),
      }))
    );
    return accountsWithRelations;
  }

  async getBusinessAccount(id: string): Promise<BusinessAccountWithRelations | undefined> {
    const account = this.businessAccounts.get(id);
    if (!account) return undefined;

    return {
      ...account,
      contactEmail: null, // Add missing property
      contactName: null, // Add missing property
      contactPhone: null, // Add missing property
      modules: await this.getBusinessAccountModules(account.id),
      users: Array.from(this.users.values()).filter(user => user.businessAccountId === account.id),
      companies: Array.from(this.companies.values()).filter(company => company.businessAccountId === account.id),
    };
  }

  async createBusinessAccount(accountData: InsertBusinessAccount): Promise<BusinessAccount> {
    const account: BusinessAccount = {
      id: randomUUID(),
      ...accountData,
      plan: accountData.plan || 'BUSINESS_PLAN',
      isActive: accountData.isActive ?? true,
      deletedAt: accountData.deletedAt || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.businessAccounts.set(account.id, account);
    return account;
  }

  async updateBusinessAccount(id: string, accountData: Partial<InsertBusinessAccount>): Promise<BusinessAccount | undefined> {
    const account = this.businessAccounts.get(id);
    if (!account) return undefined;

    const updatedAccount = {
      ...account,
      ...accountData,
      updatedAt: new Date(),
    };
    this.businessAccounts.set(id, updatedAccount);
    return updatedAccount;
  }

  async deleteBusinessAccount(id: string): Promise<boolean> {
    return this.businessAccounts.delete(id);
  }

  // Users methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(userData: InsertUser): Promise<User> {
    const user: User = {
      id: randomUUID(),
      ...userData,
      role: userData.role || 'USER',
      phone: userData.phone || null,
      avatar: userData.avatar || null,
      businessAccountId: userData.businessAccountId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async updateUser(id: string, userData: UpdateUser): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updatedUser = {
      ...user,
      ...userData,
      updatedAt: new Date(),
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async updateUserPassword(email: string, hashedPassword: string): Promise<boolean> {
    const user = Array.from(this.users.values()).find(u => u.email === email);
    if (!user) return false;
    
    const updatedUser = {
      ...user,
      password: hashedPassword,
      updatedAt: new Date(),
    };
    this.users.set(user.id, updatedUser);
    return true;
  }

  async getUsers(businessAccountId?: string): Promise<User[]> {
    if (businessAccountId) {
      return Array.from(this.users.values()).filter(user => user.businessAccountId === businessAccountId);
    }
    return Array.from(this.users.values());
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  // Companies methods
  async getCompanies(businessAccountId?: string): Promise<CompanyWithRelations[]> {
    let companiesArray = Array.from(this.companies.values());
    
    if (businessAccountId) {
      companiesArray = companiesArray.filter(company => company.businessAccountId === businessAccountId);
    }

    const companiesWithRelations = await Promise.all(
      companiesArray.map(async company => ({
        ...company,
        owner: company.ownerId ? (this.users.get(company.ownerId) ?? null) : null,
        opportunities: Array.from(this.opportunities.values()).filter(opp => opp.companyId === company.id),
        businessAccount: this.businessAccounts.get(company.businessAccountId)!,
      }))
    );
    
    return companiesWithRelations;
  }

  async getAllCompanies(): Promise<CompanyWithRelations[]> {
    return this.getCompanies();
  }

  async getCompany(id: string): Promise<CompanyWithRelations | undefined> {
    const company = this.companies.get(id);
    if (!company) return undefined;

    return {
      ...company,
      owner: company.ownerId ? (this.users.get(company.ownerId) ?? null) : null,
      opportunities: Array.from(this.opportunities.values()).filter(opp => opp.companyId === company.id),
      businessAccount: this.businessAccounts.get(company.businessAccountId)!,
    };
  }

  async createCompany(companyData: InsertCompany & { businessAccountId: string }): Promise<Company> {
    const company: Company = {
      id: randomUUID(),
      ...companyData,
      status: companyData.status || 'LEAD',
      email: companyData.email || null,
      phone: companyData.phone || null,
      contactName: companyData.contactName || null,
      website: companyData.website || null,
      ownerId: companyData.ownerId || null,
      industry: companyData.industry || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.companies.set(company.id, company);
    return company;
  }

  async updateCompany(id: string, companyData: UpdateCompany): Promise<Company | undefined> {
    const company = this.companies.get(id);
    if (!company) return undefined;

    const updatedCompany = {
      ...company,
      ...companyData,
      updatedAt: new Date(),
    };
    this.companies.set(id, updatedCompany);
    return updatedCompany;
  }

  async deleteCompany(id: string): Promise<boolean> {
    return this.companies.delete(id);
  }

  // Opportunities methods  
  async getOpportunities(businessAccountId?: string): Promise<OpportunityWithRelations[]> {
    let opportunitiesArray = Array.from(this.opportunities.values());
    
    if (businessAccountId) {
      opportunitiesArray = opportunitiesArray.filter(opp => opp.businessAccountId === businessAccountId);
    }
    
    const opportunitiesWithRelations = await Promise.all(
      opportunitiesArray.map(async opp => {
        const company = this.companies.get(opp.companyId)!;
        return {
          ...opp,
          company: {
            ...company,
            owner: company.ownerId ? (this.users.get(company.ownerId) ?? null) : null,
            opportunities: Array.from(this.opportunities.values()).filter(opportunity => opportunity.companyId === company.id),
            businessAccount: this.businessAccounts.get(company.businessAccountId)!,
          },
          seller: this.users.get(opp.sellerId)!,
          activities: Array.from(this.activities.values()).filter(activity => activity.opportunityId === opp.id),
        };
      })
    );
    return opportunitiesWithRelations;
  }

  async getAllOpportunities(): Promise<OpportunityWithRelations[]> {
    return this.getOpportunities();
  }

  async getOpportunity(id: string): Promise<OpportunityWithRelations | undefined> {
    const opportunity = this.opportunities.get(id);
    if (!opportunity) return undefined;

    const company = this.companies.get(opportunity.companyId)!;
    return {
      ...opportunity,
      company: {
        ...company,
        owner: company.ownerId ? (this.users.get(company.ownerId) ?? null) : null,
        opportunities: Array.from(this.opportunities.values()).filter(opp => opp.companyId === company.id),
        businessAccount: this.businessAccounts.get(company.businessAccountId)!,
      },
      seller: this.users.get(opportunity.sellerId)!,
      activities: Array.from(this.activities.values()).filter(activity => activity.opportunityId === opportunity.id),
    };
  }

  async getOpportunitiesByCompany(companyId: string): Promise<OpportunityWithRelations[]> {
    const opportunities = Array.from(this.opportunities.values()).filter(opp => opp.companyId === companyId);
    const opportunitiesWithRelations = await Promise.all(
      opportunities.map(async opp => {
        const company = this.companies.get(opp.companyId)!;
        return {
          ...opp,
          company: {
            ...company,
            owner: company.ownerId ? (this.users.get(company.ownerId) ?? null) : null,
            opportunities: Array.from(this.opportunities.values()).filter(opportunity => opportunity.companyId === company.id),
            businessAccount: this.businessAccounts.get(company.businessAccountId)!,
          },
          seller: this.users.get(opp.sellerId)!,
          activities: Array.from(this.activities.values()).filter(activity => activity.opportunityId === opp.id),
        };
      })
    );
    return opportunitiesWithRelations;
  }

  async createOpportunity(opportunityData: InsertOpportunity): Promise<Opportunity> {
    const opportunity: Opportunity = {
      id: randomUUID(),
      ...opportunityData,
      type: opportunityData.type || 'NEW_CLIENT',
      status: opportunityData.status || 'NEW',
      notes: opportunityData.notes || null,
      estimatedCloseDate: opportunityData.estimatedCloseDate || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.opportunities.set(opportunity.id, opportunity);
    return opportunity;
  }

  async updateOpportunity(id: string, opportunityData: UpdateOpportunity): Promise<Opportunity | undefined> {
    const opportunity = this.opportunities.get(id);
    if (!opportunity) return undefined;

    const updatedOpportunity = {
      ...opportunity,
      ...opportunityData,
      updatedAt: new Date(),
    };
    this.opportunities.set(id, updatedOpportunity);
    return updatedOpportunity;
  }

  async deleteOpportunity(id: string): Promise<boolean> {
    return this.opportunities.delete(id);
  }

  // Activities methods
  async getActivities(businessAccountId?: string): Promise<ActivityWithRelations[]> {
    let activitiesArray = Array.from(this.activities.values());
    
    if (businessAccountId) {
      activitiesArray = activitiesArray.filter(activity => activity.businessAccountId === businessAccountId);
    }
    
    const activitiesWithRelations = await Promise.all(
      activitiesArray.map(async activity => {
        const opportunity = this.opportunities.get(activity.opportunityId)!;
        const company = this.companies.get(opportunity.companyId)!;
        return {
          ...activity,
          author: this.users.get(activity.authorId)!,
          opportunity: {
            ...opportunity,
            company: {
              ...company,
              owner: company.ownerId ? (this.users.get(company.ownerId) ?? null) : null,
              opportunities: Array.from(this.opportunities.values()).filter(opp => opp.companyId === company.id),
              businessAccount: this.businessAccounts.get(company.businessAccountId)!,
            },
            seller: this.users.get(opportunity.sellerId)!,
            activities: [],
          },
        };
      })
    );
    return activitiesWithRelations;
  }

  async getAllActivities(): Promise<ActivityWithRelations[]> {
    return this.getActivities();
  }

  async getActivitiesByOpportunity(opportunityId: string): Promise<ActivityWithRelations[]> {
    const activities = Array.from(this.activities.values()).filter(activity => activity.opportunityId === opportunityId);
    const activitiesWithRelations = await Promise.all(
      activities.map(async activity => {
        const opportunity = this.opportunities.get(activity.opportunityId)!;
        const company = this.companies.get(opportunity.companyId)!;
        return {
          ...activity,
          author: this.users.get(activity.authorId)!,
          opportunity: {
            ...opportunity,
            company: {
              ...company,
              owner: company.ownerId ? (this.users.get(company.ownerId) ?? null) : null,
              opportunities: Array.from(this.opportunities.values()).filter(opp => opp.companyId === company.id),
              businessAccount: this.businessAccounts.get(company.businessAccountId)!,
            },
            seller: this.users.get(opportunity.sellerId)!,
            activities: [],
          },
        };
      })
    );
    return activitiesWithRelations;
  }

  async createActivity(activityData: InsertActivity): Promise<Activity> {
    const activity: Activity = {
      id: randomUUID(),
      ...activityData,
      details: activityData.details ?? null,
      isTask: activityData.isTask ?? false,
      reminderDate: activityData.reminderDate ?? null,
      createdAt: new Date(),
    };
    this.activities.set(activity.id, activity);
    return activity;
  }

  // Modules methods
  async getModules(): Promise<Module[]> {
    return Array.from(this.modules.values());
  }

  async getBusinessAccountModules(businessAccountId: string): Promise<ModuleWithStatus[]> {
    const businessAccountModules = Array.from(this.businessAccountModules.values())
      .filter(bam => bam.businessAccountId === businessAccountId);
    
    return businessAccountModules.map(bam => {
      const module = this.modules.get(bam.moduleId)!;
      const enabledByUser = bam.enabledBy ? this.users.get(bam.enabledBy) : null;
      
      return {
        ...module,
        isEnabled: bam.isEnabled,
        enabledAt: bam.enabledAt,
        enabledBy: enabledByUser,
      };
    });
  }

  async enableModuleForBusinessAccount(businessAccountId: string, moduleId: string, enabledBy: string): Promise<boolean> {
    // Check if relation already exists
    const existing = Array.from(this.businessAccountModules.values())
      .find(bam => bam.businessAccountId === businessAccountId && bam.moduleId === moduleId);
    
    if (existing) {
      existing.isEnabled = true;
      existing.enabledAt = new Date();
      existing.enabledBy = enabledBy;
      return true;
    }

    // Create new relation
    const businessAccountModule: BusinessAccountModule = {
      id: randomUUID(),
      businessAccountId,
      moduleId,
      isEnabled: true,
      enabledAt: new Date(),
      enabledBy,
    };
    this.businessAccountModules.set(businessAccountModule.id, businessAccountModule);
    return true;
  }

  async disableModuleForBusinessAccount(businessAccountId: string, moduleId: string): Promise<boolean> {
    const existing = Array.from(this.businessAccountModules.values())
      .find(bam => bam.businessAccountId === businessAccountId && bam.moduleId === moduleId);
    
    if (existing) {
      existing.isEnabled = false;
      return true;
    }
    return false;
  }

  async hasModuleEnabled(businessAccountId: string, moduleType: string): Promise<boolean> {
    const module = Array.from(this.modules.values()).find(m => m.type === moduleType);
    if (!module) return false;

    const businessAccountModule = Array.from(this.businessAccountModules.values())
      .find(bam => bam.businessAccountId === businessAccountId && bam.moduleId === module.id);
    
    return businessAccountModule?.isEnabled || false;
  }

  // Legacy methods for backward compatibility
  async getCompanyModules(companyId: string): Promise<ModuleWithStatus[]> {
    const company = this.companies.get(companyId);
    if (!company) return [];
    
    return this.getBusinessAccountModules(company.businessAccountId);
  }

  async enableModuleForCompany(companyId: string, moduleId: string, enabledBy: string): Promise<boolean> {
    const company = this.companies.get(companyId);
    if (!company) return false;
    
    return this.enableModuleForBusinessAccount(company.businessAccountId, moduleId, enabledBy);
  }

  async disableModuleForCompany(companyId: string, moduleId: string): Promise<boolean> {
    const company = this.companies.get(companyId);
    if (!company) return false;
    
    return this.disableModuleForBusinessAccount(company.businessAccountId, moduleId);
  }
}

import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { users, companies, opportunities, activities, modules, businessAccounts, businessAccountModules } from "@shared/schema";

export class DatabaseStorage implements IStorage {
  // Business Accounts methods
  async getBusinessAccounts(): Promise<BusinessAccountWithRelations[]> {
    // Use raw SQL to avoid Drizzle schema issues after migration
    // Only return non-deleted business accounts (soft delete)
    const result = await pool.query(`
      SELECT 
        ba.id,
        ba.name,
        ba.plan,
        ba.is_active,
        ba.deleted_at,
        ba.created_at,
        ba.updated_at,
        u.email as contact_email,
        u.name as contact_name,
        u.phone as contact_phone
      FROM business_accounts ba
      LEFT JOIN users u ON ba.id = u.business_account_id AND u.role = 'BUSINESS_PLAN'
      WHERE ba.deleted_at IS NULL
      ORDER BY ba.created_at DESC;
    `);
    
    const accountsWithRelations = await Promise.all(
      result.rows.map(async row => {
        const account = {
          id: row.id,
          name: row.name,
          plan: row.plan,
          isActive: row.is_active,
          deletedAt: row.deleted_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        return {
          ...account,
          contactEmail: row.contact_email || null,
          contactName: row.contact_name || null,
          contactPhone: row.contact_phone || null,
          modules: await this.getBusinessAccountModules(account.id),
          users: await this.getUsers(account.id),
          companies: await this.getCompanies(account.id),
        };
      })
    );
    return accountsWithRelations;
  }

  async getBusinessAccount(id: string): Promise<BusinessAccountWithRelations | undefined> {
    // Use raw SQL to avoid Drizzle schema issues after migration
    // Only return non-deleted business accounts (soft delete)
    const result = await pool.query(`
      SELECT 
        ba.id,
        ba.name,
        ba.plan,
        ba.is_active,
        ba.deleted_at,
        ba.created_at,
        ba.updated_at,
        u.email as contact_email,
        u.name as contact_name,
        u.phone as contact_phone
      FROM business_accounts ba
      LEFT JOIN users u ON ba.id = u.business_account_id AND u.role = 'BUSINESS_PLAN'
      WHERE ba.id = $1 AND ba.deleted_at IS NULL;
    `, [id]);
    
    if (result.rows.length === 0) return undefined;
    
    const row = result.rows[0];
    const account = {
      id: row.id,
      name: row.name,
      plan: row.plan,
      isActive: row.is_active,
      deletedAt: row.deleted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    return {
      ...account,
      contactEmail: row.contact_email || null,
      contactName: row.contact_name || null,
      contactPhone: row.contact_phone || null,
      modules: await this.getBusinessAccountModules(account.id),
      users: await this.getUsers(account.id),
      companies: await this.getCompanies(account.id),
    };
  }

  async createBusinessAccount(accountData: InsertBusinessAccount): Promise<BusinessAccount> {
    // Create the business account using raw SQL
    const result = await pool.query(`
      INSERT INTO business_accounts (id, name, plan, is_active, deleted_at, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, NULL, NOW(), NOW())
      RETURNING id, name, plan, is_active, deleted_at, created_at, updated_at;
    `, [
      accountData.name,
      accountData.plan || 'BUSINESS_PLAN',
      accountData.isActive ?? true
    ]);
    
    const account = {
      id: result.rows[0].id,
      name: result.rows[0].name,
      plan: result.rows[0].plan,
      isActive: result.rows[0].is_active,
      deletedAt: result.rows[0].deleted_at,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at
    };
    
    // Generate alphanumeric password for the admin user
    const { generateAlphanumericPassword, hashPassword } = await import('./utils/password');
    const plainPassword = generateAlphanumericPassword(8);
    const hashedPassword = hashPassword(plainPassword);
    
    // Create admin user for the business account
    const adminUserData = {
      name: (accountData as any).contactName || 'Admin',
      email: (accountData as any).contactEmail || `admin@${account.name.toLowerCase().replace(/\s+/g, '')}.com`,
      phone: (accountData as any).contactPhone || null,
      password: hashedPassword,
      role: 'BUSINESS_PLAN' as const,
      businessAccountId: account.id
    };
    
    try {
      // Create the admin user using raw SQL
      await pool.query(`
        INSERT INTO users (id, name, email, phone, password, role, business_account_id, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW());
      `, [
        adminUserData.name,
        adminUserData.email,
        adminUserData.phone,
        adminUserData.password,
        adminUserData.role,
        adminUserData.businessAccountId
      ]);
      
      // DON'T automatically assign all modules - this was causing the issue
      // Secure logging - no sensitive data exposed
      console.log(`✓ Business account created: ${account.name}`);
      console.log(`✓ Admin user created: ${adminUserData.email}`);
      console.log(`✓ Password generated securely`);
      console.log(`✓ No automatic modules assigned (will be handled by route)`);
    } catch (error) {
      console.error('Failed to create admin user or assign modules:', error);
      // Continue even if user/module assignment fails
    }
    
    return account;
  }

  async updateBusinessAccount(id: string, accountData: Partial<InsertBusinessAccount & { contactEmail?: string; contactName?: string; contactPhone?: string }>): Promise<BusinessAccount | undefined> {
    const client = await pool.connect();
    
    try {
      // Start transaction
      await client.query('BEGIN');
      
      // Build update query
      const fields = [];
      const values = [];
      let paramCount = 1;
      
      if (accountData.name !== undefined) {
        fields.push(`name = $${paramCount++}`);
        values.push(accountData.name);
      }
      // contactName is now handled in users table, not business_accounts
      if (accountData.contactName !== undefined) {
        // This will be handled when updating the associated admin user
        // Updating admin user contact information
      }
      if (accountData.plan !== undefined) {
        fields.push(`plan = $${paramCount++}`);
        values.push(accountData.plan);
      }
      if (accountData.isActive !== undefined) {
        fields.push(`is_active = $${paramCount++}`);
        values.push(accountData.isActive);
      }
      
      // Always update timestamp
      fields.push(`updated_at = NOW()`);
      values.push(id); // ID goes last
      
      if (fields.length === 1) {
        await client.query('ROLLBACK');
        return undefined;
      }
      
      const query = `
        UPDATE business_accounts 
        SET ${fields.join(', ')} 
        WHERE id = $${paramCount}
        RETURNING id, name, plan, is_active, created_at, updated_at
      `;
      
      // Executing business account update
      console.log('Values:', values);
      
      const result = await client.query(query, values);
      
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return undefined;
      }
      
      const row = result.rows[0];
      
      // Update admin user contact info if provided
      if (accountData.contactEmail !== undefined || accountData.contactName !== undefined || accountData.contactPhone !== undefined) {
        const userFields = [];
        const userValues = [];
        let userParamCount = 1;
        
        if (accountData.contactEmail !== undefined) {
          console.log('Updating admin user email to:', accountData.contactEmail);
          userFields.push(`email = $${userParamCount++}`);
          userValues.push(accountData.contactEmail);
        }
        
        if (accountData.contactName !== undefined) {
          // Updating admin user contact name
          userFields.push(`name = $${userParamCount++}`);
          userValues.push(accountData.contactName);
        }
        
        if (accountData.contactPhone !== undefined) {
          console.log('Updating admin user phone to:', accountData.contactPhone);
          userFields.push(`phone = $${userParamCount++}`);
          userValues.push(accountData.contactPhone);
        }
        
        userFields.push(`updated_at = NOW()`);
        userValues.push(id); // business_account_id
        
        const userUpdateQuery = `
          UPDATE users 
          SET ${userFields.join(', ')}
          WHERE business_account_id = $${userParamCount} AND role = 'BUSINESS_PLAN'
        `;
        
        const userResult = await client.query(userUpdateQuery, userValues);
        console.log('Admin user updated, affected rows:', userResult.rowCount);
      }
      
      // Commit transaction
      await client.query('COMMIT');
      console.log('✓ Transaction committed successfully');
      
      // Verify the changes persisted
      const verifyQuery = 'SELECT * FROM business_accounts WHERE id = $1';
      const verifyResult = await client.query(verifyQuery, [id]);
      console.log('✓ Verification - Record in database:', verifyResult.rows[0]);
      
      return {
        id: row.id,
        name: row.name,
        plan: row.plan,
        isActive: row.is_active,
        deletedAt: row.deleted_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
      
    } catch (error) {
      console.error('Error updating business account:', error);
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteBusinessAccount(id: string): Promise<boolean> {
    // Soft delete: set deleted_at timestamp instead of physically deleting
    const result = await pool.query(`
      UPDATE business_accounts 
      SET deleted_at = NOW(), updated_at = NOW() 
      WHERE id = $1 AND deleted_at IS NULL
    `, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Users methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    // Temporary fix: use raw SQL to avoid Drizzle schema sync issues
    const result = await pool.query(`
      SELECT id, name, email, phone, password, role, business_account_id, created_at, updated_at 
      FROM users WHERE email = $1
    `, [email]);
    
    if (result.rows.length === 0) return undefined;
    
    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      password: row.password,
      role: row.role,
      avatar: row.avatar,
      businessAccountId: row.business_account_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async updateUser(id: string, userData: UpdateUser): Promise<User | undefined> {
    // Use raw SQL for reliability with Supabase
    const fields = [];
    const values = [];
    let paramCount = 1;
    
    if (userData.name !== undefined) {
      fields.push(`name = $${paramCount++}`);
      values.push(userData.name);
    }
    if (userData.email !== undefined) {
      fields.push(`email = $${paramCount++}`);
      values.push(userData.email);
    }
    if (userData.phone !== undefined) {
      fields.push(`phone = $${paramCount++}`);
      values.push(userData.phone);
    }
    if (userData.role !== undefined) {
      fields.push(`role = $${paramCount++}`);
      values.push(userData.role);
    }
    if (userData.businessAccountId !== undefined) {
      fields.push(`business_account_id = $${paramCount++}`);
      values.push(userData.businessAccountId);
    }
    
    // Always update the timestamp
    fields.push(`updated_at = NOW()`);
    values.push(id); // ID goes last
    
    if (fields.length === 1) { // Only updated_at, no other fields
      return undefined;
    }
    
    const query = `
      UPDATE users 
      SET ${fields.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING id, name, email, phone, password, role, business_account_id, created_at, updated_at
    `;
    
    console.log('Updating user with query:', query);
    console.log('Values:', values);
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) return undefined;
    
    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      password: row.password,
      role: row.role,
      avatar: row.avatar,
      businessAccountId: row.business_account_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async updateUserPassword(email: string, hashedPassword: string): Promise<boolean> {
    // Use raw SQL for reliability
    const result = await pool.query(`
      UPDATE users SET password = $1, updated_at = NOW() WHERE email = $2
    `, [hashedPassword, email]);
    
    return (result.rowCount ?? 0) > 0;
  }

  async updateUserPasswordById(userId: string, hashedPassword: string): Promise<boolean> {
    // Use raw SQL for reliability
    const result = await pool.query(`
      UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2
    `, [hashedPassword, userId]);
    
    return (result.rowCount ?? 0) > 0;
  }

  async getUsers(businessAccountId?: string): Promise<User[]> {
    if (businessAccountId) {
      return await db.select().from(users).where(eq(users.businessAccountId, businessAccountId));
    }
    return await db.select().from(users);
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Companies methods
  async getCompanies(businessAccountId?: string): Promise<CompanyWithRelations[]> {
    const companiesQuery = businessAccountId 
      ? db.select().from(companies).where(eq(companies.businessAccountId, businessAccountId))
      : db.select().from(companies);
    
    const companiesArray = await companiesQuery;
    
    // For each company, get related data
    const companiesWithRelations = await Promise.all(
      companiesArray.map(async company => {
        const owner = company.ownerId ? (await this.getUser(company.ownerId) ?? null) : null;
        const companyOpportunities = await db.select().from(opportunities).where(eq(opportunities.companyId, company.id));
        const businessAccount = await db.select().from(businessAccounts).where(eq(businessAccounts.id, company.businessAccountId));
        
        return {
          ...company,
          owner,
          opportunities: companyOpportunities,
          businessAccount: businessAccount[0],
        };
      })
    );
    
    return companiesWithRelations;
  }

  async getAllCompanies(): Promise<CompanyWithRelations[]> {
    return this.getCompanies();
  }

  async getCompany(id: string): Promise<CompanyWithRelations | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    if (!company) return undefined;

    const owner = company.ownerId ? (await this.getUser(company.ownerId) ?? null) : null;
    const companyOpportunities = await db.select().from(opportunities).where(eq(opportunities.companyId, company.id));
    const businessAccount = await db.select().from(businessAccounts).where(eq(businessAccounts.id, company.businessAccountId));

    return {
      ...company,
      owner,
      opportunities: companyOpportunities,
      businessAccount: businessAccount[0],
    };
  }

  async createCompany(companyData: InsertCompany & { businessAccountId: string }): Promise<Company> {
    const [company] = await db.insert(companies).values(companyData).returning();
    return company;
  }

  async updateCompany(id: string, companyData: UpdateCompany): Promise<Company | undefined> {
    // Use raw SQL for reliability with Supabase
    const fields = [];
    const values = [];
    let paramCount = 1;
    
    if (companyData.name !== undefined) {
      fields.push(`name = $${paramCount++}`);
      values.push(companyData.name);
    }
    if (companyData.email !== undefined) {
      fields.push(`email = $${paramCount++}`);
      values.push(companyData.email);
    }
    if (companyData.phone !== undefined) {
      fields.push(`phone = $${paramCount++}`);
      values.push(companyData.phone);
    }
    if (companyData.contactName !== undefined) {
      fields.push(`contact_name = $${paramCount++}`);
      values.push(companyData.contactName);
    }
    if (companyData.website !== undefined) {
      fields.push(`website = $${paramCount++}`);
      values.push(companyData.website);
    }
    if (companyData.status !== undefined) {
      fields.push(`status = $${paramCount++}`);
      values.push(companyData.status);
    }
    if (companyData.ownerId !== undefined) {
      fields.push(`owner_id = $${paramCount++}`);
      values.push(companyData.ownerId);
    }
    if (companyData.industry !== undefined) {
      fields.push(`industry = $${paramCount++}`);
      values.push(companyData.industry);
    }
    
    // Always update the timestamp
    fields.push(`updated_at = NOW()`);
    values.push(id); // ID goes last
    
    if (fields.length === 1) { // Only updated_at, no other fields
      return undefined;
    }
    
    const query = `
      UPDATE companies 
      SET ${fields.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING id, name, email, phone, contact_name, website, status, owner_id, industry, business_account_id, created_at, updated_at
    `;
    
    console.log('Updating company with query:', query);
    console.log('Values:', values);
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) return undefined;
    
    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      contactName: row.contact_name,
      website: row.website,
      status: row.status,
      ownerId: row.owner_id,
      industry: row.industry,
      businessAccountId: row.business_account_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async deleteCompany(id: string): Promise<boolean> {
    const result = await db.delete(companies).where(eq(companies.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Opportunities methods
  async getOpportunities(businessAccountId?: string): Promise<OpportunityWithRelations[]> {
    const opportunitiesQuery = businessAccountId 
      ? db.select().from(opportunities).where(eq(opportunities.businessAccountId, businessAccountId))
      : db.select().from(opportunities);
    
    const opportunitiesArray = await opportunitiesQuery;
    
    const opportunitiesWithRelations = await Promise.all(
      opportunitiesArray.map(async opp => {
        const company = await this.getCompany(opp.companyId);
        const seller = await this.getUser(opp.sellerId);
        const oppActivities = await db.select().from(activities).where(eq(activities.opportunityId, opp.id));
        
        return {
          ...opp,
          company: company!,
          seller: seller!,
          activities: oppActivities,
        };
      })
    );
    return opportunitiesWithRelations;
  }

  async getAllOpportunities(): Promise<OpportunityWithRelations[]> {
    return this.getOpportunities();
  }

  async getOpportunity(id: string): Promise<OpportunityWithRelations | undefined> {
    const [opportunity] = await db.select().from(opportunities).where(eq(opportunities.id, id));
    if (!opportunity) return undefined;

    const company = await this.getCompany(opportunity.companyId);
    const seller = await this.getUser(opportunity.sellerId);
    const oppActivities = await db.select().from(activities).where(eq(activities.opportunityId, opportunity.id));

    return {
      ...opportunity,
      company: company!,
      seller: seller!,
      activities: oppActivities,
    };
  }

  async getOpportunitiesByCompany(companyId: string): Promise<OpportunityWithRelations[]> {
    const opportunitiesArray = await db.select().from(opportunities).where(eq(opportunities.companyId, companyId));
    
    const opportunitiesWithRelations = await Promise.all(
      opportunitiesArray.map(async opp => {
        const company = await this.getCompany(opp.companyId);
        const seller = await this.getUser(opp.sellerId);
        const oppActivities = await db.select().from(activities).where(eq(activities.opportunityId, opp.id));
        
        return {
          ...opp,
          company: company!,
          seller: seller!,
          activities: oppActivities,
        };
      })
    );
    return opportunitiesWithRelations;
  }

  async createOpportunity(opportunityData: InsertOpportunity): Promise<Opportunity> {
    const [opportunity] = await db.insert(opportunities).values(opportunityData).returning();
    return opportunity;
  }

  async updateOpportunity(id: string, opportunityData: UpdateOpportunity): Promise<Opportunity | undefined> {
    // Use raw SQL for reliability with Supabase
    const fields = [];
    const values = [];
    let paramCount = 1;
    
    if (opportunityData.title !== undefined) {
      fields.push(`title = $${paramCount++}`);
      values.push(opportunityData.title);
    }
    if (opportunityData.type !== undefined) {
      fields.push(`type = $${paramCount++}`);
      values.push(opportunityData.type);
    }
    if (opportunityData.status !== undefined) {
      fields.push(`status = $${paramCount++}`);
      values.push(opportunityData.status);
    }
    if (opportunityData.estimatedCloseDate !== undefined) {
      fields.push(`estimated_close_date = $${paramCount++}`);
      values.push(opportunityData.estimatedCloseDate);
    }
    if (opportunityData.companyId !== undefined) {
      fields.push(`company_id = $${paramCount++}`);
      values.push(opportunityData.companyId);
    }
    if (opportunityData.sellerId !== undefined) {
      fields.push(`seller_id = $${paramCount++}`);
      values.push(opportunityData.sellerId);
    }
    if (opportunityData.notes !== undefined) {
      fields.push(`notes = $${paramCount++}`);
      values.push(opportunityData.notes);
    }
    
    // Always update the timestamp
    fields.push(`updated_at = NOW()`);
    values.push(id); // ID goes last
    
    if (fields.length === 1) { // Only updated_at, no other fields
      return undefined;
    }
    
    const query = `
      UPDATE opportunities 
      SET ${fields.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING id, title, type, status, estimated_close_date, company_id, seller_id, notes, business_account_id, created_at, updated_at
    `;
    
    console.log('Updating opportunity with query:', query);
    console.log('Values:', values);
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) return undefined;
    
    const row = result.rows[0];
    return {
      id: row.id,
      title: row.title,
      type: row.type,
      status: row.status,
      estimatedCloseDate: row.estimated_close_date,
      companyId: row.company_id,
      sellerId: row.seller_id,
      notes: row.notes,
      businessAccountId: row.business_account_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async deleteOpportunity(id: string): Promise<boolean> {
    // First check if there are activities associated with this opportunity
    const activitiesResult = await pool.query(`
      SELECT COUNT(*) as count FROM activities WHERE opportunity_id = $1
    `, [id]);
    
    const activityCount = parseInt(activitiesResult.rows[0].count);
    
    if (activityCount > 0) {
      throw new Error(`No se puede eliminar la oportunidad porque tiene ${activityCount} actividad${activityCount > 1 ? 'es' : ''} asociada${activityCount > 1 ? 's' : ''}. Elimina primero las actividades o contacta al administrador.`);
    }
    
    // If no activities, proceed with deletion
    const result = await pool.query(`
      DELETE FROM opportunities WHERE id = $1
    `, [id]);
    
    return (result.rowCount ?? 0) > 0;
  }

  // Activities methods
  async getActivities(businessAccountId?: string): Promise<ActivityWithRelations[]> {
    const activitiesQuery = businessAccountId 
      ? db.select().from(activities).where(eq(activities.businessAccountId, businessAccountId))
      : db.select().from(activities);
    
    const activitiesArray = await activitiesQuery;
    
    const activitiesWithRelations = await Promise.all(
      activitiesArray.map(async activity => {
        const author = await this.getUser(activity.authorId);
        const opportunity = await this.getOpportunity(activity.opportunityId);
        
        return {
          ...activity,
          author: author!,
          opportunity: opportunity!,
        };
      })
    );
    return activitiesWithRelations;
  }

  async getAllActivities(): Promise<ActivityWithRelations[]> {
    return this.getActivities();
  }

  async getActivitiesByOpportunity(opportunityId: string): Promise<ActivityWithRelations[]> {
    const activitiesArray = await db.select().from(activities).where(eq(activities.opportunityId, opportunityId));
    
    const activitiesWithRelations = await Promise.all(
      activitiesArray.map(async activity => {
        const author = await this.getUser(activity.authorId);
        const opportunity = await this.getOpportunity(activity.opportunityId);
        
        return {
          ...activity,
          author: author!,
          opportunity: opportunity!,
        };
      })
    );
    return activitiesWithRelations;
  }

  async createActivity(activityData: InsertActivity): Promise<Activity> {
    const [activity] = await db.insert(activities).values(activityData).returning();
    return activity;
  }

  // Modules methods
  async getModules(): Promise<Module[]> {
    return await db.select().from(modules);
  }

  async getBusinessAccountModules(businessAccountId: string): Promise<ModuleWithStatus[]> {
    const businessAccountModulesArray = await db.select()
      .from(businessAccountModules)
      .where(eq(businessAccountModules.businessAccountId, businessAccountId));
    
    const modulesWithStatus = await Promise.all(
      businessAccountModulesArray.map(async bam => {
        const [module] = await db.select().from(modules).where(eq(modules.id, bam.moduleId));
        const enabledByUser = bam.enabledBy ? await this.getUser(bam.enabledBy) : null;
        
        return {
          ...module,
          isEnabled: bam.isEnabled,
          enabledAt: bam.enabledAt,
          enabledBy: enabledByUser,
        };
      })
    );
    
    return modulesWithStatus;
  }

  async enableModuleForBusinessAccount(businessAccountId: string, moduleId: string, enabledBy: string): Promise<boolean> {
    try {
      // Check if relation already exists
      const [existing] = await db.select()
        .from(businessAccountModules)
        .where(and(
          eq(businessAccountModules.businessAccountId, businessAccountId),
          eq(businessAccountModules.moduleId, moduleId)
        ));
      
      if (existing) {
        // Use raw SQL for reliability
        await pool.query(`
          UPDATE business_account_modules 
          SET is_enabled = true, enabled_at = NOW(), enabled_by = $1 
          WHERE id = $2
        `, [enabledBy, existing.id]);
        console.log('Updated existing module assignment:', { businessAccountId, moduleId, enabledBy });
      } else {
        await db.insert(businessAccountModules).values({
          businessAccountId,
          moduleId,
          isEnabled: true,
          enabledAt: new Date(),
          enabledBy,
        });
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  async disableModuleForBusinessAccount(businessAccountId: string, moduleId: string): Promise<boolean> {
    try {
      // Use raw SQL for reliability
      const result = await pool.query(`
        UPDATE business_account_modules 
        SET is_enabled = false 
        WHERE business_account_id = $1 AND module_id = $2
      `, [businessAccountId, moduleId]);
      console.log('Disabled module:', { businessAccountId, moduleId, rowsAffected: result.rowCount });
      return true;
    } catch (error) {
      console.error('Error disabling module:', error);
      return false;
    }
  }

  async hasModuleEnabled(businessAccountId: string, moduleType: string): Promise<boolean> {
    const [module] = await db.select().from(modules).where(eq(modules.type, moduleType as any));
    if (!module) return false;
    
    const [businessAccountModule] = await db.select()
      .from(businessAccountModules)
      .where(and(
        eq(businessAccountModules.businessAccountId, businessAccountId),
        eq(businessAccountModules.moduleId, module.id)
      ));
    
    return businessAccountModule?.isEnabled || false;
  }

  // Legacy methods for backward compatibility
  async getCompanyModules(companyId: string): Promise<ModuleWithStatus[]> {
    const company = await this.getCompany(companyId);
    if (!company) return [];
    
    return this.getBusinessAccountModules(company.businessAccountId);
  }

  async enableModuleForCompany(companyId: string, moduleId: string, enabledBy: string): Promise<boolean> {
    const company = await this.getCompany(companyId);
    if (!company) return false;
    
    return this.enableModuleForBusinessAccount(company.businessAccountId, moduleId, enabledBy);
  }

  async disableModuleForCompany(companyId: string, moduleId: string): Promise<boolean> {
    const company = await this.getCompany(companyId);
    if (!company) return false;
    
    return this.disableModuleForBusinessAccount(company.businessAccountId, moduleId);
  }

  // Initialize database with essential data
  async initializeData(): Promise<void> {
    try {
      // Get super admin credentials from environment variables
      const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || "admin@yourcompany.com";
      const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || "CHANGE_THIS_PASSWORD";
      
      // Check if Super Admin already exists
      const existingSuperAdmin = await this.getUserByEmail(superAdminEmail);
      if (!existingSuperAdmin) {
        // Create Super Admin user
        const { hashPassword } = await import('./utils/password');
        const hashedPassword = hashPassword(superAdminPassword);
        
        const superAdminData = {
          name: "Super Admin",
          email: superAdminEmail,
          password: hashedPassword,
          role: "SUPER_ADMIN" as const,
          businessAccountId: null
        };
        
        await db.insert(users).values(superAdminData);
        console.log("✓ Super Admin created in Supabase");
      } else {
        console.log("✓ Super Admin already exists in Supabase");
      }

      // Check if modules exist
      const existingModules = await this.getModules();
      if (existingModules.length === 0) {
        // Create modules from AVAILABLE_MODULES
        const moduleEntries = Object.values(AVAILABLE_MODULES);
        
        for (const moduleConfig of moduleEntries) {
          const moduleData = {
            name: moduleConfig.name,
            type: moduleConfig.type,
            description: moduleConfig.description,
            isActive: true
          };
          await db.insert(modules).values(moduleData);
        }
        console.log("✓ System modules created in Supabase");
      } else {
        console.log("✓ System modules already exist in Supabase");
      }
    } catch (error) {
      console.error("Failed to initialize database:", error);
    }
  }

  // SaaS Plans Management
  async getPlans(): Promise<Plan[]> {
    const query = `
      SELECT * FROM plans 
      ORDER BY display_order ASC, name ASC
    `;
    const result = await pool.query(query);
    return result.rows.map(row => this.mapPlanFromDB(row));
  }

  async getPlan(id: string): Promise<Plan | undefined> {
    const query = `SELECT * FROM plans WHERE id = $1`;
    const result = await pool.query(query, [id]);
    return result.rows[0] ? this.mapPlanFromDB(result.rows[0]) : undefined;
  }

  async createPlan(plan: InsertPlan): Promise<Plan> {
    const query = `
      INSERT INTO plans (name, description, price, monthly_price, annual_price, billing_frequency, trial_days, status, is_default, is_active, display_order, features)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    const values = [
      plan.name, plan.description, plan.price, plan.monthlyPrice, plan.annualPrice,
      plan.billingFrequency, plan.trialDays, plan.status, plan.isDefault, 
      plan.isActive, plan.displayOrder, plan.features
    ];
    const result = await pool.query(query, values);
    return this.mapPlanFromDB(result.rows[0]);
  }

  async updatePlan(id: string, plan: Partial<InsertPlan>): Promise<Plan | undefined> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    // Map camelCase to snake_case for specific fields
    const planFieldMapping: Record<string, string> = {
      monthlyPrice: 'monthly_price',
      annualPrice: 'annual_price',
      billingFrequency: 'billing_frequency',
      trialDays: 'trial_days',
      isDefault: 'is_default',
      isActive: 'is_active',
      displayOrder: 'display_order',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
      // Note: status, name, description, price, features don't need mapping
    };

    Object.entries(plan).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbField = planFieldMapping[key] || key;
        fields.push(`${dbField} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (fields.length === 0) return this.getPlan(id);

    const query = `
      UPDATE plans 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;
    values.push(id);
    
    const result = await pool.query(query, values);
    return result.rows[0] ? this.mapPlanFromDB(result.rows[0]) : undefined;
  }

  async isPlanInUse(planId: string): Promise<{ inUse: boolean; count: number; companies: string[] }> {
    const query = `
      SELECT ba.name 
      FROM business_accounts ba 
      WHERE ba.plan_id = $1
    `;
    const result = await pool.query(query, [planId]);
    const companies = result.rows.map(row => row.name);
    
    return {
      inUse: result.rows.length > 0,
      count: result.rows.length,
      companies
    };
  }

  async deletePlan(id: string): Promise<boolean> {
    // Check if plan is in use before deletion
    const usage = await this.isPlanInUse(id);
    if (usage.inUse) {
      throw new Error(`No se puede eliminar el plan porque está siendo usado por ${usage.count} empresa(s): ${usage.companies.join(', ')}`);
    }
    
    const query = `DELETE FROM plans WHERE id = $1`;
    const result = await pool.query(query, [id]);
    return (result.rowCount || 0) > 0;
  }

  // Products Management
  // Helper function to map database fields to TypeScript camelCase
  private mapProductFromDB(row: any): Product {
    return {
      ...row,
      isActive: row.is_active,
      moduleType: row.module_type,
      billingFrequency: row.billing_frequency,
      monthlyPrice: row.monthly_price,
      annualPrice: row.annual_price,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  // Helper function to map plan database fields to TypeScript camelCase
  private mapPlanFromDB(row: any): Plan {
    return {
      ...row,
      isActive: row.is_active,
      isDefault: row.is_default,
      status: row.status,
      billingFrequency: row.billing_frequency,
      monthlyPrice: row.monthly_price,
      annualPrice: row.annual_price,
      trialDays: row.trial_days,
      displayOrder: row.display_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async getProducts(): Promise<Product[]> {
    const query = `SELECT * FROM products ORDER BY name ASC`;
    const result = await pool.query(query);
    return result.rows.map(row => this.mapProductFromDB(row));
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const query = `SELECT * FROM products WHERE id = $1`;
    const result = await pool.query(query, [id]);
    return result.rows[0] ? this.mapProductFromDB(result.rows[0]) : undefined;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const query = `
      INSERT INTO products (name, description, type, price, billing_frequency, module_type, is_active, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const values = [
      product.name, product.description, product.type, product.price,
      product.billingFrequency, product.moduleType, product.isActive, product.metadata
    ];
    const result = await pool.query(query, values);
    return this.mapProductFromDB(result.rows[0]);
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    // Map camelCase to snake_case for specific fields
    const fieldMapping: Record<string, string> = {
      monthlyPrice: 'monthly_price',
      annualPrice: 'annual_price',
      billingFrequency: 'billing_frequency',
      moduleType: 'module_type',
      isActive: 'is_active',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    };

    Object.entries(product).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbField = fieldMapping[key] || key;
        fields.push(`${dbField} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (fields.length === 0) return this.getProduct(id);

    const query = `
      UPDATE products 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;
    values.push(id);
    
    const result = await pool.query(query, values);
    return result.rows[0] ? this.mapProductFromDB(result.rows[0]) : undefined;
  }

  async isProductInUse(productId: string): Promise<{ inUse: boolean; count: number; companies: string[] }> {
    const query = `
      SELECT DISTINCT ba.name 
      FROM business_account_products bap
      INNER JOIN business_accounts ba ON bap.business_account_id = ba.id
      WHERE bap.product_id = $1
    `;
    const result = await pool.query(query, [productId]);
    const companies = result.rows.map(row => row.name);
    
    return {
      inUse: result.rows.length > 0,
      count: result.rows.length,
      companies
    };
  }

  async deleteProduct(id: string): Promise<boolean> {
    // Check if product is in use before deletion
    const usage = await this.isProductInUse(id);
    if (usage.inUse) {
      throw new Error(`No se puede eliminar el producto porque está siendo usado por ${usage.count} empresa(s): ${usage.companies.join(', ')}`);
    }
    
    const query = `DELETE FROM products WHERE id = $1`;
    const result = await pool.query(query, [id]);
    return (result.rowCount || 0) > 0;
  }

  // Plan Modules Management
  async getPlanModules(planId: string): Promise<PlanModule[]> {
    const query = `SELECT * FROM plan_modules WHERE plan_id = $1`;
    const result = await pool.query(query, [planId]);
    return result.rows;
  }

  async createPlanModule(planModule: InsertPlanModule): Promise<PlanModule> {
    const query = `
      INSERT INTO plan_modules (plan_id, module_type, is_included, item_limit, can_create, can_edit, can_delete, features)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const values = [
      planModule.planId, planModule.moduleType, planModule.isIncluded, planModule.itemLimit,
      planModule.canCreate, planModule.canEdit, planModule.canDelete, planModule.features
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async updatePlanModule(id: string, planModule: Partial<InsertPlanModule>): Promise<PlanModule | undefined> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(planModule).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      const query = `SELECT * FROM plan_modules WHERE id = $1`;
      const result = await pool.query(query, [id]);
      return result.rows[0];
    }

    const query = `
      UPDATE plan_modules 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    values.push(id);
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async deletePlanModule(id: string): Promise<boolean> {
    const query = `DELETE FROM plan_modules WHERE id = $1`;
    const result = await pool.query(query, [id]);
    return (result.rowCount || 0) > 0;
  }

  // Business Account Subscriptions
  async getBusinessAccountPlan(businessAccountId: string): Promise<BusinessAccountPlanWithRelations | undefined> {
    const query = `
      SELECT 
        bap.*,
        p.*,
        pm.id as pm_id, pm.module_type, pm.is_included, pm.item_limit, pm.can_create, pm.can_edit, pm.can_delete, pm.features as pm_features
      FROM business_account_plans bap
      INNER JOIN plans p ON bap.plan_id = p.id
      LEFT JOIN plan_modules pm ON p.id = pm.plan_id
      WHERE bap.business_account_id = $1 
        AND bap.status IN ('TRIAL', 'ACTIVE')
      ORDER BY bap.created_at DESC
      LIMIT 1
    `;
    const result = await pool.query(query, [businessAccountId]);
    
    if (result.rows.length === 0) return undefined;

    const firstRow = result.rows[0];
    const plan = {
      id: firstRow.id,
      name: firstRow.name,
      description: firstRow.description,
      price: firstRow.price,
      monthlyPrice: firstRow.monthly_price,
      annualPrice: firstRow.annual_price,
      billingFrequency: firstRow.billing_frequency,
      trialDays: firstRow.trial_days,
      status: firstRow.status,
      isActive: firstRow.is_active,
      isDefault: firstRow.is_default,
      displayOrder: firstRow.display_order,
      features: firstRow.features,
      createdAt: firstRow.created_at,
      updatedAt: firstRow.updated_at
    };

    const modules = result.rows
      .filter(row => row.pm_id)
      .map(row => ({
        id: row.pm_id,
        planId: row.plan_id,
        moduleType: row.module_type,
        isIncluded: row.is_included,
        itemLimit: row.item_limit,
        canCreate: row.can_create,
        canEdit: row.can_edit,
        canDelete: row.can_delete,
        features: row.pm_features
      }));

    return {
      id: firstRow.id,
      businessAccountId: firstRow.business_account_id,
      planId: firstRow.plan_id,
      status: firstRow.status,
      trialStartDate: firstRow.trial_start_date,
      trialEndDate: firstRow.trial_end_date,
      subscriptionStartDate: firstRow.subscription_start_date,
      subscriptionEndDate: firstRow.subscription_end_date,
      autoRenew: firstRow.auto_renew,
      billingFrequency: firstRow.billing_frequency,
      totalAmount: firstRow.total_amount,
      currency: firstRow.currency,
      createdAt: firstRow.created_at,
      updatedAt: firstRow.updated_at,
      plan: { ...plan, modules },
      businessAccount: {
        id: firstRow.business_account_id,
        name: '',
        plan: '',
        isActive: true,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      } // Will be loaded separately if needed
    };
  }

  async createBusinessAccountPlan(subscription: InsertBusinessAccountPlan): Promise<BusinessAccountPlan> {
    const query = `
      INSERT INTO business_account_plans 
      (business_account_id, plan_id, status, trial_start_date, trial_end_date, subscription_start_date, 
       subscription_end_date, auto_renew, billing_frequency, total_amount, currency)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const values = [
      subscription.businessAccountId, subscription.planId, subscription.status,
      subscription.trialStartDate, subscription.trialEndDate, subscription.subscriptionStartDate,
      subscription.subscriptionEndDate, subscription.autoRenew, subscription.billingFrequency,
      subscription.totalAmount, subscription.currency
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async updateBusinessAccountPlan(id: string, subscription: Partial<InsertBusinessAccountPlan>): Promise<BusinessAccountPlan | undefined> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(subscription).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      const query = `SELECT * FROM business_account_plans WHERE id = $1`;
      const result = await pool.query(query, [id]);
      return result.rows[0];
    }

    const query = `
      UPDATE business_account_plans 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;
    values.push(id);
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // Business Account Products
  async getBusinessAccountProducts(businessAccountId: string): Promise<BusinessAccountProduct[]> {
    const query = `
      SELECT bap.*, p.*
      FROM business_account_products bap
      INNER JOIN products p ON bap.product_id = p.id
      WHERE bap.business_account_id = $1 AND bap.status = 'ACTIVE'
      ORDER BY bap.created_at DESC
    `;
    const result = await pool.query(query, [businessAccountId]);
    return result.rows;
  }

  async createBusinessAccountProduct(product: InsertBusinessAccountProduct): Promise<BusinessAccountProduct> {
    const query = `
      INSERT INTO business_account_products 
      (business_account_id, product_id, quantity, status, subscription_start_date, subscription_end_date,
       unit_price, total_amount, billing_frequency, auto_renew)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const values = [
      product.businessAccountId, product.productId, product.quantity, product.status,
      product.subscriptionStartDate, product.subscriptionEndDate, product.unitPrice,
      product.totalAmount, product.billingFrequency, product.autoRenew
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async updateBusinessAccountProduct(id: string, product: Partial<InsertBusinessAccountProduct>): Promise<BusinessAccountProduct | undefined> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(product).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      const query = `SELECT * FROM business_account_products WHERE id = $1`;
      const result = await pool.query(query, [id]);
      return result.rows[0];
    }

    const query = `
      UPDATE business_account_products 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;
    values.push(id);
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async deleteBusinessAccountProduct(id: string): Promise<boolean> {
    const query = `DELETE FROM business_account_products WHERE id = $1`;
    const result = await pool.query(query, [id]);
    return (result.rowCount || 0) > 0;
  }

  async updateBusinessAccountProductPrices(productId: string, priceUpdate: { unitPrice: string; billingFrequency: string }): Promise<boolean> {
    const { unitPrice, billingFrequency } = priceUpdate;
    
    // Calculate new total amounts based on quantity
    const query = `
      UPDATE business_account_products 
      SET 
        unit_price = $1,
        billing_frequency = $2,
        total_amount = (CAST($1 AS DECIMAL) * quantity)::TEXT,
        updated_at = NOW()
      WHERE product_id = $3
      RETURNING id
    `;
    
    try {
      const result = await pool.query(query, [unitPrice, billingFrequency, productId]);
      console.log(`Updated ${result.rowCount} customer subscriptions for product ${productId}`);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error("Error updating business account product prices:", error);
      return false;
    }
  }

  async updateBusinessAccountProductDualPrices(productId: string, priceUpdate: { monthlyPrice?: string; annualPrice?: string }): Promise<boolean> {
    const { monthlyPrice, annualPrice } = priceUpdate;
    
    try {
      let totalUpdated = 0;

      // Update monthly subscriptions if monthlyPrice is provided
      if (monthlyPrice) {
        const monthlyQuery = `
          UPDATE business_account_products 
          SET 
            unit_price = $1,
            total_amount = (CAST($1 AS DECIMAL) * quantity)::TEXT,
            updated_at = NOW()
          WHERE product_id = $2 AND billing_frequency = 'MONTHLY'
          RETURNING id
        `;
        
        const monthlyResult = await pool.query(monthlyQuery, [monthlyPrice, productId]);
        totalUpdated += (monthlyResult.rowCount || 0);
        console.log(`Updated ${(monthlyResult.rowCount || 0)} monthly subscriptions for product ${productId}`);
      }

      // Update annual subscriptions if annualPrice is provided
      if (annualPrice) {
        const annualQuery = `
          UPDATE business_account_products 
          SET 
            unit_price = $1,
            total_amount = (CAST($1 AS DECIMAL) * quantity)::TEXT,
            updated_at = NOW()
          WHERE product_id = $2 AND billing_frequency = 'ANNUAL'
          RETURNING id
        `;
        
        const annualResult = await pool.query(annualQuery, [annualPrice, productId]);
        totalUpdated += (annualResult.rowCount || 0);
        console.log(`Updated ${(annualResult.rowCount || 0)} annual subscriptions for product ${productId}`);
      }

      console.log(`Total updated customer subscriptions: ${totalUpdated} for product ${productId}`);
      return totalUpdated > 0;
    } catch (error) {
      console.error("Error updating business account product dual prices:", error);
      return false;
    }
  }

  async updateBusinessAccountPlanDualPrices(planId: string, priceUpdate: { monthlyPrice?: string; annualPrice?: string }): Promise<boolean> {
    const { monthlyPrice, annualPrice } = priceUpdate;
    
    try {
      let totalUpdated = 0;

      // Update monthly plan subscriptions if monthlyPrice is provided
      if (monthlyPrice) {
        const monthlyQuery = `
          UPDATE business_accounts 
          SET 
            plan_price = $1,
            updated_at = NOW()
          WHERE plan_id = $2 AND plan_billing_frequency = 'MONTHLY'
          RETURNING id
        `;
        
        const monthlyResult = await pool.query(monthlyQuery, [monthlyPrice, planId]);
        totalUpdated += (monthlyResult.rowCount || 0);
        console.log(`Updated ${(monthlyResult.rowCount || 0)} monthly plan subscriptions for plan ${planId}`);
      }

      // Update annual plan subscriptions if annualPrice is provided
      if (annualPrice) {
        const annualQuery = `
          UPDATE business_accounts 
          SET 
            plan_price = $1,
            updated_at = NOW()
          WHERE plan_id = $2 AND plan_billing_frequency = 'ANNUAL'
          RETURNING id
        `;
        
        const annualResult = await pool.query(annualQuery, [annualPrice, planId]);
        totalUpdated += (annualResult.rowCount || 0);
        console.log(`Updated ${(annualResult.rowCount || 0)} annual plan subscriptions for plan ${planId}`);
      }

      console.log(`Total updated customer plan subscriptions: ${totalUpdated} for plan ${planId}`);
      return totalUpdated > 0;
    } catch (error) {
      console.error("Error updating business account plan dual prices:", error);
      return false;
    }
  }

  // Plan Usage Tracking
  async getPlanUsage(businessAccountId: string): Promise<PlanUsage[]> {
    const query = `SELECT * FROM plan_usage WHERE business_account_id = $1`;
    const result = await pool.query(query, [businessAccountId]);
    return result.rows;
  }

  async updatePlanUsage(usage: InsertPlanUsage): Promise<PlanUsage> {
    const query = `
      INSERT INTO plan_usage (business_account_id, module_type, current_count)
      VALUES ($1, $2, $3)
      ON CONFLICT (business_account_id, module_type) 
      DO UPDATE SET 
        current_count = $3,
        last_calculated = NOW()
      RETURNING *
    `;
    const values = [usage.businessAccountId, usage.moduleType, usage.currentCount];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async getCurrentUsageCount(businessAccountId: string, moduleType: string): Promise<number> {
    let query = '';
    
    switch (moduleType) {
      case 'USERS':
        query = `SELECT COUNT(*) as count FROM users WHERE business_account_id = $1`;
        break;
      case 'COMPANIES':
        query = `SELECT COUNT(*) as count FROM companies WHERE business_account_id = $1`;
        break;
      case 'CRM':
        // For CRM, we don't count items, just check access
        return 0;
      default:
        return 0;
    }

    const result = await pool.query(query, [businessAccountId]);
    return parseInt(result.rows[0].count) || 0;
  }
}

export const storage = new DatabaseStorage();