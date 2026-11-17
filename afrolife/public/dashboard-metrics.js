function countBy(rows, property) {
  const counts = new Map();
  for (const row of rows) {
    const value = typeof row?.[property] === 'string' && row[property] ? row[property] : 'unknown';
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts].map(([label, count]) => ({ label, count }));
}

export function workforceDashboardMetrics(workers) {
  const rows = Array.isArray(workers) ? workers : [];
  return { total: rows.length, byVerification: countBy(rows, 'verification') };
}

export function staffingDashboardMetrics(requests) {
  const rows = Array.isArray(requests) ? requests : [];
  return { total: rows.length, byStatus: countBy(rows, 'status') };
}

export function propertyDashboardMetrics(properties) {
  const rows = Array.isArray(properties) ? properties : [];
  return {
    totalListings: rows.length,
    totalUnits: rows.reduce((total, property) => total + (Array.isArray(property?.units) ? property.units.length : 0), 0),
    byStatus: countBy(rows, 'status'),
  };
}

export function marketplaceDashboardMetrics(listings, userId) {
  const rows = Array.isArray(listings) ? listings : [];
  return {
    totalListings: rows.length,
    publishedListings: rows.filter((listing) => listing.status === 'published').length,
    ownedListings: rows.filter((listing) =>
      listing.created_by === userId || listing.seller_user_id === userId).length,
    byStatus: countBy(rows, 'status'),
  };
}

export function propertyOwnerDashboardMetrics(properties, statements, maintenanceRequests) {
  const propertyRows = Array.isArray(properties) ? properties : [];
  const statementRows = Array.isArray(statements) ? statements : [];
  const maintenanceRows = Array.isArray(maintenanceRequests) ? maintenanceRequests : [];
  const units = propertyRows.flatMap((property) => Array.isArray(property?.units) ? property.units : []);
  const money = (rows, key) => Math.round(rows.reduce((total, row) => total + Number(row?.[key] ?? 0), 0) * 100) / 100;
  return {
    properties: propertyRows.length,
    units: units.length,
    occupiedUnits: units.filter((unit) => unit.occupancy === 'occupied').length,
    vacantUnits: units.filter((unit) => unit.occupancy === 'vacant').length,
    activeLeases: statementRows.filter((statement) => statement.status === 'active').length,
    rentReconciled: money(statementRows, 'rent_reconciled'),
    rentPendingReconciliation: money(statementRows, 'rent_pending_reconciliation'),
    openMaintenance: maintenanceRows.filter((request) => ['open', 'assigned', 'in_progress'].includes(request.status)).length,
  };
}

export function agentDashboardMetrics(leads, workers, requests, commissions) {
  const leadRows = Array.isArray(leads) ? leads : [];
  const workerRows = Array.isArray(workers) ? workers : [];
  const requestRows = Array.isArray(requests) ? requests : [];
  const commissionRows = Array.isArray(commissions) ? commissions : [];
  return {
    leads: leadRows.length,
    followUpLeads: leadRows.filter((lead) => ['new', 'qualified'].includes(lead.status)).length,
    workers: workerRows.length,
    workersAwaitingVerification: workerRows.filter((worker) => worker.verification !== 'verified').length,
    openStaffingRequests: requestRows.filter((request) => request.status === 'open').length,
    commissionsAwaitingReview: commissionRows.filter((commission) => commission.status === 'qualified').length,
    approvedCommissionAmount: Math.round(commissionRows
      .filter((commission) => ['approved', 'paid'].includes(commission.status))
      .reduce((total, commission) => total + Number(commission.amount ?? 0), 0) * 100) / 100,
    heldCommissionAmount: Math.round(commissionRows
      .filter((commission) => commission.held_status === 'held')
      .reduce((total, commission) => total + Number(commission.held_amount ?? 0), 0) * 100) / 100,
  };
}
