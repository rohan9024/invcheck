import { InvCheckOptions, NormalizedInvoice, ValidationError, VerificationReport } from './types.js';
import { PreciseDecimal } from './decimal.js';
import { validateABN, validateGermanVAT, validateIBAN, validateUKVAT, validateUSEIN } from './checksums.js';

/**
 * Deterministic Arithmetic & E-Invoice Verifier.
 */
export function verifyNormalizedInvoice(
  inv: NormalizedInvoice,
  options: InvCheckOptions = {}
): VerificationReport {
  const tolerance = options.tolerance ?? 0.01;
  const rounding = options.roundingMode ?? 'HALF_UP';
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  const items = Array.isArray(inv.items) ? inv.items : [];
  const taxBrackets = Array.isArray(inv.taxBrackets) ? inv.taxBrackets : [];
  const identifiers = inv.identifiers ?? {};

  // 1. Line Item Verification: qty * unitPrice - discount == lineTotal
  let computedSubtotal = PreciseDecimal.from(0);

  items.forEach((item, idx) => {
    const qty = PreciseDecimal.from(item.quantity);
    const price = PreciseDecimal.from(item.unitPrice);
    const lineTotal = PreciseDecimal.from(item.lineTotal);

    let expected = qty.mul(price);

    if (item.discountRate && item.discountRate > 0) {
      const discFactor = PreciseDecimal.from(1).sub(
        PreciseDecimal.from(item.discountRate).div(PreciseDecimal.from(100))
      );
      expected = expected.mul(discFactor);
    } else if (item.discountAmount && item.discountAmount > 0) {
      expected = expected.sub(PreciseDecimal.from(item.discountAmount));
    }

    expected = expected.round(2, rounding);

    if (expected.diffAbs(lineTotal) > tolerance) {
      errors.push({
        code: 'LINE_ITEM_TOTAL_MISMATCH',
        field: `items[${idx}].lineTotal`,
        severity: 'ERROR',
        message: `Line item #${idx + 1} (${item.description || 'Item'}) total ${lineTotal.toFixed(2)} does not match qty(${item.quantity}) * price(${item.unitPrice}) = ${expected.toFixed(2)}`,
        expected: expected.toNumber(),
        actual: lineTotal.toNumber(),
        discrepancy: lineTotal.sub(expected).toNumber()
      });
    }

    computedSubtotal = computedSubtotal.add(lineTotal);
  });

  computedSubtotal = computedSubtotal.round(2, rounding);

  // 2. Subtotal Check: sum(items.lineTotal) == subtotal
  if (inv.subtotal !== undefined) {
    const subtotal = PreciseDecimal.from(inv.subtotal).round(2, rounding);
    if (computedSubtotal.diffAbs(subtotal) > tolerance) {
      errors.push({
        code: 'SUBTOTAL_MISMATCH',
        field: 'subtotal',
        severity: 'ERROR',
        message: `Extracted subtotal ${subtotal.toFixed(2)} does not equal sum of line totals ${computedSubtotal.toFixed(2)}`,
        expected: computedSubtotal.toNumber(),
        actual: subtotal.toNumber(),
        discrepancy: subtotal.sub(computedSubtotal).toNumber()
      });
    }
  }

  // 3. Tax Brackets Check
  let computedTaxTotal = PreciseDecimal.from(0);
  if (taxBrackets.length > 0) {
    taxBrackets.forEach((tb, idx) => {
      const basis = PreciseDecimal.from(tb.basis);
      const rate = PreciseDecimal.from(tb.rate);
      const actualTax = PreciseDecimal.from(tb.amount).round(2, rounding);

      const expectedTax = basis.mul(rate.div(PreciseDecimal.from(100))).round(2, rounding);
      if (expectedTax.diffAbs(actualTax) > tolerance) {
        errors.push({
          code: 'TAX_BRACKET_MISMATCH',
          field: `taxBrackets[${idx}].amount`,
          severity: 'ERROR',
          message: `Tax bracket #${idx + 1} (${tb.rate}%) amount ${actualTax.toFixed(2)} does not match basis(${tb.basis}) * rate = ${expectedTax.toFixed(2)}`,
          expected: expectedTax.toNumber(),
          actual: actualTax.toNumber(),
          discrepancy: actualTax.sub(expectedTax).toNumber()
        });
      }
      computedTaxTotal = computedTaxTotal.add(actualTax);
    });
  } else if (inv.taxTotal !== undefined) {
    computedTaxTotal = PreciseDecimal.from(inv.taxTotal).round(2, rounding);
  }

  computedTaxTotal = computedTaxTotal.round(2, rounding);

  // 4. Grand Total Check: subtotal + tax + shipping - discount == grandTotal
  let computedGrandTotal = (inv.subtotal !== undefined ? PreciseDecimal.from(inv.subtotal) : computedSubtotal)
    .add(computedTaxTotal);

  if (inv.shippingAmount) {
    computedGrandTotal = computedGrandTotal.add(PreciseDecimal.from(inv.shippingAmount));
  }
  if (inv.discountAmount) {
    computedGrandTotal = computedGrandTotal.sub(PreciseDecimal.from(inv.discountAmount));
  }
  computedGrandTotal = computedGrandTotal.round(2, rounding);

  if (inv.grandTotal !== undefined) {
    const extractedGrandTotal = PreciseDecimal.from(inv.grandTotal).round(2, rounding);
    if (computedGrandTotal.diffAbs(extractedGrandTotal) > tolerance) {
      errors.push({
        code: 'GRAND_TOTAL_MISMATCH',
        field: 'grandTotal',
        severity: 'ERROR',
        message: `Extracted grand total ${extractedGrandTotal.toFixed(2)} does not equal computed total ${computedGrandTotal.toFixed(2)} (subtotal + tax + shipping - discounts)`,
        expected: computedGrandTotal.toNumber(),
        actual: extractedGrandTotal.toNumber(),
        discrepancy: extractedGrandTotal.sub(computedGrandTotal).toNumber()
      });
    }
  }

  // 5. Payment Due Check: paid + due == grandTotal
  if (inv.amountPaid !== undefined && inv.amountDue !== undefined && inv.grandTotal !== undefined) {
    const paid = PreciseDecimal.from(inv.amountPaid);
    const due = PreciseDecimal.from(inv.amountDue);
    const total = PreciseDecimal.from(inv.grandTotal);
    const paymentSum = paid.add(due).round(2, rounding);

    if (paymentSum.diffAbs(total) > tolerance) {
      warnings.push({
        code: 'PAYMENT_BALANCE_MISMATCH',
        field: 'amountDue',
        severity: 'WARNING',
        message: `Amount paid (${paid.toFixed(2)}) + amount due (${due.toFixed(2)}) does not equal total (${total.toFixed(2)})`,
        expected: total.sub(paid).toNumber(),
        actual: due.toNumber()
      });
    }
  }

  // 6. Checksum Verifications
  if (options.strictIdentifiers !== false && identifiers) {
    const { iban, vatId, ein, abn } = identifiers;

    if (iban && !validateIBAN(iban)) {
      errors.push({
        code: 'INVALID_IBAN_CHECKSUM',
        field: 'identifiers.iban',
        severity: 'ERROR',
        message: `IBAN '${iban}' failed ISO 7064 Mod 97-10 checksum verification`,
        actual: iban
      });
    }

    if (vatId) {
      const cleanVat = vatId.toUpperCase().replace(/[\s-]/g, '');
      if (cleanVat.startsWith('DE') && !validateGermanVAT(cleanVat)) {
        errors.push({
          code: 'INVALID_GERMAN_VAT',
          field: 'identifiers.vatId',
          severity: 'ERROR',
          message: `German VAT '${vatId}' failed ISO 7064 Mod 11, 10 checksum`,
          actual: vatId
        });
      } else if (cleanVat.startsWith('GB') && !validateUKVAT(cleanVat)) {
        errors.push({
          code: 'INVALID_UK_VAT',
          field: 'identifiers.vatId',
          severity: 'ERROR',
          message: `UK VAT '${vatId}' failed Modulo 97 checksum`,
          actual: vatId
        });
      }
    }

    if (ein && !validateUSEIN(ein)) {
      warnings.push({
        code: 'INVALID_US_EIN_PREFIX',
        field: 'identifiers.ein',
        severity: 'WARNING',
        message: `US EIN '${ein}' contains an unrecognized IRS campus prefix`,
        actual: ein
      });
    }

    if (abn && !validateABN(abn)) {
      errors.push({
        code: 'INVALID_ABN_CHECKSUM',
        field: 'identifiers.abn',
        severity: 'ERROR',
        message: `Australian ABN '${abn}' failed Modulo 89 checksum verification`,
        actual: abn
      });
    }
  }

  // Compute confidence score
  const totalChecks = items.length + 3 + (identifiers.iban ? 1 : 0);
  const penalty = errors.length * 25 + warnings.length * 5;
  const score = Math.max(0, Math.min(100, 100 - (penalty / Math.max(1, totalChecks)) * 10));

  return {
    isValid: errors.length === 0,
    score: Math.round(score),
    errors,
    warnings,
    summary: {
      computedSubtotal: computedSubtotal.toNumber(),
      computedTaxTotal: computedTaxTotal.toNumber(),
      computedGrandTotal: computedGrandTotal.toNumber(),
      extractedGrandTotal: inv.grandTotal,
      reconciled: errors.length === 0
    }
  };
}