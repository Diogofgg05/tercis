import type { BudgetItem, CalculatedItem, Budget } from './types';

type PricedItem = BudgetItem | CalculatedItem;

// Quote monetary rule, shared by budget lists, PDF and spreadsheet:
// quantity up to 3 decimal places, sale unit price 4 decimal places,
// each line subtotal rounded half up to EUR cents, VAT on summed net.
export const roundCurrency = (value: number, decimals = 2): number => {
  if (!Number.isFinite(value)) return NaN;
  const multiplier = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
};

export function calcItem(item: BudgetItem): CalculatedItem {
  const baseCost = item.unit_cost ?? item.unit_price ?? 0;
  const markup = item.margin ?? 0;
  const discount = item.discount ?? 0;
  const quantity = item.quantity ?? 0;
  const pvp = roundCurrency(baseCost * (1 + markup / 100), 4);
  const finalPrice = roundCurrency(pvp * (1 - discount / 100), 4);
  const subtotal = roundCurrency(finalPrice * quantity);
  return { ...item, unit_cost: baseCost, pvp, finalPrice, subtotal, totalPrice: subtotal };
}

export function grandTotal(items: PricedItem[]): number {
  return roundCurrency(items.reduce((sum, item) => {
    if ('subtotal' in item && typeof item.subtotal === 'number') return sum + item.subtotal;
    if ('totalPrice' in item && typeof item.totalPrice === 'number') return sum + item.totalPrice;
    return sum + calcItem(item).subtotal;
  }, 0));
}

export function totalWithTax(budget: Budget, items: PricedItem[]): number {
  const base = grandTotal(items);
  const tax = budget.include_tax ? roundCurrency(base * budget.tax_rate / 100) : 0;
  return roundCurrency(base + tax);
}

// This metric is average *markup on supplier cost*, not gross profit margin.
export function avgMargin(items: BudgetItem[]): number {
  if (items.length === 0) return 0;
  return items.reduce((s, i) => s + (i.margin ?? 0), 0) / items.length;
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

export function formatPercent(value: number, digits = 1): string {
  return value.toFixed(digits) + '%';
}
