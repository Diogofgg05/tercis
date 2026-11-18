import { useCallback, useEffect, useState } from 'react';
import { FileUp, FileText, ExternalLink, RefreshCw } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
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

const BUCKET = 'tercis-private-attachments';
const ACCEPTED = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain'];

export function BudgetAttachments({ budget }: { budget: Budget }) {
  const { profile, demoMode } = useAuth();
  const [items, setItems] = useState<PrivateAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const staff = Boolean(profile?.active && (
    profile.role === 'admin' || profile.role === 'company_admin'
    || (profile.role === 'collaborator' && profile.collaborator_type === 'internal')
  ));

  const refresh = useCallback(async () => {
    if (!staff || demoMode || !budget.organization_id) return;
    setLoading(true);
    try {
      const { data, error: failure } = await supabase.from('budget_attachments')
        .select('id,file_name,file_path,mime_type,size_bytes,created_at,scan_status')
        .eq('budget_id', budget.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (failure) throw failure;
      setItems((data || []) as PrivateAttachment[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro ao consultar anexos.');
    } finally { setLoading(false); }
  }, [budget.id, budget.organization_id, demoMode, staff]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function upload(file: File | undefined) {
    if (!file || !profile || !staff || !budget.organization_id || !budget.company_id || busy) return;
    setError(''); setNotice('');
    if (!ACCEPTED.includes(file.type) || file.size < 1 || file.size > 10 * 1024 * 1024) {
      setError('Escolha PDF, PNG, JPEG, WebP ou TXT, com tamanho até 10 MB.'); return;
    }
    setBusy(true);
    const safeName = (file.name.normalize('NFKC').replace(/[^a-zA-Z0-9._-]+/g,'_')
      .slice(-90) || 'anexo');
    const path = `${budget.organization_id}/${budget.id}/${crypto.randomUUID()}-${safeName}`;
    try {
      const { error: storageError } = await supabase.storage.from(BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type });
      if (storageError) throw storageError;
      const { error: metadataError } = await supabase.from('budget_attachments').insert({
        budget_id: budget.id,
        company_id: budget.company_id,
        uploaded_by: profile.id,
        file_name: file.name,
        file_path: path,
        mime_type: file.type,
        size_bytes: file.size,
        visibility: 'internal',
      });
      if (metadataError) {
        // Upload and metadata INSERT are separate operations. Files in the
        // private bucket are immutable, even for uploaders, to prevent
        // replacing approved bytes without a fresh antivirus verdict.
        // The service-only orphan inventory handles deferred cleanup.
        throw new Error('O ficheiro foi recebido em quarentena, mas não foi possível associá-lo ao orçamento. A manutenção deverá verificar o anexo pendente.');
      }
      setNotice('Anexo colocado em quarentena; fica disponível após análise antivírus.');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao guardar o anexo.');
    } finally { setBusy(false); }
  }

  async function downloadPrivate(item: PrivateAttachment) {
    setError('');
    // An authenticated download avoids a transferable signed URL and prevents
    // rendering unscanned uploads directly as active content in a browser tab.
    // The file must still be scanned by a trusted malware scanner in staging.
    try {
      const { data, error: failure } = await supabase.storage.from(BUCKET)
        .download(item.file_path);
      if (failure || !data) throw failure || new Error('Ficheiro indisponível.');
      const objectUrl = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = item.file_name.replace(/[\\/\\\\]/g, '_').slice(0, 120) || 'anexo';
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível descarregar o anexo.');
    }
  }

  if (!staff || demoMode || !budget.organization_id) return null;
  return <section className="tercis-card p-4 space-y-3">
    <div className="flex flex-wrap justify-between gap-2 items-center">
      <div>
        <h2 className="font-bold text-slate-900 flex items-center gap-2"><FileText size={17}/> Anexos privados</h2>
        <p className="text-xs text-slate-500 mt-1">Apenas a equipa interna autorizada da organização pode consultar estes ficheiros.</p>
      </div>
      <button type="button" disabled={loading} onClick={() => { void refresh(); }}
        className="tercis-button tercis-button-neutral"><RefreshCw size={14}/> Atualizar</button>
    </div>
    <label className="inline-flex gap-2 items-center cursor-pointer rounded-lg border border-blue-200 px-4 py-2 text-blue-700 font-semibold text-sm">
      <FileUp size={16}/>{busy ? 'A carregar…' : 'Adicionar anexo (até 10 MB)'}
      <input type="file" className="sr-only" disabled={busy}
        accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
        onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = '';
          void upload(file);
        }}/>
    </label>
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    {notice && <p role="status" className="text-xs text-emerald-700">{notice}</p>}
    {loading ? <p className="text-sm text-slate-500">A carregar anexos…</p> :
      items.length === 0 ? <p className="text-sm text-slate-500">Ainda não existem anexos neste orçamento.</p> :
      <ul className="divide-y divide-slate-100">
        {items.map(item => <li key={item.id} className="flex justify-between items-center gap-3 py-2">
          <span className="min-w-0 truncate text-sm" title={item.file_name}>{item.file_name}
            <span className="text-xs text-slate-400 ml-2">{Math.ceil(item.size_bytes / 1024)} KB</span>
          </span>
          <span className="text-[11px] text-slate-500">
            {{pending:'Pendente de análise',scanning:'A analisar',
              clean:'Seguro',infected:'Bloqueado: ameaça detetada',
              error:'Erro na análise'}[item.scan_status] || 'Em quarentena'}
          </span>
          <button type="button" disabled={item.scan_status !== 'clean'}
            onClick={() => { void downloadPrivate(item); }}
            className="text-sm font-semibold text-blue-700 inline-flex items-center gap-1 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed">
            <ExternalLink size={14}/> Descarregar
          </button>
        </li>)}
      </ul>}
  </section>;
}
