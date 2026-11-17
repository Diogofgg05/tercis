import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  TrendingUp, TrendingDown, BarChart2, PieChart, Users,
  Building2, FileText, DollarSign, Award, Target,
  Download, RefreshCw, X, Mail, Phone, MapPin, Globe,
  Calendar, Hash, CheckCircle2, Clock3, Send, ShieldCheck,
  Circle, AlertCircle,
} from 'lucide-react';

// ─── Tipos locais ────────────────────────────────────────────────────────
type BudgetStatus = 'rascunho' | 'em_analise_tecnica' | 'enviado' | 'aprovado' | 'rejeitado' | 'em_execucao' | 'concluido';

interface BudgetItem {
  unit_cost: number;
  margin: number;
  discount: number;
  quantity: number;
}

interface Budget {
  id: string;
  assigned_to: string | null;
  created_by: string;
  company_id: string;
  status: BudgetStatus;
  date: string;
  sector?: string;
  items: BudgetItem[];
  created_at?: string;
  ref?: string;
  name?: string;
}

interface Company {
  id: string;
  name: string;
  sector?: string;
  tax_id?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  notes?: string;
}

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

// ─── Helpers de formatação ──────────────────────────────────────────────
const formatCurrency = (val: number): string =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(val);

const formatPercent = (val: number): string => `${val.toFixed(1)}%`;

// ─── DADOS FIXOS (enriquecidos com detalhes de empresa) ─────────────────
const FIXED_COMPANIES: Company[] = [
  {
    id: 'c1', name: 'Construtora Nova Era', sector: 'Construção',
    tax_id: '500123456', address: 'Rua da Construção, 42', city: 'Lisboa',
    country: 'Portugal', phone: '+351 210 111 222', email: 'info@novaera.pt',
    website: 'https://novaera.pt', notes: 'Cliente desde 2020. Preferencial.',
  },
  {
    id: 'c2', name: 'EletroPlus', sector: 'Eletricidade',
    tax_id: '510654321', address: 'Av. dos Eletricistas, 17', city: 'Porto',
    country: 'Portugal', phone: '+351 220 987 654', email: 'contacto@eletroplus.pt',
    website: 'https://eletroplus.pt', notes: '',
  },
  {
    id: 'c3', name: 'Águas do Tejo', sector: 'Saneamento',
    tax_id: '505111222', address: 'Zona Industrial, Lote 3', city: 'Faro',
    country: 'Portugal', phone: '+351 289 555 333', email: 'geral@aguasdotejo.pt',
    website: '', notes: 'Fornecedor de peças',
  },
  {
    id: 'c4', name: 'TechPark', sector: 'Tecnologia',
    tax_id: '507889900', address: 'Parque Tecnológico, Edifício 1', city: 'Coimbra',
    country: 'Portugal', phone: '+351 239 111 444', email: 'info@techpark.pt',
    website: 'https://techpark.pt', notes: 'Startup incubada',
  },
  {
    id: 'c5', name: 'Hospital São Lucas', sector: 'Saúde',
    tax_id: '509123456', address: 'Av. da Saúde, 100', city: 'Braga',
    country: 'Portugal', phone: '+351 253 222 333', email: 'administracao@saolucas.pt',
    website: 'https://saolucas.pt', notes: 'Contrato de manutenção anual',
  },
  {
    id: 'c6', name: 'EduPrime', sector: 'Educação',
    tax_id: '512334455', address: 'Rua das Escolas, 5', city: 'Aveiro',
    country: 'Portugal', phone: '+351 234 555 666', email: 'geral@eduprime.pt',
    website: 'https://eduprime.pt', notes: '',
  },
  {
    id: 'c7', name: 'TurisBeira', sector: 'Turismo',
    tax_id: '515667788', address: 'Rua do Turismo, 12', city: 'Viseu',
    country: 'Portugal', phone: '+351 232 444 555', email: 'info@turisbeira.pt',
    website: '', notes: 'Cliente sazonal',
  },
  {
    id: 'c8', name: 'LogiTrans', sector: 'Logística',
    tax_id: '518990011', address: 'Centro Logístico, Armazém 7', city: 'Setúbal',
    country: 'Portugal', phone: '+351 265 777 888', email: 'contacto@logitrans.pt',
    website: 'https://logitrans.pt', notes: '',
  },
];

const FIXED_TEAM: Profile[] = [
  { id: 'user1', full_name: 'Carlos Silva', role: 'admin' },
  { id: 'user2', full_name: 'Marta Oliveira', role: 'collaborator' },
  { id: 'user3', full_name: 'Rui Sousa', role: 'client' },
  { id: 'user4', full_name: 'Ana Pereira', role: 'collaborator' },
  { id: 'user5', full_name: 'João Martins', role: 'client' },
];

const FIXED_BUDGETS: Budget[] = [
  {
    id: 'b1', assigned_to: 'user1', created_by: 'user1', company_id: 'c1',
    status: 'aprovado', date: '2025-10-15', sector: 'Construção',
    items: [{ unit_cost: 2500, margin: 20, discount: 5, quantity: 1 }],
    created_at: '2025-10-10T10:00:00Z', ref: 'ORC-2025-001', name: 'Instalação Quadro Elétrico',
  },
  {
    id: 'b2', assigned_to: 'user2', created_by: 'user1', company_id: 'c2',
    status: 'aprovado', date: '2025-11-02', sector: 'Eletricidade',
    items: [{ unit_cost: 150, margin: 25, discount: 0, quantity: 10 }],
    created_at: '2025-11-01T09:30:00Z', ref: 'ORC-2025-002', name: 'Manutenção Preventiva',
  },
  {
    id: 'b3', assigned_to: 'user3', created_by: 'user2', company_id: 'c3',
    status: 'rascunho', date: '2026-01-20', sector: 'Saneamento',
    items: [{ unit_cost: 300, margin: 18, discount: 3, quantity: 50 }],
    created_at: '2026-01-15T14:20:00Z', ref: 'ORC-2026-003', name: 'Painéis Solares 50kW',
  },
  {
    id: 'b4', assigned_to: 'user1', created_by: 'user1', company_id: 'c4',
    status: 'enviado', date: '2026-02-10', sector: 'Tecnologia',
    items: [{ unit_cost: 1200, margin: 30, discount: 10, quantity: 1 }],
    created_at: '2026-02-08T11:00:00Z', ref: 'ORC-2026-004', name: 'Estudo de Viabilidade',
  },
  {
    id: 'b5', assigned_to: 'user5', created_by: 'user2', company_id: 'c5',
    status: 'concluido', date: '2026-03-01', sector: 'Saúde',
    items: [{ unit_cost: 3500, margin: 10, discount: 0, quantity: 1 }],
    created_at: '2026-03-01T16:45:00Z', ref: 'ORC-2026-005', name: 'Reparação de Compressor',
  },
  {
    id: 'b6', assigned_to: 'user4', created_by: 'user4', company_id: 'c1',
    status: 'em_execucao', date: '2026-04-18', sector: 'Construção',
    items: [{ unit_cost: 8000, margin: 15, discount: 5, quantity: 2 }],
    created_at: '2026-04-10T08:00:00Z', ref: 'ORC-2026-006', name: 'Instalação de Climatização',
  },
  {
    id: 'b7', assigned_to: 'user2', created_by: 'user1', company_id: 'c6',
    status: 'aprovado', date: '2026-05-05', sector: 'Educação',
    items: [{ unit_cost: 500, margin: 22, discount: 0, quantity: 20 }],
    created_at: '2026-05-02T12:15:00Z', ref: 'ORC-2026-007', name: 'Rede Estruturada',
  },
  {
    id: 'b8', assigned_to: null, created_by: 'user1', company_id: 'c7',
    status: 'rejeitado', date: '2026-05-20', sector: 'Turismo',
    items: [{ unit_cost: 4000, margin: 12, discount: 8, quantity: 1 }],
    created_at: '2026-05-18T09:00:00Z', ref: 'ORC-2026-008', name: 'Obra Hotel Central',
  },
  {
    id: 'b9', assigned_to: 'user3', created_by: 'user3', company_id: 'c8',
    status: 'em_execucao', date: '2026-06-01', sector: 'Logística',
    items: [{ unit_cost: 6000, margin: 18, discount: 4, quantity: 1 }],
    created_at: '2026-06-01T10:30:00Z', ref: 'ORC-2026-009', name: 'Sistema de CFTV',
  },
];

// ─── Constantes visuais ─────────────────────────────────────────────────
const STATUS_COLORS: Record<BudgetStatus, string> = {
  rascunho: '#94a3b8',
  em_analise_tecnica: '#a855f7',
  enviado: '#3b82f6',
  aprovado: '#10b981',
  rejeitado: '#ef4444',
  em_execucao: '#f59e0b',
  concluido: '#6366f1',
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

const STATUS_ICONS: Record<string, typeof Circle> = {
  rascunho: Circle,
  em_analise_tecnica: ShieldCheck,
  enviado: Send,
  aprovado: CheckCircle2,
  rejeitado: AlertCircle,
  em_execucao: Clock3,
  concluido: CheckCircle2,
};

const ALL_STATUSES: BudgetStatus[] = ['rascunho', 'enviado', 'aprovado', 'rejeitado', 'em_execucao', 'concluido'];
const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ─── Cálculo do valor do orçamento ─────────────────────────────────────
function calcBudgetValue(b: Budget): number {
  return b.items?.reduce((s, i) => {
    const pvp = i.unit_cost * (1 + i.margin / 100);
    return s + pvp * (1 - i.discount / 100) * i.quantity;
  }, 0) || 0;
}

// ─── KPI Card ─────────────────────────────────────────────────────────
const KpiCard: React.FC<{
  label: string; value: string; icon: React.ReactNode; iconBg: string;
  sub?: string; trend?: number; highlight?: boolean;
}> = ({ label, value, icon, iconBg, sub, trend, highlight }) => (
  <div className={`rounded-2xl p-5 border ${highlight ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-100 shadow-sm'} hover:shadow-md transition-all duration-200 relative overflow-hidden group`}>
    {highlight && <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent pointer-events-none" />}
    <div className="relative">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${iconBg}`}>{icon}</div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${trend >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
            {trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <p className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${highlight ? 'text-slate-400' : 'text-slate-400'}`}>{label}</p>
      <p className={`text-2xl font-black tracking-tight ${highlight ? 'text-white' : 'text-slate-900'}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 ${highlight ? 'text-slate-500' : 'text-slate-400'}`}>{sub}</p>}
    </div>
  </div>
);

// ─── Horizontal Bar Chart ──────────────────────────────────────────────
const HorizontalBar: React.FC<{ label: string; value: number; max: number; color: string; total?: number }> = ({ label, value, max, color, total }) => {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-600 font-medium truncate flex-1 mr-4">{label}</span>
        <span className="font-bold text-slate-800 flex-shrink-0">{total !== undefined ? total : value}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};

// ─── Donut Chart ────────────────────────────────────────────────────────
const DonutChart: React.FC<{ data: { label: string; value: number; color: string }[]; centerText?: string; centerSub?: string }> = ({ data, centerText, centerSub }) => {
  const total = data.reduce((a, b) => a + b.value, 0);
  if (total === 0) return <div className="h-32 flex items-center justify-center text-slate-300 text-sm">Sem dados</div>;
  const cx = 80, cy = 80, r = 62, inner = 36;
  let angle = -90;
  const segments = data.filter(d => d.value > 0).map(d => {
    const a = (d.value / total) * 360;
    const s = angle;
    angle += a;
    const sr = (s * Math.PI) / 180, er = ((s + a) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(sr), y1 = cy + r * Math.sin(sr);
    const x2 = cx + r * Math.cos(er), y2 = cy + r * Math.sin(er);
    const ix1 = cx + inner * Math.cos(sr), iy1 = cy + inner * Math.sin(sr);
    const ix2 = cx + inner * Math.cos(er), iy2 = cy + inner * Math.sin(er);
    const la = a > 180 ? 1 : 0;
    return {
      ...d,
      path: `M ${ix1} ${iy1} L ${x1} ${y1} A ${r} ${r} 0 ${la} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${inner} ${inner} 0 ${la} 0 ${ix1} ${iy1} Z`,
      pct: Math.round((d.value / total) * 100),
    };
  });
  return (
    <div className="flex gap-5 items-center">
      <svg viewBox="0 0 160 160" className="w-40 h-40 flex-shrink-0">
        {segments.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="2.5" className="hover:opacity-80 transition-opacity cursor-pointer" />
        ))}
        {centerText && (
          <>
            <text x={cx} y={cy - 3} textAnchor="middle" fontSize="18" fontWeight="900" fill="#0f172a">{centerText}</text>
            {centerSub && <text x={cx} y={cy + 13} textAnchor="middle" fontSize="9" fill="#94a3b8">{centerSub}</text>}
          </>
        )}
      </svg>
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-xs text-slate-600 flex-1 truncate">{s.label}</span>
            <span className="text-xs font-bold text-slate-800">{s.value}</span>
            <span className="text-[10px] text-slate-400 w-8 text-right">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Monthly Trend Chart ────────────────────────────────────────────────
const TrendChart: React.FC<{ data: number[]; labels: string[] }> = ({ data, labels }) => {
  const max = Math.max(...data, 1);
  const h = 120, w = 500, padding = 40, chartW = w - padding * 2, chartH = h - 20;
  const points = data.map((v, i) => ({
    x: padding + (i / (data.length - 1)) * chartW,
    y: 10 + (1 - v / max) * chartH,
    v,
  }));
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${h + 10} L ${points[0].x} ${h + 10} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h + 30}`} className="w-full">
      <defs>
        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map(pct => (
        <line key={pct} x1={padding} y1={10 + (1 - pct) * chartH} x2={w - padding} y2={10 + (1 - pct) * chartH} stroke="#f1f5f9" strokeWidth="1" />
      ))}
      <path d={areaD} fill="url(#trendGrad)" />
      <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="white" stroke="#3b82f6" strokeWidth="2.5" />
          {p.v > 0 && <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="9" fontWeight="700" fill="#475569">{formatCurrency(p.v).replace('€', '').trim()}</text>}
          <text x={p.x} y={h + 22} textAnchor="middle" fontSize="10" fill="#94a3b8" fontWeight="500">{labels[i]}</text>
        </g>
      ))}
    </svg>
  );
};

// ─── MODAL DE DETALHES DA EMPRESA ──────────────────────────────────────
const CompanyDetailModal: React.FC<{
  company: Company;
  budgets: Budget[];
  onClose: () => void;
}> = ({ company, budgets, onClose }) => {
  const companyBudgets = budgets.filter(b => b.company_id === company.id);
  const totalValue = companyBudgets.reduce((s, b) => s + calcBudgetValue(b), 0);
  const approvedCount = companyBudgets.filter(b => b.status === 'aprovado').length;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl shadow-slate-300/50 max-h-[90vh] overflow-y-auto border border-slate-100 animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-800 flex items-center justify-center text-white text-sm font-bold">
              {company.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{company.name}</h2>
              <p className="text-xs text-slate-500">{company.sector || '—'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Info cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              {company.tax_id && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Hash size={14} className="text-slate-400 flex-shrink-0" />
                  <span>NIF: {company.tax_id}</span>
                </div>
              )}
              {company.email && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Mail size={14} className="text-slate-400 flex-shrink-0" />
                  <a href={`mailto:${company.email}`} className="text-blue-800 hover:underline truncate">{company.email}</a>
                </div>
              )}
              {company.phone && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Phone size={14} className="text-slate-400 flex-shrink-0" />
                  <span>{company.phone}</span>
                </div>
              )}
              {company.website && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Globe size={14} className="text-slate-400 flex-shrink-0" />
                  <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-blue-800 hover:underline truncate">{company.website}</a>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {company.address && (
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <MapPin size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
                  <span>{company.address}, {company.city} {company.country}</span>
                </div>
              )}
              {company.notes && (
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <FileText size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
                  <span>{company.notes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
              <p className="text-lg font-black text-slate-800">{formatCurrency(totalValue)}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Volume Total</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
              <p className="text-lg font-black text-slate-800">{companyBudgets.length}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Orçamentos</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
              <p className="text-lg font-black text-emerald-700">{approvedCount}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Aprovados</p>
            </div>
          </div>

          {/* Últimos orçamentos */}
          {companyBudgets.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Calendar size={14} className="text-blue-500" />
                Últimos Orçamentos
              </h3>
              <div className="space-y-2">
                {companyBudgets
                  .sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime())
                  .slice(0, 5)
                  .map(b => {
                    const Icon = STATUS_ICONS[b.status] || Circle;
                    return (
                      <div key={b.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm">
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon size={14} style={{ color: STATUS_COLORS[b.status] }} />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 truncate">{b.name || b.ref || b.id}</p>
                            <p className="text-xs text-slate-400 font-mono">{b.ref || b.id}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                          <span className="font-semibold text-slate-800">{formatCurrency(calcBudgetValue(b))}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ backgroundColor: `${STATUS_COLORS[b.status]}18`, color: STATUS_COLORS[b.status] }}>
                            {STATUS_LABELS[b.status] || b.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────
export function ReportsView(_props: {
  budgets?: unknown[];
  companies?: unknown[];
  team?: unknown[];
} = {}) {
  const [budgets] = useState<Budget[]>(FIXED_BUDGETS);
  const [companies] = useState<Company[]>(FIXED_COMPANIES);
  const [team] = useState<Profile[]>(FIXED_TEAM);
  const [period, setPeriod] = useState<6 | 12>(6);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [key, setKey] = useState(0);

  const now = new Date();

  const handleRefresh = () => setKey(prev => prev + 1);
  const handleDownloadCSV = () => {
    const headers = ['ID', 'Status', 'Empresa', 'Setor', 'Valor', 'Responsável', 'Data'];
    const rows = budgets.map(b => {
      const company = companies.find(c => c.id === b.company_id);
      const member = team.find(m => m.id === b.assigned_to);
      return [
        b.id,
        STATUS_LABELS[b.status] || b.status,
        company?.name || '',
        b.sector || '',
        formatCurrency(calcBudgetValue(b)),
        member?.full_name || 'Não atribuído',
        new Date(b.date).toLocaleDateString('pt-PT'),
      ];
    });
    const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'relatorio_orcamentos.csv'; link.click();
    URL.revokeObjectURL(url);
  };

  const stats = useMemo(() => {
    const totalVolume = budgets.reduce((s, b) => s + calcBudgetValue(b), 0);
    const approved = budgets.filter(b => b.status === 'aprovado').length;
    const conversionRate = budgets.length > 0 ? (approved / budgets.length) * 100 : 0;
    const avgTicket = budgets.length > 0 ? totalVolume / budgets.length : 0;
    const inExecution = budgets.filter(b => b.status === 'em_execucao').length;
    return { totalVolume, approved, conversionRate, avgTicket, inExecution, total: budgets.length };
  }, [budgets, key]);

  const monthlyData = useMemo(() => {
    const months = Array(period).fill(0);
    budgets.forEach(b => {
      const d = new Date(b.date);
      if (isNaN(d.getTime())) return;
      const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      if (diff >= 0 && diff < period) months[period - 1 - diff] += calcBudgetValue(b);
    });
    return months;
  }, [budgets, period, key]);

  const monthLabels = Array.from({ length: period }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (period - 1) + i, 1);
    return MONTH_NAMES[d.getMonth()];
  });

  const statusData = useMemo(() =>
    ALL_STATUSES.map(s => ({
      label: STATUS_LABELS[s],
      value: budgets.filter(b => b.status === s).length,
      color: STATUS_COLORS[s],
    })).filter(d => d.value > 0),
    [budgets, key]
  );

  const budgetsBySector = useMemo(() => {
    const map: Record<string, number> = {};
    budgets.forEach(b => { if (b.sector) map[b.sector] = (map[b.sector] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [budgets, key]);

  const maxSectorCount = Math.max(...budgetsBySector.map(([, c]) => c), 1);
  const sectorColors = ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6'];

  const topCompanies = useMemo(() =>
    companies.map(c => {
      const cBudgets = budgets.filter(b => b.company_id === c.id);
      const value = cBudgets.reduce((s, b) => s + calcBudgetValue(b), 0);
      const approvedCount = cBudgets.filter(b => b.status === 'aprovado').length;
      return { company: c, value, count: cBudgets.length, approved: approvedCount };
    }).sort((a, b) => b.value - a.value).slice(0, 8),
    [companies, budgets, key]
  );

  const teamPerformance = useMemo(() =>
    team.map(m => {
      const mb = budgets.filter(b => b.assigned_to === m.id);
      const value = mb.reduce((s, b) => s + calcBudgetValue(b), 0);
      const approved = mb.filter(b => b.status === 'aprovado').length;
      const rate = mb.length > 0 ? (approved / mb.length) * 100 : 0;
      return { member: m, budgets: mb.length, value, approved, rate };
    }).sort((a, b) => b.value - a.value),
    [team, budgets, key]
  );

  const maxTeamValue = Math.max(...teamPerformance.map(t => t.value), 1);

  return (
    <div className="p-6 sm:p-8 space-y-7 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Relatórios & Analytics</h1>
          <p className="text-slate-400 text-sm mt-0.5">Visão geral do desempenho do negócio</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors" title="Atualizar dados">
            <RefreshCw size={16} />
          </button>
          <button onClick={handleDownloadCSV} className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors" title="Exportar CSV">
            <Download size={16} />
          </button>
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
            {([6, 12] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${period === p ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {p}M
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Volume Total" value={formatCurrency(stats.totalVolume)} icon={<DollarSign size={18} className="text-blue-600" />} iconBg="bg-blue-50" sub={`${stats.total} orçamentos`} highlight />
        <KpiCard label="Taxa Conversão" value={formatPercent(stats.conversionRate)} icon={<Target size={18} className="text-emerald-600" />} iconBg="bg-emerald-50" sub={`${stats.approved} aprovados`} trend={stats.conversionRate} />
        <KpiCard label="Ticket Médio" value={formatCurrency(stats.avgTicket)} icon={<TrendingUp size={18} className="text-amber-600" />} iconBg="bg-amber-50" sub="por orçamento" />
        <KpiCard label="Em Execução" value={stats.inExecution.toString()} icon={<Award size={18} className="text-cyan-600" />} iconBg="bg-cyan-50" sub="projetos ativos" />
      </div>

      {/* Trend + Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-bold text-slate-800 flex items-center gap-2"><BarChart2 size={15} className="text-blue-500" />Evolução de Volume</h2>
              <p className="text-xs text-slate-400 mt-0.5">Últimos {period} meses</p>
            </div>
          </div>
          <TrendChart data={monthlyData} labels={monthLabels} />
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><PieChart size={15} className="text-emerald-500" />Por Estado</h2>
          <DonutChart data={statusData} centerText={stats.total.toString()} centerSub="total" />
        </div>
      </div>

      {/* Sector + Team */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-bold text-slate-800 mb-5 flex items-center gap-2"><BarChart2 size={15} className="text-amber-500" />Orçamentos por Setor</h2>
          <div className="space-y-3">
            {budgetsBySector.length === 0 ? <p className="text-slate-400 text-sm text-center py-6">Sem dados</p> : budgetsBySector.map(([sector, count], i) => (
              <HorizontalBar key={sector} label={sector} value={count} max={maxSectorCount} color={sectorColors[i % sectorColors.length]} total={count} />
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-bold text-slate-800 mb-5 flex items-center gap-2"><Users size={15} className="text-blue-500" />Performance da Equipa</h2>
          <div className="space-y-4">
            {teamPerformance.length === 0 ? <p className="text-slate-400 text-sm text-center py-6">Sem dados de equipa</p> : teamPerformance.map((t, i) => {
              const initials = t.member.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
              const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-cyan-500', 'bg-rose-500'];
              return (
                <div key={t.member.id} className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl ${colors[i % colors.length]} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>{initials}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-700 truncate">{t.member.full_name}</span>
                      <span className="text-xs font-bold text-slate-800 ml-2">{formatCurrency(t.value)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${colors[i % colors.length]}`} style={{ width: `${maxTeamValue > 0 ? (t.value / maxTeamValue) * 100 : 0}%` }} />
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-slate-400">{t.budgets} orçam.</span>
                      <span className="text-[10px] text-emerald-600 font-semibold">{t.approved} aprov.</span>
                      <span className="text-[10px] text-slate-400">{t.rate.toFixed(0)}% taxa</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top companies table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Building2 size={15} className="text-slate-600" />
          <h2 className="font-bold text-slate-800">Top Clientes por Volume</h2>
          <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{topCompanies.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['#', 'Empresa', 'Setor', 'Orçamentos', 'Aprovados', 'Volume Total', 'Último Orçamento'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topCompanies.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-slate-400 text-sm">Sem dados de empresas</td></tr>
              ) : topCompanies.map((item, i) => {
                const lastBudget = budgets
                  .filter(b => b.company_id === item.company.id)
                  .sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime())[0];
                const rankColors = ['text-amber-600 bg-amber-50', 'text-slate-600 bg-slate-100', 'text-orange-600 bg-orange-50'];
                return (
                  <tr
                    key={item.company.id}
                    onClick={() => setSelectedCompany(item.company)}
                    className="border-b border-slate-50 hover:bg-blue-50/20 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3.5">
                      <span className={`w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center ${rankColors[i] || 'text-slate-400 bg-slate-50'}`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-800">{item.company.name}</td>
                    <td className="px-4 py-3.5 text-slate-500">{item.company.sector || '—'}</td>
                    <td className="px-4 py-3.5 text-slate-600">{item.count}</td>
                    <td className="px-4 py-3.5"><span className="text-emerald-700 font-semibold">{item.approved}</span></td>
                    <td className="px-4 py-3.5 font-bold text-slate-800">{formatCurrency(item.value)}</td>
                    <td className="px-4 py-3.5 text-slate-400">
                      {lastBudget
                        ? new Date(lastBudget.created_at || lastBudget.date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' })
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL de detalhes da empresa */}
      {selectedCompany && (
        <CompanyDetailModal
          company={selectedCompany}
          budgets={budgets}
          onClose={() => setSelectedCompany(null)}
        />
      )}

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
      `}</style>
    </div>
  );
}