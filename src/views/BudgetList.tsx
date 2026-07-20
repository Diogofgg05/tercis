import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, Search, FileText, Trash2, Edit3, Download,
  FileSpreadsheet, Copy, Filter, ChevronUp, ChevronDown,
  ArrowUpDown, Tag, Calendar, Building2, User, CheckCircle2,
  AlertTriangle, X,
} from 'lucide-react';
import { BudgetEditor } from './BudgetEditor'; // ajusta o caminho se necessário

// ============================================================
// Error Boundary (mantido)
// ============================================================
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 text-red-700 rounded-xl m-4">
          <h2 className="font-bold">Erro inesperado</h2>
          <p className="text-sm mt-1">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg"
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================
// TIPOS (compatíveis com o BudgetEditor)
// ============================================================
type BudgetStatus = 'rascunho' | 'em_analise_tecnica' | 'enviado' | 'aprovado' | 'rejeitado' | 'em_execucao' | 'concluido';

interface BudgetItem {
  id?: string;
  code?: string;
  description?: string;
  reference?: string;
  brand?: string;
  category?: string;
  sector?: string;
  unit?: string;
  unit_cost: number;
  quantity: number;
  margin: number;
  discount: number;
  notes?: string;
  is_custom?: boolean;
}

interface Company {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  full_name: string;
  email?: string;
}

interface Budget {
  id: string;
  ref: string;
  name: string;
  company?: Company;
  company_id: string;
  sector?: string;
  assignee?: Profile;
  assigned_to?: string | null;
  status: BudgetStatus;
  items: BudgetItem[];
  date: string;
  valid_until: string;
  client_contact?: string;
  client_email?: string;
  notes?: string;
  tax_rate?: number;
  include_tax?: boolean;
}

// ============================================================
// HELPERS
// ============================================================
const STORAGE_PREFIX = 'catalog_';
const BUDGETS_KEY = 'budgets';

function generateId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {}
  return Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
}

function grandTotal(items: BudgetItem[]): number {
  return items?.reduce((s, i) => {
    const pvp = i.unit_cost * (1 + i.margin / 100);
    return s + pvp * (1 - i.discount / 100) * i.quantity;
  }, 0) || 0;
}

function formatCurrency(val: number): string {
  try {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(val);
  } catch {
    return `${val.toFixed(2)} €`;
  }
}

// ============================================================
// STATUS BADGE
// ============================================================
const STATUS_CONFIG: Record<BudgetStatus, { bg: string; text: string; dot: string }> = {
  rascunho: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  em_analise_tecnica: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
  enviado: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  aprovado: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  rejeitado: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  em_execucao: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  concluido: { bg: 'bg-cyan-50', text: 'text-cyan-700', dot: 'bg-cyan-600' },
};

const STATUS_LABELS: Record<BudgetStatus, string> = {
  rascunho: 'Rascunho',
  em_analise_tecnica: 'Análise Técnica',
  enviado: 'Enviado',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
  em_execucao: 'Em Execução',
  concluido: 'Concluído',
};

const StatusBadge: React.FC<{ status: BudgetStatus }> = ({ status }) => {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.rascunho;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {STATUS_LABELS[status] || status}
    </span>
  );
};

// ============================================================
// EXPORTAÇÕES (mock)
// ============================================================
function exportToPDF(budget: Budget): void {
  const content = `Orçamento: ${budget.ref} - ${budget.name}\nCliente: ${budget.company?.name || 'N/A'}\nTotal: ${formatCurrency(grandTotal(budget.items))}\nEstado: ${STATUS_LABELS[budget.status] || budget.status}\nData: ${budget.date}`;
  const blob = new Blob([content], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${budget.ref}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportToExcel(budget: Budget): void {
  const rows = [
    ['Ref', 'Nome', 'Cliente', 'Estado', 'Total', 'Data'],
    [budget.ref, budget.name, budget.company?.name || '', STATUS_LABELS[budget.status] || budget.status, formatCurrency(grandTotal(budget.items)), budget.date],
  ];
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${budget.ref}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// DADOS FIXOS
// ============================================================
const MOCK_COMPANIES: Company[] = [
  { id: '1', name: 'Meevo - Soluções Digitais' },
  { id: '2', name: 'FastRotator - Tecnologia Rápida' },
  { id: '3', name: 'Coploca - Consultoria Lda' },
  { id: '4', name: 'InovaTech SA' },
  { id: '5', name: 'Grupo Energia Global' },
];

const MOCK_TEAM: Profile[] = [
  { id: '101', full_name: 'João Silva (Comercial)' },
  { id: '102', full_name: 'Maria Oliveira (Diretora)' },
  { id: '103', full_name: 'Carlos Santos (Técnico)' },
  { id: '104', full_name: 'Ana Costa (Financeiro)' },
];

// ============================================================
// LEITURA / ESCRITA DO LOCAL STORAGE
// ============================================================
function loadBudgetsFromStorage(): Budget[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${BUDGETS_KEY}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((b: any) => ({
      ...b,
      company: MOCK_COMPANIES.find(c => c.id === b.company_id) || undefined,
      assignee: MOCK_TEAM.find(t => t.id === b.assigned_to) || undefined,
    }));
  } catch {
    return [];
  }
}

function saveBudgetsToStorage(budgets: Budget[]) {
  const clean = budgets.map(({ company, assignee, ...rest }) => rest);
  localStorage.setItem(`${STORAGE_PREFIX}${BUDGETS_KEY}`, JSON.stringify(clean));
}

// ============================================================
// MODAL DE EDIÇÃO SIMPLES (mantido)
// ============================================================
interface BudgetEditModalProps {
  budget: Budget;
  onClose: () => void;
  onSave: (updated: Budget) => void;
}

const BudgetEditModal: React.FC<BudgetEditModalProps> = ({ budget, onClose, onSave }) => {
  const [name, setName] = useState(budget.name);
  const [status, setStatus] = useState<BudgetStatus>(budget.status);
  const [validUntil, setValidUntil] = useState(budget.valid_until);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; date?: string }>({});

  const isDirty = name !== budget.name || status !== budget.status || validUntil !== budget.valid_until;

  const handleSave = async () => {
    if (!name.trim()) {
      setErrors({ name: 'Nome obrigatório.' });
      return;
    }
    if (!validUntil) {
      setErrors({ date: 'Data de validade obrigatória.' });
      return;
    }
    setSaving(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    onSave({ ...budget, name: name.trim(), status, valid_until: validUntil });
  };

  // Este modal menor também será renderizado no portal para evitar problemas de stacking context
  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Editar Orçamento</h2>
          <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nome</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Estado</label>
            <select value={status} onChange={e => setStatus(e.target.value as BudgetStatus)} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm">
              {(Object.keys(STATUS_LABELS) as BudgetStatus[]).map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Validade</label>
            <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm" />
            {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100">Cancelar</button>
          <button onClick={handleSave} disabled={!isDirty || saving} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
type SortField = 'ref' | 'name' | 'client' | 'date' | 'total' | 'status';
type SortDir = 'asc' | 'desc';

const ActionBtn: React.FC<{ icon: React.ReactNode; onClick: () => void; danger?: boolean; title?: string }> = ({ icon, onClick, danger, title }) => (
  <button type="button" onClick={onClick} title={title} className={`p-1.5 rounded-lg transition-all ${danger ? 'text-slate-300 hover:text-red-600 hover:bg-red-50' : 'text-slate-300 hover:text-blue-600 hover:bg-blue-50'}`}>
    {icon}
  </button>
);

const StatCard: React.FC<{ icon: React.ReactNode; bg: string; label: string; value: string; valueClass?: string }> = ({ icon, bg, label, value, valueClass = 'text-slate-900' }) => (
  <div className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-center gap-3">
    <div className={`w-10 h-10 ${bg} rounded-2xl flex items-center justify-center`}>{icon}</div>
    <div>
      <p className="text-xs text-slate-400 font-medium">{label}</p>
      <p className={`text-lg font-black ${valueClass}`}>{value}</p>
    </div>
  </div>
);

interface BudgetListProps {
  onNew?: () => void;
}

const BudgetListContent: React.FC<BudgetListProps> = ({ onNew }) => {
  const [budgets, setBudgets] = useState<Budget[]>(() => loadBudgetsFromStorage());
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [editingFullBudget, setEditingFullBudget] = useState<Budget | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<BudgetStatus | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  // Atualizar lista quando a janela ganha foco
  useEffect(() => {
    const handleFocus = () => setBudgets(loadBudgetsFromStorage());
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Recarregar lista ao fechar o editor
  useEffect(() => {
    if (!editorModalOpen) {
      setBudgets(loadBudgetsFromStorage());
    }
  }, [editorModalOpen]);

  // Bloquear scroll do body quando qualquer modal estiver aberto
  useEffect(() => {
    if (editorModalOpen || editingBudget) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [editorModalOpen, editingBudget]);

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }, [sortField]);

  const filtered = useMemo(() => {
    const list = budgets.filter(b => {
      const q = search.toLowerCase();
      const matchSearch = !q || b.ref.toLowerCase().includes(q) || b.name.toLowerCase().includes(q) || (b.company?.name || '').toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || b.status === statusFilter;
      return matchSearch && matchStatus;
    });
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'ref') cmp = a.ref.localeCompare(b.ref);
      else if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'client') cmp = (a.company?.name || '').localeCompare(b.company?.name || '');
      else if (sortField === 'date') {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        cmp = (isNaN(da) ? 0 : da) - (isNaN(db) ? 0 : db);
      }
      else if (sortField === 'total') cmp = grandTotal(a.items || []) - grandTotal(b.items || []);
      else if (sortField === 'status') cmp = a.status.localeCompare(b.status);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [budgets, search, statusFilter, sortField, sortDir]);

  const summaryStats = useMemo(() => {
    const total = filtered.reduce((s, b) => s + grandTotal(b.items || []), 0);
    const approved = filtered.filter(b => b.status === 'aprovado').length;
    const expired = filtered.filter(b => {
      if (!b.valid_until) return false;
      const d = new Date(b.valid_until);
      if (isNaN(d.getTime())) return false;
      return d < new Date() && !['aprovado', 'concluido'].includes(b.status);
    }).length;
    return { total, approved, expired, count: filtered.length };
  }, [filtered]);

  const SortHeader: React.FC<{ field: SortField; label: string; className?: string }> = ({ field, label, className = '' }) => {
    const active = sortField === field;
    return (
      <th onClick={() => toggleSort(field)} className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:text-slate-700 select-none whitespace-nowrap transition-colors ${active ? 'text-blue-600' : 'text-slate-400'} ${className}`}>
        <span className="inline-flex items-center gap-1">
          {label}
          {active ? (sortDir === 'asc' ? <ChevronUp size={10} className="text-blue-600" /> : <ChevronDown size={10} className="text-blue-600" />) : <ArrowUpDown size={9} className="opacity-30" />}
        </span>
      </th>
    );
  };

  const persistAndSet = useCallback((newBudgets: Budget[]) => {
    setBudgets(newBudgets);
    saveBudgetsToStorage(newBudgets);
  }, []);

  const handleNew = useCallback(() => {
    if (onNew) {
      onNew();
      return;
    }
    const newBudget: Budget = {
      id: generateId(),
      ref: `ORC-${new Date().getFullYear()}-${String(budgets.length + 1).padStart(3, '0')}`,
      name: 'Novo Orçamento',
      company: MOCK_COMPANIES[0],
      company_id: MOCK_COMPANIES[0].id,
      sector: 'Geral',
      assignee: undefined,
      assigned_to: null,
      status: 'rascunho',
      items: [],
      date: new Date().toISOString().slice(0, 10),
      valid_until: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 10),
    };
    persistAndSet([newBudget, ...budgets]);
  }, [budgets, onNew, persistAndSet]);

  const handleEdit = useCallback((b: Budget) => setEditingBudget(b), []);
  const handleSaveEdit = useCallback((updated: Budget) => {
    const newList = budgets.map(b => b.id === updated.id ? updated : b);
    persistAndSet(newList);
    setEditingBudget(null);
  }, [budgets, persistAndSet]);

  const handleDelete = useCallback((id: string) => {
    persistAndSet(budgets.filter(b => b.id !== id));
  }, [budgets, persistAndSet]);

  const handleDuplicate = useCallback((b: Budget) => {
    const dup: Budget = {
      ...b,
      id: generateId(),
      ref: `ORC-${new Date().getFullYear()}-${String(budgets.length + 1).padStart(3, '0')}`,
      name: `${b.name} (cópia)`,
      status: 'rascunho',
      date: new Date().toISOString().slice(0, 10),
      items: b.items.map(item => ({ ...item })),
    };
    persistAndSet([dup, ...budgets]);
  }, [budgets, persistAndSet]);

  // Abrir editor completo
  const openFullEditor = useCallback((b: Budget) => {
    setEditingFullBudget(b);
    setEditorModalOpen(true);
  }, []);

  const handleFullEditorChange = useCallback((updated: Budget) => {
    setEditingFullBudget(updated);
    setBudgets(prev => prev.map(b => b.id === updated.id ? updated : b));
  }, []);

  const handleFullEditorClose = useCallback(() => {
    setEditorModalOpen(false);
    setEditingFullBudget(null);
  }, []);

  // Fechar com Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editorModalOpen) handleFullEditorClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editorModalOpen, handleFullEditorClose]);

  // Modal do editor completo (portal)
  const fullEditorModal = editorModalOpen && editingFullBudget ? (
    createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Overlay que cobre tudo */}
        <div
          className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
          onClick={handleFullEditorClose}
        />
        {/* Conteúdo */}
        <div className="relative z-10 w-full max-w-[1200px] max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fade-in">
          <button
            onClick={handleFullEditorClose}
            className="absolute top-4 right-4 z-10 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow hover:bg-white transition-colors"
            aria-label="Fechar editor"
          >
            <X size={18} className="text-slate-600" />
          </button>
          <div className="flex-1 overflow-auto">
            <BudgetEditor
              key={editingFullBudget.id}
              budget={editingFullBudget}
              onChange={handleFullEditorChange}
              onBack={handleFullEditorClose}
              companies={MOCK_COMPANIES.map(c => ({ id: c.id, name: c.name }))}
              team={MOCK_TEAM.map(t => ({ id: t.id, full_name: t.full_name }))}
            />
          </div>
        </div>
      </div>,
      document.body
    )
  ) : null;

  return (
    <div className="p-6 sm:p-8 space-y-5 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Orçamentos</h1>
          <p className="text-sm text-slate-400 mt-0.5">{budgets.length} orçamento{budgets.length !== 1 ? 's' : ''} no total</p>
        </div>
        <button onClick={handleNew} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2">
          <Plus size={16} /> Novo Orçamento
        </button>
      </div>

      {/* Mini dashboard */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={<FileText size={16} className="text-blue-600" />} bg="bg-blue-50" label="Orçamentos filtrados" value={summaryStats.count.toString()} />
          <StatCard icon={<CheckCircle2 size={16} className="text-emerald-600" />} bg="bg-emerald-50" label="Aprovados" value={summaryStats.approved.toString()} valueClass="text-emerald-700" />
          <StatCard icon={<AlertTriangle size={16} className="text-amber-600" />} bg="bg-amber-50" label="Atrasados" value={summaryStats.expired.toString()} valueClass="text-amber-700" />
          <StatCard icon={<Tag size={16} className="text-cyan-600" />} bg="bg-cyan-50" label="Volume total" value={formatCurrency(summaryStats.total)} />
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-56 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Pesquisar ref, nome, cliente..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setStatusFilter('all')} className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${statusFilter === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'}`}>Todos</button>
          {(Object.keys(STATUS_CONFIG) as BudgetStatus[]).map(status => {
            const c = STATUS_CONFIG[status] || STATUS_CONFIG.rascunho;
            const active = statusFilter === status;
            return (
              <button key={status} onClick={() => setStatusFilter(active ? 'all' : status)} className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${active ? `${c.bg} ${c.text} shadow-sm` : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'}`}>
                {STATUS_LABELS[status] || status}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Filter size={22} className="text-slate-300" />
            </div>
            <p className="font-semibold text-slate-600 text-sm">{budgets.length === 0 ? 'Sem orçamentos guardados' : 'Nenhum resultado'}</p>
            <p className="text-slate-400 text-xs mt-1">{budgets.length === 0 ? 'Crie o seu primeiro orçamento no editor' : 'Tente ajustar os filtros'}</p>
            {budgets.length === 0 && (
              <button onClick={handleNew} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 inline-flex items-center gap-2">
                <Plus size={14} /> Criar primeiro orçamento
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <SortHeader field="ref" label="Ref" />
                  <SortHeader field="name" label="Nome" className="min-w-36" />
                  <SortHeader field="client" label="Cliente" />
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Setor</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Resp.</th>
                  <SortHeader field="status" label="Estado" />
                  <SortHeader field="total" label="Total" />
                  <SortHeader field="date" label="Data" />
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Validade</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 w-36">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => {
                  const total = grandTotal(b.items || []);
                  const validDate = b.valid_until ? new Date(b.valid_until) : null;
                  const expired = validDate && !isNaN(validDate.getTime()) && validDate < new Date() && !['aprovado', 'concluido'].includes(b.status);
                  const isHovered = hoveredRow === b.id;
                  return (
                    <tr
                      key={b.id}
                      onClick={() => openFullEditor(b)}
                      onMouseEnter={() => setHoveredRow(b.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      className="border-b border-slate-50 hover:bg-blue-50/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3.5"><span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{b.ref}</span></td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800 max-w-44"><span className="block truncate">{b.name}</span></td>
                      <td className="px-4 py-3.5 text-xs text-slate-600">{b.company?.name ? <span className="flex items-center gap-1.5"><Building2 size={11} className="text-slate-400 flex-shrink-0" /><span className="truncate max-w-28">{b.company.name}</span></span> : <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 max-w-24"><span className="block truncate">{b.sector || '—'}</span></td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">{b.assignee?.full_name ? <span className="flex items-center gap-1.5"><User size={10} className="text-slate-400" />{b.assignee.full_name.split(' ')[0]}</span> : <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3.5"><StatusBadge status={b.status} /></td>
                      <td className="px-4 py-3.5 font-bold text-slate-800">{formatCurrency(total)}</td>
                      <td className="px-4 py-3.5 text-xs text-slate-500"><span className="flex items-center gap-1"><Calendar size={10} className="text-slate-400" />{new Date(b.date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span></td>
                      <td className={`px-4 py-3.5 text-xs ${expired ? 'text-red-600 font-bold' : 'text-slate-500'}`}><span className="flex items-center gap-1">{expired && <AlertTriangle size={10} className="text-red-500" />}{validDate ? validDate.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}</span></td>
                      <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                        <div className={`flex gap-0.5 justify-center transition-opacity duration-150 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                          <ActionBtn icon={<Edit3 size={13} />} title="Editar" onClick={() => handleEdit(b)} />
                          <ActionBtn icon={<Copy size={13} />} title="Duplicar" onClick={() => handleDuplicate(b)} />
                          <ActionBtn icon={<Download size={13} />} title="Exportar PDF" onClick={() => exportToPDF(b)} />
                          <ActionBtn icon={<FileSpreadsheet size={13} />} title="Exportar Excel" onClick={() => exportToExcel(b)} />
                          <ActionBtn icon={<Trash2 size={13} />} title="Eliminar" onClick={() => { if (confirm(`Eliminar "${b.name}"?`)) handleDelete(b.id); }} danger />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de edição simples (portal) */}
      {editingBudget && (
        <BudgetEditModal
          budget={editingBudget}
          onClose={() => setEditingBudget(null)}
          onSave={handleSaveEdit}
        />
      )}

      {/* Modal do editor completo (portal) */}
      {fullEditorModal}
    </div>
  );
};

// ============================================================
// Exportação principal
// ============================================================
export function BudgetList({ onNew }: { onNew?: () => void }) {
  return (
    <ErrorBoundary>
      <BudgetListContent onNew={onNew} />
    </ErrorBoundary>
  );
}