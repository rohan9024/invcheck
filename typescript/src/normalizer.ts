import { NormalizedInvoice, NormalizedLineItem, NormalizedTaxBracket } from './types.js';

/**
 * Type-guard to verify whether an input object is already a normalized invoice.
 */
export function isNormalizedInvoice(val: unknown): val is NormalizedInvoice {
  if (!val || typeof val !== 'object') return false;
  const candidate = val as Record<string, unknown>;
  return (
    Array.isArray(candidate.items) &&
    Array.isArray(candidate.taxBrackets) &&
    typeof candidate.identifiers === 'object' &&
    candidate.identifiers !== null &&
    'raw' in candidate
  );
}

/**
 * Parses dirty strings (e.g. "$ 1,234.50 USD", "1.234,50 €") into clean numbers.
 */
export function parseCleanNumber(val: unknown): number | undefined {
  if (val === null || val === undefined || val === '') return undefined;
  if (typeof val === 'number') return Number.isNaN(val) ? undefined : val;

  const str = String(val).trim();
  if (!str) return undefined;

  // Detect European comma decimal separator: "1.250,50" -> "1250.50"
  let sanitized = str.replace(/[^0-9.,-]/g, '');
  if (sanitized.includes(',') && sanitized.includes('.')) {
    if (sanitized.lastIndexOf(',') > sanitized.lastIndexOf('.')) {
      sanitized = sanitized.replace(/\./g, '').replace(',', '.');
    } else {
      sanitized = sanitized.replace(/,/g, '');
    }
  } else if (sanitized.includes(',') && !sanitized.includes('.')) {
    // If only comma present, treat as decimal if 2 decimals (e.g. 19,99)
    sanitized = sanitized.replace(',', '.');
  }

  const num = parseFloat(sanitized);
  return Number.isNaN(num) ? undefined : num;
}

/**
 * Fuzzy Key Resolver: Matches aliases regardless of casing, snake_case, camelCase.
 */
function findValue(obj: Record<string, unknown>, aliases: string[]): unknown {
  const lowerAliases = aliases.map(a => a.toLowerCase().replace(/[^a-z0-9]/g, ''));
  for (const [k, v] of Object.entries(obj)) {
    const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (lowerAliases.includes(cleanK)) {
      if (v !== undefined && v !== null && v !== '') {
        // If nested inside an object with a 'value' property (Docling / AWS Textract)
        if (typeof v === 'object' && v !== null && !Array.isArray(v) && 'value' in v) {
          return (v as { value: unknown }).value;
        }
        return v;
      }
    }
  }
  return undefined;
}

/**
 * Normalizes JSON from Docling, MarkItDown, Textract, Azure, or LLMs into NormalizedInvoice.
 */
export function normalizeInvoice(rawInput: Record<string, unknown>): NormalizedInvoice {
  let root = rawInput;

  // Unnest if wrapped in common envelopes
  for (const envelope of ['invoice', 'document', 'data', 'extraction', 'result', 'body']) {
    if (root[envelope] && typeof root[envelope] === 'object' && !Array.isArray(root[envelope])) {
      root = root[envelope] as Record<string, unknown>;
      break;
    }
  }

  // 1. Line Items
  const itemsRaw = findValue(root, ['items', 'line_items', 'lineItems', 'lines', 'LineItem', 'table_rows', 'expenses', 'products']) || [];
  const normalizedItems: NormalizedLineItem[] = [];

  if (Array.isArray(itemsRaw)) {
    for (const item of itemsRaw) {
      if (typeof item !== 'object' || item === null) continue;
      const row = item as Record<string, unknown>;

      const quantity = parseCleanNumber(findValue(row, ['quantity', 'qty', 'count', 'units', 'Quantity', 'QTY'])) ?? 1;
      const unitPrice = parseCleanNumber(findValue(row, ['unit_price', 'unitPrice', 'price', 'rate', 'UnitPrice', 'unit_cost', 'cost'])) ?? 0;
      let lineTotal = parseCleanNumber(findValue(row, ['line_total', 'total', 'lineTotal', 'amount', 'TotalPrice', 'extended_price', 'row_total', 'price_total']));

      if (lineTotal === undefined) {
        lineTotal = quantity * unitPrice;
      }

      normalizedItems.push({
        id: String(findValue(row, ['id', 'item_id', 'line_number', 'sku']) || ''),
        description: String(findValue(row, ['description', 'desc', 'name', 'item', 'title', 'Description']) || ''),
        quantity,
        unitPrice,
        lineTotal,
        discountRate: parseCleanNumber(findValue(row, ['discount_rate', 'discount_pct', 'discountRate', 'discount_percent'])),
        discountAmount: parseCleanNumber(findValue(row, ['discount_amount', 'discount', 'discountAmount'])),
        taxRate: parseCleanNumber(findValue(row, ['tax_rate', 'tax_pct', 'vat_rate', 'vat_pct', 'taxRate'])),
        taxAmount: parseCleanNumber(findValue(row, ['tax_amount', 'tax', 'vat_amount', 'taxAmount'])),
        raw: row
      });
    }
  }

  // 2. Document Totals
  const subtotal = parseCleanNumber(findValue(root, ['subtotal', 'sub_total', 'net_amount', 'net_total', 'taxable_amount', 'SubTotal', 'total_net']));
  const taxTotal = parseCleanNumber(findValue(root, ['tax_total', 'tax', 'total_tax', 'vat_total', 'vat_amount', 'TotalTax', 'total_vat']));
  const grandTotal = parseCleanNumber(findValue(root, ['grand_total', 'total', 'total_amount', 'gross_amount', 'gross_total', 'amount_due', 'InvoiceTotal', 'total_gross']));
  const shippingAmount = parseCleanNumber(findValue(root, ['shipping', 'shipping_fee', 'freight', 'delivery_fee', 'postage']));
  const discountAmount = parseCleanNumber(findValue(root, ['discount', 'total_discount', 'document_discount', 'order_discount']));
  const amountPaid = parseCleanNumber(findValue(root, ['amount_paid', 'paid', 'paid_amount', 'payment_received']));
  const amountDue = parseCleanNumber(findValue(root, ['amount_due', 'balance_due', 'due', 'outstanding']));

  // 3. Tax Breakdown
  const rawTaxes = findValue(root, ['taxes', 'tax_breakdown', 'tax_details', 'vat_breakdown']) || [];
  const taxBrackets: NormalizedTaxBracket[] = [];
  if (Array.isArray(rawTaxes)) {
    for (const t of rawTaxes) {
      if (typeof t === 'object' && t !== null) {
        const tb = t as Record<string, unknown>;
        const rate = parseCleanNumber(findValue(tb, ['rate', 'tax_rate', 'percentage', 'vat_rate'])) ?? 0;
        const basis = parseCleanNumber(findValue(tb, ['basis', 'taxable_amount', 'base', 'net_amount'])) ?? 0;
        const amount = parseCleanNumber(findValue(tb, ['amount', 'tax_amount', 'vat_amount'])) ?? (basis * rate) / 100;
        taxBrackets.push({ rate, basis, amount });
      }
    }
  }

  // 4. Identifiers
  const iban = String(findValue(root, ['iban', 'bank_account', 'iban_number', 'IBAN', 'account_number']) || '');
  const vatId = String(findValue(root, ['vat_id', 'vat_number', 'tax_id', 'ust_id', 'siren', 'siret', 'VATNumber']) || '');
  const ein = String(findValue(root, ['ein', 'federal_tax_id', 'us_ein', 'tax_ein']) || '');
  const abn = String(findValue(root, ['abn', 'australian_business_number']) || '');

  return {
    invoiceId: String(findValue(root, ['invoice_id', 'invoice_number', 'invoice_no', 'number', 'InvoiceId']) || ''),
    currency: String(findValue(root, ['currency', 'currency_code', 'iso_currency']) || ''),
    subtotal,
    taxTotal,
    grandTotal,
    shippingAmount,
    discountAmount,
    amountPaid,
    amountDue,
    items: normalizedItems,
    taxBrackets,
    identifiers: {
      iban: iban || undefined,
      vatId: vatId || undefined,
      ein: ein || undefined,
      abn: abn || undefined,
    },
    raw: root
  };
}