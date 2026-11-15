export type RoundingMode = 'HALF_UP' | 'HALF_EVEN';

export interface InvCheckOptions {
  tolerance?: number;            // Default 0.01 (cents)
  roundingMode?: RoundingMode;   // Default 'HALF_UP' (or 'HALF_EVEN' for EN 16931)
  strictIdentifiers?: boolean;   // Default true
}

export interface NormalizedLineItem {
  id?: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  discountRate?: number;         // e.g. 10 for 10%
  discountAmount?: number;
  taxRate?: number;              // e.g. 19 for 19%
  taxAmount?: number;
  raw: Record<string, unknown>;
}

export interface NormalizedTaxBracket {
  rate: number;                  // e.g. 19 for 19%
  basis: number;                 // taxable base amount
  amount: number;                // tax collected
}

export interface NormalizedInvoice {
  invoiceId?: string;
  currency?: string;
  subtotal?: number;
  taxTotal?: number;
  grandTotal?: number;
  shippingAmount?: number;
  discountAmount?: number;
  amountPaid?: number;
  amountDue?: number;
  items: NormalizedLineItem[];
  taxBrackets: NormalizedTaxBracket[];
  identifiers: {
    iban?: string;
    vatId?: string;
    ein?: string;
    abn?: string;
  };
  raw: Record<string, unknown>;
}

export type ErrorSeverity = 'ERROR' | 'WARNING';

export interface ValidationError {
  code: string;
  field: string;
  severity: ErrorSeverity;
  message: string;
  expected?: number | string;
  actual?: number | string;
  discrepancy?: number;
}

export interface VerificationReport {
  isValid: boolean;
  score: number;                 // 0 to 100 confidence score
  errors: ValidationError[];
  warnings: ValidationError[];
  summary: {
    computedSubtotal: number;
    computedTaxTotal: number;
    computedGrandTotal: number;
    extractedGrandTotal?: number;
    reconciled: boolean;
  };
}

export interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
  confidence: number;            // 0.00 to 1.00
}

export interface RepairResult {
  repaired: Record<string, unknown>;
  normalized: NormalizedInvoice;
  changes: FieldChange[];
  wasRepaired: boolean;
}
