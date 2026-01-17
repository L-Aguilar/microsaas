import { z } from "zod";

// ============================================================================
// FRONTEND-ONLY SCHEMA - Types and validation schemas for client-side use
// This file contains frontend-safe exports from the root schema without drizzle-orm dependencies
// ============================================================================

// Type definitions (without Drizzle database schemas)
export type UserRole = 'SUPER_ADMIN' | 'BUSINESS_ADMIN' | 'USER';
export type CompanyStatus = 'LEAD' | 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'DELETED';
export type OpportunityType = 'NEW_CLIENT' | 'ADDITIONAL_PROJECT';
export type OpportunityStatus = 'NEW' | 'IN_PROGRESS' | 'NEGOTIATION' | 'WON' | 'LOST';
export type ActivityType = 'CALL' | 'MEETING' | 'NOTE';
export type ModuleType = 'USERS' | 'CONTACTS' | 'CRM';
export type BillingFrequency = 'MONTHLY' | 'ANNUAL';
export type PlanStatus = 'ACTIVE' | 'INACTIVE' | 'DEPRECATED';
export type ProductType = 'MODULE' | 'USER_ADDON' | 'FEATURE_ADDON' | 'STORAGE_ADDON';
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';

// Available modules definition (same as root schema but without drizzle imports)
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
};

// Base entity types
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  password: string;
  role: UserRole;
  avatar?: string | null;
  businessAccountId?: string | null;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

export interface Company {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  status: CompanyStatus;
  businessAccountId: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

export interface Opportunity {
  id: string;
  companyId: string;
  title: string;
  description?: string | null;
  value?: string | null;
  type: OpportunityType;
  status: OpportunityStatus;
  probability?: number | null;
  closedDate?: string | null;
  businessAccountId: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  companyId?: string | null;
  opportunityId?: string | null;
  businessAccountId: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

export interface Module {
  id: string;
  type: ModuleType;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessAccount {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  planId?: string | null;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

export interface Plan {
  id: string;
  name: string;
  description?: string | null;
  monthlyPrice?: string | null;
  annualPrice?: string | null;
  maxUsers: number;
  maxCompanies: number;
  maxOpportunities: number;
  maxStorage: number;
  status: PlanStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  type: ProductType;
  monthlyPrice?: string | null;
  annualPrice?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

// Validation schemas for forms
export const insertUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  phone: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(['SUPER_ADMIN', 'BUSINESS_ADMIN', 'USER']),
  businessAccountId: z.string().optional(),
});

export const updateUserSchema = insertUserSchema.partial();

export const insertCompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  email: z.string().email("Invalid email format").optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  website: z.string().url("Invalid website URL").optional(),
  status: z.enum(['LEAD', 'ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED']),
  businessAccountId: z.string(),
});

export const updateCompanySchema = insertCompanySchema.partial();

export const insertOpportunitySchema = z.object({
  companyId: z.string(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  value: z.string().optional(),
  type: z.enum(['NEW_CLIENT', 'ADDITIONAL_PROJECT']),
  status: z.enum(['NEW', 'IN_PROGRESS', 'NEGOTIATION', 'WON', 'LOST']),
  probability: z.number().min(0).max(100).optional(),
  closedDate: z.string().optional(),
  businessAccountId: z.string(),
});

export const updateOpportunitySchema = insertOpportunitySchema.partial();

export const insertActivitySchema = z.object({
  type: z.enum(['CALL', 'MEETING', 'NOTE']),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  companyId: z.string().optional(),
  opportunityId: z.string().optional(),
  businessAccountId: z.string(),
});

export const insertModuleSchema = z.object({
  type: z.enum(['USERS', 'CONTACTS', 'CRM']),
  name: z.string().min(1, "Module name is required"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const insertBusinessAccountSchema = z.object({
  name: z.string().min(1, "Business account name is required"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  planId: z.string().optional(),
});

export const insertBusinessAccountModuleSchema = z.object({
  businessAccountId: z.string(),
  moduleId: z.string(),
  isActive: z.boolean().default(true),
});

export const insertPlanSchema = z.object({
  name: z.string().min(1, "Plan name is required"),
  description: z.string().optional(),
  monthlyPrice: z.string().optional(),
  annualPrice: z.string().optional(),
  maxUsers: z.number().min(1),
  maxCompanies: z.number().min(0),
  maxOpportunities: z.number().min(0),
  maxStorage: z.number().min(0),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DEPRECATED']),
  isActive: z.boolean().default(true),
});

export const insertProductSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  type: z.enum(['MODULE', 'USER_ADDON', 'FEATURE_ADDON', 'STORAGE_ADDON']),
  monthlyPrice: z.string().optional(),
  annualPrice: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const insertPlanModuleSchema = z.object({
  planId: z.string(),
  moduleId: z.string(),
  isIncluded: z.boolean().default(true),
});

// Theme configuration (copied from shared)
export const THEME_CONFIGS = {
  default: {
    name: "Controly",
    primaryColor: "hsl(240, 10%, 3.9%)",
    brandColor: "#000000",
  }
} as const;

export type ThemeType = keyof typeof THEME_CONFIGS;
export const CURRENT_THEME: ThemeType = 'default';
export const getCurrentThemeConfig = () => THEME_CONFIGS[CURRENT_THEME];