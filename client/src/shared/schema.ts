import { z } from "zod";

// ============================================================================
// FRONTEND-ONLY SCHEMA - Types and validation schemas for client-side use
// ============================================================================

// Type definitions (without Drizzle database schemas)
export type UserRole = 'SUPER_ADMIN' | 'BUSINESS_PLAN' | 'USER';
export type CompanyStatus = 'LEAD' | 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'DELETED';
export type OpportunityType = 'NEW_CLIENT' | 'ADDITIONAL_PROJECT';
export type OpportunityStatus = 'NEW' | 'IN_PROGRESS' | 'NEGOTIATION' | 'WON' | 'LOST';
export type ActivityType = 'CALL' | 'MEETING' | 'NOTE';
export type ModuleType = 'USERS' | 'COMPANIES' | 'CRM' | 'REPORTS';
export type BillingFrequency = 'MONTHLY' | 'ANNUAL';
export type PlanStatus = 'ACTIVE' | 'INACTIVE' | 'DEPRECATED';
export type ProductType = 'MODULE' | 'USER_ADDON' | 'FEATURE_ADDON' | 'STORAGE_ADDON';
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';

// Base entity types
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: UserRole;
  avatar?: string;
  businessAccountId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BusinessAccount {
  id: string;
  name: string;
  contactEmail: string;
  phone?: string;
  website?: string;
  address?: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionStartDate: Date;
  subscriptionEndDate?: Date;
  planId?: string;
  maxUsers: number;
  currentUsers: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Company {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  status: CompanyStatus;
  businessAccountId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Opportunity {
  id: string;
  title: string;
  description?: string;
  value: string;
  type: OpportunityType;
  status: OpportunityStatus;
  companyId: string;
  assignedTo?: string;
  businessAccountId: string;
  createdAt: Date;
  updatedAt: Date;
  expectedCloseDate?: Date;
}

export interface Activity {
  id: string;
  type: ActivityType;
  description: string;
  dueDate?: Date;
  completed: boolean;
  opportunityId?: string;
  companyId?: string;
  createdBy: string;
  businessAccountId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Module {
  id: string;
  name: string;
  type: ModuleType;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Plan {
  id: string;
  name: string;
  description?: string;
  monthlyPrice: string;
  annualPrice: string;
  maxUsers: number;
  status: PlanStatus;
  features: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  type: ProductType;
  price: string;
  billingFrequency: BillingFrequency;
  isActive: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Relations types
export interface CompanyWithRelations extends Company {
  businessAccount: BusinessAccount;
  opportunities: Opportunity[];
}

export interface OpportunityWithRelations extends Opportunity {
  company: Company;
  assignedUser?: User;
  activities: Activity[];
}

export interface ActivityWithRelations extends Activity {
  user: User;
  opportunity?: Opportunity;
  company?: Company;
}

export interface BusinessAccountWithRelations extends BusinessAccount {
  users: User[];
  companies: Company[];
  plan?: Plan;
  modules: Module[];
}

export interface ModuleWithStatus extends Module {
  enabled: boolean;
}

export interface ModulePermissions {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

// Dashboard stats interface
export interface DashboardStats {
  totalCompanies: number;
  totalOpportunities: number;
  totalActivities: number;
  totalUsers: number;
  recentOpportunities: OpportunityWithRelations[];
  recentActivities: ActivityWithRelations[];
}

// Available modules constant
export const AVAILABLE_MODULES: ModuleType[] = ['USERS', 'COMPANIES', 'CRM', 'REPORTS'];

// Validation schemas for forms
export const insertUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  role: z.enum(['SUPER_ADMIN', 'BUSINESS_PLAN', 'USER']),
  businessAccountId: z.string().optional(),
});

export const insertCompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().url("Invalid website URL").optional().or(z.literal('')),
  address: z.string().optional(),
  status: z.enum(['LEAD', 'ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED']),
});

export const insertOpportunitySchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  value: z.string().min(1, "Value is required"),
  type: z.enum(['NEW_CLIENT', 'ADDITIONAL_PROJECT']),
  status: z.enum(['NEW', 'IN_PROGRESS', 'NEGOTIATION', 'WON', 'LOST']),
  companyId: z.string().min(1, "Company is required"),
  assignedTo: z.string().optional(),
  expectedCloseDate: z.date().optional(),
});

export const insertActivitySchema = z.object({
  type: z.enum(['CALL', 'MEETING', 'NOTE']),
  description: z.string().min(1, "Description is required"),
  dueDate: z.date().optional(),
  completed: z.boolean().default(false),
  opportunityId: z.string().optional(),
  companyId: z.string().optional(),
});

export const insertPlanSchema = z.object({
  name: z.string().min(1, "Plan name is required"),
  description: z.string().optional(),
  monthlyPrice: z.string().min(1, "Monthly price is required"),
  annualPrice: z.string().min(1, "Annual price is required"),
  maxUsers: z.number().min(1, "Maximum users must be at least 1"),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DEPRECATED']),
  features: z.array(z.string()),
});

export const insertProductSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  type: z.enum(['MODULE', 'USER_ADDON', 'FEATURE_ADDON', 'STORAGE_ADDON']),
  price: z.string().min(1, "Price is required"),
  billingFrequency: z.enum(['MONTHLY', 'ANNUAL']),
  isActive: z.boolean().default(true),
  metadata: z.record(z.any()).optional(),
});