import re

# 1. ISO 7064 Mod 97-10 Checksum (IBAN)
def validate_iban(iban_str: str) -> bool:
    clean = re.sub(r"[\s-]", "", iban_str.upper())
    if not re.match(r"^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$", clean):
        return False

    rearranged = clean[4:] + clean[:4]
    numeric = ""
    for ch in rearranged:
        if ch.isalpha():
            numeric += str(ord(ch) - 55)
        else:
            numeric += ch

    try:
        return int(numeric) % 97 == 1
    except ValueError:
        return False


# 2. German VAT (USt-IdNr) ISO 7064 Mod 11, 10
def validate_german_vat(vat_str: str) -> bool:
    clean = re.sub(r"[\s-]", "", vat_str.upper())
    if not re.match(r"^DE[0-9]{9}$", clean):
        return False
    digits = clean[2:]

    product = 10
    for i in range(8):
        d = int(digits[i])
        s = (d + product) % 10
        if s == 0:
            s = 10
        product = (2 * s) % 11

    check = 11 - product
    if check == 10:
        check = 0
    if check == 11:
        check = 0

    return check == int(digits[8])


# 3. French TVA Check
def validate_french_vat(vat_str: str) -> bool:
    clean = re.sub(r"[\s-]", "", vat_str.upper())
    if not re.match(r"^FR[A-Z0-9]{2}[0-9]{9}$", clean):
        return False
    key = clean[2:4]
    siren = clean[4:]
    if key.isdigit():
        return int(key) == (12 + 3 * (int(siren) % 97)) % 97
    return True


# 4. UK VAT (GB + 9 digits) Mod 97 / Mod 9755
def validate_uk_vat(vat_str: str) -> bool:
    clean = re.sub(r"[\s-]", "", vat_str.upper())
    if not re.match(r"^GB[0-9]{9}$", clean):
        return False
    digits = [int(ch) for ch in clean[2:]]
    weights = [8, 7, 6, 5, 4, 3, 2]

    s = sum(digits[i] * weights[i] for i in range(7))
    check = digits[7] * 10 + digits[8]
    c1 = (97 - (s % 97)) % 97
    c2 = (c1 + 55) % 97
    return check in (c1, c2)


# 5. US EIN Prefix Validation
VALID_EIN_PREFIXES = {
    "01", "02", "03", "04", "05", "06", "10", "11", "12", "13", "14", "15", "16",
    "20", "21", "22", "23", "24", "25", "26", "27", "30", "31", "32", "33", "34",
    "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47",
    "48", "50", "51", "52", "53", "54", "55", "56", "57", "58", "59", "60", "61",
    "62", "63", "64", "65", "66", "67", "68", "71", "72", "73", "74", "75", "76",
    "77", "80", "81", "82", "83", "84", "85", "86", "87", "88", "90", "91", "92",
    "93", "94", "95", "98", "99"
}

def validate_us_ein(ein_str: str) -> bool:
    clean = re.sub(r"[\s-]", "", ein_str)
    if not re.match(r"^[0-9]{9}$", clean):
        return False
    return clean[:2] in VALID_EIN_PREFIXES


# 6. Australian ABN Modulo 89
def validate_abn(abn_str: str) -> bool:
    clean = re.sub(r"[\s-]", "", abn_str)
    if not re.match(r"^[0-9]{11}$", clean):
        return False
    digits = [int(c) for c in clean]
    weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]

    s = (digits[0] - 1) * weights[0] + sum(digits[i] * weights[i] for i in range(1, 11))
    return s % 89 == 0
