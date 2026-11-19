import { supabase } from './supabase';

export type ChatContact = {id:string;full_name:string;job_title:string;organization_name:string;external:boolean;avatar_url:string};
export type DirectMessage = {id:string;sender_id:string;recipient_id:string;body:string;attachment_path:string|null;attachment_name:string|null;attachment_type:string|null;created_at:string;read_at:string|null};
export type CallRecord = {id:string;caller_id:string;callee_id:string;kind:'audio'|'video';status:'ringing'|'accepted'|'declined'|'ended';offer:RTCSessionDescriptionInit;answer:RTCSessionDescriptionInit|null;created_at:string;updated_at:string};
export const CHAT_BUCKET='tercis-chat-files';
export const FILE_TYPES=['application/pdf','image/png','image/jpeg','image/webp','text/plain'];
export function errorMessage(error:unknown,fallback='Não foi possível concluir a operação.'):string {
 return typeof error==='object' && error!==null && 'message' in error && typeof error.message==='string' ? error.message : fallback;
}
export function initials(name:string):string {return name.trim().split(/\s+/).slice(0,2).map(p=>p[0]).join('').toLocaleUpperCase('pt-PT')||'?';}
export async function downloadChatFile(message:DirectMessage) {
 if(!message.attachment_path)return;
 const {data,error}=await supabase.storage.from(CHAT_BUCKET).download(message.attachment_path);
 if(error)throw error;
 const url=URL.createObjectURL(data);
 const link=document.createElement('a');link.href=url;link.download=(message.attachment_name||'anexo').replace(/[\\/]/g,'_');
 document.body.append(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export async function normalizeProfileImage(file:File):Promise<Blob> {
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)
  throw new Error('Escolhe uma imagem JPG, PNG ou WebP até 5 MB.');
 const bitmap=await createImageBitmap(file);
 try {
  const size=Math.min(640,Math.max(bitmap.width,bitmap.height));
  const ratio=size/Math.max(bitmap.width,bitmap.height);
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
  canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);
  return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Não foi possível preparar a imagem.')),'image/webp',0.85));
 } finally {bitmap.close();}
}
