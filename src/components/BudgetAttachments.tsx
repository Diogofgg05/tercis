import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Eye, FileText, FileUp, Image, RefreshCw, UploadCloud, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { WorkspaceDialog } from './WorkspaceDialog';
import type { Budget } from '../types';

type PrivateAttachment = {
  id: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  scan_status: 'pending'|'scanning'|'clean'|'infected'|'error';
};
type Preview = { url:string; name:string; budgetId:string };
const BUCKET = 'tercis-private-attachments';
const ACCEPTED = ['application/pdf','image/png','image/jpeg','image/webp','text/plain'];
const MAX_BYTES = 10 * 1024 * 1024;
const LABELS: Record<PrivateAttachment['scan_status'],string> = {
  pending:'Em quarentena',
  scanning:'A analisar',
  clean:'Validado',
  infected:'Bloqueado',
  error:'Erro na análise',
};

/** Images can be previewed locally before upload and after a CLEAN antivirus
 * verdict. Files remain private; no signed public URL is generated. */
export function BudgetAttachments({ budget }: { budget: Budget }) {
  const { profile, demoMode } = useAuth();
  const [rows,setRows] = useState<{budgetId:string;items:PrivateAttachment[]}>({
    budgetId:budget.id,items:[],
  });
  const items=rows.budgetId===budget.id?rows.items:[];
  const requestRef=useRef(0);
  const currentBudgetRef=useRef(budget.id);
  currentBudgetRef.current=budget.id;
  const [loading,setLoading] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [pendingSelection,setPendingSelection] =
    useState<{budgetId:string;file:File}|null>(null);
  const pending=pendingSelection?.budgetId===budget.id?pendingSelection.file:null;
  const setPending=(file:File|null)=>
    setPendingSelection(file?{budgetId:budget.id,file}:null);
  const [localPreview,setLocalPreview] = useState('');
  const [viewing,setViewing] = useState<Preview|null>(null);
  const activeViewing=viewing?.budgetId===budget.id?viewing:null;
  const [dragging,setDragging] = useState(false);
  const staff = Boolean(profile?.active && (
    profile.role === 'admin' || profile.role === 'company_admin'
    || (profile.role === 'collaborator' && profile.collaborator_type === 'internal')
  ));
  const canUpload = Boolean(staff && !demoMode && budget.organization_id && budget.company_id);

  const refresh = useCallback(async () => {
    if (!staff || demoMode || !budget.organization_id) return;
    const requestId=++requestRef.current;
    setLoading(true);
    try {
      const { data, error: failure } = await supabase.from('budget_attachments')
        .select('id,file_name,file_path,mime_type,size_bytes,created_at,scan_status')
        .eq('budget_id', budget.id)
        .order('created_at', { ascending: false }).limit(100);
      if (failure) throw failure;
      if(requestId===requestRef.current)
        setRows({budgetId:budget.id,items:(data||[]) as PrivateAttachment[]});
    } catch (cause) {
      if(requestId===requestRef.current)
        setError(cause instanceof Error ? cause.message : 'Erro ao consultar anexos.');
    } finally {
      if(requestId===requestRef.current)setLoading(false);
    }
  }, [budget.id, budget.organization_id, demoMode, staff]);

  // Cancel the UI impact of responses started under an earlier budget,
  // even when the old database request itself cannot be aborted.
  useEffect(()=>{
    void refresh();
    return ()=>{requestRef.current+=1;};
  },[refresh]);

  useEffect(()=>{
    setPendingSelection(null);
    setViewing(null);
    setNotice('');
    setError('');
    setDragging(false);
  },[budget.id]);

  useEffect(() => {
    setLocalPreview('');
    if (!pending || !pending.type.startsWith('image/')) return;
    const url = URL.createObjectURL(pending);
    setLocalPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pending]);

  useEffect(() => {
    if (!viewing) return;
    const url = viewing.url;
    return () => URL.revokeObjectURL(url);
  }, [viewing]);

  function selectFile(file: File | undefined) {
    if (!file || busy || !canUpload) return;
    setError('');setNotice('');
    if (!ACCEPTED.includes(file.type) || file.size < 1 || file.size > MAX_BYTES) {
      setPending(null);
      setError('Escolha PDF, PNG, JPEG, WebP ou TXT, com tamanho até 10 MB.');
      return;
    }
    setPending(file);
  }

  async function upload() {
    const file=pending;
    if (!file || !profile || !canUpload || !budget.organization_id || !budget.company_id || busy) return;
    // Validate again when committing, even if the file was selected earlier.
    if (!ACCEPTED.includes(file.type) || file.size < 1 || file.size > MAX_BYTES) {
      setError('Tipo ou tamanho do ficheiro inválido.');return;
    }
    setBusy(true);setError('');setNotice('');
    const originatingBudgetId=budget.id;
    const safeName = file.name.normalize('NFKC')
      .replace(/[^a-zA-Z0-9._-]+/g,'_').slice(-90) || 'anexo';
    const path = `${budget.organization_id}/${budget.id}/${crypto.randomUUID()}-${safeName}`;
    try {
      const { error: storageError } = await supabase.storage.from(BUCKET)
        .upload(path,file,{ upsert:false, contentType:file.type });
      if (storageError) throw storageError;
      const { error: metadataError } = await supabase.from('budget_attachments').insert({
        budget_id:budget.id, company_id:budget.company_id,
        uploaded_by:profile.id, file_name:file.name, file_path:path,
        mime_type:file.type, size_bytes:file.size, visibility:'internal',
      });
      if (metadataError) {
        // The bucket is immutable by design; service-only orphan inventory
        // reconciles files uploaded before a failed metadata INSERT.
        throw new Error('Ficheiro recebido em quarentena sem associação ao orçamento. A manutenção deverá reconciliar o anexo pendente.');
      }
      if(currentBudgetRef.current===originatingBudgetId){
        setPending(null);
        setNotice('Ficheiro enviado. Está em quarentena até a análise antivírus terminar.');
        await refresh();
      }
    } catch (cause) {
      if(currentBudgetRef.current===originatingBudgetId)
        setError(cause instanceof Error ? cause.message : 'Não foi possível enviar o ficheiro.');
    } finally {setBusy(false);}

  }

  async function downloadBlob(item:PrivateAttachment): Promise<Blob> {
    if (item.scan_status !== 'clean') throw new Error('Este anexo ainda não foi validado.');
    const {data,error:failure} = await supabase.storage.from(BUCKET).download(item.file_path);
    if (failure || !data) throw failure || new Error('Ficheiro indisponível.');
    return data;
  }

  async function downloadPrivate(item:PrivateAttachment) {
    const originatingBudgetId=budget.id;
    setError('');
    try {
      const blob=await downloadBlob(item);
      if(currentBudgetRef.current!==originatingBudgetId)return;
      const objectUrl=URL.createObjectURL(blob);
      const link=document.createElement('a');
      link.href=objectUrl;
      link.download=item.file_name.replace(/[\\/]/g,'_').slice(0,120)||'anexo';
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(()=>URL.revokeObjectURL(objectUrl),30000);
    } catch(cause) {
      if(currentBudgetRef.current===originatingBudgetId)
        setError(cause instanceof Error?cause.message:'Não foi possível descarregar.');
    }
  }

  async function showImage(item:PrivateAttachment) {
    if (item.scan_status!=='clean' || !item.mime_type.startsWith('image/'))return;
    setError('');
    try {
      const blob=await downloadBlob(item);
      if (!['image/png','image/jpeg','image/webp'].includes(blob.type) && !['image/png','image/jpeg','image/webp'].includes(item.mime_type)) {
        throw new Error('Pré-visualização não suportada para este formato.');
      }
      const url=URL.createObjectURL(blob);
      if(currentBudgetRef.current===budget.id)
        setViewing({url,name:item.file_name,budgetId:budget.id});
      else URL.revokeObjectURL(url);
    } catch(cause) {
      if(currentBudgetRef.current===budget.id)
        setError(cause instanceof Error?cause.message:'Não foi possível pré-visualizar.');
    }
  }

  if (!staff || demoMode || !budget.organization_id) return null;
  return <section className="tercis-card p-4 sm:p-5 space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="tercis-card-title flex gap-2 items-center"><FileText size={17}/> Ficheiros e fotografias</h2>
        <p className="text-xs text-slate-500 mt-1">Anexos privados · controlo de acesso e quarentena antes da consulta.</p>
      </div>
      <button type="button" disabled={loading} onClick={() => {void refresh();}}
        className="tercis-button tercis-button-neutral"><RefreshCw size={14}/> Atualizar</button>
    </header>

    {!budget.company_id && <p role="status" className="tercis-note">
      Associe primeiro um cliente ao orçamento e guarde-o para poder enviar fotografias ou documentos.
    </p>}

    {canUpload && <>
      <label className="tercis-upload-zone" data-dragging={dragging}
        onDragOver={event => {event.preventDefault();setDragging(true);}}
        onDragLeave={event => {event.preventDefault();setDragging(false);}}
        onDrop={event => {event.preventDefault();setDragging(false);selectFile(event.dataTransfer.files?.[0]);}}>
        <span className="w-11 h-11 bg-white border border-blue-100 rounded-xl grid place-items-center text-blue-700 mb-3">
          <UploadCloud size={21}/>
        </span>
        <strong className="text-[13px] text-slate-900">Adicionar uma fotografia ou ficheiro</strong>
        <span className="text-[11px] text-slate-500 mt-1">Clique para escolher ou arraste para esta área</span>
        <span className="text-[10px] text-slate-400 mt-2">PNG, JPEG, WebP, PDF, TXT · máximo 10 MB</span>
        <input type="file" className="sr-only" disabled={busy} accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
          onChange={event => {const file=event.target.files?.[0];event.target.value='';selectFile(file);}}/>
      </label>

      {pending && <div className="rounded-xl border border-slate-200 p-3 flex gap-3 items-center">
        {localPreview
          ? <img src={localPreview} alt="Pré-visualização local da fotografia selecionada"
              className="h-16 w-16 rounded-lg object-cover border border-slate-100"/>
          : <div className="tercis-attachment-icon shrink-0"><FileText size={20}/></div>}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[12px] truncate" title={pending.name}>{pending.name}</p>
          <p className="text-[11px] text-slate-500 mt-1">{(pending.size/1024/1024).toFixed(2)} MB · ainda não enviado</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" disabled={busy} onClick={() => {void upload();}}
              className="tercis-button tercis-button-primary"><FileUp size={14}/>{busy?'A enviar…':'Enviar ficheiro'}</button>
            <button type="button" disabled={busy} onClick={() => setPending(null)}
              className="tercis-button tercis-button-neutral"><X size={14}/>Remover</button>
          </div>
        </div>
      </div>}
    </>}

    {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">{notice}</p>}

    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="text-[12px] font-bold text-slate-800">Anexos do orçamento</h3>
        <span className="text-[11px] text-slate-500">{items.length} ficheiros</span>
      </div>
      {loading ? <p className="text-xs text-slate-500 p-3">A atualizar anexos…</p> :
        items.length === 0 ? <p className="text-xs text-slate-500 bg-slate-50 p-4 rounded-xl">Ainda não existem anexos neste orçamento.</p> :
        <ul>
          {items.map(item => <li key={item.id} className="tercis-attachment-row">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="tercis-attachment-icon shrink-0">
                {item.mime_type.startsWith('image/') ? <Image size={19}/> : <FileText size={19}/>}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-slate-900" title={item.file_name}>{item.file_name}</p>
                <p className="text-[11px] text-slate-500">
                  {Math.ceil(item.size_bytes / 1024)} KB · {new Date(item.created_at).toLocaleDateString('pt-PT')}
                </p>
              </div>
            </div>
            <span className={`inline-flex gap-1 items-center text-[11px] font-semibold ${item.scan_status==='clean'?'text-emerald-700':item.scan_status==='infected'?'text-rose-700':'text-amber-700'}`}>
              {item.scan_status==='clean' && <CheckCircle2 size={14}/>}
              {LABELS[item.scan_status] || 'Em quarentena'}
            </span>
            <div className="flex items-center gap-1">
              {item.scan_status==='clean' && item.mime_type.startsWith('image/') && <button type="button"
                onClick={() => {void showImage(item);}} className="tercis-button tercis-button-neutral">
                <Eye size={14}/> Ver
              </button>}
              <button type="button" disabled={item.scan_status!=='clean'}
                onClick={() => {void downloadPrivate(item);}}
                className="tercis-button tercis-button-neutral disabled:opacity-40">
                Descarregar
              </button>
            </div>
          </li>)}
        </ul>}
    </div>
    <WorkspaceDialog open={Boolean(activeViewing)} onClose={() => setViewing(null)}
      title={activeViewing?.name || 'Fotografia'} description="Imagem privada validada pelo antivírus." size="lg">
      {activeViewing && <img src={activeViewing.url} alt={activeViewing.name}
        className="w-full max-h-[68dvh] object-contain rounded-xl mt-3 bg-slate-50"/>}
    </WorkspaceDialog>
  </section>;
}
