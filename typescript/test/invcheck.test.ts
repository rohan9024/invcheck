import test from 'node:test';
import assert from 'node:assert';
import { verifyInvoice, repairInvoice, validateIBAN, validateGermanVAT, validateABN, PreciseDecimal } from '../dist/index.js';

test('PreciseDecimal avoids 0.1 + 0.2 floating point drift', () => {
  const a = PreciseDecimal.from(0.1);
  const b = PreciseDecimal.from(0.2);
  const sum = a.add(b);
  assert.strictEqual(sum.toNumber(), 0.3);
  assert.strictEqual(sum.toFixed(2), '0.30');
});

test('Validates realistic Docling extraction output', () => {
  const doclingPayload = {
    invoice: {
      invoice_number: 'INV-2026-99',
      items: [
        { description: 'Cloud GPU Pod', qty: 2, unit_price: 15.50, total: 31.00 },
        { description: 'Cold Storage (TB)', qty: 10, unit_price: 2.00, total: 20.00 }
      ],
      subtotal: 51.00,
      tax: 9.69,
      total: 60.69,
      iban: 'DE89370400440532013000',
      vat_id: 'DE136695976'
    }
  };

  const report = verifyInvoice(doclingPayload);
  assert.strictEqual(report.isValid, true);
  assert.strictEqual(report.score, 100);
  assert.strictEqual(report.errors.length, 0);
});

test('Catches line-item math and subtotal hallucinations', () => {
  const faultyPayload = {
    items: [
      { name: 'Hardware Token', quantity: 3, unit_price: 10.00, line_total: 25.00 } // Error: 3 * 10 != 25
    ],
    subtotal: 30.00,
    total: 30.00
  };

  const report = verifyInvoice(faultyPayload);
  assert.strictEqual(report.isValid, false);
  assert.strictEqual(report.errors.some(e => e.code === 'LINE_ITEM_TOTAL_MISMATCH'), true);
});

test('Checksum validators hold', () => {
  assert.strictEqual(validateIBAN('DE89370400440532013000'), true);
  assert.strictEqual(validateIBAN('DE89370400440532013001'), false); // Corrupted digit
  assert.strictEqual(validateGermanVAT('DE136695976'), true); // SAP SE
  assert.strictEqual(validateABN('51824753556'), true); // Australian Taxation Office
});

test('Auto-heals 1-cent rounding drift and dirty currency strings', () => {
  const dirtyVlmOutput = {
    items: [
      { name: 'Item A', qty: 1, price: '$ 10.005', amount: '10.00' },
      { name: 'Item B', qty: 1, price: '$ 10.005', amount: '10.00' }
    ],
    subtotal: '$ 20.00',
    tax: '$ 3.80',
    total: '$ 23.85', // Off by 5 cents hallucination
    iban: 'DE 89 3704 0044 0532 0130 00'
  };

  const result = repairInvoice(dirtyVlmOutput);
  assert.strictEqual(result.wasRepaired, true);
  assert.strictEqual(result.changes.length > 0, true);
  assert.strictEqual(result.repaired['iban'], 'DE89370400440532013000');
});
