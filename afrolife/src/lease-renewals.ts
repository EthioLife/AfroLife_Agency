import { endDate } from './rent.js';

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function normalizeLeaseMoney(value: string, allowZero = false): string {
  const match = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new RangeError('Lease amounts must be positive decimal values with at most two fractional digits');
  const whole = BigInt(match[1]);
  const cents = BigInt((match[2] ?? '').padEnd(2, '0'));
  if ((!allowZero && whole === 0n && cents === 0n) || whole * 100n + cents > 99999999999999n) {
    throw new RangeError('Lease amount is outside the supported range');
  }
  return `${whole}.${cents.toString().padStart(2, '0')}`;
}

export function leaseMoneyToCents(value: string): bigint {
  const normalized = normalizeLeaseMoney(value, true);
  const [whole, cents] = normalized.split('.');
  return BigInt(whole) * 100n + BigInt(cents);
}

export function validateLeaseRenewalTerm(input: {
  currentEndDate: string;
  proposedStartDate: string;
  months: number;
  today?: string;
}): { startDate: string; endDate: string } {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  if (!isIsoDate(input.currentEndDate) || !isIsoDate(input.proposedStartDate) || !isIsoDate(today)) {
    throw new RangeError('Lease renewal dates must be valid calendar dates');
  }
  if (!Number.isSafeInteger(input.months) || input.months < 1 || input.months > 120) {
    throw new RangeError('Lease renewal term must be between 1 and 120 months');
  }
  if (input.proposedStartDate <= input.currentEndDate || input.proposedStartDate <= today) {
    throw new RangeError('A renewal must begin after the current lease ends and in the future');
  }
  return {
    startDate: input.proposedStartDate,
    endDate: endDate(input.proposedStartDate, input.months),
  };
}
