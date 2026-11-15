import sys
import json
import argparse
from .normalizer import normalize_invoice
from .arithmetic import verify_normalized_invoice
from .repair import repair_invoice


def main() -> None:
    parser = argparse.ArgumentParser(description="invcheck: Deterministic E-Invoice Arithmetic & Checksum Verifier")
    parser.add_argument("file", help="Path to invoice JSON file")
    parser.add_argument("--repair", action="store_true", help="Auto-repair arithmetic and rounding discrepancies")
    parser.add_argument("--out", help="Output path for repaired JSON")
    parser.add_argument("--tolerance", type=float, default=0.01, help="Rounding tolerance threshold (default: 0.01)")
    parser.add_argument("--quiet", action="store_true", help="Output JSON only")

    args = parser.parse_args()

    try:
        with open(args.file, "r", encoding="utf-8") as f:
            raw_data = json.load(f)
    except Exception as e:
        print(f"[invcheck error] Could not read JSON: {e}", file=sys.stderr)
        sys.exit(1)

    if args.repair:
        res = repair_invoice(raw_data, tolerance=args.tolerance)
        if args.out:
            with open(args.out, "w", encoding="utf-8") as f:
                json.dump(res.repaired, f, indent=2)
            if not args.quiet:
                print(f"✓ Healed JSON written to {args.out}")
        else:
            print(json.dumps(res.repaired, indent=2))
        sys.exit(0)

    norm = normalize_invoice(raw_data)
    rep = verify_normalized_invoice(norm, tolerance=args.tolerance)

    if args.quiet:
        print(json.dumps({
            "isValid": rep.is_valid,
            "score": rep.score,
            "errors": [e.__dict__ for e in rep.errors],
            "summary": rep.summary.__dict__
        }, indent=2))
    else:
        status = "✓ VALID" if rep.is_valid else "✗ DISCREPANCIES DETECTED"
        print(f"\n=== invcheck Verification Report ===")
        print(f"Status:   {status}")
        print(f"Score:    {rep.score}/100")
        print(f"Subtotal: {rep.summary.computed_subtotal} | Grand Total: {rep.summary.computed_grand_total}")

        if rep.errors:
            print(f"\nErrors ({len(rep.errors)}):")
            for e in rep.errors:
                print(f"  ✗ [{e.code}] {e.field}: {e.message}")

    sys.exit(0 if rep.is_valid else 1)


if __name__ == "__main__":
    main()
