import {createClient} from 'npm:@supabase/supabase-js@2.57.4';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response(null,{headers:cors});
 if(request.method!=='POST')return json({error:'Método indisponível.'},405);
 const authorization=request.headers.get('Authorization');
 if(!authorization?.startsWith('Bearer '))return json({error:'Inicia sessão para continuar.'},401);
 const url=Deno.env.get('SUPABASE_URL')!;
 const caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:identity,error:authError}=await caller.auth.getUser();
 if(authError||!identity.user)return json({error:'Sessão inválida.'},401);
 try{
  const body=await request.json();
  const name=typeof body.full_name==='string'?body.full_name.trim():'';
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  const role=body.role||'collaborator';
  if(name.length<2||name.length>120||email.length>254||!/^[^ @]+@[^ @]+[.][^ @]+$/.test(email)||!['collaborator','company_admin'].includes(role))return json({error:'Indica um nome, email e papel válidos.'},400);
  if(body.confirm_email_ownership!==true)return json({error:'Confirma que verificaste a identidade e o email deste colaborador.'},400);
  const {data:scope,error:scopeError}=await caller.rpc('tercis_provisioning_scope',{p_organization_id:body.organization_id||null});
  if(scopeError||!scope)return json({error:scopeError?.message||'Sem permissão para criar contas.'},403);
  if(role==='company_admin'&&!scope.platform_admin)return json({error:'Apenas o administrador da plataforma pode criar administradores de empresa.'},403);
  const password=typeof body.password==='string'?body.password:'';
  if(password.length<12||password.length>128)return json({error:'Escolhe uma palavra-passe entre 12 e 128 caracteres.'},400);
  const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:created,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:name}});
  if(createError||!created.user)return json({error:createError?.code==='email_exists'?'Este email já tem conta. As pessoas de outras empresas são adicionadas como contactos no chat.':createError?.message||'Não foi possível criar a conta.'},409);
  const userId=created.user.id;
  const {error:finishError}=await admin.rpc('tercis_complete_team_account',{p_actor:scope.actor_id,p_user_id:userId,p_organization_id:scope.organization_id,p_role:role,p_name:name});
  if(finishError){
   // Do not delete a provisioned account if only the completion response was lost.
   const {data:profile,error:readError}=await admin.from('profiles').select('active,organization_id,role').eq('id',userId).single();
   if(!readError&&profile?.active&&profile.organization_id===scope.organization_id&&profile.role===role)return json({id:userId,email,full_name:name,role});
   if(!readError&&!profile?.active){await admin.auth.admin.deleteUser(userId);}
   return json({error:'Não foi possível concluir a associação da conta. Contacta a administração da plataforma.'},500);
  }
  return json({id:userId,email,full_name:name,role});
 }catch{return json({error:'Pedido inválido ou serviço temporariamente indisponível.'},400);}
});
