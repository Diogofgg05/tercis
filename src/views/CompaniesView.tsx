import React, { useState, useMemo, useEffect } from 'react';
import {
  Search, Plus, Edit2, Trash2, X, Building2, Mail, Phone,
  MapPin, Globe, FileText, DollarSign, ChevronRight,
  Save, ShieldCheck, AlertCircle, CheckCircle2, Building,
  Users, Briefcase, Calendar,
} from 'lucide-react';

// ============================================================
// Mocks autossuficientes
// ============================================================
const useAuth = () => ({ profile: { role: 'admin' } });

// ============================================================
// Modal (corrigido com title como ReactNode)
// ============================================================
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, size = 'lg' }) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-7xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 transition-opacity duration-300"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full ${sizeClasses[size]} mx-4 p-6 max-h-[95vh] overflow-y-auto transform transition-all duration-300 scale-100 opacity-100`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <div>{title}</div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex-shrink-0"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

// ============================================================
// Toast Notification
// ============================================================
const Toast = ({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-2xl shadow-lg flex items-center gap-3 animate-slide-in ${
        type === 'success'
          ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
          : 'bg-red-50 border border-red-200 text-red-800'
      }`}
    >
      {type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
      <span className="font-medium">{message}</span>
    </div>
  );
};

// ============================================================
// Dados e Constantes
// ============================================================
const SECTORS = [
  { id: 'Eletricidade Industrial', label: 'Eletricidade Industrial', icon: '⚡' },
  { id: 'Automação Industrial', label: 'Automação Industrial', icon: '🤖' },
  { id: 'HVAC & Climatização', label: 'HVAC & Climatização', icon: '🌡️' },
  { id: 'Energias Renováveis', label: 'Energias Renováveis', icon: '☀️' },
  { id: 'Telecomunicações & Redes', label: 'Telecomunicações & Redes', icon: '📡' },
  { id: 'Iluminação Técnica', label: 'Iluminação Técnica', icon: '💡' },
];

const STATUS_COLORS: Record<string, string> = {
  rascunho: '#94a3b8',
  enviado: '#3b82f6',
  aprovado: '#10b981',
  rejeitado: '#ef4444',
  em_execucao: '#f59e0b',
  concluido: '#6366f1',
};

const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
  em_execucao: 'Em Execução',
  concluido: 'Concluído',
};

const sectorColors = ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#ef4444', '#0ea5e9'];

// ============================================================
// Tipos
// ============================================================
interface Company {
  id: string;
  name: string;
  tax_id: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  sector: string;
  notes: string;
  active: boolean;
  created_at: string;
}

interface BudgetItem {
  id: string;
  code: string;
  reference: string;
  brand: string;
  model: string;
  unit: string;
  category: string;
  description: string;
  quantity: number;
  unit_cost: number;
  margin: number;
  discount: number;
  notes: string;
}

interface Budget {
  id: string;
  company_id: string;
  ref: string;
  name: string;
  status: string;
  items: BudgetItem[];
}

// ============================================================
// Dados Fixos
// ============================================================
const FIXED_COMPANIES: Company[] = [
  {
    id: '1', name: 'TechNova Lda', tax_id: '500123456',
    address: 'Rua da Tecnologia, 42', city: 'Lisboa', country: 'Portugal',
    phone: '+351 210 123 456', email: 'info@technova.pt',
    website: 'https://technova.pt', sector: 'Eletricidade Industrial',
    notes: 'Cliente preferencial', active: true, created_at: '2024-01-15T10:00:00Z',
  },
  {
    id: '2', name: 'GreenPower SA', tax_id: '510654321',
    address: 'Av. das Energias, 17', city: 'Porto', country: 'Portugal',
    phone: '+351 220 987 654', email: 'contacto@greenpower.pt',
    website: 'https://greenpower.pt', sector: 'Energias Renováveis',
    notes: '', active: true, created_at: '2024-02-20T09:30:00Z',
  },
  {
    id: '3', name: 'AutoMecânica do Sul', tax_id: '505111222',
    address: 'Zona Industrial, Lote 3', city: 'Faro', country: 'Portugal',
    phone: '+351 289 555 333', email: 'geral@automecanica.pt',
    website: '', sector: 'Manutenção Industrial',
    notes: 'Fornecedor de peças', active: true, created_at: '2024-03-10T14:15:00Z',
  },
];

const FIXED_BUDGETS: Budget[] = [
  {
    id: 'b1', company_id: '1', ref: 'ORC-2025-001', name: 'Instalação Quadro Elétrico', status: 'aprovado',
    items: [
      { id: 'item1', code: 'QE-01', reference: 'REF-QE-01', brand: 'Schneider', model: 'X100', unit: 'un', category: 'Material', description: 'Quadro principal', quantity: 1, unit_cost: 2500, margin: 20, discount: 5, notes: '' },
      { id: 'item2', code: 'DJ-03', reference: 'REF-DJ-03', brand: 'Siemens', model: 'D200', unit: 'un', category: 'Material', description: 'Disjuntores', quantity: 3, unit_cost: 800, margin: 15, discount: 0, notes: '' },
    ],
  },
  {
    id: 'b2', company_id: '1', ref: 'ORC-2025-005', name: 'Manutenção Preventiva', status: 'enviado',
    items: [
      { id: 'item3', code: 'SERV-HT', reference: 'REF-HT', brand: '', model: '', unit: 'h', category: 'Serviço', description: 'Horas técnicas', quantity: 10, unit_cost: 150, margin: 25, discount: 0, notes: '' },
    ],
  },
  {
    id: 'b3', company_id: '2', ref: 'ORC-2025-012', name: 'Painéis Solares 50kW', status: 'aprovado',
    items: [
      { id: 'item4', code: 'PS-400', reference: 'REF-PS-400', brand: 'LG', model: 'NeON', unit: 'un', category: 'Material', description: 'Painel 400W', quantity: 50, unit_cost: 300, margin: 18, discount: 3, notes: '' },
      { id: 'item5', code: 'INV-5K', reference: 'REF-INV-5K', brand: 'Fronius', model: 'Primo', unit: 'un', category: 'Material', description: 'Inversor', quantity: 2, unit_cost: 5000, margin: 12, discount: 0, notes: '' },
    ],
  },
  {
    id: 'b4', company_id: '2', ref: 'ORC-2025-020', name: 'Estudo de Viabilidade', status: 'rascunho',
    items: [
      { id: 'item6', code: 'EST-01', reference: 'REF-EST-01', brand: '', model: '', unit: 'un', category: 'Serviço', description: 'Estudo', quantity: 1, unit_cost: 3500, margin: 10, discount: 0, notes: '' },
    ],
  },
  {
    id: 'b5', company_id: '3', ref: 'ORC-2025-008', name: 'Reparação de Compressor', status: 'concluido',
    items: [
      { id: 'item7', code: 'COMP-PC', reference: 'REF-COMP-PC', brand: 'Atlas Copco', model: 'GA30', unit: 'un', category: 'Peças', description: 'Peças', quantity: 1, unit_cost: 1200, margin: 30, discount: 10, notes: '' },
      { id: 'item8', code: 'MO-5H', reference: 'REF-MO-5H', brand: '', model: '', unit: 'h', category: 'Mão‑de‑obra', description: 'Mão‑de‑obra', quantity: 5, unit_cost: 80, margin: 20, discount: 0, notes: '' },
    ],
  },
];

// ============================================================
// Utilitários
// ============================================================
const STORAGE_KEYS = {
  COMPANIES: 'companies_data',
  BUDGETS: 'budgets_data',
};

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(val);

const getInitials = (name: string) =>
  name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

const calcBudgetValue = (budget: Budget): number =>
  budget.items?.reduce((s, i) => s + i.unit_cost * (1 + i.margin / 100) * (1 - i.discount / 100) * i.quantity, 0) || 0;

const loadFromStorage = <T,>(key: string, fallback: T): T => {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      return (Array.isArray(parsed) ? parsed : fallback) as T;
    }
  } catch (error) {
    console.error(`Erro ao carregar ${key}:`, error);
  }
  return fallback;
};

const saveToStorage = <T,>(key: string, data: T) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Erro ao salvar ${key}:`, error);
  }
};

// ============================================================
// Formulário
// ============================================================
interface FormData {
  name: string;
  tax_id: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  sector: string;
  notes: string;
}

const emptyForm: FormData = {
  name: '',
  tax_id: '',
  address: '',
  city: '',
  country: 'Portugal',
  phone: '',
  email: '',
  website: '',
  sector: 'Eletricidade Industrial',
  notes: '',
};

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export function CompaniesView(_props: {
  companies?: unknown[];
  budgets?: unknown[];
  onRefresh?: () => void;
} = {}) {
  const { profile } = useAuth();
  const canEdit = profile?.role === 'admin' || profile?.role === 'collaborator';

  // Estados
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Dados com persistência
  const [companies, setCompanies] = useState<Company[]>(() =>
    loadFromStorage(STORAGE_KEYS.COMPANIES, FIXED_COMPANIES)
  );

  const [budgets, setBudgets] = useState<Budget[]>(() =>
    loadFromStorage(STORAGE_KEYS.BUDGETS, FIXED_BUDGETS)
  );

  // Persistir alterações
  useEffect(() => saveToStorage(STORAGE_KEYS.COMPANIES, companies), [companies]);
  useEffect(() => saveToStorage(STORAGE_KEYS.BUDGETS, budgets), [budgets]);

  // Cálculos memoizados
  const budgetsByCompany = useMemo(() => {
    const map: Record<string, Budget[]> = {};
    budgets.forEach(b => {
      if (b.company_id) {
        if (!map[b.company_id]) map[b.company_id] = [];
        map[b.company_id].push(b);
      }
    });
    return map;
  }, [budgets]);

  const companyValues = useMemo(() => {
    const map: Record<string, number> = {};
    budgets.forEach(b => {
      if (b.company_id) map[b.company_id] = (map[b.company_id] || 0) + calcBudgetValue(b);
    });
    return map;
  }, [budgets]);

  const companyApprovedCount = useMemo(() => {
    const map: Record<string, number> = {};
    budgets.forEach(b => {
      if (b.status === 'aprovado' && b.company_id) map[b.company_id] = (map[b.company_id] || 0) + 1;
    });
    return map;
  }, [budgets]);

  const companiesWithBudgets = useMemo(() =>
    new Set(budgets.map(b => b.company_id).filter(Boolean)).size, [budgets]
  );

  const totalVolume = useMemo(() =>
    companies.reduce((sum, c) => sum + (companyValues[c.id] || 0), 0), [companies, companyValues]
  );

  // Filtro e ordenação
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = companies.filter(c => {
      const matchSearch = !q ||
        c.name.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q);
      return matchSearch && (sectorFilter === 'all' || c.sector === sectorFilter);
    });
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [search, sectorFilter, companies]);

  // Handlers
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  const openNew = () => {
    setSelectedCompany(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEdit = (company: Company) => {
    setSelectedCompany(company);
    setFormData({
      name: company.name,
      tax_id: company.tax_id,
      address: company.address,
      city: company.city,
      country: company.country,
      phone: company.phone,
      email: company.email,
      website: company.website,
      sector: company.sector,
      notes: company.notes,
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      showToast('O nome da empresa é obrigatório', 'error');
      return;
    }

    setSaving(true);
    setTimeout(() => {
      try {
        if (selectedCompany) {
          setCompanies(prev => prev.map(c =>
            c.id === selectedCompany.id ? { ...selectedCompany, ...formData } : c
          ));
          showToast('Empresa atualizada com sucesso!', 'success');
        } else {
          const newCompany: Company = {
            id: Date.now().toString(),
            ...formData,
            active: true,
            created_at: new Date().toISOString(),
          };
          setCompanies(prev => [...prev, newCompany]);
          showToast('Empresa criada com sucesso!', 'success');
        }
        setShowModal(false);
      } catch (error) {
        showToast('Erro ao guardar empresa', 'error');
        console.error(error);
      } finally {
        setSaving(false);
      }
    }, 300);
  };

  const handleDelete = (company: Company) => {
    if (!confirm(`Tem certeza que deseja eliminar "${company.name}"?`)) return;

    try {
      setCompanies(prev => prev.filter(c => c.id !== company.id));
      setBudgets(prev => prev.filter(b => b.company_id !== company.id));
      setDetailOpen(false);
      showToast('Empresa eliminada com sucesso!', 'success');
    } catch (error) {
      showToast('Erro ao eliminar empresa', 'error');
      console.error(error);
    }
  };

  // Renderização do card de empresa
  const renderCompanyCard = (company: Company, index: number) => {
    const companyBudgets = budgetsByCompany[company.id] || [];
    const value = companyValues[company.id] || 0;
    const approved = companyApprovedCount[company.id] || 0;
    const color = sectorColors[index % sectorColors.length];

    return (
      <button
        key={company.id}
        onClick={() => { setSelectedCompany(company); setDetailOpen(true); }}
        className="p-5 rounded-2xl bg-white border border-slate-100 hover:border-blue-200 hover:shadow-lg transition-all text-left group"
      >
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black flex-shrink-0"
            style={{ backgroundColor: color }}
          >
            {getInitials(company.name)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-800 text-sm truncate">{company.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {company.city}{company.country ? `, ${company.country}` : ''}
            </p>
          </div>
          <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0 mt-1" />
        </div>

        <div className="space-y-1.5 text-xs mb-3 pb-3 border-b border-slate-100">
          {company.email && (
            <p className="text-slate-500 flex items-center gap-1.5 truncate">
              <Mail size={10} className="text-slate-400 flex-shrink-0" />
              <span className="truncate">{company.email}</span>
            </p>
          )}
          {company.phone && (
            <p className="text-slate-500 flex items-center gap-1.5">
              <Phone size={10} className="text-slate-400" />
              {company.phone}
            </p>
          )}
          <span className="inline-block bg-slate-100 text-slate-600 text-[10px] font-semibold px-2 py-0.5 rounded-md">
            {company.sector}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-black text-slate-800">{companyBudgets.length}</p>
            <p className="text-[10px] text-slate-400">Orçamentos</p>
          </div>
          <div>
            <p className="text-lg font-black text-emerald-700">{approved}</p>
            <p className="text-[10px] text-slate-400">Aprovados</p>
          </div>
          <div>
            <p className="text-sm font-black text-slate-800">{formatCurrency(value).replace('€', '').trim()}</p>
            <p className="text-[10px] text-slate-400">€ Volume</p>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Empresas</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {filtered.length} de {companies.length} empresa{companies.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openNew}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-blue-500/25"
          >
            <Plus size={16} />
            Nova Empresa
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total', value: companies.length, icon: <Building2 size={14} className="text-blue-600" />, bg: 'bg-blue-50' },
          { label: 'Com Orçamentos', value: companiesWithBudgets, icon: <FileText size={14} className="text-emerald-600" />, bg: 'bg-emerald-50' },
          { label: 'Volume Total', value: formatCurrency(totalVolume), icon: <DollarSign size={14} className="text-amber-600" />, bg: 'bg-amber-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-center gap-3">
            <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>{s.icon}</div>
            <div>
              <p className="text-xs text-slate-400 font-medium">{s.label}</p>
              <p className="text-lg font-black text-slate-800">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-52 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-50 transition-all">
          <Search size={15} className="text-slate-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Pesquisar por nome, cidade, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 outline-none text-sm bg-transparent placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Sector Filters */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setSectorFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            sectorFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
          }`}
        >
          Todos
        </button>
        {SECTORS.map(s => (
          <button
            key={s.id}
            onClick={() => setSectorFilter(sectorFilter === s.id ? 'all' : s.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              sectorFilter === s.id ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
            }`}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* Lista de Empresas */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Building2 size={36} className="mx-auto text-slate-200 mb-3" />
          <p className="text-slate-500 font-medium text-sm">Nenhuma empresa encontrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(renderCompanyCard)}
        </div>
      )}

      {/* ============================================================
          DETAIL PANEL - CORRIGIDO (fixo ao viewport)
          ============================================================ */}
      {detailOpen && selectedCompany && (
        <div
          className="fixed top-0 left-0 right-0 bottom-0 z-[9999] flex"
          style={{ margin: 0, padding: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDetailOpen(false)}
            style={{ margin: 0, padding: 0 }}
          />

          <div className="relative ml-auto h-screen w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white text-sm font-black flex-shrink-0">
                  {getInitials(selectedCompany.name)}
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-slate-900 truncate">{selectedCompany.name}</h2>
                  <p className="text-xs text-slate-400 truncate">{selectedCompany.sector}</p>
                </div>
              </div>
              <button
                onClick={() => setDetailOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Orçamentos', value: (budgetsByCompany[selectedCompany.id] || []).length },
                  { label: 'Aprovados', value: companyApprovedCount[selectedCompany.id] || 0 },
                  { label: 'Volume', value: formatCurrency(companyValues[selectedCompany.id] || 0) },
                ].map(s => (
                  <div key={s.label} className="text-center p-3 bg-slate-50 rounded-xl">
                    <p className="text-base font-black text-slate-800">{s.value}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                {[
                  { icon: <Mail size={14} className="text-slate-400 flex-shrink-0" />, value: selectedCompany.email },
                  { icon: <Phone size={14} className="text-slate-400 flex-shrink-0" />, value: selectedCompany.phone },
                  { icon: <MapPin size={14} className="text-slate-400 flex-shrink-0" />, value: [selectedCompany.address, selectedCompany.city, selectedCompany.country].filter(Boolean).join(', ') },
                  { icon: <Globe size={14} className="text-slate-400 flex-shrink-0" />, value: selectedCompany.website },
                ].filter(i => i.value).map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                    {item.icon}
                    <span className="text-sm text-slate-700 break-all">{item.value}</span>
                  </div>
                ))}
              </div>

              {(budgetsByCompany[selectedCompany.id] || []).length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Orçamentos Recentes</p>
                  <div className="space-y-2">
                    {(budgetsByCompany[selectedCompany.id] || []).slice(0, 5).map(b => (
                      <div key={b.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-slate-800 truncate">{b.name || b.ref}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{b.ref}</p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap"
                            style={{ backgroundColor: `${STATUS_COLORS[b.status]}18`, color: STATUS_COLORS[b.status] }}
                          >
                            {STATUS_LABELS[b.status] || b.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {canEdit && (
              <div className="border-t border-slate-100 p-4 flex gap-2 flex-shrink-0">
                <button
                  onClick={() => { setDetailOpen(false); openEdit(selectedCompany); }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Edit2 size={14} />
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(selectedCompany)}
                  className="flex-1 py-2.5 rounded-xl bg-red-50 border border-red-200 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={14} />
                  Eliminar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL - NOVO LAYOUT (Sidebar + Conteúdo)
          ============================================================ */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        size="xl"
        title={
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 flex-shrink-0">
              <Building2 size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                {selectedCompany ? 'Editar Empresa' : 'Nova Empresa'}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {selectedCompany ? 'Atualize os dados da empresa' : 'Preencha os dados para criar uma nova empresa'}
              </p>
            </div>
          </div>
        }
      >
        <div className="grid lg:grid-cols-[340px_1fr] gap-6">
          {/* ========== SIDEBAR ========== */}
          <div className="space-y-4">
            {/* Card de Perfil */}
            <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-3xl p-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-blue-500/25 flex-shrink-0">
                  {formData.name ? getInitials(formData.name) : '?'}
                </div>

                <div className="min-w-0">
                  <h2 className="font-bold text-xl text-slate-900 dark:text-white truncate">
                    {formData.name || 'Nova Empresa'}
                  </h2>

                  <p className="text-slate-500 dark:text-slate-400 text-sm truncate">
                    {formData.email || 'email@empresa.pt'}
                  </p>

                  <p className="text-slate-500 dark:text-slate-400 text-sm truncate">
                    {formData.phone || '+351 xxx xxx xxx'}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                  {formData.sector || 'Setor'}
                </span>

                <span className="px-3 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                  {selectedCompany ? (selectedCompany.active ? 'Ativa' : 'Inativa') : 'Ativa'}
                </span>

                {selectedCompany && (
                  <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 text-xs font-semibold">
                    {selectedCompany.tax_id || 'N/A'}
                  </span>
                )}
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4">
                <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">Volume</p>
                <p className="text-2xl font-black text-emerald-800 dark:text-emerald-200">
                  {selectedCompany
                    ? formatCurrency(companyValues[selectedCompany.id] || 0)
                    : '0,00 €'}
                </p>
              </div>

              <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">Orçamentos</p>
                <p className="text-2xl font-black text-blue-800 dark:text-blue-200">
                  {selectedCompany
                    ? (budgetsByCompany[selectedCompany.id] || []).length
                    : 0}
                </p>
              </div>
            </div>

            {/* Info adicional (apenas edição) */}
            {selectedCompany && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/30 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Calendar size={14} className="text-slate-400" />
                  <span>Criada em: {new Date(selectedCompany.created_at).toLocaleDateString('pt-PT')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Building size={14} className="text-slate-400" />
                  <span>{selectedCompany.address || 'Morada não definida'}</span>
                </div>
                {selectedCompany.website && (
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Globe size={14} className="text-slate-400" />
                    <a href={selectedCompany.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                      {selectedCompany.website}
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ========== CONTEÚDO DO FORMULÁRIO ========== */}
          <div className="space-y-5">
            {/* Linha 1: Nome (full width) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Nome da Empresa <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: GreenPower SA"
                  className={`w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border rounded-xl text-sm text-slate-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-400 transition-all ${
                    !formData.name.trim() ? 'border-red-300 dark:border-red-700' : 'border-slate-200 dark:border-slate-600'
                  }`}
                />
              </div>
              {!formData.name.trim() && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> Nome é obrigatório
                </p>
              )}
            </div>

            {/* Linha 2: NIF + Setor + Website */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">NIF</label>
                <input
                  type="text"
                  value={formData.tax_id}
                  onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                  placeholder="510654321"
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Setor</label>
                <select
                  value={formData.sector}
                  onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-400"
                >
                  {SECTORS.map((s) => (
                    <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Website</label>
                <div className="relative">
                  <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://empresa.pt"
                    className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-400"
                  />
                </div>
              </div>
            </div>

            {/* Linha 3: Email + Telefone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contacto@empresa.pt"
                    className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Telefone</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+351 220 912 345"
                    className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-400"
                  />
                </div>
              </div>
            </div>

            {/* Linha 4: Morada + Cidade + País */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Morada</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Av. das Energias, 17"
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Cidade</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Porto"
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">País</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="Portugal"
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-400"
                />
              </div>
            </div>

            {/* Linha 5: Notas (full width) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Notas</label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações internas, informações adicionais..."
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-400"
              />
            </div>

            {/* Footer com ações */}
            <div className="border-t border-slate-200 dark:border-slate-600 pt-5 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 w-full sm:w-auto">
                <ShieldCheck size={18} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-slate-800 dark:text-white text-sm">Dados seguros</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Todas as alterações são guardadas com segurança</p>
                </div>
              </div>

              <div className="flex gap-3 w-full sm:w-auto">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors text-sm"
                >
                  Cancelar
                </button>

                <button
                  onClick={handleSave}
                  disabled={!formData.name.trim() || saving}
                  className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-lg shadow-blue-500/25 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2 text-sm"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      A guardar...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      {selectedCompany ? 'Guardar Alterações' : 'Criar Empresa'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Estilos para animações */}
      <style>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slide-in-right {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }

        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
