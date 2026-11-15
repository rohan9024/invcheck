from typing import Any, Dict, Optional, Union
from .types import NormalizedInvoice, VerificationReport, RepairResult
from .normalizer import normalize_invoice
from .arithmetic import verify_normalized_invoice
from .repair import repair_invoice
from .checksums import (
    validate_iban,
    validate_german_vat,
    validate_french_vat,
    validate_uk_vat,
    validate_us_ein,
    validate_abn,
)

__version__ = "1.0.0"

def verify_invoice(
    invoice_data: Union[Dict[str, Any], NormalizedInvoice],
    tolerance: float = 0.01,
    rounding_mode: str = "HALF_UP",
    strict_identifiers: bool = True,
) -> VerificationReport:
    """
    Primary API function to verify any extracted invoice JSON.
    """
    if isinstance(invoice_data, NormalizedInvoice):
        norm = invoice_data
    else:
        norm = normalize_invoice(invoice_data)

    return verify_normalized_invoice(
        norm,
        tolerance=tolerance,
        rounding_mode=rounding_mode,
        strict_identifiers=strict_identifiers,
    )

__all__ = [
    "verify_invoice",
    "repair_invoice",
    "normalize_invoice",
    "validate_iban",
    "validate_german_vat",
    "validate_french_vat",
    "validate_uk_vat",
    "validate_us_ein",
    "validate_abn",
    "NormalizedInvoice",
    "VerificationReport",
    "RepairResult",
]
