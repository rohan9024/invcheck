import re
from typing import Any, Dict, List, Optional
from .types import NormalizedInvoice, NormalizedLineItem, NormalizedTaxBracket, Identifiers


def parse_clean_number(val: Any) -> Optional[float]:
    if val is None or val == "":
        return None
    if isinstance(val, (int, float)):
        return float(val)

    s = str(val).strip()
    if not s:
        return None

    cleaned = re.sub(r"[^0-9.,-]", "", s)
    if "," in cleaned and "." in cleaned:
        if cleaned.rfind(",") > cleaned.rfind("."):
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    elif "," in cleaned and "." not in cleaned:
        cleaned = cleaned.replace(",", ".")

    try:
        return float(cleaned)
    except ValueError:
        return None


def find_value(obj: Dict[str, Any], aliases: List[str]) -> Any:
    lower_map = {re.sub(r"[^a-z0-9]", "", k.lower()): v for k, v in obj.items()}
    for alias in aliases:
        clean_alias = re.sub(r"[^a-z0-9]", "", alias.lower())
        if clean_alias in lower_map:
            v = lower_map[clean_alias]
            if isinstance(v, dict) and "value" in v:
                return v["value"]
            return v
    return None


def normalize_invoice(raw_input: Dict[str, Any]) -> NormalizedInvoice:
    root = raw_input
    for env in ["invoice", "document", "data", "extraction", "result"]:
        if env in root and isinstance(root[env], dict):
            root = root[env]
            break

    # 1. Line Items
    items_raw = find_value(root, ["items", "line_items", "lines", "LineItem", "table_rows", "expenses"]) or []
    items: List[NormalizedLineItem] = []

    if isinstance(items_raw, list):
        for row in items_raw:
            if not isinstance(row, dict):
                continue
            qty = parse_clean_number(find_value(row, ["quantity", "qty", "count", "units", "Quantity"])) or 1.0
            price = parse_clean_number(find_value(row, ["unit_price", "unitPrice", "price", "rate", "UnitPrice"])) or 0.0
            total = parse_clean_number(find_value(row, ["line_total", "total", "amount", "TotalPrice", "extended_price"]))
            if total is None:
                total = qty * price

            items.append(
                NormalizedLineItem(
                    id=str(find_value(row, ["id", "sku", "item_id"]) or ""),
                    description=str(find_value(row, ["description", "desc", "name", "item"]) or ""),
                    quantity=qty,
                    unit_price=price,
                    line_total=total,
                    discount_rate=parse_clean_number(find_value(row, ["discount_rate", "discount_pct"])),
                    discount_amount=parse_clean_number(find_value(row, ["discount_amount", "discount"])),
                    tax_rate=parse_clean_number(find_value(row, ["tax_rate", "tax_pct", "vat_rate"])),
                    tax_amount=parse_clean_number(find_value(row, ["tax_amount", "tax", "vat"])),
                    raw=row,
                )
            )

    # 2. Document Totals
    subtotal = parse_clean_number(find_value(root, ["subtotal", "sub_total", "net_amount", "SubTotal"]))
    tax_total = parse_clean_number(find_value(root, ["tax_total", "tax", "total_tax", "vat_amount", "TotalTax"]))
    grand_total = parse_clean_number(find_value(root, ["grand_total", "total", "total_amount", "gross_amount", "InvoiceTotal"]))
    shipping = parse_clean_number(find_value(root, ["shipping", "shipping_fee", "freight"]))
    discount = parse_clean_number(find_value(root, ["discount", "total_discount"]))
    amount_paid = parse_clean_number(find_value(root, ["amount_paid", "paid"]))
    amount_due = parse_clean_number(find_value(root, ["amount_due", "balance_due", "due"]))

    # 3. Tax Breakdown
    raw_taxes = find_value(root, ["taxes", "tax_breakdown", "tax_details"]) or []
    brackets: List[NormalizedTaxBracket] = []
    if isinstance(raw_taxes, list):
        for tb in raw_taxes:
            if isinstance(tb, dict):
                r = parse_clean_number(find_value(tb, ["rate", "percentage"])) or 0.0
                b = parse_clean_number(find_value(tb, ["basis", "taxable_amount"])) or 0.0
                a = parse_clean_number(find_value(tb, ["amount", "tax_amount"])) or ((b * r) / 100.0)
                brackets.append(NormalizedTaxBracket(rate=r, basis=b, amount=a))

    # 4. Identifiers
    iban = find_value(root, ["iban", "bank_account", "IBAN"])
    vat_id = find_value(root, ["vat_id", "vat_number", "tax_id", "ust_id"])
    ein = find_value(root, ["ein", "federal_tax_id", "us_ein"])
    abn = find_value(root, ["abn", "australian_business_number"])

    return NormalizedInvoice(
        invoice_id=str(find_value(root, ["invoice_id", "invoice_number", "InvoiceId"]) or ""),
        currency=str(find_value(root, ["currency", "currency_code"]) or ""),
        subtotal=subtotal,
        tax_total=tax_total,
        grand_total=grand_total,
        shipping_amount=shipping,
        discount_amount=discount,
        amount_paid=amount_paid,
        amount_due=amount_due,
        items=items,
        tax_brackets=brackets,
        identifiers=Identifiers(
            iban=str(iban) if iban else None,
            vat_id=str(vat_id) if vat_id else None,
            ein=str(ein) if ein else None,
            abn=str(abn) if abn else None,
        ),
        raw=root,
    )
