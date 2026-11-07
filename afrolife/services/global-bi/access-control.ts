import { HttpError } from '../../src/http-error.js';

export function assertGlobalBiAccess(role: string): void {
  if (!['global_admin', 'super_admin'].includes(role)) {
    throw new HttpError(403, 'Global BI is restricted to assigned platform administrators.');
  }
}
