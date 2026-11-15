import copy
from decimal import Decimal
from typing import Any, Dict, List
from .types import FieldChange, RepairResult
from .decimal_ops import to_decimal, round_decimal
from .normalizer import normalize_invoice


def repair_invoice(
    raw_input: Dict[str, Any],
    tolerance: float = 0.01,
    rounding_mode: str = "HALF_UP"
) -> RepairResult:
    norm = normalize_invoice(raw_input)
    changes: List[FieldChange] = []
    tol = Decimal(str(tolerance))
    repaired = copy.deepcopy(raw_input)

    # 1. Line Items Repair
    running_subtotal = Decimal("0.00")
    for idx, item in enumerate(norm.items):
        qty = to_decimal(item.quantity)
        price = to_decimal(item.unit_price)
        current_total = to_decimal(item.line_total)

        exp = qty * price
        if item.discount_rate and item.discount_rate > 0:
            exp *= (Decimal("1.0") - (to_decimal(item.discount_rate) / Decimal("100.0")))
        elif item.discount_amount:
            exp -= to_decimal(item.discount_amount)
        exp = round_decimal(exp, 2, rounding_mode)

        if abs(exp - current_total) > tol:
            diff = abs(exp - current_total)
            conf = 0.99 if diff <= Decimal("0.03") else 0.85
            changes.append(
                FieldChange(
                    field=f"items[{idx}].line_total",
                    old_value=item.line_total,
                    new_value=float(exp),
                    reason=f"Reconciled line_total = qty({item.quantity}) * price({item.unit_price})",
                    confidence=conf,
                )
            )
            item.line_total = float(exp)
            _update_in_payload(repaired, ["items", "line_items", "lines"], idx, ["line_total", "total", "amount"], float(exp))

        running_subtotal += to_decimal(item.line_total)

    running_subtotal = round_decimal(running_subtotal, 2, rounding_mode)

    # 2. Subtotal Repair
    if norm.subtotal is not None:
        cur_sub = round_decimal(to_decimal(norm.subtotal), 2, rounding_mode)
        if abs(cur_sub - running_subtotal) > tol:
            changes.append(
                FieldChange(
                    field="subtotal",
                    old_value=norm.subtotal,
                    new_value=float(running_subtotal),
                    reason="Recalculated subtotal as exact sum of line totals",
                    confidence=0.98,
                )
            )
            norm.subtotal = float(running_subtotal)
            _set_in_payload(repaired, ["subtotal", "sub_total", "SubTotal"], float(running_subtotal))
    else:
        norm.subtotal = float(running_subtotal)
        _set_in_payload(repaired, ["subtotal"], float(running_subtotal))

    # 3. Grand Total Repair
    running_grand = to_decimal(norm.subtotal)
    if norm.tax_total is not None:
        running_grand += to_decimal(norm.tax_total)
    if norm.shipping_amount is not None:
        running_grand += to_decimal(norm.shipping_amount)
    if norm.discount_amount is not None:
        running_grand -= to_decimal(norm.discount_amount)
    running_grand = round_decimal(running_grand, 2, rounding_mode)

    if norm.grand_total is not None:
        cur_grand = round_decimal(to_decimal(norm.grand_total), 2, rounding_mode)
        if abs(cur_grand - running_grand) > tol:
            changes.append(
                FieldChange(
                    field="grand_total",
                    old_value=norm.grand_total,
                    new_value=float(running_grand),
                    reason="Reconciled grand total = subtotal + tax + shipping - discounts",
                    confidence=0.99,
                )
            )
            norm.grand_total = float(running_grand)
            _set_in_payload(repaired, ["grand_total", "total", "total_amount", "InvoiceTotal"], float(running_grand))

    # 4. IBAN Format Sanitization
    if norm.identifiers.iban:
        clean_iban = norm.identifiers.iban.upper().replace(" ", "").replace("-", "")
        if clean_iban != norm.identifiers.iban:
            changes.append(
                FieldChange(
                    field="identifiers.iban",
                    old_value=norm.identifiers.iban,
                    new_value=clean_iban,
                    reason="Standardized IBAN formatting",
                    confidence=1.0,
                )
            )
            norm.identifiers.iban = clean_iban
            _set_in_payload(repaired, ["iban", "bank_account", "IBAN"], clean_iban)

    return RepairResult(
        repaired=repaired,
        normalized=norm,
        changes=changes,
        was_repaired=len(changes) > 0,
    )


def _update_in_payload(root: Dict[str, Any], arr_keys: List[str], idx: int, field_keys: List[str], val: Any) -> None:
    for ak in arr_keys:
        if ak in root and isinstance(root[ak], list) and idx < len(root[ak]):
            target = root[ak][idx]
            if isinstance(target, dict):
                for fk in field_keys:
                    if fk in target:
                        target[fk] = val
                        return
                target[field_keys[0]] = val
                return


def _set_in_payload(root: Dict[str, Any], keys: List[str], val: Any) -> None:
    for k in keys:
        if k in root:
            root[k] = val
            return
    root[keys[0]] = val
