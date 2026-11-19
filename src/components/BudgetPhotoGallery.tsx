import { useEffect, useMemo, useState } from 'react';
import { Eye, Images, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { WorkspaceDialog } from './WorkspaceDialog';

export type CleanPhoto = {
  id:string;
  file_name:string;
  file_path:string;
  mime_type:string;
  scan_status:'pending'|'scanning'|'clean'|'infected'|'error';
};

type Thumbnail={id:string;name:string;url:string};

/** Private gallery: never requests URLs until staff explicitly opens it.
 * Images are downloaded through the existing tenant-isolated Storage policy;
 * only CLEAN (antivirus-approved) objects can be accessed.
 */
export function BudgetPhotoGallery({budgetId,items}:{budgetId:string;items:CleanPhoto[]}){
  const [open,setOpen]=useState(false);
  const [showCount,setShowCount]=useState(6);
  const [thumbnails,setThumbnails]=useState<{budgetId:string;rows:Thumbnail[]}>({
    budgetId,rows:[],
  });
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [selected,setSelected]=useState<string|null>(null);
  const photos=useMemo(()=>items.filter(item=>
    item.scan_status==='clean'
    && ['image/png','image/jpeg','image/webp'].includes(item.mime_type)
  ),[items]);
  const visible=photos.slice(0,showCount);
  const urls=thumbnails.budgetId===budgetId?thumbnails.rows:[];
  const selectedPhoto=urls.find(img=>img.id===selected)||null;
  const visibleKey=visible.map(item=>item.id+':'+item.file_path).join('|');

  useEffect(()=>{
    setOpen(false);setSelected(null);setShowCount(6);
  },[budgetId]);

  useEffect(()=>{
    if(!open||visible.length===0){
      setThumbnails({budgetId,rows:[]});
      setLoading(false);
      return;
    }
    let disposed=false;
    const downloaded:Thumbnail[]=[];
    setLoading(true);
    setError('');
    // Only six at a time by default; never download all private objects in
    // the background merely because someone opened an unrelated page.
    void Promise.all(visible.map(async(item)=>{
      try{
        const {data,error:failure}=await supabase.storage
          .from('tercis-private-attachments').download(item.file_path);
        if(failure||!data)throw failure||new Error('Ficheiro indisponível');
        if(disposed)return;
        const url=URL.createObjectURL(data);
        downloaded.push({id:item.id,name:item.file_name,url});
      }catch{
        // A different permission or a deleted object may hide this image.
        // Never fall back to a public Storage URL.
      }
    })).then(()=>{
      if(disposed)return;
      setThumbnails({budgetId,rows:downloaded});
      setLoading(false);
    });
    return ()=>{
      disposed=true;
      for(const image of downloaded)URL.revokeObjectURL(image.url);
    };
  // visibleKey captures file identity while avoiding repeated async work
  // on equivalent array references from fresh DB responses.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[open,budgetId,visibleKey]);

  if(photos.length===0)return null;
  return <section className="rounded-xl border border-slate-200 bg-[#fbfcfe] p-3.5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="flex items-center gap-2 text-[12px] font-bold text-slate-800">
          <Images size={16} className="text-blue-700"/> Fotografias validadas
        </h3>
        <p className="text-[11px] text-slate-500 mt-1">
          {photos.length} {photos.length===1?'imagem':'imagens'} privadas · antivírus concluído
        </p>
      </div>
      <button type="button" className="tercis-button tercis-button-neutral"
        onClick={()=>setOpen(value=>!value)}>
        <Images size={14}/> {open?'Ocultar galeria':'Ver galeria'}
      </button>
    </div>
    {open&&<div className="mt-4">
      {loading&&<p role="status" className="text-xs text-slate-500 flex items-center gap-2">
        <RefreshCw size={14} className="animate-spin"/> A carregar fotografias privadas…
      </p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {visible.map(item=>{
          const preview=urls.find(img=>img.id===item.id);
          return <button type="button" key={item.id}
            disabled={!preview}
            aria-label={'Ver fotografia '+item.file_name}
            onClick={()=>setSelected(item.id)}
            className="group overflow-hidden rounded-xl bg-white border border-slate-200 text-left disabled:cursor-default">
            {preview?<img src={preview.url} alt={item.file_name}
              className="w-full aspect-[4/3] object-cover transition-transform duration-200 group-hover:scale-[1.03]"/>
              :<div className="w-full aspect-[4/3] flex flex-col gap-2 items-center justify-center text-slate-400">
                <Images size={23}/>
                <span className="text-[10px]">Indisponível</span>
              </div>}
            <span className="block px-2.5 py-2 text-[11px] font-medium text-slate-700 truncate">
              {item.file_name}
            </span>
          </button>;
        })}
      </div>
      {photos.length>showCount&&<button type="button"
        className="tercis-button tercis-button-neutral mt-3" onClick={()=>setShowCount(v=>v+6)}>
        Mostrar mais fotografias
      </button>}
      {error&&<p role="alert" className="text-xs text-rose-700 mt-2">{error}</p>}
    </div>}
    <WorkspaceDialog open={Boolean(selectedPhoto)} onClose={()=>setSelected(null)}
      title={selectedPhoto?.name||'Fotografia'} size="xl"
      description="Fotografia privada, acessível apenas após aprovação do antivírus.">
      {selectedPhoto&&<img src={selectedPhoto.url} alt={selectedPhoto.name}
        className="w-full max-h-[75dvh] object-contain bg-slate-50 rounded-xl mt-2"/>}
      <p className="text-[11px] text-slate-500 mt-3 inline-flex gap-2 items-center">
        <Eye size={13}/> Visualização privada · sem ligação pública
      </p>
    </WorkspaceDialog>
  </section>;
}
