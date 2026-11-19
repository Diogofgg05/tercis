/**
 * Decimal arithmetic for quote calculations.
 *
 * Inputs arrive from JSON as JavaScript numbers. Converting their shortest
 * decimal representation to a rational BEFORE multiplication avoids binary
 * floating-point rounding (for example 1.005 * 100 -> 100.49999...).
 * PostgreSQL numeric rounds half away from zero; Math.round does not for
 * negative midpoint values.
 */
type Fraction = { n: bigint; d: bigint };
const ONE: Fraction = { n: 1n, d: 1n };
const HUNDRED: Fraction = { n: 100n, d: 1n };
const TEN = 10n;

function fraction(value: number): Fraction {
  if (!Number.isFinite(value)) throw new RangeError('O valor tem de ser finito.');
  const input = value.toString().toLowerCase();
  const [mantissa, exponentText = '0'] = input.split('e');
  const exponent = Number(exponentText);
  const negative = mantissa.startsWith('-');
  const unsigned = mantissa.replace(/^[+-]/, '');
  const point = unsigned.indexOf('.');
  const decimalPlaces = point < 0 ? 0 : unsigned.length - point - 1;
  const digits = unsigned.replace('.', '');
  const shift = exponent - decimalPlaces;
  const n = BigInt(digits || '0') * (negative ? -1n : 1n);
  if (shift >= 0) return { n: n * TEN ** BigInt(shift), d: 1n };
  return { n, d: TEN ** BigInt(-shift) };
}

function multiply(a: Fraction, b: Fraction): Fraction {
  return { n: a.n * b.n, d: a.d * b.d };
}

function add(a: Fraction, b: Fraction): Fraction {
  return { n: a.n * b.d + b.n * a.d, d: a.d * b.d };
}

function subtract(a: Fraction, b: Fraction): Fraction {
  return { n: a.n * b.d - b.n * a.d, d: a.d * b.d };
}

function percent(value: number): Fraction {
  const n = fraction(value);
  return { n: n.n, d: n.d * HUNDRED.n };
}

/** Rounds rational x to an integer of the requested power of ten. */
function scaledInt(x: Fraction, places: number): bigint {
  if (!Number.isInteger(places) || places < 0 || places > 12) {
    throw new RangeError('Precisão decimal inválida.');
  }
  const scaled = x.n * TEN ** BigInt(places);
  const positive = scaled < 0n ? -scaled : scaled;
  const quotient = positive / x.d;
  const remainder = positive % x.d;
  const rounded = quotient + (2n * remainder >= x.d ? 1n : 0n);
  return scaled < 0n ? -rounded : rounded;
}

function fromScaled(amount: bigint, places: number): Fraction {
  return { n: amount, d: TEN ** BigInt(places) };
}

function toNumber(amount: bigint, places: number): number {
  // Convert to a decimal string before Number(). Dividing a large Number by
  // 100 can introduce an EXTRA rounding error (e.g. 1e21 -> 999999999999999900000).
  const negative = amount < 0n;
  const digits = (negative ? -amount : amount).toString().padStart(places + 1, '0');
  const formatted = places === 0 ? digits
    : digits.slice(0, -places) + '.' + digits.slice(-places);
  const result = Number((negative ? '-' : '') + formatted);
  return Number.isFinite(result) ? result : NaN;
}

export function roundDecimal(value: number, places = 2): number {
  if (!Number.isFinite(value)) return NaN;
  const rounded = scaledInt(fraction(value), places);
  return toNumber(rounded, places);
}

/**
 * Mirrors PostgreSQL:
 * round(cost * (1+margin/100),4)
 * -> round(unit * (1-discount/100),4)
 * -> round(discountedUnit * quantity,2).
 */
export function priceLine(
  cost: number,
  margin: number,
  discount: number,
  quantity: number,
): { pvp: number; finalPrice: number; subtotal: number } {
  if (![cost, margin, discount, quantity].every(Number.isFinite)) {
    return { pvp: NaN, finalPrice: NaN, subtotal: NaN };
  }
  const marked = multiply(fraction(cost), add(ONE, percent(margin)));
  const pvp4 = scaledInt(marked, 4);
  const discounted = multiply(fromScaled(pvp4, 4), subtract(ONE, percent(discount)));
  const final4 = scaledInt(discounted, 4);
  const line2 = scaledInt(multiply(fromScaled(final4, 4), fraction(quantity)), 2);
  return { pvp: toNumber(pvp4, 4), finalPrice: toNumber(final4, 4), subtotal: toNumber(line2, 2) };
}

/** Cents are added exactly before applying VAT to the aggregate net value. */
export function addCents(lines: number[]): number {
  if (lines.some(value => !Number.isFinite(value))) return NaN;
  const cents = lines.reduce((total, value) => total + scaledInt(fraction(value), 2), 0n);
  return toNumber(cents, 2);
}

export function totalAfterTax(net: number, taxRate: number, includeTax: boolean): number {
  if (!Number.isFinite(net) || !Number.isFinite(taxRate)) return NaN;
  const netCents = scaledInt(fraction(net), 2);
  if (!includeTax) return toNumber(netCents, 2);
  const taxCents = scaledInt(multiply(fromScaled(netCents, 2), percent(taxRate)), 2);
  return toNumber(netCents + taxCents, 2);
}
