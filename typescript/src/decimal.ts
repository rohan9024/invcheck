import { RoundingMode } from './types.js';

/**
 * 0-dependency Scaled Arbitrary-Precision Decimal Engine.
 * Operates at 8 decimal places scale to prevent any IEEE 754 float drift.
 */
export class PreciseDecimal {
  private static readonly SCALE = 8n;
  private static readonly MULTIPLIER = 100_000_000n; // 10^8

  private readonly value: bigint;

  private constructor(value: bigint) {
    this.value = value;
  }

  public static from(val: number | string | bigint | PreciseDecimal | undefined | null): PreciseDecimal {
    if (val === undefined || val === null) {
      return new PreciseDecimal(0n);
    }
    if (val instanceof PreciseDecimal) {
      return val;
    }
    if (typeof val === 'bigint') {
      return new PreciseDecimal(val * PreciseDecimal.MULTIPLIER);
    }
    if (typeof val === 'number') {
      if (Number.isNaN(val) || !Number.isFinite(val)) return new PreciseDecimal(0n);
      return PreciseDecimal.fromString(val.toFixed(8));
    }
    return PreciseDecimal.fromString(val.toString());
  }

  private static fromString(str: string): PreciseDecimal {
    const cleaned = str.trim().replace(/[^0-9.-]/g, '');
    if (!cleaned || cleaned === '-' || cleaned === '.') return new PreciseDecimal(0n);

    const isNegative = cleaned.startsWith('-');
    const absStr = isNegative ? cleaned.slice(1) : cleaned;
    const parts = absStr.split('.');
    const intPart = parts[0] || '0';
    let fracPart = parts[1] || '';

    if (fracPart.length > 8) {
      fracPart = fracPart.slice(0, 8);
    } else {
      fracPart = fracPart.padEnd(8, '0');
    }

    const totalBig = BigInt(intPart) * PreciseDecimal.MULTIPLIER + BigInt(fracPart);
    return new PreciseDecimal(isNegative ? -totalBig : totalBig);
  }

  public add(other: PreciseDecimal): PreciseDecimal {
    return new PreciseDecimal(this.value + other.value);
  }

  public sub(other: PreciseDecimal): PreciseDecimal {
    return new PreciseDecimal(this.value - other.value);
  }

  public mul(other: PreciseDecimal): PreciseDecimal {
    const product = this.value * other.value;
    return new PreciseDecimal(product / PreciseDecimal.MULTIPLIER);
  }

  public div(other: PreciseDecimal): PreciseDecimal {
    if (other.value === 0n) return new PreciseDecimal(0n);
    const scaled = (this.value * PreciseDecimal.MULTIPLIER) / other.value;
    return new PreciseDecimal(scaled);
  }

  public abs(): PreciseDecimal {
    return new PreciseDecimal(this.value < 0n ? -this.value : this.value);
  }

  public round(decimals: number = 2, mode: RoundingMode = 'HALF_UP'): PreciseDecimal {
    if (decimals >= 8) return this;
    const factor = 10n ** BigInt(8 - decimals);
    const half = factor / 2n;

    const isNeg = this.value < 0n;
    const absVal = isNeg ? -this.value : this.value;
    const intTrunc = absVal / factor;
    const remainder = absVal % factor;

    let roundedInt = intTrunc;
    if (mode === 'HALF_UP') {
      if (remainder >= half) {
        roundedInt += 1n;
      }
    } else {
      // HALF_EVEN (Banker's Rounding as mandated by EN 16931)
      if (remainder > half) {
        roundedInt += 1n;
      } else if (remainder === half) {
        if (intTrunc % 2n !== 0n) {
          roundedInt += 1n;
        }
      }
    }

    const finalVal = roundedInt * factor;
    return new PreciseDecimal(isNeg ? -finalVal : finalVal);
  }

  public toNumber(): number {
    const isNeg = this.value < 0n;
    const absVal = isNeg ? -this.value : this.value;
    const intPart = absVal / PreciseDecimal.MULTIPLIER;
    const fracPart = absVal % PreciseDecimal.MULTIPLIER;
    const num = Number(intPart) + Number(fracPart) / 100_000_000;
    return isNeg ? -num : num;
  }

  public toFixed(decimals: number = 2): string {
    return this.round(decimals, 'HALF_UP').toNumber().toFixed(decimals);
  }

  public diffAbs(other: PreciseDecimal): number {
    return this.sub(other).abs().toNumber();
  }

  public isZero(): boolean {
    return this.value === 0n;
  }
}
