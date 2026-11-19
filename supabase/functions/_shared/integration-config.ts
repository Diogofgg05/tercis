type Environment = (name:string)=>string|undefined;
export function emailConfiguration(get:Environment) {
  const enabled=get('TERCIS_EMAIL_ENABLED')==='true';
  const required=['RESEND_API_KEY','TERCIS_EMAIL_FROM','TERCIS_APP_URL','RESEND_WEBHOOK_SECRET'];
  const missing=required.filter(name=>!get(name)?.trim());
  if(get('TERCIS_APP_URL')) {
    try { if(new URL(get('TERCIS_APP_URL')!).protocol!=='https:')missing.push('TERCIS_APP_URL_HTTPS'); }
    catch { missing.push('TERCIS_APP_URL_HTTPS'); }
  }
  if(get('TERCIS_EMAIL_FROM')&&!/^[^<>\s]+@[^<>\s]+\.[^<>\s]+$/.test(get('TERCIS_EMAIL_FROM')!))missing.push('TERCIS_EMAIL_FROM_VALID');
  return {enabled,ready:enabled&&missing.length===0,missing,state:!enabled?'disabled':missing.length?'incomplete':'configured'};
}

export function integrationConfiguration(get:Environment) {
  return {
    email:emailConfiguration(get),
    // No payment provider has been selected or integrated. An environment
    // variable alone must never make checkout or charging available.
    billing:{enabled:false,ready:false,state:'disabled',provider:null},
    antivirus:{configured:Boolean(get('CLAMAV_GATEWAY_URL')&&get('CLAMAV_GATEWAY_SECRET'))},
  };
}
