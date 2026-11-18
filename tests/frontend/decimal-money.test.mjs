import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function loadTypeScript(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(output.outputText).toString('base64')}`);
}
const { roundDecimal, priceLine, addCents, totalAfterTax } =
  await loadTypeScript('../../src/domain/decimal.ts');

test('exact round-half-away-from-zero agrees with PostgreSQL numeric', () => {
  assert.equal(roundDecimal(1.005), 1.01);
  assert.equal(roundDecimal(2.675), 2.68);
  assert.equal(roundDecimal(-1.005), -1.01);
  assert.equal(roundDecimal(-2.675), -2.68);
  assert.equal(roundDecimal(0.00005, 4), 0.0001);
  assert.equal(roundDecimal(-0.00005, 4), -0.0001);
  assert.equal(roundDecimal(999999.995), 1000000);
});

test('SQL quote formula rounds unit price twice, then line cents', () => {
  assert.deepEqual(priceLine(0.29, 30, 5, 3), {
    pvp: 0.377,
    finalPrice: 0.3582,
    subtotal: 1.07,
  });
  assert.deepEqual(priceLine(123.45, 20, 5, 1.125), {
    pvp: 148.14,
    finalPrice: 140.733,
    subtotal: 158.32,
  });
  assert.equal(priceLine(1.005, 0, 0, 1).subtotal, 1.01);
});

test('line sum is exact in cents and tax is rounded once on net', () => {
  assert.equal(addCents([0.335, 0.335, 0.335]), 1.02);
  assert.equal(addCents([0.1, 0.2, 0.3]), 0.6);
  assert.equal(totalAfterTax(1.005, 23, true), 1.24);
  assert.equal(totalAfterTax(1, 23, true), 1.23);
  assert.equal(totalAfterTax(0.02, 23, false), 0.02);
});

test('cannot silently turn invalid monetary inputs into a valid zero', () => {
  assert.ok(Number.isNaN(roundDecimal(NaN)));
  assert.ok(Number.isNaN(roundDecimal(Infinity)));
  assert.ok(Number.isNaN(priceLine(NaN, 20, 0, 1).subtotal));
  assert.ok(Number.isNaN(addCents([0.5, Infinity])));
  assert.ok(Number.isNaN(totalAfterTax(1, NaN, true)));
});

test('valid large and very small decimals, scientific notation', () => {
  assert.equal(roundDecimal(1e-7, 8), 1e-7);
  assert.equal(roundDecimal(1e21, 2), 1e21);
  assert.equal(priceLine(0.0001, 0, 0, 1000).subtotal, 0.1);
});
