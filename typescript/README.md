<div align="center">

# 🧾 invcheck

**Deterministic Arithmetic, Tax & E-Invoice JSON Verifier & Auto-Repair Engine**

*The missing zero-dependency validation primitive for Docling, MarkItDown, AWS Textract, and VLM extraction pipelines.*

[![npm version](https://img.shields.io/npm/v/invcheck?color=cb3837&style=flat-square&logo=npm)](https://www.npmjs.com/package/invcheck)
[![PyPI version](https://img.shields.io/pypi/v/invcheck?color=3775a9&style=flat-square&logo=pypi)](https://pypi.org/project/invcheck)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-success?style=flat-square)](#architecture--zero-dependencies)
[![MCP Ready](https://img.shields.io/badge/MCP-native_tools-purple?style=flat-square)](#model-context-protocol-mcp-integration)

</div>

---

## ⚡ The Problem

Modern document extraction pipelines using **IBM Docling**, **Microsoft MarkItDown**, **AWS Textract**, **LiteParse**, or Vision Language Models (**GPT-4o**, **Claude Sonnet**, **Gemini**, **Qwen2.5-VL**) can produce plausible JSON that still contains accounting errors.

Common problems include:

1. **Floating-point & OCR Rounding Drift:** Extracted monetary values can differ by a cent due to rounding or OCR inaccuracies.
2. **Arithmetic Hallucinations:** `quantity × unit_price` may not equal the extracted line total.
3. **Split Tax Rate Errors:** Multiple VAT rates can be mixed together, resulting in incorrect tax calculations.
4. **Identifier Errors:** Extractors can drop digits or transpose characters in IBANs, VAT IDs, EINs, and ABNs.

**`invcheck`** is an open-source TypeScript and Python library designed to validate invoice arithmetic, normalize extracted data, check supported identifiers, and repair supported discrepancies.

---

## 🚀 Key Features

- **🧮 Exact Decimal Arithmetic:** Uses scaled integer arithmetic in TypeScript and decimal arithmetic in Python to avoid common floating-point precision issues.
- **🏛️ Rounding Support:** Supports commercial rounding (`HALF_UP`) and banker's rounding (`HALF_EVEN`).
- **🩹 Auto-Repair Engine:** Repairs supported rounding discrepancies, normalizes currency strings, and returns an audit trail.
- **🔍 Identifier Validation:**
  - IBAN: ISO 7064 Mod 97-10.
  - German VAT ID: Country-specific checksum validation.
  - French VAT ID: SIREN-based validation.
  - UK VAT ID: Supported modulo validation.
  - US EIN: Format and prefix validation.
  - Australian ABN: Weighted checksum validation.
- **🧩 Extraction Pipeline Support:** Designed for JSON produced by Docling, MarkItDown, AWS Textract, Azure Document Intelligence, and LLM extraction workflows.
- **🤖 MCP Integration:** Includes Model Context Protocol tool handlers for AI-agent workflows.
- **📦 Dual Ecosystem:** TypeScript and Python implementations.
- **🔒 Offline Processing:** Core validation runs locally without requiring an external API.

---

## 📊 Comparison Matrix

| Capability | `invcheck` | Commercial APIs | Custom Regex / Float Math |
|---|---|---|---|
| License | MIT | Proprietary | N/A |
| Pricing | Free & open source | Often usage-based | Developer time |
| Runtime dependencies | Zero (core package) | API / SDK dependencies | Varies |
| Language support | TypeScript + Python | Varies | Varies |
| Offline processing | Yes | Usually no | Yes |
| Exact decimal arithmetic | Yes | Varies | Usually no |
| Deterministic auto-repair | Supported | Varies | Manual |
| Identifier checksums | Supported formats | Varies | Manual |
| MCP integration | Included handlers | Varies | Manual |

---

## 📦 Installation

### Node.js / TypeScript

```bash
# npm
npm install invcheck

# pnpm
pnpm add invcheck

# yarn
yarn add invcheck
```

### Python

```bash
# pip
pip install invcheck

# uv
uv add invcheck
```

---

## 💡 Quickstart

### TypeScript / JavaScript

```typescript
import { verifyInvoice, repairInvoice } from 'invcheck';

const extractedJson = {
  invoice_number: "INV-2026-0881",
  items: [
    {
      name: "Cloud GPU Node",
      quantity: 2,
      unit_price: 3.50,
      total: 7.00
    },
    {
      name: "Persistent Storage",
      quantity: 5,
      unit_price: 10.00,
      total: 50.00
    }
  ],
  subtotal: 57.00,
  tax: 10.83,
  total: 67.83,
  iban: "DE89370400440532013000",
  vat_id: "DE136695976"
};

// Verify extracted invoice data
const report = verifyInvoice(extractedJson);

if (report.isValid) {
  console.log("Invoice verified!");
  console.log(`Confidence score: ${report.score}/100`);
} else {
  console.error("Discrepancies found:", report.errors);

  // Attempt supported deterministic repairs
  const healed = repairInvoice(extractedJson);

  console.log("Repaired document:", healed.repaired);
  console.log("Audit changelog:", healed.changes);
}
```

### Python

```python
from invcheck import verify_invoice, repair_invoice

extracted_json = {
    "invoice": {
        "items": [
            {
                "description": "Engineering Consulting",
                "qty": 10,
                "rate": "$ 150.00",
                "amount": 1500.00
            },
            {
                "description": "DevOps Setup",
                "qty": 1,
                "rate": "$ 500.00",
                "amount": 500.00
            }
        ],
        "sub_total": 2000.00,
        "tax": 380.00,
        "total": 2380.00,
        "iban": "DE 89 3704 0044 0532 0130 00"
    }
}

# Verify invoice
report = verify_invoice(extracted_json)

if not report.is_valid:
    for err in report.errors:
        print(f"[{err.code}] {err.field}: {err.message}")

    # Attempt supported repairs
    healed = repair_invoice(extracted_json)

    print("Repaired payload:", healed.repaired)
    print("Changes:", healed.changes)
else:
    print("Invoice verified!")
```

---

## 🛠️ Pipeline Integrations

### 1. IBM Docling

```python
from docling.document_converter import DocumentConverter
from invcheck import verify_invoice, repair_invoice

converter = DocumentConverter()

result = converter.convert("invoice.pdf")
raw_data = result.document.export_to_dict()

verification = verify_invoice(raw_data)

if not verification.is_valid:
    healed_data = repair_invoice(raw_data).repaired
    save_to_database(healed_data)
else:
    save_to_database(raw_data)
```

### 2. OpenAI / Anthropic Structured Output

```typescript
import { verifyInvoice, repairInvoice } from 'invcheck';

const extractedInvoice = {
  invoice_number: "INV-2026-001",
  items: [
    {
      description: "Engineering Services",
      quantity: 2,
      unit_price: 150,
      line_total: 300
    }
  ],
  subtotal: 300,
  tax: 57,
  total: 357
};

const check = verifyInvoice(extractedInvoice);

const finalInvoice = check.isValid
  ? extractedInvoice
  : repairInvoice(extractedInvoice).repaired;
```

---

## 🩺 Auto-Repair Engine

The repair engine attempts to correct supported discrepancies and returns an audit trail.

Example of a conceptual repair result:

```json
{
  "wasRepaired": true,
  "changes": [
    {
      "field": "items[0].lineTotal",
      "oldValue": 10.00,
      "newValue": 10.01,
      "reason": "Reconciled line total",
      "confidence": 0.99
    }
  ]
}
```

Repair behavior depends on the detected discrepancy and the supported repair rules.

**Important:** Always review repaired values before using them in accounting, ERP, tax, or payment workflows. A mathematically consistent invoice is not necessarily legally or commercially correct.

---

## 💻 Command Line Interface

Use the CLI to validate or repair invoice JSON files.

```bash
# Verify an invoice
npx invcheck sample_invoice.json

# Repair and save the output
npx invcheck sample_invoice.json --repair --out clean_invoice.json

# Display CLI help
npx invcheck --help
```

### CLI Options

| Option | Description |
|---|---|
| `--repair` | Attempt supported automatic repairs |
| `--out <file>` | Write repaired JSON to the specified file |
| `--tolerance <n>` | Configure rounding tolerance |
| `--quiet` | Output machine-readable JSON where supported |
| `--help` | Display usage information |

---

## 🤖 Model Context Protocol (MCP) Integration

`invcheck` includes MCP-oriented tool handlers for AI-agent workflows.

Example MCP configuration:

```json
{
  "mcpServers": {
    "invcheck": {
      "command": "npx",
      "args": ["-y", "invcheck"]
    }
  }
}
```

Available tool handlers include:

- **`invcheck_verify`** — Validates supported invoice arithmetic, tax calculations, and identifiers.
- **`invcheck_repair`** — Attempts supported repairs and returns an audit trail.

Check the package documentation and MCP implementation for the exact server startup requirements and supported tool schemas.

---

## 🔍 Supported Identifier Checks

| Identifier | Validation |
|---|---|
| IBAN | ISO 7064 Mod 97-10 |
| German VAT ID | Country-specific checksum |
| French VAT ID | SIREN-based validation |
| UK VAT ID | Supported modulo validation |
| US EIN | Format and prefix validation |
| Australian ABN | Weighted checksum modulo 89 |

Checksum validation does not establish that an identifier is registered, active, or belongs to the invoice issuer. Use the relevant government or financial authority for authoritative verification.

---

## 📐 Architecture & Zero Dependencies

```text
                 ┌───────────────────────────────┐
                 │ Raw Extracted Document (JSON) │
                 │   Docling / MarkItDown / VLM  │
                 └───────────────┬───────────────┘
                                 │
                                 ▼
                 ┌───────────────────────────────┐
                 │       Fuzzy Normalizer        │
                 │   Key Aliasing & Currency     │
                 └───────────────┬───────────────┘
                                 │
                ┌────────────────┴────────────────┐
                ▼                                 ▼
    ┌─────────────────────────┐       ┌─────────────────────────┐
    │ Exact Decimal Engine    │       │  Algorithmic Checksums  │
    │ Scaled Integer / Decimal│       │  IBAN / VAT / EIN / ABN  │
    └────────────┬────────────┘       └────────────┬────────────┘
                 │                                 │
                 └────────────────┬────────────────┘
                                  │
                                  ▼
                 ┌───────────────────────────────┐
                 │     Deterministic Verifier    │
                 │   Line Totals / Tax / Total   │
                 └───────────────┬───────────────┘
                                 │
                                 ▼
                       Discrepancies Detected?
                          /             \
                        Yes              No
                         │                │
                         ▼                ▼
             ┌───────────────────┐  ┌───────────────────┐
             │  Auto-Repair      │  │  Validated Report │
             │  + Audit Trail    │  │  + Results        │
             └───────────────────┘  └───────────────────┘
```

Both implementations are designed to avoid external runtime dependencies:

- **TypeScript:** Uses native `BigInt` scaled integer arithmetic.
- **Python:** Uses the standard library's `decimal.Decimal` and regular expressions.

---

## 🧪 Testing & Development

### TypeScript

```bash
cd typescript

npm install

# Compile
npm run build

# Run tests
npm test
```

### Python

```bash
cd python

# Install in editable mode
python -m pip install -e .

# Install test dependency
python -m pip install pytest

# Run tests
python -m pytest tests
```

---

## 🗺️ Roadmap

Potential areas for future development:

- [ ] Additional country-specific VAT validation.
- [ ] More extraction-provider adapters.
- [ ] Expanded invoice schema support.
- [ ] Additional tax and discount reconciliation rules.
- [ ] More robust repair confidence calibration.
- [ ] Performance benchmarks across TypeScript and Python.
- [ ] Additional MCP integration examples.
- [ ] Expanded test coverage with real-world anonymized invoices.

---

## 📄 License

Distributed under the **MIT License**.

See [LICENSE](LICENSE) for details.

---

## 👨‍💻 Author

**Rohan Ramesh Wandre**

- GitHub: [@rohan9024](https://github.com/rohan9024)
- npm: [@rohan9024](https://www.npmjs.com/~rohan9024)
- PyPI: [rohan9024](https://pypi.org/user/rohan9024/)

---

<div align="center">

**Built for reliable document extraction and deterministic invoice validation.**

⭐ If you find `invcheck` useful, consider giving the repository a star!

</div>