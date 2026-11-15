# invcheck

<p align="center">
  <strong>Deterministic Arithmetic, Tax & E-Invoice JSON Verifier & Auto-Repair Engine</strong><br>
  <em>The missing 0-dependency MIT verification primitive for Docling, MarkItDown, Textract, and VLM Extractors</em>
</p>

<p align="center">
  <a href="https://npmjs.com/package/invcheck"><img src="https://img.shields.io/npm/v/invcheck?color=blue" alt="npm version"></a>
  <a href="https://pypi.org/project/invcheck"><img src="https://img.shields.io/pypi/v/invcheck?color=blue" alt="pypi version"></a>
  <a href="#license"><img src="https://img.shields.io/badge/license-MIT-green" alt="license"></a>
  <a href="#dependencies"><img src="https://img.shields.io/badge/dependencies-0-brightgreen" alt="dependencies"></a>
  <a href="#speed"><img src="https://img.shields.io/badge/latency-%3C0.2ms-orange" alt="latency"></a>
</p>

---

## Why invcheck?

Every modern document extraction pipeline (using **IBM Docling**, **Microsoft MarkItDown**, **LiteParse**, or **GPT-4o / Claude Sonnet** vision prompts) suffers from a critical flaw: **models cannot guarantee exact arithmetic**.

* Line items drift by off-by-one cent rounding errors ($0.01).
* Subtotals and tax rates hallucinate mismatches.
* Extracted IBANs, VAT numbers, and EINs contain dropped or transposed characters.

**`invcheck`** provides a sub-millisecond, zero-dependency, deterministic financial boundary for your extraction pipeline. Available synchronously in both **TypeScript** and **Python**.

| Feature | `invcheck` | Reducto | strutex | Manual Regex / Scripts |
| :--- | :---: | :---: | :---: | :---: |
| **License** | **MIT (Free forever)** | Proprietary SaaS ($$$) | GPL-3.0 (Viral) | Custom |
| **Dependencies** | **0 (Zero)** | Heavy API SDK | Python dependencies | None |
| **Runtime** | **Sub-millisecond Local** | Cloud API (100-500ms) | Local (Python only) | Fast |
| **TypeScript + Python** | **Yes (Full parity)** | Python/REST only | Python only | Fragmented |
| **EN 16931 Banker's Rounding** | **Yes** | Cloud blackbox | Partial | Rarely |
| **Auto-Repair / Healing Mode** | **Yes (Diff + Confidence)** | Cloud blackbox | No | No |
| **IBAN / VAT / EIN Checksums** | **Yes (ISO 7064, Mod 89/97)**| Partial | No | Fragile |

---

## Quickstart

### Node.js / TypeScript
