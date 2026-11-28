import { readdirSync, readFileSync } from 'node:fs';
import type { PoolClient } from 'pg';
import { assessMigrationReadiness, migrationChecksum } from './migration-checksums.js';

const migrationDirectory = new URL('../migrations/', import.meta.url);
const expectedMigrations = readdirSync(migrationDirectory)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => ({
    name,
    checksum: migrationChecksum(readFileSync(new URL(name, migrationDirectory), 'utf8')),
  }));

export const DATABASE_ADMIN_TOOL_CATALOG = [
  {
    id: 'runtime-role-safety',
    name: 'Runtime role safety',
    description: 'Checks whether the connected application role is a superuser, bypasses RLS, or owns RLS-protected tables.',
  },
  {
    id: 'users-rls-readiness',
    name: 'Users RLS readiness',
    description: 'Checks users RLS enablement, expected policy names/commands/modes, and helper-function execute grants.',
  },
  {
    id: 'migration-readiness',
    name: 'Migration checksum readiness',
    description: 'Compares applied migration names and checksums with this application release.',
  },
] as const;

export type DatabaseAdminToolId = typeof DATABASE_ADMIN_TOOL_CATALOG[number]['id'];

export async function runDatabaseAdminTool(
  toolId: string,
  client: Pick<PoolClient, 'query'>,
): Promise<unknown> {
  switch (toolId) {
    case 'runtime-role-safety': {
      const result = await client.query(
        `SELECT current_database() AS database_name,
                current_user AS runtime_role,
                role.rolsuper AS is_superuser,
                role.rolbypassrls AS bypasses_rls,
                EXISTS (
                  SELECT 1 FROM pg_class relation
                  WHERE relation.relrowsecurity
                    AND relation.relowner=role.oid
                ) AS owns_rls_protected_tables
         FROM pg_roles role
         WHERE role.rolname=current_user`,
      );
      return result.rows[0] ?? null;
    }
    case 'users-rls-readiness': {
      const result = await client.query(
        `SELECT COALESCE(relation.relrowsecurity,false) AS users_rls_enabled,
                COALESCE(relation.relowner=runtime_role.oid,false) AS runtime_role_owns_users,
                COALESCE(
                  json_agg(json_build_object(
                    'name',policy.polname,
                    'command',policy.polcmd,
                    'permissive',policy.polpermissive,
                    'using',pg_get_expr(policy.polqual,policy.polrelid),
                    'with_check',pg_get_expr(policy.polwithcheck,policy.polrelid)
                  ) ORDER BY policy.polname)
                  FILTER (WHERE policy.oid IS NOT NULL),
                  '[]'::json
                ) AS policies,
                (
                  SELECT bool_and(EXISTS (
                    SELECT 1 FROM pg_policy expected_policy
                    WHERE expected_policy.polrelid=relation.oid
                      AND expected_policy.polname=expected.name
                      AND expected_policy.polcmd=expected.command
                      AND expected_policy.polpermissive=expected.permissive
                  ))
                  FROM (VALUES
                    ('users_platform_tenant_scope'::name,'*'::"char",false),
                    ('users_application_read'::name,'r'::"char",true),
                    ('users_application_insert'::name,'a'::"char",true),
                    ('users_application_update'::name,'w'::"char",true)
                  ) AS expected(name,command,permissive)
                ) AS expected_policy_metadata_matches,
                (
                  SELECT bool_and(
                    function.oid IS NOT NULL
                    AND has_function_privilege(current_user,function.oid,'EXECUTE')
                  )
                  FROM (VALUES
                    ('public.app_user_creation_id()'),
                    ('public.app_user_phone_lookup(text)'),
                    ('public.app_is_pending_global_admin_promotion(uuid)')
                  ) AS expected(signature)
                  LEFT JOIN pg_proc function
                    ON function.oid=to_regprocedure(expected.signature)::oid
                ) AS users_rls_helpers_executable
         FROM (SELECT oid FROM pg_roles WHERE rolname=current_user) runtime_role
         LEFT JOIN pg_class relation ON relation.oid=to_regclass('public.users')
         LEFT JOIN pg_policy policy ON policy.polrelid=relation.oid
         GROUP BY relation.oid,relation.relrowsecurity,relation.relowner,runtime_role.oid`,
      );
      return result.rows[0] ?? null;
    }
    case 'migration-readiness': {
      const result = await client.query<{ name: string; checksum: string | null }>(
        'SELECT name,checksum FROM schema_migrations ORDER BY name',
      );
      return assessMigrationReadiness(expectedMigrations, result.rows);
    }
    default:
      throw new Error('Unsupported database administration tool.');
  }
}
