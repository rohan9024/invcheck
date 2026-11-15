from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any


@dataclass
class NormalizedLineItem:
    quantity: float
    unit_price: float
    line_total: float
    id: Optional[str] = None
    description: Optional[str] = None
    discount_rate: Optional[float] = None
    discount_amount: Optional[float] = None
    tax_rate: Optional[float] = None
    tax_amount: Optional[float] = None
    raw: Dict[str, Any] = field(default_factory=dict)


@dataclass
class NormalizedTaxBracket:
    rate: float
    basis: float
    amount: float


@dataclass
class Identifiers:
    iban: Optional[str] = None
    vat_id: Optional[str] = None
    ein: Optional[str] = None
    abn: Optional[str] = None


@dataclass
class NormalizedInvoice:
    items: List[NormalizedLineItem]
    tax_brackets: List[NormalizedTaxBracket]
    identifiers: Identifiers
    invoice_id: Optional[str] = None
    currency: Optional[str] = None
    subtotal: Optional[float] = None
    tax_total: Optional[float] = None
    grand_total: Optional[float] = None
    shipping_amount: Optional[float] = None
    discount_amount: Optional[float] = None
    amount_paid: Optional[float] = None
    amount_due: Optional[float] = None
    raw: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ValidationError:
    code: str
    field: str
    severity: str
    message: str
    expected: Optional[Any] = None
    actual: Optional[Any] = None
    discrepancy: Optional[float] = None


@dataclass
class VerificationSummary:
    computed_subtotal: float
    computed_tax_total: float
    computed_grand_total: float
    extracted_grand_total: Optional[float]
    reconciled: bool


@dataclass
class VerificationReport:
    is_valid: bool
    score: int
    errors: List[ValidationError]
    warnings: List[ValidationError]
    summary: VerificationSummary


@dataclass
class FieldChange:
    field: str
    old_value: Any
    new_value: Any
    reason: str
    confidence: float


@dataclass
class RepairResult:
    repaired: Dict[str, Any]
    normalized: NormalizedInvoice
    changes: List[FieldChange]
    was_repaired: bool
