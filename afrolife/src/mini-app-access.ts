import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { HttpError } from './http-error.js';
import type { AuthUser } from './auth-types.js';
import { WORKSPACE_MODULES, type WorkspaceModule } from './runtime-config.js';
import { hasRoleActivityAccess } from './role-activities.js';

export type MiniAppAccessMode = 'role_default' | 'custom';
export type MiniAppKey = WorkspaceModule;

export const MINI_APP_LABELS: Readonly<Record<MiniAppKey, string>> = Object.freeze({
  leads: 'Lead Book',
  workers: 'Workforce Management',
  requests: 'Staffing',
  learning: 'Training and Support',
  properties: 'Property Management',
  marketplace: 'Marketplace',
  contracts: 'Agreements',
  commissions: 'Commissions',
  agents: 'Agent Network',
  rent: 'Rent and Deposits',
  mfi: 'SACCO / MFI',
  accounting: 'Financial Services',
  edir: 'Edir',
  insurance: 'Insurance',
  privacy: 'Privacy and Data Rights',
  'global-bi': 'Global BI',
});

export function isMiniAppKey(value: unknown): value is MiniAppKey {
  return typeof value === 'string' && WORKSPACE_MODULES.includes(value as MiniAppKey);
}

export function isMiniAppKeys(value: unknown): value is MiniAppKey[] {
  return Array.isArray(value) && value.every(isMiniAppKey);
}

function hasAnyActivity(user: AuthUser, activities: string[]): boolean {
  return activities.some((activity) =>
    hasRoleActivityAccess(user.role, activity, user.rolePermissions));
}

export function roleCanUseMiniApp(user: AuthUser, module: MiniAppKey): boolean {
  if (user.role === 'property_vendor') return module === 'properties';
  switch (module) {
    case 'workers':
      return user.role === 'worker' || user.role === 'corporate_business_manager'
        || hasAnyActivity(user, ['workforce.workers.view', 'workforce.workers.register']);
    case 'requests':
      return hasAnyActivity(user, ['staffing.requests.manage']);
    case 'properties':
      return user.role === 'property_vendor' || hasAnyActivity(user, ['property.listings.view']);
    case 'learning':
      return hasAnyActivity(user, ['learning.content.view', 'learning.content.manage']);
    case 'rent':
      return hasAnyActivity(user, [
        'property.tenancy.manage',
        'property.tenancy.approve',
        'property.tenancy.execute',
        'rent.payments.submit',
        'rent.transactions.view',
        'rent.transactions.reconcile',
        'rent.transactions.void',
        'rent.deposit.refund_request',
      ]);
    case 'accounting':
      // Subscribers and corporate finance users may open the full workspace;
      // subscriber entitlement is checked in API middleware. Other mini-apps
      // keep their own service-specific ledgers.
      if (['customer', 'property_owner'].includes(user.role)) {
        return user.miniAppAccessMode === 'custom';
      }
      return [
        'global_admin', 'super_admin', 'finance', 'finance_manager',
        'compliance', 'corporate_business_manager',
      ].includes(user.role);
    case 'commissions':
      return [
        'global_admin', 'super_admin', 'finance', 'finance_manager',
        'master_agent', 'field_agent',
      ].includes(user.role);
    case 'agents':
      return ['global_admin', 'super_admin', 'master_agent'].includes(user.role);
    case 'leads':
    case 'contracts':
      return !['customer', 'worker', 'property_owner', 'property_vendor'].includes(user.role);
    case 'global-bi':
      return user.role === 'global_admin';
    default:
      return true;
  }
}

export function hasMiniAppAccess(user: AuthUser, module: MiniAppKey): boolean {
  const roleAllows = user.adminRoleModules
    ? user.adminRoleModules.includes(module)
    : roleCanUseMiniApp(user, module);
  return roleAllows
    && (user.miniAppAccessMode !== 'custom' || user.miniAppGrants?.includes(module) === true);
}

export function allowedMiniApps(
  user: AuthUser,
  enabledModules: readonly string[] = WORKSPACE_MODULES,
): MiniAppKey[] {
  return WORKSPACE_MODULES.filter((module) =>
    enabledModules.includes(module) && hasMiniAppAccess(user, module));
}

export function requireMiniAppAccess(module: MiniAppKey): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (hasMiniAppAccess(req.user!, module)) return next();
    return next(new HttpError(403, 'This mini-app is not assigned to your account'));
  };
}

export function requireAnyMiniAppAccess(...modules: MiniAppKey[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (modules.some((module) => hasMiniAppAccess(req.user!, module))) return next();
    return next(new HttpError(403, 'This service is not assigned to your account'));
  };
}
