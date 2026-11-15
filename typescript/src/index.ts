import { InvCheckOptions, NormalizedInvoice, RepairResult, VerificationReport } from './types.js';
import { normalizeInvoice, isNormalizedInvoice } from './normalizer.js';
import { verifyNormalizedInvoice } from './arithmetic.js';
import { repairInvoice } from './repair.js';

export * from './types.js';
export * from './decimal.js';
export * from './checksums.js';
export * from './normalizer.js';
export * from './arithmetic.js';
export * from './repair.js';
export * from './mcp.js';

/**
 * Primary One-Liner Verifier API.
 */
export function verifyInvoice(
  input: Record<string, unknown> | NormalizedInvoice,
  options?: InvCheckOptions
): VerificationReport {
  const normalized = isNormalizedInvoice(input)
    ? input
    : normalizeInvoice(input as Record<string, unknown>);

  return verifyNormalizedInvoice(normalized, options);
}