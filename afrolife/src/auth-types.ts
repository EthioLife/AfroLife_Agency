import type { RoleActivityOverrides } from './role-activities.js';
import type { MiniAppAccessMode, MiniAppKey } from './mini-app-access.js';

export interface AuthUser {
  id: string;
  role: string;
  primaryRole?: string;
  sessionId?: string;
  rst?: string;
  legal_name?: string;
  phone?: string;
  email?: string | null;
  kyc_status?: string;
  edir_id?: string;
  rolePermissions?: RoleActivityOverrides;
  miniAppAccessMode?: MiniAppAccessMode;
  miniAppGrants?: MiniAppKey[];
  propertyTenantSystemId?: string;
  propertyTenantPurpose?: string;
  adminRoleModules?: MiniAppKey[];
  adminRoleAllTenants?: boolean;
  accessOptions?: string[];
}

export function isPlatformAdminRole(role: string): boolean {
  return role === 'super_admin' || role === 'global_admin';
}

const MFA_REQUIRED_ROLES = new Set([
  'global_admin', 'super_admin', 'compliance', 'finance', 'finance_manager', 'corporate_business_manager',
]);

export function requiresMfaEnrollment(role: string): boolean {
  return MFA_REQUIRED_ROLES.has(role);
}

declare global {
  namespace Express {
    interface Request { user?: AuthUser }
  }
}
