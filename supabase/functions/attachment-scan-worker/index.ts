// Authenticated scheduled Edge worker. Uses a SEPARATE private ClamAV
// gateway; no file is marked clean unless the gateway returns an explicit
// malware-engine verdict. Missing scanner config is FAIL-CLOSED.
import { createClient } from 'npm:@supabase/supabase-js@2';

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required secret: ${name}`);
  return value;
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: {'content-type':'application/json'},
});
type Claimed = {id:string;file_path:string;mime_type:string;size_bytes:number};
async function hasExpectedSignature(file: Blob, mime: string):Promise<boolean> {
  const signature=new Uint8Array(await file.slice(0,16).arrayBuffer());
  const text=String.fromCharCode(...signature);
  switch(mime) {
    case 'application/pdf':return text.startsWith('%PDF-');
    case 'image/png':return [137,80,78,71,13,10,26,10]
      .every((byte,i)=>signature[i]===byte);
    case 'image/jpeg':return signature[0]===255&&signature[1]===216&&signature[2]===255;
    case 'image/webp':return text.startsWith('RIFF')&&text.slice(8,12)==='WEBP';
    case 'text/plain':return !signature.includes(0);
    default:return false;
  }
}
Deno.serve(async request => {
  if(request.method !== 'POST') return json({error:'Method not allowed'},405);
  try {
    if(request.headers.get('x-tercis-worker-secret') !== env('ATTACHMENT_SCAN_WORKER_SECRET'))
      return json({error:'Unauthorized'},401);

    const gateway = new URL(env('CLAMAV_GATEWAY_URL'));
    if(gateway.protocol !== 'https:')
      throw new Error('ClamAV gateway must be accessed over HTTPS');
    const supabase = createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{
      auth:{persistSession:false,autoRefreshToken:false},
    });
    const {data,error}=await supabase.rpc('tercis_claim_attachment_scans',{p_limit:5});
    if(error) throw error;
    const results: {id:string;status:string}[]=[];
    for(const job of (data||[]) as Claimed[]) {
      let verdict: 'clean'|'infected'|'error'='error';
      let detail='Scanner response unavailable';
      try {
        if(job.size_bytes<1 || job.size_bytes>10*1024*1024)
          throw new Error('Attachment size is outside allowed limits');
        const {data:file,error:downloadError}=await supabase.storage
          .from('tercis-private-attachments').download(job.file_path);
        if(downloadError || !file) throw downloadError || new Error('Cannot download object');
        if(file.size !== Number(job.size_bytes))
          throw new Error('Attachment metadata size differs from Storage object');
        if(!(await hasExpectedSignature(file,job.mime_type)))
          throw new Error('Attachment content does not match declared MIME type');
        const res=await fetch(gateway.toString(),{
          method:'POST',
          headers:{
            'authorization':`Bearer ${env('CLAMAV_GATEWAY_SECRET')}`,
            'content-type':'application/octet-stream',
            'x-tercis-attachment-id':job.id,
          },
          body:file,
          signal:AbortSignal.timeout(30000),
        });
        if(!res.ok) throw new Error(`Scanner unavailable: HTTP ${res.status}`);
        const response=await res.json() as {status?:string;signature?:string;engine?:string};
        if(response.engine !== 'clamav' ||
           !['clean','infected'].includes(response.status||''))
          throw new Error('Scanner returned invalid/missing ClamAV verdict');
        verdict=response.status as 'clean'|'infected';
        detail=(response.signature || (verdict==='clean'?'OK':'Malware detected')).slice(0,255);
      } catch (failure) {
        detail=failure instanceof Error?failure.message.slice(0,255):'Antivirus scan failed';
      }
      const {data:updated,error:saveError}=await supabase.rpc('tercis_complete_attachment_scan',{
        p_id:job.id,p_result:verdict,p_detail:detail,
      });
      if(saveError || updated !== true)
        throw saveError || new Error('Scanner verdict was not recorded');
      results.push({id:job.id,status:verdict});
    }
    return json({processed:results.length,results});
  } catch(error) {
    return json({error:error instanceof Error?error.message:'Scanner worker failure'},500);
  }
});
