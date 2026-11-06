export function filterWorkerActivityReports(reports, filters = {}) {
  const { startDate = '', endDate = '', status = 'all' } = filters;
  return reports.filter((report) =>
    (!startDate || report.period_end >= startDate)
    && (!endDate || report.period_start <= endDate)
    && (status === 'all' || report.status === status));
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const raw = String(value);
  const numericText = /^-?\d+(?:\.\d+)?$/.test(raw);
  const safe = !numericText && /^[\t\r ]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function workerActivityReportsCsv(reports, engagements) {
  const engagementsById = new Map(engagements.map((engagement) => [engagement.id, engagement]));
  const columns = [
    'Period start',
    'Period end',
    'Employer client',
    'Worker type',
    'Quantity',
    'Billing unit',
    'Worker amount ETB',
    'Status',
    'Description',
    'Review reason',
  ];
  const rows = reports.map((report) => {
    const engagement = engagementsById.get(report.engagement_id);
    return [
      report.period_start,
      report.period_end,
      engagement?.employer_client,
      engagement?.worker_type,
      report.quantity,
      engagement?.billing_unit,
      report.worker_amount,
      report.status,
      report.description,
      report.review_reason,
    ];
  });
  return [columns, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n') + '\r\n';
}
