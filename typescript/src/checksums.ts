/**
 * 0-Dependency Checksum Validators for IBAN, VAT, EIN, ABN.
 */

// 1. ISO 7064 Mod 97-10 Checksum (IBAN)
export function validateIBAN(ibanStr: string): boolean {
  const clean = ibanStr.toUpperCase().replace(/[\s-]/g, '');
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(clean)) {
    return false;
  }

  // Move first 4 characters to end
  const rearranged = clean.slice(4) + clean.slice(0, 4);

  // Convert letters to numbers A=10 ... Z=35
  let numeric = '';
  for (let i = 0; i < rearranged.length; i++) {
    const code = rearranged.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      numeric += (code - 55).toString();
    } else {
      numeric += rearranged[i];
    }
  }

  // Large integer Modulo 97 using BigInt
  try {
    return BigInt(numeric) % 97n === 1n;
  } catch {
    return false;
  }
}

// 2. German VAT (USt-IdNr) ISO 7064 Mod 11, 10
export function validateGermanVAT(vatStr: string): boolean {
  const clean = vatStr.toUpperCase().replace(/[\s-]/g, '');
  if (!/^DE[0-9]{9}$/.test(clean)) return false;
  const digits = clean.slice(2);

  let product = 10;
  for (let i = 0; i < 8; i++) {
    const d = parseInt(digits[i], 10);
    let sum = (d + product) % 10;
    if (sum === 0) sum = 10;
    product = (2 * sum) % 11;
  }

  let checkDigit = 11 - product;
  if (checkDigit === 10) checkDigit = 0;
  if (checkDigit === 11) checkDigit = 0;

  return checkDigit === parseInt(digits[8], 10);
}

// 3. French TVA (FR + 2 chars + 9 SIREN digits)
export function validateFrenchVAT(vatStr: string): boolean {
  const clean = vatStr.toUpperCase().replace(/[\s-]/g, '');
  if (!/^FR[A-Z0-9]{2}[0-9]{9}$/.test(clean)) return false;

  const key = clean.slice(2, 4);
  const siren = clean.slice(4);

  if (/^[0-9]{2}$/.test(key)) {
    const keyNum = parseInt(key, 10);
    const sirenNum = parseInt(siren, 10);
    const expected = (12 + 3 * (sirenNum % 97)) % 97;
    return keyNum === expected;
  }
  return true; // Simplified for alphanumeric keys
}

// 4. UK VAT (GB + 9 digits) Modulo 97 / Modulo 9755
export function validateUKVAT(vatStr: string): boolean {
  const clean = vatStr.toUpperCase().replace(/[\s-]/g, '');
  if (!/^GB[0-9]{9}$/.test(clean)) return false;
  const digits = clean.slice(2).split('').map(Number);

  const weights = [8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    sum += digits[i] * weights[i];
  }

  const checkDigits = digits[7] * 10 + digits[8];
  let check1 = (97 - (sum % 97)) % 97;
  let check2 = (check1 + 55) % 97;

  return checkDigits === check1 || checkDigits === check2;
}

// 5. US EIN (9 digits with valid IRS Campus Prefixes)
const VALID_EIN_PREFIXES = new Set([
  '01', '02', '03', '04', '05', '06', '10', '11', '12', '13', '14', '15', '16',
  '20', '21', '22', '23', '24', '25', '26', '27', '30', '31', '32', '33', '34',
  '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47',
  '48', '50', '51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61',
  '62', '63', '64', '65', '66', '67', '68', '71', '72', '73', '74', '75', '76',
  '77', '80', '81', '82', '83', '84', '85', '86', '87', '88', '90', '91', '92',
  '93', '94', '95', '98', '99'
]);

export function validateUSEIN(einStr: string): boolean {
  const clean = einStr.replace(/[\s-]/g, '');
  if (!/^[0-9]{9}$/.test(clean)) return false;
  const prefix = clean.slice(0, 2);
  return VALID_EIN_PREFIXES.has(prefix);
}

// 6. Australian Business Number (ABN) Weighting Modulo 89
export function validateABN(abnStr: string): boolean {
  const clean = abnStr.replace(/[\s-]/g, '');
  if (!/^[0-9]{11}$/.test(clean)) return false;
  const digits = clean.split('').map(Number);
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

  let sum = (digits[0] - 1) * weights[0];
  for (let i = 1; i < 11; i++) {
    sum += digits[i] * weights[i];
  }
  return sum % 89 === 0;
}
