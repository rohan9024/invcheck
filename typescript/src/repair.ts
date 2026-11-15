import { FieldChange, InvCheckOptions, RepairResult } from './types.js';
import { PreciseDecimal } from './decimal.js';
import { normalizeInvoice } from './normalizer.js';

/**
 * Deterministic Auto-Repair ("Healer") Engine.
 * Resolves 1-cent rounding drift, reconciles lines, and cleans OCR artifacts.
 */
export function repairInvoice(
  rawInput: Record<string, unknown>,
  options: InvCheckOptions = {}
): RepairResult {
  const norm = normalizeInvoice(rawInput);
  const changes: FieldChange[] = [];
  const rounding = options.roundingMode ?? 'HALF_UP';
  const tolerance = options.tolerance ?? 0.01;

  // Deep clone rawInput for repairing in-place
  const repaired = JSON.parse(JSON.stringify(rawInput)) as Record<string, unknown>;

  const items = Array.isArray(norm.items) ? norm.items : [];
  const identifiers = norm.identifiers ?? {};

  // 1. Repair Line Items
  let runningSubtotal = PreciseDecimal.from(0);

  items.forEach((item, idx) => {
    const qty = PreciseDecimal.from(item.quantity);
    const price = PreciseDecimal.from(item.unitPrice);
    const currentLineTotal = PreciseDecimal.from(item.lineTotal);

    let expected = qty.mul(price);
    if (item.discountRate && item.discountRate > 0) {
      expected = expected.mul(
        PreciseDecimal.from(1).sub(PreciseDecimal.from(item.discountRate).div(PreciseDecimal.from(100)))
      );
    } else if (item.discountAmount) {
      expected = expected.sub(PreciseDecimal.from(item.discountAmount));
    }
    expected = expected.round(2, rounding);

    if (expected.diffAbs(currentLineTotal) > tolerance) {
      const diff = expected.diffAbs(currentLineTotal);
      const confidence = diff <= 0.03 ? 0.99 : 0.85;

      changes.push({
        field: `items[${idx}].lineTotal`,
        oldValue: item.lineTotal,
        newValue: expected.toNumber(),
        reason: `Reconciled line_total = qty (${item.quantity}) * price (${item.unitPrice})`,
        confidence
      });

      item.lineTotal = expected.toNumber();
      updateFieldInPayload(repaired, ['items', 'line_items', 'lines'], idx, ['total', 'line_total', 'amount', 'lineTotal'], expected.toNumber());
    }

    runningSubtotal = runningSubtotal.add(PreciseDecimal.from(item.lineTotal));
  });

  runningSubtotal = runningSubtotal.round(2, rounding);

  // 2. Repair Subtotal
  if (norm.subtotal !== undefined) {
    const currentSub = PreciseDecimal.from(norm.subtotal).round(2, rounding);
    if (currentSub.diffAbs(runningSubtotal) > tolerance) {
      changes.push({
        field: 'subtotal',
        oldValue: norm.subtotal,
        newValue: runningSubtotal.toNumber(),
        reason: 'Recalculated subtotal as exact sum of line items',
        confidence: 0.98
      });
      norm.subtotal = runningSubtotal.toNumber();
      setFieldInPayload(repaired, ['subtotal', 'sub_total', 'net_amount', 'SubTotal'], runningSubtotal.toNumber());
    }
  } else {
    norm.subtotal = runningSubtotal.toNumber();
    setFieldInPayload(repaired, ['subtotal'], runningSubtotal.toNumber());
  }

  // 3. Repair Grand Total
  let runningGrandTotal = PreciseDecimal.from(norm.subtotal);
  if (norm.taxTotal !== undefined) {
    runningGrandTotal = runningGrandTotal.add(PreciseDecimal.from(norm.taxTotal));
  }
  if (norm.shippingAmount !== undefined) {
    runningGrandTotal = runningGrandTotal.add(PreciseDecimal.from(norm.shippingAmount));
  }
  if (norm.discountAmount !== undefined) {
    runningGrandTotal = runningGrandTotal.sub(PreciseDecimal.from(norm.discountAmount));
  }
  runningGrandTotal = runningGrandTotal.round(2, rounding);

  if (norm.grandTotal !== undefined) {
    const currentGrand = PreciseDecimal.from(norm.grandTotal).round(2, rounding);
    if (currentGrand.diffAbs(runningGrandTotal) > tolerance) {
      changes.push({
        field: 'grandTotal',
        oldValue: norm.grandTotal,
        newValue: runningGrandTotal.toNumber(),
        reason: 'Reconciled grand total = subtotal + tax + shipping - discounts',
        confidence: 0.99
      });
      norm.grandTotal = runningGrandTotal.toNumber();
      setFieldInPayload(repaired, ['grand_total', 'total', 'total_amount', 'gross_amount', 'InvoiceTotal'], runningGrandTotal.toNumber());
    }
  } else {
    norm.grandTotal = runningGrandTotal.toNumber();
    setFieldInPayload(repaired, ['total', 'grand_total'], runningGrandTotal.toNumber());
  }

  // 4. Sanitize IBAN whitespace
  if (identifiers.iban) {
    const cleanIban = identifiers.iban.toUpperCase().replace(/[\s-]/g, '');
    if (cleanIban !== identifiers.iban) {
      changes.push({
        field: 'identifiers.iban',
        oldValue: identifiers.iban,
        newValue: cleanIban,
        reason: 'Standardized IBAN formatting (removed spaces and dashes)',
        confidence: 1.0
      });
      norm.identifiers.iban = cleanIban;
      setFieldInPayload(repaired, ['iban', 'bank_account', 'IBAN'], cleanIban);
    }
  }

  return {
    repaired,
    normalized: norm,
    changes,
    wasRepaired: changes.length > 0
  };
}

function updateFieldInPayload(
  root: Record<string, unknown>,
  arrayKeys: string[],
  index: number,
  fieldKeys: string[],
  newVal: unknown
): void {
  for (const ak of arrayKeys) {
    if (Array.isArray(root[ak]) && root[ak][index]) {
      const target = root[ak][index] as Record<string, unknown>;
      for (const fk of fieldKeys) {
        if (fk in target) {
          target[fk] = newVal;
          return;
        }
      }
      target[fieldKeys[0]] = newVal;
      return;
    }
  }
}

function setFieldInPayload(root: Record<string, unknown>, keys: string[], newVal: unknown): void {
  for (const k of keys) {
    if (k in root) {
      root[k] = newVal;
      return;
    }
  }
  root[keys[0]] = newVal;
}