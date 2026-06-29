import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Plus, Search, FileText, Trash2, Edit3, Download,
  FileSpreadsheet, Copy, Filter, ChevronUp, ChevronDown,
  ArrowUpDown, Tag, Calendar, Building2, User, CheckCircle2,
  AlertTriangle, X, Save,
} from 'lucide-react';
import { BudgetEditor } from './BudgetEditor'; // ajusta o caminho se necessário

// ============================================================
// Error Boundary
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
type BudgetStatus =
  | 'rascunho'
  | 'pendente_aprovacao'
  | 'em_analise_tecnica'
  | 'enviado'
  | 'aprovado'
  | 'rejeitado'
  | 'pedido_alteracoes'
  | 'em_execucao'
  | 'aceite'
  | 'expirado'
  | 'concluido';

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
  company_id: string | null;
  sector?: string;
  assignee?: Profile;
  assigned_to?: string | null;
  status: BudgetStatus;
  items?: BudgetItem[];
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
  pendente_aprovacao: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
  em_analise_tecnica: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  enviado: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  aprovado: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  rejeitado: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  pedido_alteracoes: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  em_execucao: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  aceite: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  expirado: { bg: 'bg-stone-100', text: 'text-stone-700', dot: 'bg-stone-500' },
  concluido: { bg: 'bg-cyan-50', text: 'text-cyan-700', dot: 'bg-cyan-600' },
};

const STATUS_LABELS: Partial<Record<BudgetStatus, string>> = {
  rascunho: 'Rascunho',
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
  const content = `Orçamento: ${budget.ref} - ${budget.name}\nCliente: ${budget.company?.name || 'N/A'}\nTotal: ${formatCurrency(grandTotal(budget.items ?? []))}\nEstado: ${STATUS_LABELS[budget.status] || budget.status}\nData: ${budget.date}`;
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
    [budget.ref, budget.name, budget.company?.name || '', STATUS_LABELS[budget.status] || budget.status, formatCurrency(grandTotal(budget.items ?? [])), budget.date],
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
// DADOS FIXOS (usados como fallback e para resolver nomes)
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
// HOOKS REUTILIZÁVEIS
// ============================================================
function useDirtyTracking<T extends Record<string, unknown>>(current: T, original: T) {
  const [isDirty, setIsDirty] = useState(false);
  useEffect(() => {
    const dirty = Object.keys(original).some(key => current[key] !== original[key]);
    setIsDirty(dirty);
  }, [current, original]);
  return isDirty;
}

function useEscapeKey(onEscape: () => void, disabled = false) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disabled) onEscape();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onEscape, disabled]);
}

function useAutoFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}

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
// COMPONENTES ATÓMICOS DO MODAL (edição simples mantida)
// ============================================================
const Modal: React.FC<{ open: boolean; onClose: () => void; children: React.ReactNode }> = ({ open, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-[39.6rem] bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/5 overflow-hidden">
        {children}
      </div>
    </div>
  );
};

const ModalHeader: React.FC<{ title: string; onClose: () => void }> = ({ title, onClose }) => (
  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
    <h2 className="text-lg font-bold text-slate-800">{title}</h2>
    <button
      onClick={onClose}
      className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30"
      aria-label="Fechar"
    >
      <X size={18} />
    </button>
  </div>
);

const ModalFooter: React.FC<{ onCancel: () => void; onSave: () => void; isDirty: boolean; saving: boolean }> = ({ onCancel, onSave, isDirty, saving }) => (
  <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row gap-2.5">
    <button
      onClick={onCancel}
      disabled={saving}
      className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-50 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30"
    >
      Cancelar
    </button>
    <button
      onClick={onSave}
      disabled={saving || !isDirty}
      className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/30 transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
    >
      {saving ? (
        <React.Fragment>
          <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          A guardar...
        </React.Fragment>
      ) : (
        <React.Fragment>
          <Save size={16} />
          Guardar alterações
        </React.Fragment>
      )}
    </button>
  </div>
);

const Field: React.FC<{ label: string; id: string; children: React.ReactNode; error?: string | null }> = ({ label, id, children, error }) => (
  <div>
    <label htmlFor={id} className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
    {children}
    {error && (
      <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={12} /> {error}</p>
    )}
  </div>
);

// ============================================================
// MODAL DE EDIÇÃO SIMPLES (mantido para o botão Editar da tabela)
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
  const nameInputRef = useAutoFocus<HTMLInputElement>();

  const original = useMemo(() => ({
    name: budget.name,
    status: budget.status,
    validUntil: budget.valid_until,
  }), [budget]);

  const isDirty = useDirtyTracking({ name, status, validUntil }, original);

  const handleCloseWithConfirmation = useCallback(() => {
    if (isDirty && !saving) {
      const discard = window.confirm('Tens alterações não guardadas. Descartar?');
      if (!discard) return;
    }
    onClose();
  }, [isDirty, saving, onClose]);

  useEscapeKey(handleCloseWithConfirmation, saving);

  const validate = (): boolean => {
    const newErrors: { name?: string; date?: string } = {};
    if (!name.trim()) newErrors.name = 'Nome obrigatório.';
    if (!validUntil) newErrors.date = 'Data de validade obrigatória.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      onSave({ ...budget, name: name.trim(), status, valid_until: validUntil });
      onClose();
    } catch {
      setErrors({ name: 'Erro ao guardar. Tenta novamente.' });
    } finally {
      setSaving(false);
    }
  };

  const handleBackdropClick = () => {
    if (!saving) handleCloseWithConfirmation();
  };

  return (
    <Modal open={true} onClose={handleBackdropClick}>
      <ModalHeader title="Editar Orçamento" onClose={handleCloseWithConfirmation} />
      <div className="px-6 py-5 space-y-5">
        <Field label="Nome" id="edit-name" error={errors.name}>
          <input
            ref={nameInputRef}
            id="edit-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Orçamento Q4"
            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 bg-white shadow-sm focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 hover:border-slate-300 transition-all"
          />
        </Field>
        <Field label="Estado" id="edit-status">
          <select
            id="edit-status"
            value={status}
            onChange={e => setStatus(e.target.value as BudgetStatus)}
            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white shadow-sm focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 hover:border-slate-300 transition-all appearance-none bg-no-repeat bg-[right_0.75rem_center] pr-10"
            style={{ backgroundImage: `url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"%3E%3Cpath d="m6 9 6 6 6-6"/%3E%3C/svg%3E')` }}
          >
            {(Object.keys(STATUS_LABELS) as BudgetStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </Field>
        <Field label="Validade" id="edit-validity" error={errors.date}>
          <input
            id="edit-validity"
            type="date"
            value={validUntil}
            onChange={e => setValidUntil(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white shadow-sm focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 hover:border-slate-300 transition-all"
          />
        </Field>
      </div>
      <ModalFooter onCancel={handleCloseWithConfirmation} onSave={handleSave} isDirty={isDirty} saving={saving} />
    </Modal>
  );
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
  budgets?: Budget[];
  companies?: Company[];
  team?: Profile[];
  onNew?: () => void;
  onEdit?: (budget: Budget) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (budget: Budget) => void;
}

const BudgetListContent: React.FC<BudgetListProps> = ({
  budgets: controlledBudgets,
  companies = MOCK_COMPANIES,
  team = MOCK_TEAM,
  onNew,
  onEdit,
  onDelete,
  onDuplicate,
}) => {
  const isControlled = Array.isArray(controlledBudgets);
  const [localBudgets, setLocalBudgets] = useState<Budget[]>(() => {
    const stored = loadBudgetsFromStorage();
    return stored.length > 0 ? stored : [];
  });
  const budgets = useMemo(() => {
    const source = isControlled ? controlledBudgets ?? [] : localBudgets;
    return source.map((budget) => ({
      ...budget,
      company: budget.company ?? companies.find((company) => company.id === budget.company_id),
      assignee: budget.assignee ?? team.find((member) => member.id === budget.assigned_to),
      items: budget.items ?? [],
    }));
  }, [companies, controlledBudgets, isControlled, localBudgets, team]);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [editingFullBudget, setEditingFullBudget] = useState<Budget | null>(null);
  const isClient = false;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<BudgetStatus | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  // Sincronizar com localStorage sempre que a janela ganhar foco
  useEffect(() => {
    if (isControlled) return;
    const handleFocus = () => {
      const fresh = loadBudgetsFromStorage();
      if (fresh.length > 0) {
        setLocalBudgets(fresh);
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isControlled]);

  // Recarregar a lista quando o modal do editor fechar
  useEffect(() => {
    if (isControlled) return;
    if (!editorModalOpen) {
      const fresh = loadBudgetsFromStorage();
      setLocalBudgets(fresh);
    }
  }, [editorModalOpen, isControlled]);

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
        const da = new Date(a.date);
        const db = new Date(b.date);
        cmp = (isNaN(da.getTime()) ? 0 : da.getTime()) - (isNaN(db.getTime()) ? 0 : db.getTime());
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
    setLocalBudgets(newBudgets);
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

  const handleEdit = useCallback((b: Budget) => {
    if (onEdit) {
      onEdit(b);
      return;
    }
    setEditingBudget(b);
  }, [onEdit]);
  const handleSaveEdit = useCallback((updated: Budget) => {
    const newList = budgets.map(b => b.id === updated.id ? updated : b);
    persistAndSet(newList);
    setEditingBudget(null);
  }, [budgets, persistAndSet]);

  const handleDelete = useCallback((id: string) => {
    if (onDelete) {
      onDelete(id);
      return;
    }
    persistAndSet(budgets.filter(b => b.id !== id));
  }, [budgets, onDelete, persistAndSet]);

  const handleDuplicate = useCallback((b: Budget) => {
    if (onDuplicate) {
      onDuplicate(b);
      return;
    }
    const dup: Budget = {
      ...b,
      id: generateId(),
      ref: `ORC-${new Date().getFullYear()}-${String(budgets.length + 1).padStart(3, '0')}`,
      name: `${b.name} (cópia)`,
      status: 'rascunho',
      date: new Date().toISOString().slice(0, 10),
      items: (b.items ?? []).map(item => ({ ...item })),
    };
    persistAndSet([dup, ...budgets]);
  }, [budgets, onDuplicate, persistAndSet]);

  // Abre o editor completo (BudgetEditor) num modal centrado
  const openFullEditor = useCallback((b: Budget) => {
    setSelectedBudget(b);
    setEditingFullBudget(b);
    setEditorModalOpen(true);
  }, []);

  const handleFullEditorChange = useCallback((updated: Budget) => {
    setEditingFullBudget(updated);
  }, []);

  const handleFullEditorClose = useCallback(() => {
    setEditorModalOpen(false);
    setSelectedBudget(null);
    setEditingFullBudget(null);
  }, []);

  return (
    <div className="p-6 sm:p-8 space-y-5 max-w-7xl mx-auto" style={{ zoom: 1.1 }}>
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Orçamentos</h1>
          <p className="text-sm text-slate-400 mt-0.5">{budgets.length} orçamento{budgets.length !== 1 ? 's' : ''} no total</p>
        </div>
        {!isClient && (
          <button onClick={handleNew} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2">
            <Plus size={16} /> Novo Orçamento
          </button>
        )}
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
            {budgets.length === 0 && !isClient && (
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
                  {!isClient && <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 w-36">Ações</th>}
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
                      onClick={() => onEdit ? onEdit(b) : openFullEditor(b)}
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
                      {!isClient && (
                        <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                          <div className={`flex gap-0.5 justify-center transition-opacity duration-150 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                            <ActionBtn icon={<Edit3 size={13} />} title="Editar" onClick={() => handleEdit(b)} />
                            <ActionBtn icon={<Copy size={13} />} title="Duplicar" onClick={() => handleDuplicate(b)} />
                            <ActionBtn icon={<Download size={13} />} title="Exportar PDF" onClick={() => exportToPDF(b)} />
                            <ActionBtn icon={<FileSpreadsheet size={13} />} title="Exportar Excel" onClick={() => exportToExcel(b)} />
                            <ActionBtn icon={<Trash2 size={13} />} title="Eliminar" onClick={() => { if (confirm(`Eliminar "${b.name}"?`)) handleDelete(b.id); }} danger />
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de edição simples (mantido) */}
      {editingBudget && (
        <BudgetEditModal
          budget={editingBudget}
          onClose={() => setEditingBudget(null)}
          onSave={handleSaveEdit}
        />
      )}

      {/* Modal centrado com o BudgetEditor completo */}
      {editorModalOpen && editingFullBudget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm">
          <div className="relative w-full max-w-[1200px] max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            {/* Botão de fechar personalizado */}
            <button
              onClick={handleFullEditorClose}
              className="absolute top-4 right-4 z-10 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow hover:bg-white transition-colors"
              aria-label="Fechar editor"
            >
              <X size={18} className="text-slate-600" />
            </button>
            {/* Conteúdo do editor com scroll */}
            <div className="flex-1 overflow-auto">
              <BudgetEditor
                key={editingFullBudget.id}
                budget={editingFullBudget}
                onChange={handleFullEditorChange}
                onSave={() => {}} // o auto-save já trata da persistência
                onBack={handleFullEditorClose}
                saving={false}
                unsaved={false}
                companies={MOCK_COMPANIES.map(c => ({ id: c.id, name: c.name }))}
                team={MOCK_TEAM.map(t => ({ id: t.id, full_name: t.full_name }))}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// Exportação principal
// ============================================================
export function BudgetList(props: BudgetListProps) {
  return (
    <ErrorBoundary>
      <BudgetListContent {...props} />
    </ErrorBoundary>
  );
} 
