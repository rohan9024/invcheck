from invcheck import verify_invoice, repair_invoice, validate_iban, validate_german_vat, validate_abn

def test_valid_docling_invoice():
    payload = {
        "invoice": {
            "invoice_number": "INV-1020",
            "items": [
                {"description": "Compute Units", "quantity": 4, "unit_price": 25.00, "line_total": 100.00},
                {"description": "Networking Transfer", "quantity": 1, "unit_price": 5.50, "line_total": 5.50}
            ],
            "subtotal": 105.50,
            "tax": 20.05,
            "total": 125.55,
            "iban": "DE89370400440532013000",
            "vat_id": "DE136695976"
        }
    }
    report = verify_invoice(payload)
    assert report.is_valid is True
    assert report.score == 100
    assert len(report.errors) == 0

def test_detects_arithmetic_hallucination():
    faulty = {
        "items": [
            {"name": "Widget", "qty": 2, "price": 10.00, "total": 25.00} # 2 * 10 != 25
        ],
        "subtotal": 20.00,
        "total": 20.00
    }
    report = verify_invoice(faulty)
    assert report.is_valid is False
    assert any(e.code == "LINE_ITEM_TOTAL_MISMATCH" for e in report.errors)

def test_checksum_algorithms():
    assert validate_iban("DE89370400440532013000") is True
    assert validate_iban("DE89370400440532013009") is False
    assert validate_german_vat("DE136695976") is True
    assert validate_abn("51824753556") is True

def test_repair_heals_drift():
    dirty = {
        "items": [
            {"item": "Service A", "quantity": 2, "unit_price": "$ 14.50", "line_total": "29.00"}
        ],
        "subtotal": "29.00",
        "tax": "5.51",
        "total": "35.00", # Hallucinated total instead of 34.51
        "iban": "DE 89 3704 0044 0532 0130 00"
    }
    res = repair_invoice(dirty)
    assert res.was_repaired is True
    assert res.repaired["total"] == 34.51
    assert res.repaired["iban"] == "DE89370400440532013000"
