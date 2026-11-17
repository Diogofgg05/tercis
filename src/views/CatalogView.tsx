import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, PackagePlus, Search, SlidersHorizontal, X } from 'lucide-react';
import { DEMO_REFERENCE_CATALOG, loadOrganizationCatalogPage, loadOrganizationCatalogCategories } from '../lib/commercialCatalog';
import { formatCurrency } from '../calc';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import type { CatalogItem } from '../types';

type EditableItem = { id?:string; code:string;description:string;reference:string;brand:string;category:string;sector:string;unit:string;unit_cost:number };
const empty:EditableItem={code:'',description:'',reference:'',brand:'',category:'',sector:'',unit:'un',unit_cost:0};


export function CatalogView() {
  const {profile,demoMode} = useAuth();
  const canWrite = !demoMode && profile?.active && (profile.role==='admin'||profile.role==='company_admin');
  const [custom,setCustom]=useState<CatalogItem[]>([]);
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('all');
  const [source,setSource]=useState<'all'|'reference'|'custom'>('all');
  const [page,setPage]=useState(0);
  const [loading,setLoading]=useState(!demoMode);
  const [total,setTotal]=useState(0);
  const [serverCategories,setServerCategories]=useState<string[]>([]);
  const [error,setError]=useState('');
  const [selected,setSelected]=useState<EditableItem|null>(null);
  const [busy,setBusy]=useState(false);

  const reload = useCallback(async () => {
    if(demoMode){setCustom([]);setLoading(false);return;}
    setLoading(true);setError('');
    try {
      const result=await loadOrganizationCatalogPage({
        search:query,category:category==='all'?'':category,page,pageSize:20,
      });
      setCustom(result.items);
      setTotal(result.total);
    } catch(cause){setError(cause instanceof Error?cause.message:'Falha ao carregar produtos.');}
    finally{setLoading(false);}
  },[demoMode,query,category,page]);
  useEffect(()=>{
    if(demoMode)return;
    let active=true;
    void loadOrganizationCatalogCategories().then(values=>{
      if(active)setServerCategories(values);
    }).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Erro de categorias.');});
    return ()=>{active=false;};
  },[demoMode,profile?.id]);
  useEffect(()=>{
    const timer=window.setTimeout(()=>{void reload();},250);
    return ()=>window.clearTimeout(timer);
  },[reload,profile?.id]);

  const all=useMemo(()=>demoMode ? DEMO_REFERENCE_CATALOG : custom,[custom,demoMode]);
  const categories=useMemo(()=>demoMode
    ? [...new Set(all.map(item=>item.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-PT'))
    : serverCategories,[all,demoMode,serverCategories]);
  const filtered=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase('pt-PT');
    return all.filter(item=>(category==='all'||item.category===category) &&
      (source==='all'||(source==='custom')===Boolean(item.is_custom)) &&
      (!q || [item.code,item.description,item.reference,item.brand,item.category]
        .some(field=>(field||'').toLocaleLowerCase('pt-PT').includes(q))));
  },[all,query,category,source]);
  const shown=demoMode?filtered.slice(page*20,(page+1)*20):filtered;
  const pages=Math.max(1,Math.ceil((demoMode?filtered.length:total)/20));
  // A narrower search can invalidate the previously selected page.
  // Reset to the first result instead of showing a misleading empty catalog.
  useEffect(() => setPage(0), [query, category, source]);

  function edit(item:CatalogItem) {
    if(!canWrite || !item.is_custom) return;
    setSelected({id:item.id,code:item.code,description:item.description,reference:item.reference,
      brand:item.brand,category:item.category,sector:item.sector,unit:item.unit,unit_cost:item.unit_cost});
  }
  async function save() {
    if(!selected || !canWrite || !profile) return;
    if(!selected.code.trim() || !selected.description.trim() || !Number.isFinite(selected.unit_cost)||selected.unit_cost<0){
      setError('Preencha o código, a descrição e um custo válido.');return;
    }
    setBusy(true);setError('');
    try {
      const {id,...fields}=selected;
      const cleaned={...fields,code:fields.code.trim(),description:fields.description.trim()};
      const response=id
        ? await supabase.from('custom_catalog_items').update(cleaned).eq('id',id).select('id').single()
        : await supabase.from('custom_catalog_items').insert({...cleaned,created_by:profile.id}).select('id').single();
      if(response.error)throw response.error;
      setSelected(null);await reload();
    } catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível guardar.');}
    finally{setBusy(false);}
  }

  return <div className="tercis-page space-y-5">
    <header className="tercis-head">
      <div><p className="tercis-eyebrow">Tercis / Produtos</p><h1 className="tercis-title">Catálogo</h1>
        <p className="tercis-subtitle">Referências e materiais para preparar propostas e orçamentos.</p></div>
      {canWrite && <button onClick={()=>{setSelected({...empty});setError('')}} type="button"
        className="tercis-button tercis-button-primary"><PackagePlus size={16}/> Novo artigo</button>}
    </header>
    <div className="tercis-note flex gap-2 items-start"><BookOpen size={16} className="mt-0.5 shrink-0"/>
      <span>{demoMode ? 'Catálogo demonstrativo: referências e custos ilustrativos, sem preços confirmados.' : 'Catálogo comercial da organização: custos sujeitos às políticas do Supabase. Adicione artigos personalizados para os seus preços reais.'}</span>
    </div>
    {!demoMode && !canWrite && <p className="text-xs text-slate-500">Catálogo em modo consulta. A escrita requer um administrador autorizado e as políticas RLS correspondentes.</p>}

    {error && <div role="alert" className="bg-rose-50 text-rose-700 border border-rose-200 p-3 rounded-xl text-xs">{error}</div>}

    <section className="tercis-card overflow-hidden">
      <div className="p-4 flex flex-wrap gap-2 border-b border-slate-100">
        <label className="relative flex-[2] min-w-[190px]">
          <Search size={16} className="absolute left-3 top-3 text-slate-400"/>
          <span className="sr-only">Pesquisar artigos</span>
          <input value={query} onChange={e=>{setQuery(e.target.value);setPage(0)}} className="tercis-input pl-9" placeholder="Código, descrição, marca…"/>
        </label>
        <label className="inline-flex gap-2 items-center min-w-[150px]"><SlidersHorizontal size={15} className="text-slate-400 hidden sm:block"/>
          <span className="sr-only">Categoria</span>
          <select className="tercis-input" value={category} onChange={e=>{setCategory(e.target.value);setPage(0)}}>
            <option value="all">Todas as categorias</option>
            {categories.map(c=><option key={c} value={c}>{c}</option>)}
          </select></label>
        <select aria-label="Origem" value={source} onChange={e=>{setSource(e.target.value as typeof source);setPage(0)}} className="tercis-input w-auto">
          <option value="all">Todas as origens</option>{demoMode && <option value="reference">Referência</option>}<option value="custom">Personalizados</option>
        </select>
      </div>
      <div className="px-4 py-2.5 text-[11px] text-slate-500 flex gap-3 justify-between">
        <span>{demoMode?filtered.length:total} artigos encontrados · {custom.length} nesta página</span>
        {loading&&<span>A atualizar catálogo…</span>}
      </div>
      {!shown.length && !loading ? <p className="p-10 text-sm text-slate-500 text-center">Nenhum artigo corresponde aos filtros.</p> :
      <div className="overflow-x-auto"><table className="tercis-table min-w-[660px]">
        <thead><tr><th>Artigo</th><th>Marca / Referência</th><th>Categoria</th><th>Origem</th><th className="text-right">Custo base</th><th className="text-right">Ação</th></tr></thead>
        <tbody>{shown.map(item=><tr key={item.id}>
          <td><div className="font-semibold text-slate-900">{item.description}</div><div className="text-[11px] font-mono text-slate-500">{item.code}</div></td>
          <td><div>{item.brand||'—'}</div><div className="text-[11px] text-slate-400">{item.reference||'—'}</div></td>
          <td className="text-slate-600">{item.category||'Outros'}</td>
          <td><span className={'tercis-badge '+(item.is_custom?'bg-blue-50 text-blue-700':'bg-slate-100 text-slate-600')}>{item.is_custom?'Personalizado':'Referência'}</span></td>
          <td className="text-right font-semibold tabular-nums">{formatCurrency(item.unit_cost)}</td>
          <td className="text-right">{canWrite&&item.is_custom
            ? <button onClick={()=>edit(item)} className="text-blue-700 font-semibold text-xs hover:underline">Editar</button>
            : <span className="text-slate-400 text-xs">Consultar</span>}</td>
        </tr>)}</tbody>
      </table></div>}
      <footer className="p-3 border-t border-slate-100 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500">Página {Math.min(page+1,pages)} de {pages}</span>
        <div className="flex gap-2">
          <button disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))} className="tercis-button tercis-button-neutral">Anterior</button>
          <button disabled={page>=pages-1} onClick={()=>setPage(p=>p+1)} className="tercis-button tercis-button-neutral">Seguinte</button>
        </div>
      </footer>
    </section>

    {selected && canWrite && <div className="fixed inset-0 z-[90] bg-slate-950/40 p-4 grid place-items-center"
      onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}>
      <section role="dialog" aria-modal="true" aria-labelledby="catalog-dialog" className="tercis-card w-full max-w-lg p-5 sm:p-6 space-y-4 shadow-xl">
        <header className="flex items-center justify-between">
          <h2 id="catalog-dialog" className="text-lg font-bold">{selected.id?'Editar artigo':'Novo artigo'}</h2>
          <button onClick={()=>setSelected(null)} aria-label="Fechar" className="p-2 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
        </header>
        <div className="grid sm:grid-cols-2 gap-3">
          {([
            ['code','Código'],['description','Descrição'],['brand','Marca'],['reference','Referência'],
            ['category','Categoria'],['sector','Setor'],['unit','Unidade'],
          ] as const).map(([key,label])=><label key={key} className={'text-xs font-semibold '+(key==='description'?'sm:col-span-2':'')}>
            {label}<input value={selected[key]} onChange={e=>setSelected(p=>p?{...p,[key]:e.target.value}:p)} className="tercis-input mt-1.5"/>
          </label>)}
          <label className="text-xs font-semibold">Custo unitário (€)
            <input type="number" min="0" step="0.01" value={selected.unit_cost}
              onChange={e=>setSelected(p=>p?{...p,unit_cost:Number(e.target.value)}:p)} className="tercis-input mt-1.5"/>
          </label>
        </div>
        {error && <p role="alert" className="text-rose-700 text-xs">{error}</p>}
        <footer className="flex justify-end gap-2">
          <button className="tercis-button tercis-button-neutral" onClick={()=>setSelected(null)}>Cancelar</button>
          <button disabled={busy} className="tercis-button tercis-button-primary" onClick={()=>{void save()}}>{busy?'A guardar…':'Guardar artigo'}</button>
        </footer>
      </section>
    </div>}
  </div>;
}
