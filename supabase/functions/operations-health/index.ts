// Scheduled, authenticated operational health probe.
// No customer identifiers or raw file paths are included in alerts.
import { createClient } from 'npm:@supabase/supabase-js@2';

const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{
  status,headers:{'content-type':'application/json','cache-control':'no-store'},
});
function env(name:string) {
  const value=Deno.env.get(name);
  if(!value)throw new Error(`Missing secret ${name}`);
  return value;
}
Deno.serve(async request=>{
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  try {
    const supplied=request.headers.get('x-tercis-worker-secret');
    if(!supplied||supplied!==env('OPS_HEALTH_WORKER_SECRET'))
      return json({error:'Unauthorized'},401);
    const client=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{
      auth:{persistSession:false,autoRefreshToken:false},
    });
    const {data,error}=await client.rpc('tercis_operational_health');
    if(error||!data||typeof data!=='object')
      throw error||new Error('Unable to query operational health');
    const counters=data as Record<string,number>;
    const alerts=Object.entries(counters)
      .filter(([_,value])=>typeof value==='number'&&value>0)
      .map(([key,value])=>({metric:key,count:value}));
    if(alerts.length>0) {
      const webhook=env('OPS_ALERT_WEBHOOK_URL');
      if(!webhook.startsWith('https://'))
        throw new Error('Alert receiver must use HTTPS');
      const response=await fetch(webhook,{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({
          text:'TERCIS operational alert: '+alerts.map(a=>`${a.metric}=${a.count}`).join(', '),
          source:'tercis',alerts,
        }),
        signal:AbortSignal.timeout(10000),
      });
      if(!response.ok)throw new Error(`Alert provider failed with HTTP ${response.status}`);
    }
    return json({status:alerts.length?'attention':'ok',metrics:counters,alerted:alerts.length});
  }catch(error){
    return json({error:error instanceof Error?error.message:'Health probe failed'},500);
  }
});
