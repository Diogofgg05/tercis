import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginView } from './auth/LoginView';
import { MFAGate } from './auth/MFAGate';
import { PendingApprovalView } from './auth/PendingApprovalView';
import { Sidebar } from './components/Sidebar';
import { WorkspaceTopbar } from './components/WorkspaceTopbar';
import type { View } from './components/Sidebar';
import { Toast } from './components/Toast';
import { ConfirmActionDialog } from './components/ConfirmActionDialog';
import type { ToastType } from './components/Toast';
import { Dashboard } from './views/Dashboard';
import { BudgetList, downloadCompleteCsv } from './views/BudgetList';
import type { CsvBudgetRow } from './views/BudgetList';
import { CallProvider } from './components/CallProvider';
import { isDemoAllowed, isSupabaseConfigured, supabase } from './lib/supabase';
import type { Budget, BudgetItem, BudgetStatus, Company, Profile } from './types';
import { DEMO_BUDGETS, DEMO_COMPANIES, DEMO_PROFILES, hydrateDemoBudget } from './demoData';
import { isClientUser, nextBudgetStatuses } from './domain/workflow';
import { calcItem } from './calc';
import { canAccessView } from './domain/access';
import { canCreateBudget, canEditBudget, canDeleteBudget, canDuplicateBudget } from './domain/budget-actions';
import { createBudgetDraft, duplicateBudgetDraft } from './domain/budget-drafts';

const BudgetEditor=lazy(()=>import('./views/BudgetEditor').then(module=>({default:module.BudgetEditor})));
const BudgetDetail=lazy(()=>import('./views/BudgetDetail').then(module=>({default:module.BudgetDetail})));
const AccessView=lazy(()=>import('./views/AccessView').then(module=>({default:module.AccessView})));
const CatalogView=lazy(()=>import('./views/CatalogView').then(module=>({default:module.CatalogView})));
const CompaniesView=lazy(()=>import('./views/CompaniesView').then(module=>({default:module.CompaniesView})));
const TeamView=lazy(()=>import('./views/TeamView').then(module=>({default:module.TeamView})));
const ReportsView=lazy(()=>import('./views/ReportsView').then(module=>({default:module.ReportsView})));
const SettingsView=lazy(()=>import('./views/SettingsView').then(module=>({default:module.SettingsView})));
const ChatView=lazy(()=>import('./views/ChatView').then(module=>({default:module.ChatView})));
const PlatformAdminView=lazy(()=>import('./views/PlatformAdminView').then(module=>({default:module.PlatformAdminView})));

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
type PendingAction =
  | {kind:'leave'; target:View}
  | {kind:'delete'; budgetId:string; name:string; ref:string}
  | {kind:'archive'; budget:Budget; archive:boolean};

function AppInner() {
  const { profile, demoMode } = useAuth();
  const [view, setView] = useState<View>(()=>profile?.platform_admin&&sessionStorage.getItem('tercis:open-company')!==profile.organization_id?'platform':'dashboard');
  const companyWorkspace = !profile?.platform_admin || sessionStorage.getItem('tercis:open-company') === profile.organization_id;
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [hasMoreBudgets,setHasMoreBudgets] = useState(false);
  const budgetCursorRef = useRef<{ created_at: string | null; id: string } | null>(null);
  const budgetCursorFilterRef = useRef('');
  const budgetAppendInFlightRef = useRef(false);
  const budgetRequestRef = useRef(0);
  const [budgetQuery,setBudgetQuery]=useState('');
  const [chatBudgetId,setChatBudgetId]=useState<string|null>(null);
  const [chatPeerId,setChatPeerId]=useState<string|null>(null);
  const [chatOpenRequest,setChatOpenRequest]=useState(0);
  const [budgetStatus,setBudgetStatus]=useState<BudgetStatus|'todos'>('todos');
  const [budgetArchived,setBudgetArchived]=useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [organizationName,setOrganizationName]=useState('');
  useEffect(()=>{let alive=true;if(profile?.platform_admin&&profile.organization_id)void supabase.from('organizations').select('name').eq('id',profile.organization_id).single().then(({data})=>{if(alive)setOrganizationName(data?.name||'Empresa selecionada');});return()=>{alive=false;};},[profile?.platform_admin,profile?.organization_id]);
  const [team, setTeam] = useState<Profile[]>([]);
  const [activeBudget, setActiveBudget] = useState<Budget | null>(null);
  const [unsaved, setUnsaved] = useState(false);
  // A user can keep typing while a save is in flight. A committed snapshot
  // must never clear the dirty state of edits made after that save started.
  const draftRevisionRef = useRef(0);
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
  const saveInFlight=useRef(false);
  const [autosaveEnabled,setAutosaveEnabled]=useState(()=>localStorage.getItem('tercis:autosave')!=='false');
  const [autosaveError,setAutosaveError]=useState('');
  const [lastSaved,setLastSaved]=useState('');
  useEffect(()=>{setAutosaveError('');setLastSaved('');},[activeBudget?.id]);
  const [toast, setToast] = useState<ToastState>(null);
  const [pendingAction,setPendingAction]=useState<PendingAction|null>(null);
  const [confirmingAction,setConfirmingAction]=useState(false);

  const notify = useCallback((message: string, type: ToastType = 'success') => setToast({ message, type }), []);

  // -- Load data ------------------------------------------------------
  async function loadBudgets(append = false, filters: {query:string;status:BudgetStatus|'todos';archived:boolean} = {query:'',status:'todos',archived:false}) {
    // Reject duplicate append and a cursor from a different filter set.
    // Neither should cancel a request that is already in progress.
    const filterKey=JSON.stringify([filters.query.trim().slice(0,100),filters.status,filters.archived]);
    if (append && budgetAppendInFlightRef.current) return [];
    if (append && budgetCursorFilterRef.current !== filterKey) {
      setHasMoreBudgets(false);
      return [];
    }
    const requestId=++budgetRequestRef.current;
    if (!append) budgetCursorFilterRef.current=filterKey;
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
    const {data,error}=await supabase.rpc('tercis_company_team');
    if (error) throw error;
    setTeam((data || []) as Profile[]);
  }

  useEffect(() => {
    if (!profile || !companyWorkspace) {
      budgetRequestRef.current++;
      setBudgets([]);setCompanies([]);setTeam([]);setHasMoreBudgets(false);
      return;
    }
    Promise.all([loadBudgets(),loadCompanies(),loadTeam()]).catch(error =>
      notify(error instanceof Error ? error.message : 'Falha ao carregar dados do Tercis.', 'error')
    );
  }, [profile?.id, companyWorkspace, demoMode]);

  // Refresh server-side filters and use a token to discard stale results.
  useEffect(()=>{
    if(!companyWorkspace||view!=='budgets'||demoMode||isClientUser(profile))return;
    const timeout=window.setTimeout(()=>{
      void loadBudgets(false,{query:budgetQuery,status:budgetStatus,archived:budgetArchived})
        .catch(error=>notify(error instanceof Error?error.message:'Falha ao pesquisar orçamentos.','error'));
    },250);
    return ()=>window.clearTimeout(timeout);
  },[view,budgetQuery,budgetStatus,budgetArchived,profile?.id,companyWorkspace,demoMode]);

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
  async function handleSave(automatic=false) {
    if (!activeBudget || !profile) return;
    if (!canEditBudget(profile, activeBudget)) { notify('Este orçamento não permite edição comercial pelo seu papel ou estado.', 'error'); return; }
    if (!activeBudget.name.trim()) { notify('Indique uma designação para o orçamento.', 'error'); return; }
    if (saving||saveInFlight.current) return;
    if ((activeBudget.items || []).some(item => !Number.isFinite(item.quantity) || item.quantity <= 0 ||
      !Number.isFinite(item.unit_cost ?? 0) || (item.unit_cost ?? 0) < 0 ||
      !Number.isFinite(item.margin ?? 0) || (item.margin ?? 0) < 0 ||
       !Number.isFinite(item.discount ?? 0) || (item.discount ?? 0) < 0 || (item.discount ?? 0) > 100)) {
      notify('Verifique as quantidades, custos e descontos dos itens.', 'error'); return;
    }

    const saveRevision = draftRevisionRef.current;
    saveInFlight.current=true;
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
      setUnsaved(draftRevisionRef.current !== saveRevision);
      setAutosaveError('');setLastSaved(new Date().toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'}));
      if(!automatic)notify(demoMode
        ? 'Rascunho local guardado.'
        : 'Orçamento guardado com todos os itens.');
      if(automatic){
        setBudgets(previous=>{
          const saved={...activeBudget,version:savedVersion,ref:confirmedRef??activeBudget.ref};
          return previous.some(b=>b.id===saved.id)?previous.map(b=>b.id===saved.id?saved:b):[saved,...previous];
        });
      }else try {
        await loadBudgets(false,{query:budgetQuery,status:budgetStatus,archived:budgetArchived});
      } catch {
        notify('Orçamento guardado. A lista não atualizou devido a um problema de ligação; pode voltar a carregar a página.', 'info');
      }
    } catch (error) {
      const message=error instanceof Error ? error.message : 'Erro ao guardar orçamento.';
      setAutosaveError(message);
      if(!automatic)notify(message,'error');
    } finally {
      saveInFlight.current=false;
      setSaving(false);
    }
  }

  // Debounce only valid, unpublished drafts. The server's atomic save retains
  // its optimistic version check; a conflict pauses autosave without retrying
  // or overwriting another session's changes.
  const latestSave=useRef(handleSave);latestSave.current=handleSave;
  useEffect(()=>{
    if(!autosaveEnabled||autosaveError||!online||!unsaved||saving||view!=='editor'
      ||!activeBudget?.name.trim()||activeBudget.status!=='rascunho'||activeBudget.sent_at
      ||!canEditBudget(profile,activeBudget))return;
    const invalid=(activeBudget.items||[]).some(item=>
      !Number.isFinite(item.quantity)||item.quantity<=0||
      !Number.isFinite(item.unit_cost??0)||(item.unit_cost??0)<0||
      !Number.isFinite(item.margin??0)||(item.margin??0)<0||
      !Number.isFinite(item.discount??0)||(item.discount??0)<0||(item.discount??0)>100);
    if(invalid)return;
    const timer=window.setTimeout(()=>{void latestSave.current(true);},1800);
    return()=>window.clearTimeout(timer);
  },[activeBudget,autosaveEnabled,autosaveError,online,unsaved,saving,view,profile]);

  async function handleTransition(target: BudgetStatus): Promise<void> {
    if(!activeBudget || !profile) throw new Error('O orçamento não está disponível.');
    if(activeBudget.is_example)throw new Error('Os orçamentos de demonstração não podem ser enviados ou submetidos.');
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

  useEffect(()=>{
    const raw=sessionStorage.getItem('tercis:open-budget');if(!raw||view==='platform')return;
    let target:{organization:string;id:string};try{target=JSON.parse(raw);}catch{sessionStorage.removeItem('tercis:open-budget');return;}
    if(target.organization!==profile?.organization_id)return;
    let alive=true;
    void supabase.from('budgets').select('*').eq('id',target.id).single().then(async({data,error})=>{
      if(!alive)return;
      sessionStorage.removeItem('tercis:open-budget');
      if(error){notify(error.message,'error');return;}
      await openBudget(data as Budget);
    });
    return()=>{alive=false;};
    // The target is handled after the workspace is mounted, including same-company navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[profile?.organization_id,view]);

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

  async function deleteBudget(id: string): Promise<boolean> {
    const selected = budgets.find(b => b.id === id);
    if (!selected || !canDeleteBudget(profile, selected)) { notify('Só é possível eliminar rascunhos autorizados.', 'error'); return false; }
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
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Erro ao eliminar.', 'error');
      return false;
    }
  }

  async function archiveBudget(budget: Budget, archive: boolean): Promise<boolean> {
    if(demoMode || !profile?.active || !['admin','company_admin'].includes(profile.role)) return false;
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
      return true;
    } catch(reason){
      notify(reason instanceof Error?reason.message:'Falha ao alterar o arquivo.','error');
      return false;
    }
  }

  function performNavigation(next:View){
    if(next==='platform') {
      sessionStorage.removeItem('tercis:open-company');
      sessionStorage.removeItem('tercis:open-budget');
    }
    if(next!=='editor'&&next!=='viewer'){
      setActiveBudget(null);
      setUnsaved(false);
    }
    setView(next);
    if(next==='dashboard'&&!demoMode&&!isClientUser(profile)){
      void loadBudgets().catch(error=>
        notify(error instanceof Error?error.message:'Falha ao atualizar o painel.','error'));
    }
  }

  function handleBack(){
    if(saving){notify('Aguarde a confirmação da operação em curso.','info');return;}
    if(view==='editor'&&unsaved){
      setPendingAction({kind:'leave',target:'budgets'});
      return;
    }
    performNavigation('budgets');
    setActiveBudget(null);
    setUnsaved(false);
  }

  function changeActiveBudget(b: Budget) {
    draftRevisionRef.current++;
    setActiveBudget(b);
    setUnsaved(true);
  }

  const isEditor = view === 'editor';

  function navigateTo(next:View) {
    if(saving){notify('Aguarde a confirmação da operação em curso.','info');return;}
    if(!canAccessView(profile,next)){
      notify('Não tem acesso a esta página.','error');
      return;
    }
    if(view==='editor'&&unsaved&&next!==view){
      setPendingAction({kind:'leave',target:next});
      return;
    }
    performNavigation(next);
  }

  function requestDelete(id:string){
    const target=budgets.find(b=>b.id===id);
    if(!target||!canDeleteBudget(profile,target)){
      notify('Só é possível eliminar rascunhos autorizados.','error');
      return;
    }
    setPendingAction({kind:'delete',budgetId:id,name:target.name||'Sem designação',ref:target.ref});
  }

  function requestArchive(budget:Budget,archive:boolean){
    if(demoMode||!profile?.active||!['admin','company_admin'].includes(profile.role))return;
    setPendingAction({kind:'archive',budget,archive});
  }

  async function confirmAction(){
    const action=pendingAction;
    if(!action||confirmingAction||saving)return;
    if(action.kind==='leave'){
      setPendingAction(null);
      performNavigation(action.target);
      return;
    }
    setConfirmingAction(true);
    try{
      const success=action.kind==='delete'
        ?await deleteBudget(action.budgetId)
        :await archiveBudget(action.budget,action.archive);
      if(success)setPendingAction(null);
    }finally{setConfirmingAction(false);}
  }

  const confirmationTitle = pendingAction?.kind==='leave'
    ? 'Sair sem guardar alterações?'
    : pendingAction?.kind==='delete'
      ? 'Eliminar rascunho?'
      : pendingAction?.archive ? 'Arquivar proposta?' : 'Recuperar proposta do arquivo?';
  const confirmationDescription = pendingAction?.kind==='leave'
    ? 'As alterações deste orçamento que ainda não foram guardadas serão perdidas.'
    : pendingAction?.kind==='delete'
      ? 'A eliminação deste rascunho é definitiva e não pode ser anulada.'
      : pendingAction?.archive
        ? 'A proposta deixará de aparecer na lista normal e ficará disponível no arquivo.'
        : 'A proposta regressará à lista de documentos ativos.';

  return (
    <div className="tercis-app flex bg-[#f5f6f8] min-h-screen">
      {!isEditor && (
        <Sidebar
          current={view}
          budgetCount={budgets.length}
          onChange={navigateTo}
        />
      )}

      <main className="tercis-main flex-1 min-w-0 overflow-x-hidden" data-view={view} data-redesigned={!['dashboard','team','access'].includes(view)}>
        {!isEditor && <WorkspaceTopbar
          current={view} onChange={navigateTo} online={online} demoMode={demoMode}
          onChat={peer=>{setChatPeerId(peer||null);setChatOpenRequest(value=>value+1);setChatBudgetId(null);navigateTo('chat');}}
          onBudget={id=>{void supabase.from('budgets').select('*').eq('id',id).single().then(({data,error})=>{if(error)notify(error.message,'error');else void openBudget(data as Budget);});}}/>}
        {profile?.platform_admin&&companyWorkspace&&view!=='platform'&&<div className="platform-workspace-banner"><span><strong>Administração da plataforma</strong> · {organizationName}</span><button type="button" onClick={()=>navigateTo('platform')}>Mudar de empresa</button></div>}
        {!online && <div role="alert" className="px-5 py-3 bg-amber-50 border-b border-amber-200 text-amber-950 text-xs font-semibold">
          Sem ligação à Internet. Não guarde nem altere estados de propostas até recuperar a ligação.
          As alterações em edição não são sincronizadas automaticamente.
        </div>}
        <Suspense fallback={<div className="p-6 text-sm text-slate-500" role="status">A carregar página…</div>}>
        {view === 'dashboard' && (
          <Dashboard
            budgets={budgets.filter(b=>!b.archived_at&&!b.is_example)}
            companies={companies.filter(c=>!c.is_example)}
            onNew={openNew}
            onOpen={openBudget}
            onShowBudgets={() => navigateTo('budgets')}
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
            onDelete={requestDelete}
            onDuplicate={duplicateBudget}
            canCreate={canCreateBudget(profile)}
            canDuplicate={b => canDuplicateBudget(profile,b)}
            canDelete={b => canDeleteBudget(profile,b)}
            canEdit={b => canEditBudget(profile,b)}
            canArchive={!demoMode && Boolean(profile?.active && ['admin','company_admin'].includes(profile.role))}
            onArchive={requestArchive}
            hasMore={hasMoreBudgets}
            searchQuery={budgetQuery}
            onSearchQuery={setBudgetQuery}
            selectedStatus={demoMode?undefined:budgetStatus}
            onSelectedStatus={demoMode?undefined:setBudgetStatus}
            archivedOnly={demoMode?undefined:budgetArchived}
            onArchivedOnly={demoMode?undefined:setBudgetArchived}
            onExportAll={demoMode?undefined:exportAllBudgets}
                        onLoadMore={()=>{void loadBudgets(true,{query:budgetQuery,status:budgetStatus,archived:budgetArchived}).catch(error =>
              notify(error instanceof Error ? error.message : 'Falha na paginação.','error'));}}
          />
        )}
        {view === 'platform' && profile?.platform_admin && <PlatformAdminView onWorkspace={(id,budgetId)=>{sessionStorage.setItem('tercis:open-company',id);if(budgetId)sessionStorage.setItem('tercis:open-budget',JSON.stringify({organization:id,id:budgetId}));if(id===profile.organization_id)setView(budgetId?'budgets':'dashboard');}}/>}
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
            autosaveEnabled={autosaveEnabled}
            onAutosaveEnabledChange={enabled=>{setAutosaveEnabled(enabled);localStorage.setItem('tercis:autosave',String(enabled));}}
            autosaveError={autosaveError}
            lastSaved={lastSaved}
          />
        )}
        {view === 'catalog' && <CatalogView />}
        {view === 'companies' && (
          <CompaniesView
            companies={companies}
            budgets={budgets}
            onRefresh={async () => { await Promise.all([loadCompanies(), loadBudgets()]); }}
            onOpenBudget={openBudget}
            onOpenInternalNotes={budgetId=>{
              setChatBudgetId(budgetId);
              navigateTo('chat');
            }}
            onSeeBudgets={companyName=>{
              setBudgetQuery(companyName);
              setBudgetStatus('todos');
              setBudgetArchived(false);
              navigateTo('budgets');
            }}
          />
        )}
        {view === 'team' && (
          <TeamView
            onOpenChat={(member)=>{setChatPeerId(member.id);setChatOpenRequest(value=>value+1);setChatBudgetId(null);navigateTo('chat');}}
            team={team}
            budgets={budgets}
            companies={companies}
            onRefresh={loadTeam}
          />
        )}
        {view === 'reports' && (
          <ReportsView
            budgets={budgets.filter(b=>!b.is_example)}
            companies={companies.filter(c=>!c.is_example)}
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
            initialPeerId={chatPeerId}
            initialPeerRequest={chatOpenRequest}
            onOpenTeam={()=>navigateTo('team')}
            budgets={budgets}
            initialBudgetId={chatBudgetId}
            onOpenBudget={openBudget}
            onBack={() => {
              setView('dashboard');
              setActiveBudget(null);
              setUnsaved(false);
            }}
          />
        )}
        </Suspense>
      </main>

      <ConfirmActionDialog open={pendingAction!==null}
        title={confirmationTitle} description={confirmationDescription}
        danger={pendingAction?.kind==='delete'||pendingAction?.kind==='leave'}
        busy={confirmingAction||saving}
        confirmLabel={pendingAction?.kind==='leave'?'Sair sem guardar':
          pendingAction?.kind==='delete'?'Eliminar rascunho':
          pendingAction?.archive?'Arquivar':'Recuperar'}
        onClose={()=>setPendingAction(null)} onConfirm={()=>{void confirmAction();}}>
        {pendingAction?.kind==='delete'
          ? <p><strong>{pendingAction.name}</strong> · {pendingAction.ref}</p>
          :pendingAction?.kind==='archive'
            ? <p><strong>{pendingAction.budget.name||pendingAction.budget.ref}</strong> · {pendingAction.budget.ref}</p>
            : <p>Pode cancelar e regressar ao editor para guardar o trabalho.</p>}
      </ConfirmActionDialog>
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
        <p className="text-sm">O TERCIS necessita de uma ligação ao Supabase para autenticar utilizadores e guardar os dados empresariais. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY antes de publicar.</p>
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
    : <MFAGate><CallProvider key={`${profile!.id}:${profile!.organization_id}`}><AppInner key={`${profile!.id}:${profile!.organization_id}`} /></CallProvider></MFAGate>;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoot />
    </AuthProvider>
  );
}
