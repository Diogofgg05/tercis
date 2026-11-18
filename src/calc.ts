import type { BudgetItem, CalculatedItem, Budget } from './types';
import { addCents, priceLine, roundDecimal, totalAfterTax } from './domain/decimal';

type PricedItem = BudgetItem | CalculatedItem;

// Shared with the quote editor. Half-away-from-zero decimal rounding matches
// PostgreSQL numeric, including negative midpoint values.
export const roundCurrency = roundDecimal;

export function calcItem(item: BudgetItem): CalculatedItem {
  const baseCost = item.unit_cost ?? item.unit_price ?? 0;
  const markup = item.margin ?? 0;
  const discount = item.discount ?? 0;
  const quantity = item.quantity ?? 0;
  const priced = priceLine(baseCost, markup, discount, quantity);
  return {
    ...item, unit_cost: baseCost,
    pvp: priced.pvp, finalPrice: priced.finalPrice,
    subtotal: priced.subtotal, totalPrice: priced.subtotal,
  };
}

export function grandTotal(items: PricedItem[]): number {
  return addCents(items.map(item => {
    if ('subtotal' in item && typeof item.subtotal === 'number') return item.subtotal;
    if ('totalPrice' in item && typeof item.totalPrice === 'number') return item.totalPrice;
    return calcItem(item).subtotal;
  }));
}

export function totalWithTax(
  budget: Pick<Budget, 'include_tax' | 'tax_rate'>,
  items: PricedItem[],
): number {
  return totalAfterTax(grandTotal(items), budget.tax_rate, budget.include_tax);
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
