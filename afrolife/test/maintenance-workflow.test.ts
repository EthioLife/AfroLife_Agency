import test from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { canTransitionMaintenance, MAINTENANCE_TRANSITIONS, requiresMaintenanceReview } from '../src/maintenance-workflow.js';
import { dispatchMaintenanceSlaEscalations, maintenanceSlaEscalationLevels } from '../src/maintenance-sla.js';

test('maintenance lifecycle routes triage, assignment, work and independent review', () => {
  assert.deepEqual(MAINTENANCE_TRANSITIONS.open, ['triaged', 'cancelled']);
  assert.equal(canTransitionMaintenance('open', 'triaged'), true);
  assert.equal(canTransitionMaintenance('triaged', 'assigned'), true);
  assert.equal(canTransitionMaintenance('assigned', 'in_progress'), true);
  assert.equal(canTransitionMaintenance('in_progress', 'awaiting_review'), true);
  assert.equal(canTransitionMaintenance('awaiting_review', 'completed'), true);
  assert.equal(canTransitionMaintenance('awaiting_review', 'rework_required'), true);
  assert.equal(canTransitionMaintenance('rework_required', 'in_progress'), true);
});

test('maintenance lifecycle prevents skipping review and editing terminal states', () => {
  assert.equal(canTransitionMaintenance('open', 'assigned'), false);
  assert.equal(canTransitionMaintenance('in_progress', 'completed'), false);
  assert.equal(canTransitionMaintenance('awaiting_review', 'cancelled'), false);
  assert.equal(canTransitionMaintenance('completed', 'in_progress'), false);
  assert.equal(canTransitionMaintenance('done', 'in_progress'), false);
});

test('only completion decisions require independent review evidence', () => {
  assert.equal(requiresMaintenanceReview('completed'), true);
  assert.equal(requiresMaintenanceReview('rework_required'), true);
  assert.equal(requiresMaintenanceReview('awaiting_review'), false);
});

test('maintenance SLA escalation levels use the agreed 1, 24, and 72 hour thresholds', () => {
  const dueAt = new Date('2026-10-26T00:00:00.000Z');
  assert.deepEqual(maintenanceSlaEscalationLevels(dueAt, new Date('2026-10-26T00:59:59.999Z')), []);
  assert.deepEqual(maintenanceSlaEscalationLevels(dueAt, new Date('2026-10-26T01:00:00.000Z')), [1]);
  assert.deepEqual(maintenanceSlaEscalationLevels(dueAt, new Date('2026-10-27T00:00:00.000Z')), [1, 2]);
  assert.deepEqual(maintenanceSlaEscalationLevels(dueAt, new Date('2026-10-29T00:00:00.000Z')), [1, 2, 3]);
  assert.throws(() => maintenanceSlaEscalationLevels('not-a-date'), /valid dates/);
});

test('maintenance SLA dispatch can use a Global Admin when no Super Admin remains', async () => {
  const actorId = '00000000-0000-4000-8000-000000000001';
  const poolQueries: string[] = [];
  const clientQueries: string[] = [];
  const pool = {
    query: async (sql: string) => {
      poolQueries.push(sql);
      return { rows: [{ id: actorId }], rowCount: 1 };
    },
    connect: async () => ({
      query: async (sql: string) => {
        clientQueries.push(sql);
        if (sql.includes('WITH eligible_recipients')) return { rows: [], rowCount: 0 };
        if (sql.includes('WHERE id=$1 AND active=true')) return { rows: [{ id: actorId }], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      },
      release: () => undefined,
    }),
  } as unknown as Pool;

  assert.equal(await dispatchMaintenanceSlaEscalations(pool), 0);
  assert.match(poolQueries[0], /role IN \('super_admin','global_admin'\)/);
  assert.ok(clientQueries.some((sql) => sql.includes("role IN ('super_admin','global_admin')")));
});
