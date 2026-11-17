import { z } from 'zod';

export const TENANT_DATA_CAPABILITIES = ['database_admin', 'analytics_admin'] as const;
export type TenantDataCapability = typeof TENANT_DATA_CAPABILITIES[number];
export const EXCLUDED_TENANT_CAPABILITY_ROLES = ['global_admin', 'super_admin', 'master_agent'] as const;
export const tenantCapabilitiesSchema = z.array(z.enum(TENANT_DATA_CAPABILITIES))
  .max(TENANT_DATA_CAPABILITIES.length)
  .refine((values) => new Set(values).size === values.length, 'Capabilities must be unique');
export const tenantOperatorRequestSchema = z.object({
  tenant_id: z.string().uuid(),
  request_type: z.enum(['migration_review', 'backup_restore_review', 'database_change_review']),
  summary: z.string().trim().min(10).max(1000)
    .refine((text) => !/\b(SELECT|INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE)\b|:\/\/|password|secret|token|credential|postgres(ql)?/i.test(text),
      'Requests may not contain SQL, connection details, or credentials'),
  evidence_reference: z.string().trim().min(2).max(200).optional()
    .refine((text) => text === undefined || !/(password|secret|token|credential|:\/\/|postgres(ql)?)/i.test(text),
      'Evidence must be a non-secret reference, not a URL'),
}).strict();

const migrationReferenceSchema = z.string().trim().min(2).max(200)
  .refine((text) => !/(password|secret|token|credential|:\/\/|postgres(ql)?)/i.test(text),
    'References must be non-secret identifiers, not URLs');
const migrationNarrativeSchema = z.string().trim().min(10).max(1000)
  .refine((text) => !/\b(SELECT|INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE)\b|:\/\/|password|secret|token|credential|postgres(ql)?/i.test(text),
    'Migration notes may not contain SQL, connection details, or credentials');
const migrationHashSchema = z.string().regex(/^[0-9a-f]{64}$/);

export const tenantMigrationStartSchema = z.object({
  source_reference: migrationReferenceSchema,
  target_reference: migrationReferenceSchema,
  summary: migrationNarrativeSchema,
  manifest_sha256: migrationHashSchema,
  evidence_reference: migrationReferenceSchema,
  notes: migrationNarrativeSchema,
}).strict().refine((migration) => migration.source_reference !== migration.target_reference, {
  path: ['target_reference'],
  message: 'Source and target references must be different',
});

export const tenantMigrationEventSchema = z.object({
  stage: z.enum(['dry_run','staged','reconciled','cutover_approved','cutover_completed','aborted']),
  manifest_sha256: migrationHashSchema.optional(),
  source_record_count: z.number().safe().int().nonnegative().optional(),
  staged_record_count: z.number().safe().int().nonnegative().optional(),
  unresolved_count: z.number().safe().int().nonnegative().default(0),
  validation_error_count: z.number().safe().int().nonnegative().default(0),
  evidence_reference: migrationReferenceSchema,
  notes: migrationNarrativeSchema,
}).strict().superRefine((event, context) => {
  if (['dry_run','staged','reconciled','cutover_completed'].includes(event.stage)
    && !event.manifest_sha256) {
    context.addIssue({ code: 'custom', path: ['manifest_sha256'], message: 'This stage requires a manifest SHA-256' });
  }
  if (['dry_run','staged','reconciled'].includes(event.stage)
    && (event.source_record_count === undefined || event.staged_record_count === undefined)) {
    context.addIssue({ code: 'custom', path: ['source_record_count'], message: 'This stage requires source and staged record counts' });
  }
});
