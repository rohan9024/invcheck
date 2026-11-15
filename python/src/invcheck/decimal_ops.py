from decimal import Decimal, ROUND_HALF_UP, ROUND_HALF_EVEN
from typing import Union, Optional


def to_decimal(val: Union[int, float, str, Decimal, None]) -> Decimal:
    if val is None:
        return Decimal("0.00")
    if isinstance(val, Decimal):
        return val
    try:
        # Convert floats via str to avoid IEEE 754 precision artifacts
        return Decimal(str(val))
    except Exception:
        return Decimal("0.00")


def round_decimal(
    val: Decimal,
    decimals: int = 2,
    mode: str = "HALF_UP"
) -> Decimal:
    rounding = ROUND_HALF_UP if mode == "HALF_UP" else ROUND_HALF_EVEN
    target = Decimal("10") ** -decimals
    return val.quantize(target, rounding=rounding)
