// Supabase Edge Function for Resend/Svix signed delivery events.
// Configure Resend webhook URL with events email.sent, email.delivered,
// email.bounced, email.failed, and store its whsec_ signing secret in Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';

const reply = (status: number, data: unknown) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json' },
});
function bytesFromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}
async function verify(request: Request, payload: string, secret: string): Promise<boolean> {
  const id = request.headers.get('svix-id') || '';
  const timestamp = request.headers.get('svix-timestamp') || '';
  const signatures = request.headers.get('svix-signature') || '';
  const time = Number(timestamp);
  if (!id || !Number.isFinite(time) || Math.abs(Date.now() / 1000 - time) > 300
    || !secret.startsWith('whsec_') || !signatures) return false;
  const key = await crypto.subtle.importKey('raw',
    bytesFromBase64(secret.slice('whsec_'.length)),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const message = new TextEncoder().encode(`${id}.${timestamp}.${payload}`);
  for (const entry of signatures.split(/\s+/)) {
    if (!entry.startsWith('v1,')) continue;
    try {
      if (await crypto.subtle.verify('HMAC',key,
        bytesFromBase64(entry.substring(3)),message)) return true;
    } catch { /* ignore malformed signatures */ }
  }
  return false;
}
Deno.serve(async request => {
  if (request.method !== 'POST') return reply(405, { error: 'Method not allowed' });
  const signingSecret = Deno.env.get('RESEND_WEBHOOK_SECRET');
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!signingSecret || !url || !serviceKey) return reply(503, { error: 'Webhook not configured' });
  const rawBody = await request.text();
  if (!(await verify(request,rawBody,signingSecret))) return reply(401,{ error:'Invalid signature' });
  let event: { type?: string; data?: { email_id?: string; id?: string } };
  try {
    event=JSON.parse(rawBody) as typeof event;
  } catch { return reply(400, { error: 'Invalid JSON' }); }
  if (!event.type || !['email.sent','email.delivered','email.bounced','email.failed'].includes(event.type))
    return reply(200,{ ignored: true });
  const providerId = event.data?.email_id || event.data?.id;
  const eventId = request.headers.get('svix-id');
  if (!providerId || !eventId) return reply(400,{error:'Missing provider/event ID'});
  const supabase=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await supabase.rpc('tercis_record_quote_email_event',{
    p_event_id:eventId,p_provider_id:providerId,p_event_type:event.type,
  });
  if (error) return reply(500,{error:'Unable to persist delivery event'});
  return reply(200,{received:true});
});
