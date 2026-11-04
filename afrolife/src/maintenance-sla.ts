import type { Pool } from 'pg';
import { notify } from './notify.js';

const HOUR_MS = 60 * 60 * 1000;

export function maintenanceSlaEscalationLevels(slaDueAt: Date | string, now = new Date()): number[] {
  const dueAtMs = slaDueAt instanceof Date ? slaDueAt.getTime() : Date.parse(slaDueAt);
  const nowMs = now.getTime();
  if (!Number.isFinite(dueAtMs) || !Number.isFinite(nowMs)) {
    throw new RangeError('Maintenance SLA timestamps must be valid dates');
  }

  const overdueMs = nowMs - dueAtMs;
  return [1, 24, 72]
    .map((hours, index) => ({ hours, level: index + 1 }))
    .filter(({ hours }) => overdueMs >= hours * HOUR_MS)
    .map(({ level }) => level);
}

type EscalationTarget = {
  id: string;
  property_id: string;
  priority: string;
  status: string;
  sla_due_at: Date;
  assigned_vendor_id: string | null;
};

export async function dispatchMaintenanceSlaEscalations(pool: Pool): Promise<number> {
  const systemActorId = (await pool.query<{ id: string }>(
    `SELECT id FROM users
     WHERE active=true AND role IN ('super_admin','global_admin')
     ORDER BY CASE role WHEN 'super_admin' THEN 0 ELSE 1 END,id LIMIT 1`,
  )).rows[0]?.id;
  if (!systemActorId) throw new Error('Maintenance SLA escalation requires an active platform admin system actor');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `SELECT set_config('app.user_id',$1,true),set_config('app.role','super_admin',true),
         set_config('app.edir_id','00000000-0000-4000-8000-000000000002',true),
         set_config('app.role_permissions','{}',true)`,
      [systemActorId],
    );
    const activeActor = await client.query(
      `SELECT id FROM users WHERE id=$1 AND active=true AND role IN ('super_admin','global_admin') FOR SHARE`,
      [systemActorId],
    );
    if (!activeActor.rowCount) throw new Error('Maintenance SLA escalation system actor is no longer active');

    const now = new Date();
    const maintenance = (await client.query<EscalationTarget>(
      `WITH eligible_recipients AS (
         SELECT m.id AS maintenance_request_id,1 AS escalation_level,owner.id AS recipient_id
         FROM maintenance_requests m
         JOIN properties p ON p.id=m.property_id
         JOIN users owner ON owner.id=p.owner_user_id AND owner.active
         WHERE m.sla_due_at <= now()-interval '1 hour'
           AND m.status NOT IN ('completed','done','cancelled')
         UNION
         SELECT m.id,1,vendor_user.id
         FROM maintenance_requests m
         JOIN property_vendors vendor ON vendor.id=m.assigned_vendor_id AND vendor.active
         JOIN property_vendor_memberships membership
           ON membership.vendor_id=vendor.id AND membership.active
         JOIN users vendor_user ON vendor_user.id=membership.user_id AND vendor_user.active
         WHERE m.sla_due_at <= now()-interval '1 hour'
           AND m.status NOT IN ('completed','done','cancelled')
         UNION
         SELECT m.id,2,manager.id
         FROM maintenance_requests m
         JOIN users manager ON manager.active AND manager.role='corporate_business_manager'
         WHERE m.sla_due_at <= now()-interval '24 hours'
           AND m.status NOT IN ('completed','done','cancelled')
         UNION
         SELECT m.id,3,platform_admin.id
         FROM maintenance_requests m
         JOIN users platform_admin ON platform_admin.active
           AND platform_admin.role IN ('global_admin','super_admin')
         WHERE m.sla_due_at <= now()-interval '72 hours'
           AND m.status NOT IN ('completed','done','cancelled')
       )
       SELECT m.id,m.property_id,m.priority,m.status,m.sla_due_at,m.assigned_vendor_id
       FROM maintenance_requests m
       JOIN properties p ON p.id=m.property_id
       WHERE EXISTS (
         SELECT 1 FROM eligible_recipients eligible
         WHERE eligible.maintenance_request_id=m.id
           AND NOT EXISTS (
             SELECT 1 FROM maintenance_sla_escalations sent
             WHERE sent.maintenance_request_id=eligible.maintenance_request_id
               AND sent.escalation_level=eligible.escalation_level
               AND sent.recipient_id=eligible.recipient_id
           )
       )
       ORDER BY m.sla_due_at,m.id
       FOR UPDATE OF m SKIP LOCKED
       LIMIT 100`,
    )).rows;
    if (!maintenance.length) {
      await client.query('COMMIT');
      return 0;
    }

    const managers = (await client.query<{ id: string }>(
      `SELECT id FROM users WHERE active=true AND role='corporate_business_manager' ORDER BY id`,
    )).rows.map(({ id }) => id);
    const platformAdmins = (await client.query<{ id: string }>(
      `SELECT id FROM users WHERE active=true AND role IN ('global_admin','super_admin') ORDER BY id`,
    )).rows.map(({ id }) => id);
    let notificationsCreated = 0;

    for (const item of maintenance) {
      const levels = maintenanceSlaEscalationLevels(item.sla_due_at, now);
      let vendorAndOwner: string[] = [];
      if (levels.includes(1)) {
        vendorAndOwner = (await client.query<{ id: string }>(
          `SELECT recipients.id FROM (
             SELECT p.owner_user_id AS id
             FROM properties p
             WHERE p.id=$1 AND p.owner_user_id IS NOT NULL
             UNION
             SELECT membership.user_id AS id
             FROM property_vendor_memberships membership
             JOIN property_vendors vendor
               ON vendor.id=membership.vendor_id AND vendor.active
             WHERE membership.vendor_id=$2 AND membership.active
           ) recipients
           JOIN users ON users.id=recipients.id
           WHERE users.active=true
           ORDER BY recipients.id`,
          [item.property_id, item.assigned_vendor_id],
        )).rows.map(({ id }) => id);
      }

      for (const level of levels) {
        const recipients = level === 1 ? vendorAndOwner : level === 2 ? managers : platformAdmins;
        for (const recipientId of recipients) {
          const escalation = await client.query(
            `INSERT INTO maintenance_sla_escalations
               (maintenance_request_id,escalation_level,recipient_id)
             VALUES($1,$2,$3)
             ON CONFLICT (maintenance_request_id,escalation_level,recipient_id) DO NOTHING
             RETURNING id`,
            [item.id, level, recipientId],
          );
          if (!escalation.rowCount) continue;
          await notify(client, recipientId, 'maintenance_sla_escalation', {
            maintenance_request_id: item.id,
            escalation_level: level,
            priority: item.priority,
            status: item.status,
            sla_due_at: item.sla_due_at.toISOString(),
          });
          notificationsCreated += 1;
        }
      }
    }

    await client.query('COMMIT');
    return notificationsCreated;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
