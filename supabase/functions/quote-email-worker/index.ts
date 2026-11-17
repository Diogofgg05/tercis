// Supabase Edge Function: POST /functions/v1/quote-email-worker
// Invoke via an authenticated scheduler with X-Tercis-Worker-Secret.
// Uses service credentials ONLY inside the trusted Edge runtime.
import { createClient } from 'npm:@supabase/supabase-js@2';

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required secret ${name}`);
  return value;
}
function htmlEscape(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char] || char);
}
function describeQuote(snapshot: Record<string, unknown>): { subject: string; html: string } {
  const header = (snapshot.budget ?? {}) as Record<string, unknown>;
  const items = Array.isArray(snapshot.items) ? snapshot.items as Record<string, unknown>[] : [];
  const includeTax = header.include_tax === true;
  const taxRate = Math.max(0, Math.min(100, Number(header.tax_rate) || 0));
  // Match src/calc.ts (four decimal sale prices, cent-rounded line totals,
  // cent-rounded VAT) so customers cannot receive a different email amount.
  const round = (n: number, decimals = 2) => {
    const factor = 10 ** decimals;
    return Math.round((n + Number.EPSILON) * factor) / factor;
  };
  const rows = items.map(item => {
    const cost = Math.max(0, Number(item.unit_cost) || 0);
    const markup = Math.max(0, Number(item.margin) || 0);
    const discount = Math.max(0, Math.min(100, Number(item.discount) || 0));
    const qty = Math.max(0, Number(item.quantity) || 0);
    const salePrice = round(round(cost * (1 + markup / 100), 4) * (1 - discount / 100), 4);
    const subtotal = round(qty * salePrice);
    return { description: htmlEscape(item.description), qty, subtotal };
  });
  const total = round(rows.reduce((sum, row) => sum + row.subtotal, 0));
  const gross = round(total + (includeTax ? round(total * taxRate / 100) : 0));
  const money = (value: number) => new Intl.NumberFormat('pt-PT', {
    style: 'currency', currency: 'EUR',
  }).format(value);
  const reference = htmlEscape(header.ref);
  const name = htmlEscape(header.name);
  const valid = htmlEscape(header.valid_until);
  const appUrl = env('TERCIS_APP_URL');
  return {
    subject: `Proposta ${String(header.ref || '')} — Tercis`,
    html: `<main style="font-family:system-ui,sans-serif;max-width:640px;margin:auto">
      <h1>Proposta comercial ${reference}</h1><p>${name}</p>
      <p>Válida até: ${valid}</p>
      <table style="width:100%;border-collapse:collapse">
      <thead><tr><th align="left">Descrição</th><th>Qtd.</th><th align="right">Subtotal</th></tr></thead>
      <tbody>${rows.map(item => `<tr><td>${item.description}</td><td align="center">${item.qty}</td>
      <td align="right">${money(item.subtotal)}</td></tr>`).join('')}</tbody></table>
      <p><strong>Total: ${money(gross)}</strong></p>
      <p>Para consultar ou responder à proposta, entre no portal da sua empresa:
      <a href="${htmlEscape(appUrl)}">Abrir portal Tercis</a></p>
      <p style="color:#666">Este email apresenta apenas preços finais; não inclui custos de fornecedor.</p></main>`,
  };
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json' },
});

Deno.serve(async request => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const supplied = request.headers.get('x-tercis-worker-secret');
    if (!supplied || supplied !== env('EMAIL_WORKER_SECRET')) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.rpc('tercis_claim_quote_email_jobs', { p_limit: 10 });
    if (error) throw error;
    const jobs = Array.isArray(data) ? data as Record<string, unknown>[] : [];
    const results: { id: string; status: string }[] = [];
    for (const job of jobs) {
      const id = String(job.id);
      try {
        if (!job.snapshot || typeof job.snapshot !== 'object') {
          throw new Error('Missing immutable published snapshot');
        }
        const { subject, html } = describeQuote(job.snapshot as Record<string, unknown>);
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env('RESEND_API_KEY')}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': `tercis-quote-${id}`,
          },
          body: JSON.stringify({
            from: env('TERCIS_EMAIL_FROM'),
            to: [String(job.recipient_email)],
            subject, html,
          }),
          signal: AbortSignal.timeout(15000),
        });
        const body = await res.json() as { id?: string; message?: string };
        if (!res.ok || !body.id) throw new Error(`Provider HTTP ${res.status}: ${body.message || 'Unknown error'}`);
        // The signed delivery webhook may have arrived BEFORE this response.
        // Register the provider ID and reconcile pending events atomically.
        const { data: currentState, error: updateError } = await supabase.rpc(
          'tercis_register_quote_email_provider', {
            p_outbox_id: id, p_provider_id: body.id,
          },
        );
        if (updateError) throw updateError;
        results.push({ id, status: String(currentState || 'accepted') });
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 400) : 'Delivery error';
        const attempt = Math.max(1, Number(job.attempt_count) || 1);
        const retryAt = new Date(Date.now() + Math.min(3600000, 30000 * 2 ** attempt)).toISOString();
        // Never downgrade a job that was already accepted/delivered by
        // the provider. Only retry work that has no provider identifier.
        await supabase.from('quote_email_outbox').update({
          state: 'failed', last_error: message, next_attempt_at: retryAt,
          updated_at: new Date().toISOString(),
        }).eq('id', id).eq('state', 'processing').is('provider_id', null);
        results.push({ id, status: 'failed' });
      }
    }
    return json({ processed: results.length, results });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Worker failure' }, 500);
  }
});
