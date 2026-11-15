from typing import Any, Dict
from .normalizer import normalize_invoice
from .arithmetic import verify_normalized_invoice
from .repair import repair_invoice

MCP_TOOLS = [
    {
        "name": "invcheck_verify",
        "description": "Verifies invoice extraction JSON for arithmetic correctness and checksums.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "invoice_json": {"type": "object"},
                "tolerance": {"type": "number", "default": 0.01}
            },
            "required": ["invoice_json"]
        }
    },
    {
        "name": "invcheck_repair",
        "description": "Auto-repairs rounding drift and mismatched totals in extracted invoice JSON.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "invoice_json": {"type": "object"}
            },
            "required": ["invoice_json"]
        }
    }
]

def handle_mcp_call(tool_name: str, args: Dict[str, Any]) -> Any:
    invoice_data = args.get("invoice_json", {})
    tolerance = float(args.get("tolerance", 0.01))

    if tool_name == "invcheck_verify":
        norm = normalize_invoice(invoice_data)
        rep = verify_normalized_invoice(norm, tolerance=tolerance)
        return {
            "isValid": rep.is_valid,
            "score": rep.score,
            "errors": [e.__dict__ for e in rep.errors],
            "warnings": [w.__dict__ for w in rep.warnings],
            "summary": rep.summary.__dict__
        }
    elif tool_name == "invcheck_repair":
        res = repair_invoice(invoice_data, tolerance=tolerance)
        return {
            "repaired": res.repaired,
            "changes": [c.__dict__ for c in res.changes],
            "wasRepaired": res.was_repaired
        }
    raise ValueError(f"Unknown MCP tool: {tool_name}")
