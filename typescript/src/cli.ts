#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { normalizeInvoice } from './normalizer.js';
import { verifyNormalizedInvoice } from './arithmetic.js';
import { repairInvoice } from './repair.js';

function printHelp(): void {
  console.log(`
invcheck CLI — E-Invoice & Extraction Arithmetic Verifier (0-dep MIT)

Usage:
  npx invcheck <file.json> [options]

Options:
  --repair         Auto-repair rounding drift and total mismatches
  --out <file>     Write repaired JSON to specified output path
  --tolerance <n>  Rounding tolerance threshold (default: 0.01)
  --quiet          Output pure JSON result only
  --help           Show this manual
  `);
}

function run(): void {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help')) {
    printHelp();
    process.exit(0);
  }

  const filePath = args[0];
  const isRepair = args.includes('--repair');
  const isQuiet = args.includes('--quiet');
  const outIdx = args.indexOf('--out');
  const outPath = outIdx !== -1 ? args[outIdx + 1] : undefined;

  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`[invcheck error] File not found: ${filePath}`);
    process.exit(1);
  }

  let rawData: Record<string, unknown>;
  try {
    rawData = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
  } catch (err) {
    console.error(`[invcheck error] Invalid JSON in ${filePath}:`, err);
    process.exit(1);
  }

  if (isRepair) {
    const res = repairInvoice(rawData);
    if (outPath) {
      fs.writeFileSync(path.resolve(process.cwd(), outPath), JSON.stringify(res.repaired, null, 2));
      if (!isQuiet) console.log(`✓ Healed JSON written to ${outPath}`);
    } else {
      console.log(JSON.stringify(res.repaired, null, 2));
    }
    process.exit(0);
  }

  const norm = normalizeInvoice(rawData);
  const report = verifyNormalizedInvoice(norm);

  if (isQuiet) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`\n=== invcheck Verification Report ===`);
    console.log(`Status:  ${report.isValid ? '✓ VALID' : '✗ DISCREPANCIES DETECTED'}`);
    console.log(`Score:   ${report.score}/100`);
    console.log(`Subtotal: ${report.summary.computedSubtotal} | Grand Total: ${report.summary.computedGrandTotal}`);

    if (report.errors.length > 0) {
      console.log(`\nErrors (${report.errors.length}):`);
      report.errors.forEach(e => console.log(`  ✗ [${e.code}] ${e.field}: ${e.message}`));
    }
    if (report.warnings.length > 0) {
      console.log(`\nWarnings (${report.warnings.length}):`);
      report.warnings.forEach(w => console.log(`  ! [${w.code}] ${w.field}: ${w.message}`));
    }
  }

  process.exit(report.isValid ? 0 : 1);
}

run();
