import { verifyNormalizedInvoice } from './arithmetic.js';
import { normalizeInvoice } from './normalizer.js';
import { repairInvoice } from './repair.js';

/**
 * Model Context Protocol (MCP) Standard Tool Definitions.
 * Allows Claude Code, Cursor, and agent frameworks to run invcheck natively.
 */
export const MCP_TOOLS = [
  {
    name: 'invcheck_verify',
    description: 'Verifies invoice extraction JSON for arithmetic correctness, VAT/tax calculations, and IBAN/EIN checksums.',
    inputSchema: {
      type: 'object',
      properties: {
        invoice_json: {
          type: 'object',
          description: 'The raw JSON extracted from Docling, MarkItDown, or LLM vision models.'
        },
        tolerance: {
          type: 'number',
          description: 'Allowed rounding discrepancy in currency units (default 0.01).'
        }
      },
      required: ['invoice_json']
    }
  },
  {
    name: 'invcheck_repair',
    description: 'Deterministically heals and repairs 1-cent rounding errors, mismatched totals, and dirty OCR strings in invoice JSON.',
    inputSchema: {
      type: 'object',
      properties: {
        invoice_json: {
          type: 'object',
          description: 'The raw extracted invoice JSON payload to heal.'
        }
      },
      required: ['invoice_json']
    }
  }
];

export async function handleMcpCall(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  const invoiceData = (args.invoice_json || {}) as Record<string, unknown>;
  const tolerance = (args.tolerance as number) || 0.01;

  if (toolName === 'invcheck_verify') {
    const norm = normalizeInvoice(invoiceData);
    return verifyNormalizedInvoice(norm, { tolerance });
  }

  if (toolName === 'invcheck_repair') {
    return repairInvoice(invoiceData, { tolerance });
  }

  throw new Error(`Unknown MCP tool: ${toolName}`);
}
