from decimal import Decimal
from typing import List, Optional
from .types import NormalizedInvoice, ValidationError, VerificationReport, VerificationSummary
from .decimal_ops import to_decimal, round_decimal
from .checksums import validate_iban, validate_german_vat, validate_uk_vat, validate_us_ein, validate_abn


def verify_normalized_invoice(
    inv: NormalizedInvoice,
    tolerance: float = 0.01,
    rounding_mode: str = "HALF_UP",
    strict_identifiers: bool = True
) -> VerificationReport:
    tol = Decimal(str(tolerance))
    errors: List[ValidationError] = []
    warnings: List[ValidationError] = []

    # 1. Line Item Math
    computed_subtotal = Decimal("0.00")
    for idx, item in enumerate(inv.items):
        qty = to_decimal(item.quantity)
        price = to_decimal(item.unit_price)
        line_total = to_decimal(item.line_total)

        expected = qty * price
        if item.discount_rate and item.discount_rate > 0:
            expected *= (Decimal("1.0") - (to_decimal(item.discount_rate) / Decimal("100.0")))
        elif item.discount_amount and item.discount_amount > 0:
            expected -= to_decimal(item.discount_amount)

        expected = round_decimal(expected, 2, rounding_mode)

        if abs(expected - line_total) > tol:
            errors.append(
                ValidationError(
                    code="LINE_ITEM_TOTAL_MISMATCH",
                    field=f"items[{idx}].line_total",
                    severity="ERROR",
                    message=f"Line item #{idx + 1} ({item.description or 'Item'}) total {line_total} != qty({item.quantity}) * price({item.unit_price}) = {expected}",
                    expected=float(expected),
                    actual=float(line_total),
                    discrepancy=float(line_total - expected),
                )
            )
        computed_subtotal += line_total

    computed_subtotal = round_decimal(computed_subtotal, 2, rounding_mode)

    # 2. Subtotal Validation
    if inv.subtotal is not None:
        subtotal = round_decimal(to_decimal(inv.subtotal), 2, rounding_mode)
        if abs(computed_subtotal - subtotal) > tol:
            errors.append(
                ValidationError(
                    code="SUBTOTAL_MISMATCH",
                    field="subtotal",
                    severity="ERROR",
                    message=f"Extracted subtotal {subtotal} != sum of line totals {computed_subtotal}",
                    expected=float(computed_subtotal),
                    actual=float(subtotal),
                    discrepancy=float(subtotal - computed_subtotal),
                )
            )

    # 3. Tax Breakdown
    computed_tax_total = Decimal("0.00")
    if inv.tax_brackets:
        for idx, tb in enumerate(inv.tax_brackets):
            basis = to_decimal(tb.basis)
            rate = to_decimal(tb.rate)
            act_tax = round_decimal(to_decimal(tb.amount), 2, rounding_mode)
            exp_tax = round_decimal(basis * (rate / Decimal("100.0")), 2, rounding_mode)

            if abs(exp_tax - act_tax) > tol:
                errors.append(
                    ValidationError(
                        code="TAX_BRACKET_MISMATCH",
                        field=f"tax_brackets[{idx}].amount",
                        severity="ERROR",
                        message=f"Tax bracket {tb.rate}% amount {act_tax} != basis({tb.basis}) * rate = {exp_tax}",
                        expected=float(exp_tax),
                        actual=float(act_tax),
                        discrepancy=float(act_tax - exp_tax),
                    )
                )
            computed_tax_total += act_tax
    elif inv.tax_total is not None:
        computed_tax_total = round_decimal(to_decimal(inv.tax_total), 2, rounding_mode)

    computed_tax_total = round_decimal(computed_tax_total, 2, rounding_mode)

    # 4. Grand Total
    base_subtotal = to_decimal(inv.subtotal) if inv.subtotal is not None else computed_subtotal
    computed_grand_total = base_subtotal + computed_tax_total

    if inv.shipping_amount:
        computed_grand_total += to_decimal(inv.shipping_amount)
    if inv.discount_amount:
        computed_grand_total -= to_decimal(inv.discount_amount)
    computed_grand_total = round_decimal(computed_grand_total, 2, rounding_mode)

    if inv.grand_total is not None:
        ext_grand = round_decimal(to_decimal(inv.grand_total), 2, rounding_mode)
        if abs(computed_grand_total - ext_grand) > tol:
            errors.append(
                ValidationError(
                    code="GRAND_TOTAL_MISMATCH",
                    field="grand_total",
                    severity="ERROR",
                    message=f"Extracted grand total {ext_grand} != computed total {computed_grand_total}",
                    expected=float(computed_grand_total),
                    actual=float(ext_grand),
                    discrepancy=float(ext_grand - computed_grand_total),
                )
            )

    # 5. Identifier Checksums
    if strict_identifiers:
        ids = inv.identifiers
        if ids.iban and not validate_iban(ids.iban):
            errors.append(
                ValidationError(
                    code="INVALID_IBAN_CHECKSUM",
                    field="identifiers.iban",
                    severity="ERROR",
                    message=f"IBAN '{ids.iban}' failed ISO 7064 Mod 97-10 checksum",
                    actual=ids.iban,
                )
            )
        if ids.vat_id:
            cvat = ids.vat_id.upper().replace(" ", "").replace("-", "")
            if cvat.startswith("DE") and not validate_german_vat(cvat):
                errors.append(
                    ValidationError(
                        code="INVALID_GERMAN_VAT",
                        field="identifiers.vat_id",
                        severity="ERROR",
                        message=f"German VAT '{ids.vat_id}' failed Mod 11, 10 checksum",
                        actual=ids.vat_id,
                    )
                )
            elif cvat.startswith("GB") and not validate_uk_vat(cvat):
                errors.append(
                    ValidationError(
                        code="INVALID_UK_VAT",
                        field="identifiers.vat_id",
                        severity="ERROR",
                        message=f"UK VAT '{ids.vat_id}' failed Mod 97 checksum",
                        actual=ids.vat_id,
                    )
                )
        if ids.ein and not validate_us_ein(ids.ein):
            warnings.append(
                ValidationError(
                    code="INVALID_US_EIN_PREFIX",
                    field="identifiers.ein",
                    severity="WARNING",
                    message=f"US EIN '{ids.ein}' has unrecognized IRS campus prefix",
                    actual=ids.ein,
                )
            )
        if ids.abn and not validate_abn(ids.abn):
            errors.append(
                ValidationError(
                    code="INVALID_ABN_CHECKSUM",
                    field="identifiers.abn",
                    severity="ERROR",
                    message=f"Australian ABN '{ids.abn}' failed Mod 89 checksum",
                    actual=ids.abn,
                )
            )

    penalty = len(errors) * 25 + len(warnings) * 5
    score = max(0, min(100, 100 - penalty))

    return VerificationReport(
        is_valid=len(errors) == 0,
        score=score,
        errors=errors,
        warnings=warnings,
        summary=VerificationSummary(
            computed_subtotal=float(computed_subtotal),
            computed_tax_total=float(computed_tax_total),
            computed_grand_total=float(computed_grand_total),
            extracted_grand_total=inv.grand_total,
            reconciled=len(errors) == 0,
        ),
    )
