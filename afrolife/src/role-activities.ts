export const ROLE_NAMES = [
  'global_admin',
  'super_admin',
  'corporate_business_manager',
  'compliance',
  'finance',
  'finance_manager',
  'master_agent',
  'field_agent',
  'customer',
  'worker',
  'property_owner',
  'property_vendor',
] as const;

export type RoleName = typeof ROLE_NAMES[number];

export type RoleActivityDefinition = {
  key: string;
  group: string;
  label: string;
  defaultRoles: readonly RoleName[];
  sensitive?: boolean;
};

export const ROLE_ACTIVITIES: readonly RoleActivityDefinition[] = [
  { key: 'workforce.workers.view', group: 'Workforce Management', label: 'View worker profiles', defaultRoles: ['global_admin', 'super_admin', 'corporate_business_manager', 'compliance', 'finance', 'finance_manager', 'master_agent', 'field_agent'] },
  { key: 'workforce.workers.register', group: 'Workforce Management', label: 'Register workers', defaultRoles: ['master_agent', 'field_agent'] },
  { key: 'workforce.documents.view', group: 'Workforce Management', label: 'View and download worker documents', defaultRoles: ['master_agent', 'field_agent', 'compliance', 'super_admin'] },
  { key: 'workforce.documents.upload', group: 'Workforce Management', label: 'Upload worker documents', defaultRoles: ['master_agent', 'field_agent', 'compliance', 'super_admin'] },
  { key: 'workforce.documents.review', group: 'Workforce Management', label: 'Review worker documents', defaultRoles: ['compliance'] },
  { key: 'workforce.workers.verify', group: 'Workforce Management', label: 'Verify workers', defaultRoles: ['compliance'] },
  { key: 'workforce.shifts.manage', group: 'Workforce Management', label: 'Schedule and manage worker shifts', defaultRoles: ['global_admin', 'super_admin', 'corporate_business_manager', 'master_agent', 'field_agent'] },
  { key: 'workforce.time.review', group: 'Workforce Management', label: 'Review and approve recorded worker time', defaultRoles: ['global_admin', 'super_admin', 'corporate_business_manager', 'finance_manager', 'master_agent', 'field_agent'], sensitive: true },
  { key: 'workforce.leave.review', group: 'Workforce Management', label: 'Review worker leave and availability requests', defaultRoles: ['global_admin', 'super_admin', 'corporate_business_manager', 'master_agent', 'field_agent'] },
  { key: 'workforce.payroll.export', group: 'Workforce Management', label: 'Calculate payable time and export payroll data', defaultRoles: ['global_admin', 'super_admin', 'finance_manager'], sensitive: true },
  { key: 'workforce.policy.manage', group: 'Workforce Management', label: 'Manage effective-dated workforce policy versions', defaultRoles: ['global_admin', 'super_admin', 'compliance'], sensitive: true },
  { key: 'workforce.workers.offboard', group: 'Workforce Management', label: 'Terminate worker assignments and revoke access', defaultRoles: ['global_admin', 'super_admin', 'corporate_business_manager', 'compliance'], sensitive: true },
  { key: 'staffing.requests.manage', group: 'Staffing', label: 'Manage staffing requests and matching', defaultRoles: ['master_agent', 'field_agent', 'super_admin'] },
  { key: 'property.listings.view', group: 'Property Management', label: 'View property listings and media', defaultRoles: ['global_admin', 'super_admin', 'corporate_business_manager', 'customer', 'master_agent', 'field_agent', 'property_owner'] },
  { key: 'property.listings.manage', group: 'Property Management', label: 'Create listings, units, and listing media', defaultRoles: ['master_agent', 'field_agent', 'property_owner', 'super_admin', 'corporate_business_manager'] },
  { key: 'property.tenancy.manage', group: 'Property Management', label: 'Register tenants and manage leases', defaultRoles: ['master_agent', 'super_admin'] },
  { key: 'property.tenancy.approve', group: 'Property Management', label: 'Independently approve lease terms', defaultRoles: ['compliance', 'super_admin', 'corporate_business_manager'], sensitive: true },
  { key: 'property.tenancy.execute', group: 'Property Management', label: 'Execute and activate approved leases', defaultRoles: ['super_admin', 'corporate_business_manager'], sensitive: true },
  { key: 'property.maintenance.manage', group: 'Property Management', label: 'Manage maintenance requests', defaultRoles: ['master_agent', 'field_agent', 'property_owner', 'corporate_business_manager', 'super_admin'] },
  { key: 'rent.payments.submit', group: 'Rent & Deposits', label: 'Submit rent and deposit payment records', defaultRoles: ['master_agent', 'finance', 'finance_manager', 'super_admin'] },
  { key: 'rent.transactions.view', group: 'Rent & Deposits', label: 'View pending rent and deposit records', defaultRoles: ['finance_manager', 'super_admin'] },
  { key: 'rent.transactions.reconcile', group: 'Rent & Deposits', label: 'Reconcile transactions to the ledger', defaultRoles: ['finance_manager', 'super_admin'], sensitive: true },
  { key: 'rent.transactions.void', group: 'Rent & Deposits', label: 'Void pending rent and deposit records', defaultRoles: ['finance_manager', 'super_admin'], sensitive: true },
  { key: 'rent.deposit.refund_request', group: 'Rent & Deposits', label: 'Submit deposit refund requests', defaultRoles: ['finance', 'finance_manager', 'super_admin'] },
  { key: 'learning.content.view', group: 'Training & Support', label: 'View role-targeted tutorials and videos', defaultRoles: [...ROLE_NAMES] },
  { key: 'learning.content.manage', group: 'Training & Support', label: 'Publish and manage training content', defaultRoles: ['corporate_business_manager', 'super_admin'] },
];

export type RoleActivityKey = typeof ROLE_ACTIVITIES[number]['key'];
export type RoleActivityOverrides = Partial<Record<RoleActivityKey, boolean>>;

const ACTIVITY_BY_KEY = new Map(ROLE_ACTIVITIES.map((activity) => [activity.key, activity]));

export function isRoleActivityOverrides(value: unknown): value is RoleActivityOverrides {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= ROLE_ACTIVITIES.length
    && entries.every(([key, enabled]) => ACTIVITY_BY_KEY.has(key as RoleActivityKey) && typeof enabled === 'boolean');
}

export function hasRoleActivityAccess(
  role: string,
  activityKey: string,
  overrides: RoleActivityOverrides = {},
): boolean {
  const activity = ACTIVITY_BY_KEY.get(activityKey as RoleActivityKey);
  if (!activity) return false;
  if (role === 'field_agent'
    && (activity.key === 'property.tenancy.manage' || activity.key === 'rent.payments.submit')) {
    return false;
  }
  const configured = overrides[activity.key];
  if (configured !== undefined) return configured;
  return activity.defaultRoles.includes(role as RoleName)
    || (role === 'global_admin' && activity.defaultRoles.includes('super_admin'));
}

export function getRoleActivity(key: string) {
  return ACTIVITY_BY_KEY.get(key as RoleActivityKey);
}
