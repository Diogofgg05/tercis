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

const { createBudgetDraft, duplicateBudgetDraft } = await loadTypeScript('../../src/domain/budget-drafts.ts');
const { canWorkOnBudget, canEditBudget, canDeleteBudget, canDuplicateBudget } =
  await loadTypeScript('../../src/domain/budget-actions.ts');

const manager = {
  id: 'member-a', active: true, role: 'company_admin', collaborator_type: 'internal',
  organization_id: 'tenant-a',
};
const collaborator = {
  id: 'worker-a', active: true, role: 'collaborator', collaborator_type: 'internal',
  organization_id: 'tenant-a',
};
const otherTenant = {
  id: 'member-b', active: true, role: 'admin', collaborator_type: 'internal',
  organization_id: 'tenant-b',
};
const today = new Date(2026, 10, 18, 12);

function sampleQuote() {
  return {
    ...createBudgetDraft(manager, 'original-id', 'ORC-2026-001', today),
    name: 'Linha industrial',
    company_id: 'customer-id',
    assigned_to: collaborator.id,
    client_profile_id: 'customer-user',
    client_contact: 'Contact',
    client_email: 'customer@example.com',
    created_by: manager.id,
    status: 'enviado',
    sent_at: '2026-10-03T10:00:00Z',
    archived_at: '2026-11-01T10:00:00Z',
    archived_by: manager.id,
    version: 14,
    items: [{ id: 'line-original', budget_id: 'original-id', quantity: 2, unit_cost: 100 }],
  };
}

test('new document belongs to the tenant before saving', () => {
  const draft = createBudgetDraft(manager, 'new-id', 'ORC-2026-100', today);
  assert.equal(draft.organization_id, 'tenant-a');
  assert.equal(draft.created_by, manager.id);
  assert.equal(draft.version, 1);
  assert.equal(draft.date, '2026-11-18');
  assert.equal(draft.valid_until, '2026-12-18');
  assert.equal(canEditBudget(manager, draft), true);
  assert.equal(canEditBudget(otherTenant, draft), false);
});

test('company admin duplication preserves the customer but resets publication state', () => {
  const original = sampleQuote();
  const duplicate = duplicateBudgetDraft(original, manager, 'copy-id', 'ORC-2026-new', () => 'new-line', today);
  assert.equal(duplicate.organization_id, manager.organization_id);
  assert.equal(duplicate.company_id, original.company_id);
  assert.equal(duplicate.assigned_to, original.assigned_to);
  assert.equal(duplicate.client_profile_id, original.client_profile_id);
  assert.equal(duplicate.status, 'rascunho');
  assert.equal(duplicate.sent_at, null);
  assert.equal(duplicate.archived_at, null);
  assert.equal(duplicate.archived_by, null);
  assert.equal(duplicate.version, 1);
  assert.equal(duplicate.items[0].id, 'new-line');
  assert.equal(duplicate.items[0].budget_id, undefined);
  assert.equal(original.items[0].id, 'line-original');
  assert.equal(canEditBudget(manager, duplicate), true);
});

test('collaborator duplicates without inheriting customer links', () => {
  const duplicate = duplicateBudgetDraft(sampleQuote(), collaborator, 'worker-copy', 'REF', () => 'new-line', today);
  assert.equal(duplicate.company_id, null);
  assert.equal(duplicate.client_profile_id, null);
  assert.equal(duplicate.customer_type_id, null);
  assert.equal(duplicate.client_contact, '');
  assert.equal(duplicate.client_email, '');
  assert.equal(duplicate.assigned_to, collaborator.id);
  assert.equal(duplicate.created_by, collaborator.id);
  assert.equal(canEditBudget(collaborator, duplicate), true);
});

test('neither managers nor assigned collaborators can operate across tenants', () => {
  const original = sampleQuote();
  const foreignWorker = { ...collaborator, organization_id: 'tenant-b' };
  assert.equal(canWorkOnBudget(otherTenant, original), false);
  assert.equal(canDuplicateBudget(otherTenant, original), false);
  assert.equal(canDeleteBudget(otherTenant, { ...original, status: 'rascunho', archived_at: null, sent_at: null }), false);
  assert.equal(canWorkOnBudget(foreignWorker, original), false);
  assert.equal(canEditBudget(foreignWorker, { ...original, status: 'rascunho', archived_at: null, sent_at: null }), false);
});

test('deleted documents must be own-tenant unsent drafts', () => {
  const draft = { ...sampleQuote(), status: 'rascunho', sent_at: null, archived_at: null };
  assert.equal(canDeleteBudget(manager, draft), true);
  assert.equal(canDeleteBudget(collaborator, draft), false);
  assert.equal(canDeleteBudget({ ...manager, active: false }, draft), false);
  assert.equal(canDeleteBudget(manager, { ...draft, sent_at: '2026-01-01T00:00:00Z' }), false);
});

test('legacy demo without organization ids still permits locally-owned drafts', () => {
  const demo = { id: 'demo-admin', role: 'admin', active: true };
  const draft = createBudgetDraft(demo, 'demo-new', 'DEMO', today);
  assert.equal(canEditBudget(demo, draft), true);
});
