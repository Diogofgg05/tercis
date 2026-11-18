import { useEffect, useState } from 'react';
import { FileText, ImagePlus, UploadCloud, X } from 'lucide-react';

const ALLOWED = ['image/png','image/jpeg','image/webp','application/pdf','text/plain'];
const LIMIT = 10 * 1024 * 1024;

/** Honest demo-only local preview; never sends or stores a customer's files. */
export function DemoAttachmentPreview() {
  const [file,setFile]=useState<File|null>(null);
  const [preview,setPreview]=useState('');
  const [error,setError]=useState('');

  useEffect(() => {
    setPreview('');
    if(!file || !file.type.startsWith('image/'))return;
    const url=URL.createObjectURL(file);
    setPreview(url);
    return ()=>URL.revokeObjectURL(url);
  },[file]);

  function choose(next:File|undefined){
    if(!next)return;
    setError('');
    if(!ALLOWED.includes(next.type) || next.size<1 || next.size>LIMIT){
      setFile(null);
      setError('Use PNG, JPEG, WebP, PDF ou TXT até 10 MB.');
      return;
    }
    setFile(next);
  }

  return <section className="tercis-card p-4 sm:p-6 max-w-4xl space-y-4">
    <div>
      <h2 className="tercis-card-title">Ficheiros e fotografias</h2>
      <p className="text-xs text-slate-500 mt-1">
        Pode escolher fotografias para pré-visualização local.
      </p>
    </div>
    <p className="tercis-note">
      Pré-visualização local: o ficheiro não é enviado nem analisado pelo antivírus.
      O carregamento privado só está disponível numa organização real configurada.
    </p>
    <label className="tercis-upload-zone">
      <span className="w-11 h-11 bg-white border border-blue-100 rounded-xl grid place-items-center text-blue-700 mb-3">
        <UploadCloud size={21}/>
      </span>
      <strong className="text-[13px] text-slate-900">Selecionar uma fotografia ou documento</strong>
      <span className="text-[11px] text-slate-500 mt-1">Clique para experimentar o seletor de ficheiros</span>
      <span className="text-[10px] text-slate-400 mt-2">PNG, JPEG, WebP, PDF, TXT · até 10 MB</span>
      <input type="file" className="sr-only" accept=".png,.jpg,.jpeg,.webp,.pdf,.txt"
        onChange={e=>{const next=e.target.files?.[0];e.target.value='';choose(next);}}/>
    </label>
    {error && <p role="alert" className="text-xs text-rose-700 p-3 bg-rose-50 rounded-xl">{error}</p>}
    {file && <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-xl border border-slate-200 p-3">
      {preview
        ? <img alt="Pré-visualização local" src={preview}
            className="w-28 h-28 bg-slate-50 object-contain rounded-lg border border-slate-100"/>
        : <div className="tercis-attachment-icon"><FileText size={20}/></div>}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm truncate">{file.name}</p>
        <p className="text-[11px] text-slate-500 mt-1">{(file.size/1024).toFixed(1)} KB · ficheiro local, não enviado</p>
        <p className="text-[11px] text-blue-700 flex items-center gap-1 mt-2"><ImagePlus size={13}/> Pré-visualização local</p>
      </div>
      <button type="button" onClick={()=>setFile(null)} className="tercis-button tercis-button-neutral">
        <X size={15}/> Limpar
      </button>
    </div>}
  </section>;
}
