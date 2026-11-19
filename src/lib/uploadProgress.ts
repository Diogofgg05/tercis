import {createClient} from '@supabase/supabase-js';
import {supabase,supabaseUrl,supabaseKey} from './supabase';

/** Keep the SDK's request format, auth headers and RLS. XHR supplies actual
 * transmitted-byte progress that the browser fetch API does not expose. */
export function uploadFetch(onProgress:(percent:number)=>void,signal?:AbortSignal):typeof fetch {
  return async(input,init)=>{
    const url=String(input instanceof Request?input.url:input);
    const method=init?.method||'GET';
    if(!/\/storage\/v1\/object\//.test(url)||!['POST','PUT'].includes(method.toUpperCase()))return fetch(input,init);
    return new Promise<Response>((resolve,reject)=>{
      const xhr=new XMLHttpRequest();
      const abort=()=>xhr.abort();
      const clean=()=>signal?.removeEventListener('abort',abort);
      xhr.open(method,url);xhr.timeout=120000;xhr.responseType='text';
      new Headers(init?.headers).forEach((value,key)=>xhr.setRequestHeader(key,value));
      xhr.upload.onprogress=event=>{if(event.lengthComputable)onProgress(Math.min(95,Math.round(event.loaded/event.total*95)));};
      xhr.onload=()=>{clean();resolve(new Response(xhr.responseText,{status:xhr.status,headers:{'Content-Type':xhr.getResponseHeader('Content-Type')||'application/json'}}));};
      xhr.onerror=()=>{clean();reject(new Error('Ligação interrompida durante o envio. Podes tentar novamente.'));};
      xhr.ontimeout=()=>{clean();reject(new Error('O envio excedeu o tempo limite. Tenta novamente.'));};
      xhr.onabort=()=>{clean();reject(new DOMException('Envio cancelado.','AbortError'));};
      if(signal?.aborted){clean();reject(new DOMException('Envio cancelado.','AbortError'));return;}
      signal?.addEventListener('abort',abort,{once:true});
      xhr.send(init?.body as XMLHttpRequestBodyInit|null|undefined);
    });
  };
}

export async function uploadPrivateFile(bucket:string,path:string,file:File,onProgress:(percent:number)=>void,signal?:AbortSignal){
  const {data:{session},error}=await supabase.auth.getSession();
  if(error||!session)throw new Error('A sessão expirou. Inicia sessão novamente.');
  const client=createClient(supabaseUrl,supabaseKey,{
    global:{headers:{Authorization:`Bearer ${session.access_token}`},fetch:uploadFetch(onProgress,signal)},
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  });
  const {error:failure}=await client.storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type});
  if(failure)throw failure;
}
