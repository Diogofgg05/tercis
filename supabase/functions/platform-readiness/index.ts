import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
import {integrationConfiguration} from '../_shared/integration-config.ts';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response(null,{headers:cors});
  if(request.method!=='POST')return json({error:'Método indisponível.'},405);
  const authorization=request.headers.get('Authorization');
  if(!authorization?.startsWith('Bearer '))return json({error:'Sessão necessária.'},401);
  try {
    const caller=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:identity,error}=await caller.auth.getUser();
    if(error||!identity.user)return json({error:'Sessão inválida.'},401);
    // Uses the same database authority and verified AAL2 as account creation.
    const {data:scope,error:denied}=await caller.rpc('tercis_provisioning_scope');
    if(denied||!scope?.platform_admin)return json({error:'Acesso reservado ao proprietário com dois fatores.'},403);
    return json(integrationConfiguration(name=>Deno.env.get(name)));
  } catch { return json({error:'Não foi possível verificar os serviços.'},503); }
});
