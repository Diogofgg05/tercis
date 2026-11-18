// End-to-end smoke test of a real ClamAV gateway, no Supabase/Storage writes.
// The EICAR string is an industry-standard harmless antivirus test signature.
function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing staging secret: ${name}`);
  return value;
}
const ref = required('TERCIS_STAGING_PROJECT_REF');
const confirmed = required('TERCIS_STAGING_CONFIRM');
if (!/^[a-z0-9]{20}$/.test(ref) || ref !== confirmed)
  throw new Error('Scanner smoke refused: staging project not explicitly confirmed');
const raw = required('CLAMAV_GATEWAY_URL');
const gateway = new URL(raw);
if (gateway.protocol !== 'https:' || gateway.username || gateway.password ||
    gateway.search || gateway.hash || gateway.pathname !== '/scan' ||
    gateway.toString() !== raw)
  throw new Error('Scanner smoke refused: exact HTTPS /scan endpoint required');
const secret = required('CLAMAV_GATEWAY_SECRET');
if (secret.length < 32) throw new Error('Scanner gateway secret is too short');
const EICAR = String.raw`X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*`;
async function scan(bytes, token, expectedHttp, expectedStatus) {
  const result = await fetch(gateway, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/octet-stream',
      'content-length': String(bytes.byteLength),
    },
    body: bytes,
    signal: AbortSignal.timeout(30000),
  });
  if (result.status !== expectedHttp)
    throw new Error(`ClamAV staging failed: expected HTTP ${expectedHttp}, got ${result.status}`);
  if (expectedStatus) {
    const data = await result.json();
    if (data.engine !== 'clamav' || data.status !== expectedStatus)
      throw new Error(`ClamAV returned wrong verdict: expected ${expectedStatus}`);
  }
}
async function main() {
  const clean = Buffer.from('Tercis harmless staging antivirus check.\n');
  await scan(clean, 'invalid-staging-probe', 401);
  await scan(clean, secret, 200, 'clean');
  await scan(Buffer.from(EICAR), secret, 200, 'infected');
  console.log('STAGING CLAMAV PASS: invalid token denied, clean allowed, EICAR detected');
}
main().catch(error => {
  console.error('STAGING CLAMAV FAILED:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
