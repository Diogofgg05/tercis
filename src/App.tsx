import { useState, useEffect, useCallback, useRef } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginView } from './auth/LoginView';
import { MFAGate } from './auth/MFAGate';
import { PendingApprovalView } from './auth/PendingApprovalView';
import { Sidebar } from './components/Sidebar';
import type { View } from './components/Sidebar';
import { Toast } from './components/Toast';
import type { ToastType } from './components/Toast';
import { Dashboard } from './views/Dashboard';
import { BudgetList, downloadCompleteCsv } from './views/BudgetList';
import type { CsvBudgetRow } from './views/BudgetList';
import { BudgetEditor } from './views/BudgetEditor';
import { BudgetDetail } from './views/BudgetDetail';
import { AccessView } from './views/AccessView';
import { CatalogView } from './views/CatalogView';
import { CompaniesView } from './views/CompaniesView';
import { TeamView } from './views/TeamView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';
import { ChatView } from './views/ChatView';
import { isDemoAllowed, isSupabaseConfigured, supabase } from './lib/supabase';
import type { Budget, BudgetItem, BudgetStatus, Company, Profile } from './types';
import { DEMO_BUDGETS, DEMO_COMPANIES, DEMO_PROFILES, hydrateDemoBudget } from './demoData';
import { isClientUser, nextBudgetStatuses } from './domain/workflow';
import { calcItem } from './calc';
import { canAccessView } from './domain/access';
import { canCreateBudget, canEditBudget, canDeleteBudget, canDuplicateBudget } from './domain/budget-actions';
import { createBudgetDraft, duplicateBudgetDraft } from './domain/budget-drafts';

// ----------------------------------------------
// Helpers
// ----------------------------------------------
function newId() { return crypto.randomUUID(); }
const DEMO_KEY = 'tercis:demo:budgets:v2';

function readDemoBudgets(): Budget[] {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (raw) { const parsed: unknown = JSON.parse(raw); if (Array.isArray(parsed)) return parsed as Budget[]; }
  } catch { /* recover from interrupted demo storage */ }
  return DEMO_BUDGETS.map(b => ({ ...b, items: (b.items || []).map(i => ({ ...i })) }));
}
function saveDemoBudgets(budgets: Budget[]) { localStorage.setItem(DEMO_KEY, JSON.stringify(budgets)); }


function buildRef(budgets: Budget[]): string {
  const year = new Date().getFullYear();
  const prefix = `ORC-${year}-`;
  const max = Math.max(0, ...budgets.filter(b => b.ref?.startsWith(prefix)).map(b => {
    const match = b.ref.slice(prefix.length).match(/^(\d+)/);
    return match ? Number(match[1]) : 0;
  }));
  return `${prefix}${String(max + 1).padStart(4, '0')}-${newId().slice(0, 6).toUpperCase()}`;
}

// ----------------------------------------------
// Inner app (requires auth)
// ----------------------------------------------
type ToastState = { message: string; type: ToastType } | null;

function AppInner() {
  const { profile, demoMode } = useAuth();
  const [view, setView] = useState<View>('dashboard');
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [hasMoreBudgets,setHasMoreBudgets] = useState(false);
  const budgetCursorRef = useRef<{ created_at: string | null; id: string } | null>(null);
  const budgetAppendInFlightRef = useRef(false);
  const budgetRequestRef = useRef(0);
  const [budgetQuery,setBudgetQuery]=useState('');
  const [budgetStatus,setBudgetStatus]=useState<BudgetStatus|'todos'>('todos');
  const [budgetArchived,setBudgetArchived]=useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [team, setTeam] = useState<Profile[]>([]);
  const [activeBudget, setActiveBudget] = useState<Budget | null>(null);
  const [unsaved, setUnsaved] = useState(false);
  const [online,setOnline]=useState(()=>navigator.onLine);
  useEffect(()=>{
    const change=()=>setOnline(navigator.onLine);
    window.addEventListener('online',change);
    window.addEventListener('offline',change);
    return ()=>{
      window.removeEventListener('online',change);
      window.removeEventListener('offline',change);
    };
  },[]);
  useEffect(()=>{
    if(!unsaved||view!=='editor')return;
    const warn=(event:BeforeUnloadEvent)=>{
      event.preventDefault();
      event.returnValue='';
    };
    window.addEventListener('beforeunload',warn);
    return ()=>window.removeEventListener('beforeunload',warn);
  },[unsaved,view]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const notify = useCallback((message: string, type: ToastType = 'success') => setToast({ message, type }), []);

  // -- Load data ------------------------------------------------------
  async function loadBudgets(append = false, filters: {query:string;status:BudgetStatus|'todos';archived:boolean} = {query:'',status:'todos',archived:false}) {
    // A duplicate click must not invalidate the active request token.
    // Only a request we actually start may supersede an older response.
    if (append && budgetAppendInFlightRef.current) return [];
    const requestId=++budgetRequestRef.current;
    if (demoMode) {
      const records = readDemoBudgets();
      const published = new Set(['enviado','aceite','rejeitado','pedido_alteracoes','expirado','em_execucao','concluido']);
      const visible = isClientUser(profile)
        ? records.filter(b => b.company_id === profile?.company_id && published.has(b.status))
        : profile?.role === 'collaborator'
          ? records.filter(b => b.created_by === profile.id || b.assigned_to === profile.id)
          : records;
      const loaded = visible.map(hydrateDemoBudget).map(b => {
        if(!isClientUser(profile)) return b;
        return {
          ...b,notes:'',client_contact:'',client_email:'',
          items:(b.items||[]).map(item => ({
            id:item.id, budget_id:item.budget_id, code:item.code,
            description:item.description, reference:item.reference,
            unit:item.unit, quantity:item.quantity, sort_order:item.sort_order,
            unit_price:calcItem(item).finalPrice,
          })),
        };
      });
      setHasMoreBudgets(false);
      budgetCursorRef.current=null;
      setBudgets(loaded);
      return loaded;
    }
    // Customer-facing data is sourced from a dedicated server-side redacted
    // feed; PostgREST raw tables intentionally deny clients access to margins.
    if(isClientUser(profile)) {
      const {data,error}=await supabase.rpc('tercis_client_quote_feed');
      if(error) throw new Error(error.code==='PGRST202'
        ? 'A migração do portal de cliente ainda não está instalada no Supabase.'
        : error.message);
      const loaded=(Array.isArray(data)?data:[]) as Budget[];
      setHasMoreBudgets(false);
      budgetCursorRef.current=null;
      setBudgets(loaded);
      return loaded;
    }
    // Keyset pagination uses the last displayed (created_at, id) tuple.
    // A concurrent insertion/deletion before the cursor cannot shift pages.
    // Reject repeated "load more" requests while the previous one is pending.
    if (append) budgetAppendInFlightRef.current = true;
    try {
      const cursor = append ? budgetCursorRef.current : null;
      const {data: matches,error: searchError}=await supabase.rpc('tercis_budget_search_cursor',{
        p_query:filters.query.trim().slice(0,100),
        p_status:filters.status==='todos'?'':filters.status,
        p_archived:filters.archived,
        p_after_created_at:cursor?.created_at??null,
        p_after_id:cursor?.id??null,
        p_page_size:100,
      });
      if(searchError)throw new Error(searchError.code==='PGRST202'
        ? 'A migração de paginação por cursor não está instalada no Supabase.'
        : searchError.message);
      const rows=(matches||[]) as {id:string;created_at:string|null}[];
      // 101 records signal the next page; never expose that sentinel as a row.
      const pageRows=rows.slice(0,100);
      const ids=pageRows.map(row=>row.id);
      let loaded:Budget[]=[];
      if(ids.length){
        const {data,error}=await supabase.from('budgets')
          .select('*, budget_items(*), company:companies(id,name,sector,city,email,phone), assignee:profiles!budgets_assigned_to_fkey(id,full_name,email,role), creator:profiles!budgets_created_by_fkey(id,full_name)')
          .in('id',ids);
        if(error)throw error;
        const position=new Map(ids.map((id,i)=>[id,i]));
        loaded=(data||[]).map(row=>{
          const {budget_items,...budget}=row;
          return {...budget,items:(budget_items||[]) as BudgetItem[]} as Budget;
        }).sort((a,b)=>(position.get(a.id)??0)-(position.get(b.id)??0));
      }
      if(requestId!==budgetRequestRef.current)return loaded;
      const last=pageRows[pageRows.length-1];
      budgetCursorRef.current=last?{created_at:last.created_at,id:last.id}:null;
      setHasMoreBudgets(rows.length>100);
      setBudgets(previous=>append
        ? [...previous.filter(old=>!loaded.some(next=>next.id===old.id)),...loaded]
        : loaded);
      return loaded;
    } finally {
      if(append)budgetAppendInFlightRef.current=false;
    }
  }

  async function loadCompanies() {
    if (demoMode) {
      // Demo data must obey the same customer visibility as Supabase RLS.
      const visible = isClientUser(profile)
        ? DEMO_COMPANIES.filter(c => c.id === profile?.company_id)
        : profile?.role === 'collaborator'
          ? DEMO_COMPANIES.filter(c => readDemoBudgets().some(b =>
              b.company_id === c.id &&
              (b.created_by === profile.id || b.assigned_to === profile.id)))
          : DEMO_COMPANIES;
      setCompanies(visible);
      return;
    }
    const { data, error } = await supabase.from('companies').select('*').eq('active', true).order('name');
    if (error) throw error;
    setCompanies((data || []) as Company[]);
  }

  async function loadTeam() {
    if (demoMode) {
      setTeam(profile?.role === 'admin' ? DEMO_PROFILES
        : DEMO_PROFILES.filter(member => member.id === profile?.id));
      return;
    }
    // Approval would be impossible if the admin list filtered out inactive users.
    // RLS is the authority: only a trusted admin can read pending profiles.
    const query = supabase.from('profiles').select('*').order('full_name');
    const { data, error } = profile?.role === 'admin' || profile?.role === 'company_admin'
      ? await query
      : await query.eq('active', true);
    if (error) throw error;
    setTeam((data || []) as Profile[]);
  }

  useEffect(() => {
    if (!profile) return;
    Promise.all([loadBudgets(),loadCompanies(),loadTeam()]).catch(error =>
      notify(error instanceof Error ? error.message : 'Falha ao carregar dados do Tercis.', 'error')
    );
  }, [profile?.id, demoMode]);

  // Refresh server-side filters and use a token to discard stale results.
  useEffect(()=>{
    if(view!=='budgets'||demoMode||isClientUser(profile))return;
    const timeout=window.setTimeout(()=>{
      void loadBudgets(false,{query:budgetQuery,status:budgetStatus,archived:budgetArchived})
        .catch(error=>notify(error instanceof Error?error.message:'Falha ao pesquisar orçamentos.','error'));
    },250);
    return ()=>window.clearTimeout(timeout);
  },[view,budgetQuery,budgetStatus,budgetArchived,profile?.id,demoMode]);

    async function exportAllBudgets(){
    if(demoMode||isClientUser(profile))throw new Error('Exportação disponível apenas para a equipa autorizada.');
    const {data,error}=await supabase.rpc('tercis_export_budget_csv_rows',{
      p_query:budgetQuery.trim().slice(0,100),
      p_status:budgetStatus==='todos'?'':budgetStatus,
      p_archived:budgetArchived,
    });
    if(error)throw new Error(error.message);
    if(!Array.isArray(data))throw new Error('Resposta inválida na exportação dos orçamentos.');
    const rows=(data as CsvBudgetRow[]).map(row=>({
      ...row,amount:Number(row.amount||0),
    }));
    if(rows.some(row=>!Number.isFinite(row.amount)))
      throw new Error('O servidor devolveu um valor financeiro inválido.');
    downloadCompleteCsv(rows);
    notify(rows.length+' propostas exportadas com os filtros atuais.','success');
  }

    // -- Budget CRUD ----------------------------
  async function handleSave() {
    if (!activeBudget || !profile) return;
    if (!canEditBudget(profile, activeBudget)) { notify('Este orçamento não permite edição comercial pelo seu papel ou estado.', 'error'); return; }
    if (!activeBudget.name.trim()) { notify('Indique uma designação para o orçamento.', 'error'); return; }
    if (saving) return;
    if ((activeBudget.items || []).some(item => !Number.isFinite(item.quantity) || item.quantity <= 0 ||
      !Number.isFinite(item.unit_cost ?? 0) || (item.unit_cost ?? 0) < 0 ||
      !Number.isFinite(item.margin ?? 0) || (item.margin ?? 0) < 0 ||
       !Number.isFinite(item.discount ?? 0) || (item.discount ?? 0) < 0 || (item.discount ?? 0) > 100)) {
      notify('Verifique as quantidades, custos e descontos dos itens.', 'error'); return;
    }

    setSaving(true);
    let confirmedVersion: number | null = null;
    let confirmedRef: string | null = null;
    try {
      if (demoMode) {
        const all = readDemoBudgets();
        const position = all.findIndex(b => b.id === activeBudget.id);
        if (position >= 0) all[position] = activeBudget;
        else all.push(activeBudget);
        saveDemoBudgets(all);
      } else {
        // One PostgreSQL transaction (migration 20261117112500_atomic_budget_save.sql).
        // Never delete line items in the client before the replacement succeeds.
        const { id, ref, name, company_id, assigned_to, status, sector, date, valid_until,
          notes, client_contact, client_email, include_tax, tax_rate, version } = activeBudget;
        const p_budget = { id, ref, name, company_id, assigned_to, status, sector, date,
          valid_until, notes, client_contact, client_email, include_tax, tax_rate, version: version ?? 1 };
        const p_items = (activeBudget.items ?? []).map((item, index) => ({
          id: item.id, code: item.code ?? '', description: item.description ?? '',
          reference: item.reference ?? '', brand: item.brand ?? '',
          category: item.category ?? '', sector: item.sector ?? '',
          unit: item.unit ?? 'un', quantity: item.quantity,
          unit_cost: item.unit_cost ?? item.unit_price ?? 0,
          margin: item.margin ?? 0, discount: item.discount ?? 0,
          notes: item.notes ?? '', sort_order: index,
        }));
        const { data, error } = await supabase.rpc('save_budget_atomic_with_ref', { p_budget, p_items }).single();
        if (error) throw new Error(error.code === 'PGRST202'
          ? 'A migração de gravação atómica com confirmação de versão não está instalada no Supabase.'
          : error.message);
        const saved = data as { id?: string; version?: number; ref?: string } | null;
        if (!saved || saved.id !== id || typeof saved.version !== 'number' ||
            !Number.isInteger(saved.version) || saved.version < 1 || !saved.ref)
          throw new Error('Não foi possível confirmar a versão gravada. Reabra o orçamento antes de tentar novamente.');
        confirmedVersion = saved.version;
        confirmedRef = saved.ref;
      }
      // The database transaction has committed. A subsequent refresh failure
      // must not turn a successful save into an apparent failure or trigger
      // a dangerous retry with a stale optimistic-lock version.
      const savedVersion = demoMode ? (activeBudget.version ?? 1) : confirmedVersion;
      if (savedVersion === null)
        throw new Error('A versão do orçamento não foi confirmada. Reabra o documento.');
      setActiveBudget(current => current?.id === activeBudget.id
        ? { ...current, version: savedVersion, ref: confirmedRef ?? current.ref } : current);
      setUnsaved(false);
      notify(demoMode
        ? 'Orçamento guardado localmente (demonstração).'
        : 'Orçamento guardado com todos os itens.');
      try {
        await loadBudgets(false,{query:budgetQuery,status:budgetStatus,archived:budgetArchived});
      } catch {
        notify('Orçamento guardado. A lista não atualizou devido a um problema de ligação; pode voltar a carregar a página.', 'info');
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Erro ao guardar orçamento.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleTransition(target: BudgetStatus): Promise<void> {
    if(!activeBudget || !profile) throw new Error('O orçamento não está disponível.');
    if(unsaved) throw new Error('Guarde as alterações pendentes antes de mudar o estado.');
    if(!nextBudgetStatuses(profile,activeBudget.status).includes(target))
      throw new Error('Não tem permissão para esta transição de estado.');
    if(isClientUser(profile) && activeBudget.can_respond === false)
      throw new Error('Esta versão é histórica e já não pode receber uma resposta.');
    if(target === 'pendente_aprovacao' && !activeBudget.company_id)
      throw new Error('O orçamento precisa de um cliente associado antes de ser submetido. Solicite a atribuição à administração.');
    if(['pendente_aprovacao','aprovado','enviado','aceite'].includes(target)) {
      if(!activeBudget.date || !activeBudget.valid_until || activeBudget.valid_until < activeBudget.date)
        throw new Error('Corrija as datas de emissão e validade antes de continuar.');
      if(['pendente_aprovacao','aprovado','enviado'].includes(target) &&
          !(activeBudget.items ?? []).some(item => (item.description ?? '').trim().length>0))
        throw new Error('Adicione um item válido antes de submeter esta proposta.');
      if(['enviado','aceite'].includes(target)) {
        const local = new Date();
        const today = new Date(local.getTime()-local.getTimezoneOffset()*60000).toISOString().slice(0,10);
        if(activeBudget.valid_until < today)
          throw new Error('Esta proposta já expirou e não pode ser enviada nem aceite.');
      }
    }
    setSaving(true);
    try {
      let version=(activeBudget.version??1)+1;
      if(demoMode) {
        const all=readDemoBudgets();
        const index=all.findIndex(b=>b.id===activeBudget.id);
        if(index<0) throw new Error('Guarde o orçamento antes de mudar o estado.');
        if((all[index].version??1)!==(activeBudget.version??1))
          throw new Error('O orçamento foi alterado noutra sessão. Reabra-o.');
        all[index]={...all[index],status:target,version};
        saveDemoBudgets(all);
      } else {
        const {data,error}=await supabase.rpc('tercis_transition_budget',{
          p_budget_id:activeBudget.id,p_to:target,p_expected_version:activeBudget.version??1,
        }).single();
        if(error)throw new Error(error.code==='PGRST202'
          ? 'A migração de transições de estado ainda não está aplicada no Supabase.'
          : error.message);
        version=(data as {version:number}|null)?.version??version;
      }
      setActiveBudget(current=>current?.id===activeBudget.id ? {...current,status:target,version}:current);
      notify('O estado do orçamento foi atualizado.');
      try {
        await loadBudgets(false,{query:budgetQuery,status:budgetStatus,archived:budgetArchived});
      } catch {
        notify('Estado alterado com sucesso. A lista não atualizou por falha de ligação.', 'info');
      }
    } catch(reason) {
      notify(reason instanceof Error?reason.message:'Falha ao alterar o estado.','error');
      throw reason;
    } finally {setSaving(false);}
  }

  async function openBudget(b: Budget) {
    if(isClientUser(profile)) {
      setActiveBudget({...b,items:(b.items||[]).map(item=>({...item}))});
      setUnsaved(false);
      setView('viewer');
      return;
    }
    if (demoMode) {
      setActiveBudget({ ...b, items: (b.items ?? []).map(i => ({ ...i })) });
    } else {
      const { data, error } = await supabase.from('budget_items').select('*').eq('budget_id', b.id).order('sort_order');
      if (error) { notify(error.message, 'error'); return; }
      setActiveBudget({ ...b, items: (data ?? []) as BudgetItem[] });
    }
    setUnsaved(false);
    setView(canEditBudget(profile,b) ? 'editor' : 'viewer');
  }

  function openNew() {
    if (!canCreateBudget(profile) || !profile) { notify('Não tem permissão para criar orçamentos.', 'error'); return; }
    setActiveBudget(createBudgetDraft(profile, newId(), buildRef(budgets)));
    setUnsaved(false);
    setView('editor');
  }

  function duplicateBudget(b: Budget) {
    if (!profile || !canDuplicateBudget(profile,b)) { notify('Sem permissão para duplicar.', 'error'); return; }
    const copy = duplicateBudgetDraft(b, profile, newId(), buildRef(budgets), newId);
    setActiveBudget(copy);
    setUnsaved(true);
    setView('editor');
    notify('Orçamento duplicado. Guarde para confirmar.', 'info');
  }

  async function deleteBudget(id: string) {
    const selected = budgets.find(b => b.id === id);
    if (!selected || !canDeleteBudget(profile, selected)) { notify('Só é possível eliminar rascunhos autorizados.', 'error'); return; }
    try {
      if (demoMode) {
        const all = readDemoBudgets();
        const target = all.find(b => b.id === id);
        if (!target || !canDeleteBudget(profile,target)) throw new Error('Sem permissão para eliminar este rascunho.');
        saveDemoBudgets(all.filter(b => b.id !== id));
      } else {
        const { data, error } = await supabase.from('budgets').delete().eq('id', id).select('id');
        if (error) throw error;
        if (!data?.length) throw new Error('O orçamento não foi eliminado. Verifique as permissões.');
      }
      // The DELETE already committed. A refresh failure is not a failed delete.
      setBudgets(previous => previous.filter(record => record.id !== id));
      if (activeBudget?.id === id) { setActiveBudget(null); setUnsaved(false); }
      notify('Orçamento eliminado.', 'info');
      try {
        await loadBudgets(false,{query:budgetQuery,status:budgetStatus,archived:budgetArchived});
      } catch {
        notify('Orçamento eliminado, mas não foi possível atualizar a lista. Volte a carregar a página.', 'info');
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Erro ao eliminar.', 'error');
    }
  }

  async function archiveBudget(budget: Budget, archive: boolean) {
    if(demoMode || !profile?.active || !['admin','company_admin'].includes(profile.role)) return;
    if(!confirm(archive ? 'Arquivar este orçamento sem o eliminar?' : 'Recuperar este orçamento do arquivo?')) return;
    try {
      const {data,error}=await supabase.rpc('tercis_set_budget_archive',{
        p_budget_id:budget.id,p_expected_version:budget.version ?? 1,p_archive:archive,
      }).single();
      if(error)throw error;
      const result=data as {version:number;archived_at:string|null}|null;
      if(!result || typeof result.version!=='number') throw new Error('Arquivo não confirmado. Atualize a página.');
      setBudgets(previous=>previous.map(item=>item.id===budget.id
        ? {...item,version:result.version,archived_at:result.archived_at} : item));
      notify(archive?'Orçamento arquivado com sucesso.':'Orçamento recuperado do arquivo.');
      try {
        await loadBudgets(false,{query:budgetQuery,status:budgetStatus,archived:budgetArchived});
      } catch {
        notify('Arquivo atualizado. A lista pode estar desatualizada; atualize-a.','info');
      }
    } catch(reason){
      notify(reason instanceof Error?reason.message:'Falha ao alterar o arquivo.','error');
    }
  }

  function handleBack() {
    if (view === 'editor' && unsaved && !confirm('Tem alterações por guardar. Sair sem guardar?')) return;
    setView('budgets');
    setActiveBudget(null);
    setUnsaved(false);
  }

  function changeActiveBudget(b: Budget) {
    setActiveBudget(b);
    setUnsaved(true);
  }

  const isEditor = view === 'editor';

  return (
    <div className="tercis-app flex bg-[#f5f6f8] min-h-screen">
      {!isEditor && (
        <Sidebar
          current={view}
          budgetCount={budgets.length}
          onChange={(v) => {
            if (!canAccessView(profile,v)) { notify('Não tem acesso a esta página.', 'error'); return; }
            if (v !== 'editor' && v !== 'viewer') { setActiveBudget(null); setUnsaved(false); }
            setView(v);
            if(v==='dashboard' && !demoMode && !isClientUser(profile)){
              void loadBudgets().catch(error=>
                notify(error instanceof Error?error.message:'Falha ao atualizar o painel.','error'));
            }
          }}
        />
      )}

      <main className="tercis-main flex-1 min-w-0 overflow-x-hidden">
        {!online && <div role="alert" className="px-5 py-3 bg-amber-50 border-b border-amber-200 text-amber-950 text-xs font-semibold">
          Sem ligação à Internet. Não guarde nem altere estados de propostas até recuperar a ligação.
          As alterações em edição não são sincronizadas automaticamente.
        </div>}
        {demoMode && !isEditor && <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-5 py-2 text-xs font-semibold">Modo demonstração · dados locais de exemplo. Não introduza informações reais de clientes; não existe sincronização com o Supabase.</div>}
        {view === 'dashboard' && (
          <Dashboard
            budgets={budgets.filter(b=>!b.archived_at)}
            companies={companies}
            onNew={openNew}
            onOpen={openBudget}
            canCreate={canCreateBudget(profile)}
          />
        )}
        {view === 'budgets' && (
          <BudgetList
            budgets={budgets}
            companies={companies}
            team={team}
            onNew={openNew}
            onEdit={openBudget}
            onDelete={(id) => { if (confirm('Eliminar orçamento?')) deleteBudget(id); }}
            onDuplicate={duplicateBudget}
            canCreate={canCreateBudget(profile)}
            canDuplicate={b => canDuplicateBudget(profile,b)}
            canDelete={b => canDeleteBudget(profile,b)}
            canEdit={b => canEditBudget(profile,b)}
            canArchive={!demoMode && Boolean(profile?.active && ['admin','company_admin'].includes(profile.role))}
            onArchive={(b,archive)=>{void archiveBudget(b,archive);}}
            hasMore={hasMoreBudgets}
            searchQuery={demoMode?undefined:budgetQuery}
            onSearchQuery={demoMode?undefined:setBudgetQuery}
            selectedStatus={demoMode?undefined:budgetStatus}
            onSelectedStatus={demoMode?undefined:setBudgetStatus}
            archivedOnly={demoMode?undefined:budgetArchived}
            onArchivedOnly={demoMode?undefined:setBudgetArchived}
            onExportAll={demoMode?undefined:exportAllBudgets}
                        onLoadMore={()=>{void loadBudgets(true,{query:budgetQuery,status:budgetStatus,archived:budgetArchived}).catch(error =>
              notify(error instanceof Error ? error.message : 'Falha na paginação.','error'));}}
          />
        )}
        {view === 'editor' && activeBudget && (
          <BudgetEditor
            budget={activeBudget}
            companies={companies}
            team={team}
            onChange={changeActiveBudget}
            onSave={handleSave}
            onTransition={handleTransition}
            onBack={handleBack}
            saving={saving}
            unsaved={unsaved}
            canChangeAssignment={profile?.role === 'admin' || profile?.role === 'company_admin'}
          />
        )}
        {view === 'catalog' && <CatalogView />}
        {view === 'companies' && (
          <CompaniesView
            companies={companies}
            budgets={budgets}
            onRefresh={async () => { await Promise.all([loadCompanies(), loadBudgets()]); }}
          />
        )}
        {view === 'team' && (
          <TeamView
            team={team}
            budgets={budgets}
            companies={companies}
            onRefresh={loadTeam}
          />
        )}
        {view === 'reports' && (
          <ReportsView
            budgets={budgets}
            companies={companies}
            team={team}
            partial={hasMoreBudgets}
          />
        )}
        {view === 'settings' && <SettingsView onOpenAccess={() => setView('access')}/>}
        {view === 'access' && <AccessView/>}
        {view === 'viewer' && activeBudget && <BudgetDetail budget={activeBudget}
          onBack={handleBack} onTransition={handleTransition} transitionBusy={saving}/>}

        {view === 'chat' && (
          <ChatView
            budgets={budgets}
            onBack={() => {
              setView('dashboard');
              setActiveBudget(null);
              setUnsaved(false);
            }}
          />
        )}
      </main>

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}

// ----------------------------------------------
// Root with auth guard
// ----------------------------------------------
function AppRoot() {
  const { session, profile, loading, demoMode } = useAuth();

  if (!isSupabaseConfigured && !isDemoAllowed) {
    return <main className="min-h-screen flex items-center justify-center bg-slate-950 p-6" role="alert">
      <div className="max-w-xl bg-white rounded-2xl p-8 shadow-xl text-slate-900 space-y-3">
        <h1 className="text-xl font-bold">Tercis sem configuração de servidor</h1>
        <p className="text-sm">Por segurança, o modo demonstração está desativado em produção. Configure as credenciais públicas do Supabase antes de publicar a aplicação.</p>
      </div>
    </main>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">A carregar...</p>
        </div>
      </div>
    );
  }

  if (!session) return <LoginView />;
  if (!demoMode && (!profile || profile.active !== true)) return <PendingApprovalView />;
  // Reset all cached customers, budgets and editor drafts when the identity
  // changes; a previous account must never flash on another account's screen.
  return demoMode ? <AppInner key={profile?.id ?? 'demo'} />
    : <MFAGate><AppInner key={profile!.id} /></MFAGate>;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoot />
    </AuthProvider>
  );
}
