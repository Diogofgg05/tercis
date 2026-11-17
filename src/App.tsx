import { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginView } from './auth/LoginView';
import { MFAGate } from './auth/MFAGate';
import { Sidebar } from './components/Sidebar';
import type { View } from './components/Sidebar';
import { Toast } from './components/Toast';
import type { ToastType } from './components/Toast';
import { Dashboard } from './views/Dashboard';
import { BudgetList } from './views/BudgetList';
import { BudgetEditor } from './views/BudgetEditor';
import { CatalogView } from './views/CatalogView';
import { CompaniesView } from './views/CompaniesView';
import { TeamView } from './views/TeamView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';
import { ChatView } from './views/ChatView';
import { supabase } from './lib/supabase';
import type { Budget, BudgetItem, BudgetStatus, Company, Profile } from './types';
import { DEMO_BUDGETS, DEMO_COMPANIES, DEMO_PROFILES, hydrateDemoBudget } from './demoData';
import { hasPermission } from './domain/workflow';

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

function addDays(n: number): string {
  const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10);
}

function emptyBudget(ref: string, userId: string): Budget {
  return {
    id: newId(), ref,
    name: '', company_id: null, assigned_to: userId,
    status: 'rascunho' as BudgetStatus,
    sector: 'Eletricidade Industrial',
    date: new Date().toISOString().slice(0, 10),
    valid_until: addDays(30),
    notes: '', client_contact: '', client_email: '',
    include_tax: false, tax_rate: 23,
    created_by: userId, items: [],
  };
}

// ----------------------------------------------
// Inner app (requires auth)
// ----------------------------------------------
type ToastState = { message: string; type: ToastType } | null;

function AppInner() {
  const { profile, demoMode } = useAuth();
  const [view, setView] = useState<View>('dashboard');
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [team, setTeam] = useState<Profile[]>([]);
  const [activeBudget, setActiveBudget] = useState<Budget | null>(null);
  const [unsaved, setUnsaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const notify = useCallback((message: string, type: ToastType = 'success') => setToast({ message, type }), []);

  // -- Load data ------------------------------------------------------
  async function loadBudgets() {
    if (demoMode) {
      const records = readDemoBudgets();
      const visible = profile?.role === 'client'
        ? records.filter(b => b.company_id === profile.company_id)
        : profile?.role === 'collaborator'
          ? records.filter(b => b.created_by === profile.id || b.assigned_to === profile.id)
          : records;
      setBudgets(visible.map(hydrateDemoBudget));
      return;
    }
    const { data, error } = await supabase
      .from('budgets')
      .select('*, budget_items(*), company:companies(id,name,sector,city,email,phone), assignee:profiles!budgets_assigned_to_fkey(id,full_name,email,role), creator:profiles!budgets_created_by_fkey(id,full_name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    setBudgets((data || []).map(row => {
      const { budget_items, ...budget } = row;
      return { ...budget, items: (budget_items || []) as BudgetItem[] } as Budget;
    }));
  }

  async function loadCompanies() {
    if (demoMode) {
      setCompanies(DEMO_COMPANIES);
      return;
    }
    const { data, error } = await supabase.from('companies').select('*').eq('active', true).order('name');
    if (error) throw error;
    setCompanies((data || []) as Company[]);
  }

  async function loadTeam() {
    if (demoMode) {
      setTeam(DEMO_PROFILES);
      return;
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('active', true).order('full_name');
    if (error) throw error;
    setTeam((data || []) as Profile[]);
  }

  useEffect(() => {
    if (!profile) return;
    Promise.all([loadBudgets(),loadCompanies(),loadTeam()]).catch(error =>
      notify(error instanceof Error ? error.message : 'Falha ao carregar dados do Tercis.', 'error')
    );
  }, [profile?.id, demoMode]);

  // -- Budget CRUD ----------------------------
  async function handleSave() {
    if (!activeBudget || !profile) return;
    if (!hasPermission(profile, 'create_budgets')) { notify('Sem permissão para guardar orçamentos.', 'error'); return; }
    if (!activeBudget.name.trim()) { notify('Indique uma designação para o orçamento.', 'error'); return; }
    if ((activeBudget.items || []).some(item => !Number.isFinite(item.quantity) || item.quantity <= 0 ||
      !Number.isFinite(item.unit_cost ?? 0) || (item.unit_cost ?? 0) < 0 ||
      (item.discount ?? 0) < 0 || (item.discount ?? 0) > 100)) {
      notify('Verifique as quantidades, custos e descontos dos itens.', 'error'); return;
    }

    setSaving(true);
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
          notes, client_contact, client_email, include_tax, tax_rate } = activeBudget;
        const p_budget = { id, ref, name, company_id, assigned_to, status, sector, date,
          valid_until, notes, client_contact, client_email, include_tax, tax_rate };
        const p_items = (activeBudget.items ?? []).map((item, index) => ({
          id: item.id, code: item.code ?? '', description: item.description ?? '',
          reference: item.reference ?? '', brand: item.brand ?? '',
          category: item.category ?? '', sector: item.sector ?? '',
          unit: item.unit ?? 'un', quantity: item.quantity,
          unit_cost: item.unit_cost ?? item.unit_price ?? 0,
          margin: item.margin ?? 0, discount: item.discount ?? 0,
          notes: item.notes ?? '', sort_order: index,
        }));
        const { error } = await supabase.rpc('save_budget_atomic', { p_budget, p_items });
        if (error) throw new Error(error.code === 'PGRST202'
          ? 'A migração de gravação atómica ainda não está instalada no Supabase.'
          : error.message);
      }
      await loadBudgets();
      setUnsaved(false);
      notify(demoMode ? 'Orçamento guardado localmente (demonstração).' : 'Orçamento guardado com todos os itens.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Erro ao guardar orçamento.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function openBudget(b: Budget) {
    if (demoMode) {
      setActiveBudget({ ...b, items: (b.items ?? []).map(i => ({ ...i })) });
    } else {
      const { data, error } = await supabase.from('budget_items').select('*').eq('budget_id', b.id).order('sort_order');
      if (error) { notify(error.message, 'error'); return; }
      setActiveBudget({ ...b, items: (data ?? []) as BudgetItem[] });
    }
    setUnsaved(false);
    setView('editor');
  }

  function openNew() {
    if (!profile) return;
    setActiveBudget(emptyBudget(buildRef(budgets), profile.id));
    setUnsaved(false);
    setView('editor');
  }

  function duplicateBudget(b: Budget) {
    if (!profile) return;
    const copy: Budget = {
      ...b,
      id: newId(),
      ref: buildRef(budgets),
      name: `${b.name} (cópia)`,
      date: new Date().toISOString().slice(0, 10),
      valid_until: addDays(30),
      status: 'rascunho',
      created_by: profile.id,
      items: (b.items ?? []).map((i) => ({ ...i, id: newId(), budget_id: undefined })),
    };
    setActiveBudget(copy);
    setUnsaved(true);
    setView('editor');
    notify('Orçamento duplicado. Guarde para confirmar.', 'info');
  }

  async function deleteBudget(id: string) {
    if (!profile || !hasPermission(profile, 'create_budgets')) { notify('Sem permissão para eliminar.', 'error'); return; }
    try {
      if (demoMode) {
        const all = readDemoBudgets();
        const target = all.find(b => b.id === id);
        if (!target || (profile.role !== 'admin' && target.created_by !== profile.id)) throw new Error('Sem permissão para eliminar este orçamento.');
        saveDemoBudgets(all.filter(b => b.id !== id));
      } else {
        const { data, error } = await supabase.from('budgets').delete().eq('id', id).select('id');
        if (error) throw error;
        if (!data?.length) throw new Error('O orçamento não foi eliminado. Verifique as permissões.');
      }
      await loadBudgets();
      notify('Orçamento eliminado.', 'info');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Erro ao eliminar.', 'error');
    }
  }

  function handleBack() {
    if (unsaved && !confirm('Tem alterações por guardar. Sair sem guardar?')) return;
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
    <div className="flex bg-slate-100 min-h-screen">
      {!isEditor && (
        <Sidebar
          current={view}
          budgetCount={budgets.length}
          onChange={(v) => {
            if (v !== 'editor') { setActiveBudget(null); setUnsaved(false); }
            setView(v);
          }}
        />
      )}

      <main className="flex-1 min-w-0 overflow-x-hidden">
        {demoMode && !isEditor && <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-5 py-2 text-xs font-semibold">Modo demonstração · dados locais de exemplo. Não introduza informações reais de clientes; não existe sincronização com o Supabase.</div>}
        {view === 'dashboard' && (
          <Dashboard
            budgets={budgets}
            companies={companies}
            onNew={openNew}
            onOpen={openBudget}
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
            canCreate={hasPermission(profile, 'create_budgets')}
            canDelete={hasPermission(profile, 'create_budgets')}
          />
        )}
        {view === 'editor' && activeBudget && (
          <BudgetEditor
            budget={activeBudget}
            companies={companies}
            team={team}
            onChange={changeActiveBudget}
            onSave={handleSave}
            onBack={handleBack}
            saving={saving}
            unsaved={unsaved}
          />
        )}
        {view === 'catalog' && <CatalogView />}
        {view === 'companies' && (
          <CompaniesView
            companies={companies}
            budgets={budgets}
            onRefresh={() => { loadCompanies(); loadBudgets(); }}
          />
        )}
        {view === 'team' && (
          <TeamView
            team={team}
            budgets={budgets}
            onRefresh={loadTeam}
          />
        )}
        {view === 'reports' && (
          <ReportsView
            budgets={budgets}
            companies={companies}
            team={team}
          />
        )}
        {view === 'settings' && <SettingsView />}
        {view === 'chat' && (
          <ChatView
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
  const { session, loading, demoMode } = useAuth();

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
  return demoMode ? <AppInner /> : <MFAGate><AppInner /></MFAGate>;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoot />
    </AuthProvider>
  );
}
