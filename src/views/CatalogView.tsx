import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, PackagePlus, Search, SlidersHorizontal, Upload, Package, ExternalLink, Tags, CheckCircle2, BadgeEuro } from 'lucide-react';
import { DEMO_REFERENCE_CATALOG, loadOrganizationCatalogPage, loadOrganizationCatalogCategories } from '../lib/commercialCatalog';
import { readCatalogImport } from '../lib/catalogImport';
import type { ImportedCatalogRow } from '../lib/catalogCsv';
import { formatCurrency } from '../calc';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { WorkspaceDialog } from '../components/WorkspaceDialog';
import { FormSection, FormGrid, FormField } from '../components/FormLayout';
import { WorkspaceEmptyState } from '../components/WorkspacePrimitives';
import type { CatalogItem } from '../types';
import { ProductDetails, ProductPhoto } from '../components/ProductDetails';

type EditableItem = { id?:string; code:string;description:string;reference:string;brand:string;category:string;sector:string;unit:string;unit_cost:number;supplier:string;source_url?:string;price_pending?:boolean };
const empty:EditableItem={code:'',description:'',reference:'',brand:'',category:'',sector:'',unit:'un',unit_cost:0,supplier:''};


export function CatalogView() {
  const {profile,demoMode} = useAuth();
  const canWrite = !demoMode && profile?.active && (profile.role==='admin'||profile.role==='company_admin');
  const [custom,setCustom]=useState<CatalogItem[]>([]);
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('all');
  const [brand,setBrand]=useState('');
  const [summary,setSummary]=useState<{total:number;pending_prices:number;verified_references:number;brands:string[]}|null>(null);
  const [confirmCost,setConfirmCost]=useState(false);
  const [source,setSource]=useState<'all'|'reference'|'custom'>('all');
  const [page,setPage]=useState(0);
  const [loading,setLoading]=useState(!demoMode);
  const [total,setTotal]=useState(0);
  const [serverCategories,setServerCategories]=useState<string[]>([]);
  const [error,setError]=useState('');
  const [selected,setSelected]=useState<EditableItem|null>(null);
  const [detail,setDetail]=useState<CatalogItem|null>(null);
  const [busy,setBusy]=useState(false);
  const [priceHistory,setPriceHistory]=useState<{old_cost:number;new_cost:number;old_supplier:string|null;new_supplier:string|null;changed_at:string}[]>([]);
  const [historyError,setHistoryError]=useState('');
  const [notice,setNotice]=useState('');
  const [pendingImport,setPendingImport]=useState<{name:string;rows:ImportedCatalogRow[]}|null>(null);
  const latestRequest=useRef(0);

  const reload = useCallback(async () => {
    const token=++latestRequest.current;
    if(demoMode){setCustom([]);setLoading(false);return;}
    setLoading(true);setError('');
    try {
      const result=await loadOrganizationCatalogPage({
        search:query,category:category==='all'?'':category,brand,page,pageSize:20,
      });
      // A slow old response must never replace a later server search.
      if(token!==latestRequest.current)return;
      setCustom(result.items);
      setTotal(result.total);
    } catch(cause){
      if(token===latestRequest.current) {
        setCustom([]);
        setTotal(0);
        setError(cause instanceof Error?cause.message:'Falha ao carregar produtos.');
      }
    } finally{if(token===latestRequest.current)setLoading(false);}
  },[demoMode,query,category,brand,page]);
  const loadSummary=useCallback(async()=>{
    if(demoMode)return;
    const {data,error:failure}=await supabase.rpc('tercis_catalog_summary');
    if(!failure&&data)setSummary(data);
  },[demoMode]);
  useEffect(()=>{void loadSummary();},[loadSummary,profile?.id]);
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
    // The tenant catalog RPC already filters and paginates on the server.
    // Filtering its returned page again can silently hide matching results,
    // producing "0 nesta página" despite a positive server total.
    if(!demoMode)return all;
    const q=query.trim().toLocaleLowerCase('pt-PT');
    return all.filter(item=>(category==='all'||item.category===category) &&
      (source==='all'||(source==='custom')===Boolean(item.is_custom)) &&
      (!q || [item.code,item.description,item.reference,item.brand,item.category,item.sector]
        .some(field=>(field||'').toLocaleLowerCase('pt-PT').includes(q))));
  },[all,query,category,source,demoMode]);
  const shown=demoMode?filtered.slice(page*20,(page+1)*20):filtered;
  const pages=Math.max(1,Math.ceil((demoMode?filtered.length:total)/20));
  // A narrower search can invalidate the previously selected page.
  // Reset to the first result instead of showing a misleading empty catalog.
  useEffect(() => setPage(0), [query, category, source,brand]);

  function edit(item:CatalogItem) {
    if(!canWrite || !item.is_custom) return;
    setSelected({id:item.id,code:item.code,description:item.description,reference:item.reference,
      brand:item.brand,category:item.category,sector:item.sector,unit:item.unit,
      unit_cost:item.unit_cost,supplier:item.supplier||'',source_url:item.source_url||'',price_pending:item.price_pending});
    setConfirmCost(!item.price_pending);
    setHistoryError('');setPriceHistory([]);
    void supabase.rpc('tercis_catalog_price_history',{p_item_id:item.id})
      .then(({data,error})=>{
        if(error){setHistoryError(error.message);return;}
        if(Array.isArray(data))setPriceHistory(data.map(entry=>({
          old_cost:Number(entry.old_cost),new_cost:Number(entry.new_cost),
          old_supplier:entry.old_supplier,new_supplier:entry.new_supplier,
          changed_at:entry.changed_at,
        })));
      });
  }
  async function save() {
    if(!selected || !canWrite || !profile) return;
    if(selected.price_pending&&!confirmCost){setError('Confirma o custo de compra antes de guardar este artigo.');return;}
    if(!selected.code.trim() || !selected.description.trim() || !Number.isFinite(selected.unit_cost)||selected.unit_cost<0){
      setError('Preencha o código, a descrição e um custo válido.');return;
    }
    setBusy(true);setError('');
    try {
      const {id,...fields}=selected;
      const cleaned={...fields,code:fields.code.trim(),description:fields.description.trim(),price_pending:false};
      const response=id
        ? await supabase.from('custom_catalog_items').update(cleaned).eq('id',id).select('id').single()
        : await supabase.from('custom_catalog_items').insert({...cleaned,created_by:profile.id}).select('id').single();
      if(response.error)throw response.error;
      // The write is committed even if refreshing the table fails.
      setSelected(null);
      void loadSummary();
      try {await reload();}
      catch {setError('Artigo guardado. A lista não atualizou; volte a pesquisar.');}
    } catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível guardar.');}
    finally{setBusy(false);}
  }

  async function prepareCsvFile(file:File){
    if(!canWrite||busy)return;
    setError('');setNotice('');setBusy(true);
    try {
      const rows=await readCatalogImport(file);
      setPendingImport({name:file.name,rows});
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Não foi possível ler o ficheiro.');
    }finally{setBusy(false);}
  }

  async function confirmCsvImport(){
    if(!canWrite||busy||!pendingImport)return;
    const rows=pendingImport.rows;
    setBusy(true);setError('');setNotice('');
    try {
      const {data,error:failure}=await supabase.rpc('tercis_import_catalog_batch',{p_items:rows});
      if(failure)throw failure;
      setPendingImport(null);
      setNotice(String(data||rows.length)+' artigos importados ou atualizados. Os preços anteriores foram preservados no histórico.');
      void loadSummary();
      await reload();
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Erro ao importar o CSV.');
    }finally{setBusy(false);}
  }

    return <div className="tercis-page catalog-page space-y-5">
    <header className="tercis-head">
      <div><p className="tercis-eyebrow">Tercis / Produtos</p><h1 className="tercis-title">Catálogo</h1>
        <p className="tercis-subtitle">Componentes elétricos e automação, prontos para o teu próximo projeto.</p></div>
      {canWrite && <div className="flex gap-2 flex-wrap">
        <label className="tercis-button tercis-button-neutral cursor-pointer">
          <Upload size={16}/> Importar Excel / CSV
          <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only"
            disabled={busy} onChange={event=>{
              const file=event.target.files?.[0];
              event.target.value='';
              if(file)void prepareCsvFile(file);
            }}/>
        </label>
        <button onClick={()=>{setSelected({...empty});setError('')}} type="button"
          className="tercis-button tercis-button-primary"><PackagePlus size={16}/> Novo artigo</button>
      </div>}
    </header>
    {summary&&<div className="catalog-metrics">
      <div><span className="catalog-metric-icon"><Package size={21}/></span><span><strong>{summary.total}</strong><small>Componentes no catálogo</small></span></div>
      <div><span className="catalog-metric-icon"><Tags size={21}/></span><span><strong>{summary.brands.length}</strong><small>Marcas de referência</small></span></div>
      <div><span className="catalog-metric-icon"><CheckCircle2 size={21}/></span><span><strong>{summary.verified_references}</strong><small>Com fonte do fabricante</small></span></div>
      <div><span className="catalog-metric-icon pending"><BadgeEuro size={21}/></span><span><strong>{summary.pending_prices}</strong><small>Custos por confirmar</small></span></div>
    </div>}
    <div className="catalog-brands" role="group" aria-label="Filtrar por marca"><button onClick={()=>{setBrand('');setPage(0);}} aria-pressed={!brand}>Todas as marcas</button>{[...(summary?.brands||[])].sort((a,b)=>a.localeCompare(b)).map(value=><button key={value} data-brand={value} aria-pressed={brand===value} onClick={()=>{setBrand(value);setPage(0);}}>{value}</button>)}</div>
    <div className="catalog-reference-note"><BookOpen size={17}/><span>{demoMode?'Catálogo de demonstração com preços ilustrativos.':'As referências incluem ligações aos fabricantes. Define o teu custo de compra para usar um artigo num orçamento.'}</span></div>
    {!demoMode && !canWrite && <p className="text-xs text-slate-500">Catálogo em modo consulta. A escrita requer um administrador autorizado e as políticas RLS correspondentes.</p>}

    {notice && <div role="status" className="tercis-note">{notice}</div>}
        {error && <div role="alert" className="bg-rose-50 text-rose-700 border border-rose-200 p-3 rounded-xl text-xs">{error}</div>}

    <section className="tercis-card overflow-hidden">
      <div className="tercis-filterbar">
        <label className="tercis-filterbar-search">
          <Search size={16} className="absolute left-3 top-3 text-slate-400"/>
          <span className="sr-only">Pesquisar artigos</span>
          <input type="search" value={query} onChange={e=>{setQuery(e.target.value);setPage(0)}}
            className="tercis-input pl-9" placeholder="Código, descrição, marca…"/>
        </label>
        <label className="tercis-filterbar-select inline-flex gap-2 items-center"><SlidersHorizontal size={15} className="text-slate-400 hidden sm:block"/>
          <span className="sr-only">Categoria</span>
          <select className="tercis-input" value={category} onChange={e=>{setCategory(e.target.value);setPage(0)}}>
            <option value="all">Todas as categorias</option>
            {categories.map(c=><option key={c} value={c}>{c}</option>)}
          </select></label>
        {demoMode&&<select aria-label="Origem" value={source}
          onChange={e=>{setSource(e.target.value as typeof source);setPage(0)}}
          className="tercis-input tercis-filterbar-select">
          <option value="all">Todas as origens</option>
          <option value="reference">Referência</option>
          <option value="custom">Personalizados</option>
        </select>}
        {(query||category!=='all'||(demoMode&&source!=='all'))&&
          <button type="button" className="tercis-button tercis-button-neutral"
            onClick={()=>{setQuery('');setCategory('all');setSource('all');setPage(0);}}>
            Limpar filtros
          </button>}
      </div>
      <div className="px-4 py-2.5 text-[11px] text-slate-500 flex gap-3 justify-between">
        <span>{demoMode?filtered.length:total} artigos encontrados · {shown.length} nesta página</span>
        {loading&&<span>A atualizar catálogo…</span>}
      </div>
      {error&&!loading
        ?<div className="p-5 text-xs text-rose-700">
            Não foi possível atualizar o catálogo. Verifique a ligação e tente novamente.
            <button type="button" onClick={()=>{void reload();}}
              className="tercis-button tercis-button-neutral ml-3">Tentar novamente</button>
          </div>
        :!shown.length && !loading ? <WorkspaceEmptyState icon={<Package size={23}/>}
        title="Nenhum artigo encontrado" description="Altere os filtros para pesquisar outras referências ou materiais."/> :
      <>
      <div className="md:hidden divide-y divide-slate-100">
        {shown.map(item=><article key={item.id} className="px-4 py-3.5 space-y-3">
          <div className="flex justify-between items-start gap-2">
            <div className="flex gap-3 min-w-0">
              <button type="button" onClick={()=>setDetail(item)} aria-label={`Ver informação de ${item.reference||item.code}`}><ProductPhoto item={item}/></button>
              <div className="min-w-0">
                <button type="button" onClick={()=>setDetail(item)} className="text-left text-[13px] font-bold text-slate-900 break-words hover:text-blue-700">{item.description}</button>
                <p className="mt-1 text-[11px] text-slate-500 font-mono">{item.code}</p>
              </div>
            </div>
            <span className={'tercis-badge '+(item.is_custom?'bg-blue-50 text-blue-700':'bg-slate-100 text-slate-600')}>
              {item.source_url?'Fabricante':item.is_custom?'Personalizado':'Referência'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div><p className="text-slate-500 mb-1">Marca / referência</p>
              <p className="font-semibold text-slate-800 break-words">{item.brand||item.reference||'—'}</p></div>
            <div><p className="text-slate-500 mb-1">Categoria</p>
              <p className="font-semibold text-slate-800">{item.category||'Outros'}</p></div>
          </div>
          <div className="pt-3 border-t border-slate-100 flex justify-between items-center gap-2">
            <strong className={'text-[13px] tabular-nums '+(item.price_pending?'text-amber-700':'text-slate-900')}>{item.price_pending?'Custo por definir':formatCurrency(item.unit_cost)}</strong>
            {canWrite&&item.is_custom&&<button type="button" onClick={()=>edit(item)}
              className="tercis-button tercis-button-neutral">Editar artigo</button>}
          </div>
          {item.source_url&&/^https:\/\//i.test(item.source_url)&&<a href={item.source_url} target="_blank" rel="noopener noreferrer" className="catalog-source-link"><ExternalLink size={13}/> Ficha do fabricante</a>}
        </article>)}
      </div>
      <div className="hidden md:block overflow-x-auto"><table className="tercis-table min-w-[660px]">
        <thead><tr><th>Artigo</th><th>Marca / Referência</th><th>Categoria</th><th>Origem</th><th className="text-right">Custo base</th><th className="text-right">Ação</th></tr></thead>
        <tbody>{shown.map(item=><tr key={item.id}>
          <td><button type="button" className="catalog-product-identity" onClick={()=>setDetail(item)} aria-label={`Ver informação de ${item.reference||item.code}`}><ProductPhoto item={item}/><span><strong>{item.description}</strong><small>{item.code}</small></span></button></td>
          <td><div>{item.brand||'—'}</div><div className="text-[11px] text-slate-400">{item.reference||'—'}</div></td>
          <td className="text-slate-600">{item.category||'Outros'}</td>
          <td>{item.source_url&&/^https:\/\//i.test(item.source_url)?<a href={item.source_url} target="_blank" rel="noopener noreferrer" className="catalog-source-link"><ExternalLink size={13}/> Fabricante</a>:<span className="tercis-badge bg-slate-100 text-slate-600">Personalizado</span>}</td>
          <td className="text-right font-semibold tabular-nums">{item.price_pending?<span className="catalog-pending">Por definir</span>:formatCurrency(item.unit_cost)}</td>
          <td className="text-right"><button type="button" onClick={()=>setDetail(item)} className="tercis-button tercis-button-neutral">Ver ficha</button></td>
        </tr>)}</tbody>
      </table></div></>}
      <footer className="p-3 border-t border-slate-100 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500">Página {Math.min(page+1,pages)} de {pages}</span>
        <div className="flex gap-2">
          <button disabled={loading||page===0} onClick={()=>setPage(p=>Math.max(0,p-1))} className="tercis-button tercis-button-neutral">Anterior</button>
          <button disabled={loading||page>=pages-1} onClick={()=>setPage(p=>p+1)} className="tercis-button tercis-button-neutral">Seguinte</button>
        </div>
      </footer>
    </section>

    <ProductDetails item={detail} onClose={()=>setDetail(null)} onEdit={canWrite?(item)=>{setDetail(null);edit(item);}:undefined}/>
    <WorkspaceDialog open={Boolean(pendingImport)} onClose={() => setPendingImport(null)}
      busy={busy} title="Rever importação do catálogo" size="lg"
      description={pendingImport ? pendingImport.name + ' · ' + pendingImport.rows.length + ' artigos' : undefined}
      footer={<>
        <button type="button" disabled={busy} onClick={() => setPendingImport(null)}
          className="tercis-button tercis-button-neutral">Cancelar</button>
        <button type="button" disabled={busy} onClick={() => {void confirmCsvImport();}}
          className="tercis-button tercis-button-primary">{busy?'A importar…':'Confirmar importação'}</button>
      </>}>
      {pendingImport && <>
        <p className="text-xs text-slate-500 mb-3">Excel: primeira folha, até 100 artigos e 500 KB. Colunas obrigatórias: codigo, descricao, custo. Formata os códigos como texto para preservar zeros iniciais.</p>
        <p className="tercis-note mt-3">Verifique os primeiros artigos. Códigos já existentes serão atualizados; o histórico dos preços anteriores será preservado.</p>
        <div className="overflow-x-auto mt-4 rounded-xl border border-slate-200">
          <table className="tercis-table min-w-[480px]">
            <thead><tr><th>Código</th><th>Descrição</th><th className="text-right">Custo</th></tr></thead>
            <tbody>{pendingImport.rows.slice(0,6).map(row => <tr key={row.code}>
              <td className="font-mono text-[11px]">{row.code}</td>
              <td>{row.description}</td>
              <td className="text-right tabular-nums">{formatCurrency(row.unit_cost)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {pendingImport.rows.length>6 && <p className="text-[11px] text-slate-500 mt-2">
          A apresentar 6 de {pendingImport.rows.length} artigos.
        </p>}
        {error && <p role="alert" className="text-xs p-3 mt-3 bg-rose-50 rounded-lg text-rose-700">{error}</p>}
      </>}
    </WorkspaceDialog>

    <WorkspaceDialog open={Boolean(selected && canWrite)} busy={busy}
      onClose={() => setSelected(null)} title={selected?.id ? 'Editar artigo' : 'Novo artigo'}
      size="lg" description="Complete os dados do produto por grupos. Os custos são internos e sujeitos a permissões."
      footer={<>
        <button type="button" disabled={busy} className="tercis-button tercis-button-neutral"
          onClick={() => setSelected(null)}>Cancelar</button>
        <button type="button" disabled={busy} className="tercis-button tercis-button-primary"
          onClick={() => { void save(); }}>{busy ? 'A guardar…' : 'Guardar artigo'}</button>
      </>}>
      {selected && <>
        <FormSection title="Artigo" description="Identificação comercial do material.">
          {selected.source_url&&/^https:\/\//i.test(selected.source_url)&&<a href={selected.source_url} target="_blank" rel="noopener noreferrer" className="catalog-source-link mb-4"><ExternalLink size={15}/> Consultar ficha do fabricante</a>}
          <FormGrid>
            <FormField label="Código" required>
              <input data-autofocus required className="tercis-input" value={selected.code}
                onChange={e => setSelected(p => p ? {...p,code:e.target.value} : p)}/>
            </FormField>
            <FormField label="Referência do fabricante">
              <input className="tercis-input" value={selected.reference}
                onChange={e => setSelected(p => p ? {...p,reference:e.target.value} : p)}/>
            </FormField>
            <FormField label="Descrição" required wide>
              <input required className="tercis-input" value={selected.description}
                onChange={e => setSelected(p => p ? {...p,description:e.target.value} : p)}/>
            </FormField>
          </FormGrid>
        </FormSection>
        <FormSection title="Classificação" description="Organize a pesquisa e a utilização nos orçamentos.">
          <FormGrid>
            {([['category','Categoria'],['sector','Setor'],['brand','Marca'],['supplier','Fornecedor']] as const)
              .map(([key,label]) => <FormField key={key} label={label}>
                <input className="tercis-input" value={selected[key]}
                  onChange={e => setSelected(p => p ? {...p,[key]:e.target.value} : p)}/>
              </FormField>)}
          </FormGrid>
        </FormSection>
        <FormSection title="Unidade e custo" description="Valor de compra, não preço de venda ao cliente.">
          {selected.price_pending&&<label className="flex items-start gap-3 p-4 mb-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900"><input type="checkbox" className="mt-1" checked={confirmCost} onChange={e=>setConfirmCost(e.target.checked)}/><span>Confirmo que o custo introduzido foi validado para a minha empresa. O valor inicial não é um preço de compra.</span></label>}
          <FormGrid>
            <FormField label="Unidade">
              <input className="tercis-input" value={selected.unit}
                onChange={e => setSelected(p => p ? {...p,unit:e.target.value} : p)}/>
            </FormField>
            <FormField label="Custo unitário (€)" required>
              <input type="number" required min="0" step="0.0001" value={selected.unit_cost}
                onChange={e => setSelected(p => p ? {...p,unit_cost:Number(e.target.value)} : p)}
                className="tercis-input"/>
            </FormField>
          </FormGrid>
        </FormSection>
        {selected.id && <FormSection title="Histórico de preços"
          description="Registo de alterações ao custo de compra e respetivo fornecedor.">
          {historyError && <p role="alert" className="text-xs text-rose-700">{historyError}</p>}
          {!historyError && !priceHistory.length && <p className="text-xs text-slate-500">Sem alterações de custo registadas.</p>}
          <div className="max-h-36 overflow-y-auto space-y-2">
            {priceHistory.map((item,i) => <p key={i} className="text-xs text-slate-600">
              <time dateTime={item.changed_at}>{new Date(item.changed_at).toLocaleDateString('pt-PT')}</time>
              {' · '}{formatCurrency(item.old_cost)} → {formatCurrency(item.new_cost)}
              {item.new_supplier && ' · ' + item.new_supplier}
            </p>)}
          </div>
        </FormSection>}
        {error && <p role="alert" className="text-rose-700 text-xs p-3 bg-rose-50 rounded-lg">{error}</p>}
      </>}
    </WorkspaceDialog>
  </div>;
}
