import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, Plus, Edit2, Trash2, X, Building2, Mail, Phone,
  MapPin, Globe, FileText, DollarSign, ChevronRight,
  Save, ShieldCheck, AlertCircle, CheckCircle2, Calendar,
  Tag, ExternalLink, Briefcase, Upload, Camera, ChevronDown,
} from 'lucide-react';

// ============================================================
// Mocks
// ============================================================
const useAuth = () => ({ profile: { role: 'admin' } });

// ============================================================
// Modal
// ============================================================
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, size = 'lg' }) => {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
      window.addEventListener('keydown', handler);
      return () => {
        window.removeEventListener('keydown', handler);
        document.body.style.overflow = '';
      };
    }
  }, [open, onClose]);

  if (!open) return null;

  const sizeClasses = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-6xl' };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
      <div
        className={`relative z-10 bg-white rounded-3xl shadow-2xl w-full ${sizeClasses[size]} max-h-[90vh] overflow-hidden border border-white/20 animate-modal-in`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
              <Building2 size={20} className="text-blue-700" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

// ============================================================
// Toast
// ============================================================
const Toast = ({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 z-[9999] px-4 py-3 rounded-2xl shadow-lg border flex items-center gap-2 text-sm animate-toast-in ${
      type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
    }`}>
      {type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      <span className="font-medium">{message}</span>
    </div>
  );
};

// ============================================================
// Dados / Constantes
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
  rascunho: '#64748b', enviado: '#3b82f6', aprovado: '#10b981',
  rejeitado: '#ef4444', em_execucao: '#f59e0b', concluido: '#8b5cf6',
};
const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado',
  rejeitado: 'Rejeitado', em_execucao: 'Em Execução', concluido: 'Concluído',
};
const sectorColors = ['#2563eb','#059669','#d97706','#7c3aed','#db2777','#0891b2','#ea580c','#4f46e5','#dc2626','#0284c7'];

// ============================================================
// Tipos
// ============================================================
interface Company {
  id: string; name: string; tax_id: string; address: string; city: string; country: string;
  phone: string; email: string; website: string; sector: string; notes: string; active: boolean;
  created_at: string;
  logo?: string;
}
interface BudgetItem {
  id: string; code: string; reference: string; brand: string; model: string; unit: string;
  category: string; description: string; quantity: number; unit_cost: number; margin: number; discount: number; notes: string;
}
interface Budget {
  id: string; company_id: string; ref: string; name: string; status: string; items: BudgetItem[];
}

// ============================================================
// Dados Fixos
// ============================================================
const FIXED_COMPANIES: Company[] = [
  { id: '1', name: 'TechNova Lda', tax_id: '500123456', address: 'Rua da Tecnologia, 42', city: 'Lisboa', country: 'Portugal', phone: '+351 210 123 456', email: 'info@technova.pt', website: 'https://technova.pt', sector: 'Eletricidade Industrial', notes: 'Cliente preferencial', active: true, created_at: '2024-01-15T10:00:00Z' },
  { id: '2', name: 'GreenPower SA', tax_id: '510654321', address: 'Av. das Energias, 17', city: 'Porto', country: 'Portugal', phone: '+351 220 987 654', email: 'contacto@greenpower.pt', website: 'https://greenpower.pt', sector: 'Energias Renováveis', notes: '', active: true, created_at: '2024-02-20T09:30:00Z' },
  { id: '3', name: 'AutoMecânica do Sul', tax_id: '505111222', address: 'Zona Industrial, Lote 3', city: 'Faro', country: 'Portugal', phone: '+351 289 555 333', email: 'geral@automecanica.pt', website: '', sector: 'Manutenção Industrial', notes: 'Fornecedor de peças', active: true, created_at: '2024-03-10T14:15:00Z' },
];
const FIXED_BUDGETS: Budget[] = [
  { id: 'b1', company_id: '1', ref: 'ORC-2025-001', name: 'Instalação Quadro Elétrico', status: 'aprovado', items: [{ id:'i1', code:'QE-01', reference:'REF-QE-01', brand:'Schneider', model:'X100', unit:'un', category:'Material', description:'Quadro principal', quantity:1, unit_cost:2500, margin:20, discount:5, notes:'' }, { id:'i2', code:'DJ-03', reference:'REF-DJ-03', brand:'Siemens', model:'D200', unit:'un', category:'Material', description:'Disjuntores', quantity:3, unit_cost:800, margin:15, discount:0, notes:'' }] },
  { id: 'b2', company_id: '1', ref: 'ORC-2025-005', name: 'Manutenção Preventiva', status: 'enviado', items: [{ id:'i3', code:'SERV-HT', reference:'REF-HT', brand:'', model:'', unit:'h', category:'Serviço', description:'Horas técnicas', quantity:10, unit_cost:150, margin:25, discount:0, notes:'' }] },
  { id: 'b3', company_id: '2', ref: 'ORC-2025-012', name: 'Painéis Solares 50kW', status: 'aprovado', items: [{ id:'i4', code:'PS-400', reference:'REF-PS-400', brand:'LG', model:'NeON', unit:'un', category:'Material', description:'Painel 400W', quantity:50, unit_cost:300, margin:18, discount:3, notes:'' }, { id:'i5', code:'INV-5K', reference:'REF-INV-5K', brand:'Fronius', model:'Primo', unit:'un', category:'Material', description:'Inversor', quantity:2, unit_cost:5000, margin:12, discount:0, notes:'' }] },
  { id: 'b4', company_id: '2', ref: 'ORC-2025-020', name: 'Estudo de Viabilidade', status: 'rascunho', items: [{ id:'i6', code:'EST-01', reference:'REF-EST-01', brand:'', model:'', unit:'un', category:'Serviço', description:'Estudo', quantity:1, unit_cost:3500, margin:10, discount:0, notes:'' }] },
  { id: 'b5', company_id: '3', ref: 'ORC-2025-008', name: 'Reparação de Compressor', status: 'concluido', items: [{ id:'i7', code:'COMP-PC', reference:'REF-COMP-PC', brand:'Atlas Copco', model:'GA30', unit:'un', category:'Peças', description:'Peças', quantity:1, unit_cost:1200, margin:30, discount:10, notes:'' }, { id:'i8', code:'MO-5H', reference:'REF-MO-5H', brand:'', model:'', unit:'h', category:'Mão‑de‑obra', description:'Mão‑de‑obra', quantity:5, unit_cost:80, margin:20, discount:0, notes:'' }] },
];

// ============================================================
// Helpers
// ============================================================
const formatCurrency = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);
const getInitials = (n: string) => n.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
const calcBudgetValue = (b: Budget) => b.items?.reduce((s,i) => s + i.unit_cost*(1+i.margin/100)*(1-i.discount/100)*i.quantity,0)||0;
const load = <T,>(key: string, fallback: T): T => {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; } catch { return fallback; }
};
const save = (key: string, data: any) => { try { localStorage.setItem(key, JSON.stringify(data)); } catch {} };

// ============================================================
// Componente de Upload de Imagem
// ============================================================
const ImageUpload: React.FC<{ currentImage?: string; onImageChange: (base64: string) => void }> = ({ currentImage, onImageChange }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentImage || null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setPreview(base64);
      onImageChange(base64);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        onClick={() => fileRef.current?.click()}
        className="relative w-28 h-28 rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/30 flex items-center justify-center cursor-pointer transition-all group overflow-hidden"
      >
        {preview ? (
          <img src={preview} alt="Logo" className="w-full h-full object-cover rounded-2xl" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-slate-400 group-hover:text-blue-600">
            <Camera size={24} />
            <span className="text-[10px] font-medium">Adicionar logo</span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-2xl flex items-center justify-center">
          <Upload size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
      {preview && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setPreview(null);
            onImageChange('');
            if (fileRef.current) fileRef.current.value = '';
          }}
          className="text-xs text-red-500 hover:text-red-700 underline"
        >
          Remover imagem
        </button>
      )}
    </div>
  );
};

// ============================================================
// Componente Principal
// ============================================================
export function CompaniesView() {
  const { profile } = useAuth();
  const canEdit = profile?.role === 'admin' || profile?.role === 'collaborator';

  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<Company | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', tax_id: '', address: '', city: '', country: 'Portugal',
    phone: '', email: '', website: '', sector: 'Eletricidade Industrial',
    notes: '', logo: '',
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{message:string;type:'success'|'error'}|null>(null);

  const [companies, setCompanies] = useState<Company[]>(() => load('companies_data', FIXED_COMPANIES));
  const [budgets, setBudgets] = useState<Budget[]>(() => load('budgets_data', FIXED_BUDGETS));
  useEffect(() => save('companies_data', companies), [companies]);
  useEffect(() => save('budgets_data', budgets), [budgets]);

  const budgetsByCompany = useMemo(() => {
    const m: Record<string,Budget[]> = {};
    budgets.forEach(b => { if(b.company_id) { (m[b.company_id]??=[]).push(b); } });
    return m;
  }, [budgets]);
  const companyValues = useMemo(() => {
    const m: Record<string,number> = {};
    budgets.forEach(b => { if(b.company_id) m[b.company_id] = (m[b.company_id]||0)+calcBudgetValue(b); });
    return m;
  }, [budgets]);
  const companyApprovedCount = useMemo(() => {
    const m: Record<string,number> = {};
    budgets.forEach(b => { if(b.status==='aprovado' && b.company_id) m[b.company_id] = (m[b.company_id]||0)+1; });
    return m;
  }, [budgets]);
  const companiesWithBudgets = useMemo(() => new Set(budgets.map(b=>b.company_id).filter(Boolean)).size, [budgets]);
  const totalVolume = useMemo(() => companies.reduce((s,c)=>s+(companyValues[c.id]||0),0), [companies,companyValues]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return companies.filter(c => 
      (!q || c.name.toLowerCase().includes(q) || c.city?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)) &&
      (sectorFilter==='all' || c.sector===sectorFilter)
    ).sort((a,b)=>a.name.localeCompare(b.name));
  }, [search, sectorFilter, companies]);

  const toastMsg = (m:string, t:'success'|'error') => setToast({message:m,type:t});

  const openNew = () => {
    setSelected(null);
    setForm({ name: '', tax_id: '', address: '', city: '', country: 'Portugal', phone: '', email: '', website: '', sector: 'Eletricidade Industrial', notes: '', logo: '' });
    setShowModal(true);
  };
  const openEdit = (c: Company) => {
    setSelected(c);
    setForm({
      name: c.name, tax_id: c.tax_id, address: c.address, city: c.city, country: c.country,
      phone: c.phone, email: c.email, website: c.website, sector: c.sector, notes: c.notes,
      logo: c.logo || '',
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if(!form.name.trim()) { toastMsg('Nome obrigatório','error'); return; }
    setSaving(true);
    setTimeout(() => {
      if(selected) {
        setCompanies(prev => prev.map(c => c.id===selected.id ? { ...selected, ...form } : c));
        toastMsg('Atualizado!','success');
      } else {
        const novo: Company = {
          id: Date.now().toString(),
          ...form,
          active: true,
          created_at: new Date().toISOString(),
        };
        setCompanies(prev => [...prev, novo]);
        toastMsg('Criado!','success');
      }
      setShowModal(false);
      setSaving(false);
    }, 300);
  };

  const handleDelete = (c: Company) => {
    if(!confirm(`Eliminar "${c.name}"?`)) return;
    setCompanies(prev => prev.filter(x=>x.id!==c.id));
    setBudgets(prev => prev.filter(b=>b.company_id!==c.id));
    setDetailOpen(false);
    toastMsg('Eliminado!','success');
  };

  const inputClass = "w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition";
  const Field = ({ icon, ...props }: { icon: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="relative group">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">{icon}</span>
      <input {...props} className={inputClass} />
    </div>
  );

  const CompanyCard = ({ c, idx }: { c: Company; idx: number }) => {
    const color = sectorColors[idx % sectorColors.length];
    const val = companyValues[c.id]||0;
    const ap = companyApprovedCount[c.id]||0;
    const cnt = (budgetsByCompany[c.id]||[]).length;

    return (
      <button
        onClick={() => { setSelected(c); setDetailOpen(true); }}
        className="group p-4 rounded-2xl bg-white border border-slate-200 hover:border-transparent hover:shadow-xl hover:-translate-y-1 transition-all text-left relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 to-transparent group-hover:from-blue-50/50 transition" />
        <div className="relative z-10 flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow overflow-hidden" style={{ backgroundColor: c.logo ? 'transparent' : color }}>
            {c.logo ? (
              <img src={c.logo} alt={c.name} className="w-full h-full object-cover" />
            ) : (
              getInitials(c.name)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-800 truncate">{c.name}</h3>
            <p className="text-xs text-slate-500 truncate">{c.city}{c.country?`, ${c.country}`:''}</p>
          </div>
          <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all mt-1" />
        </div>
        <div className="space-y-1 text-xs mb-3 pb-3 border-b border-slate-100">
          {c.email && <p className="text-slate-500 flex items-center gap-1 truncate"><Mail size={10} className="text-slate-400" />{c.email}</p>}
          {c.phone && <p className="text-slate-500 flex items-center gap-1"><Phone size={10} className="text-slate-400" />{c.phone}</p>}
          <span className="inline-block bg-blue-50 text-blue-800 text-[10px] font-semibold px-2 py-0.5 rounded-full">{c.sector}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-slate-50 rounded-lg p-1.5"><p className="font-bold text-slate-800">{cnt}</p><p className="text-[10px] text-slate-500">Orç.</p></div>
          <div className="bg-emerald-50 rounded-lg p-1.5"><p className="font-bold text-emerald-700">{ap}</p><p className="text-[10px] text-slate-500">Aprov.</p></div>
          <div className="bg-slate-50 rounded-lg p-1.5"><p className="font-bold text-slate-800 text-xs truncate">{formatCurrency(val).replace('€','').trim()}</p><p className="text-[10px] text-slate-500">Vol.</p></div>
        </div>
      </button>
    );
  };

  const DetailPanel = detailOpen && selected ? createPortal(
    <div className="fixed inset-0 z-[9998] flex">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDetailOpen(false)} />
      <div className="relative ml-auto h-screen w-full max-w-sm bg-white/95 backdrop-blur-xl shadow-2xl flex flex-col border-l border-white/50 animate-slide-in-right">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-800 flex items-center justify-center text-white text-sm font-bold overflow-hidden">
              {selected.logo ? (
                <img src={selected.logo} alt={selected.name} className="w-full h-full object-cover" />
              ) : (
                getInitials(selected.name)
              )}
            </div>
            <div className="min-w-0"><h2 className="font-semibold text-slate-900 truncate">{selected.name}</h2><p className="text-xs text-slate-500">{selected.sector}</p></div>
          </div>
          <button onClick={() => setDetailOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {[ 
              {l:'Orç.', v:(budgetsByCompany[selected.id]||[]).length, bg:'bg-blue-50', tc:'text-blue-800'},
              {l:'Aprov.', v:companyApprovedCount[selected.id]||0, bg:'bg-emerald-50', tc:'text-emerald-800'},
              {l:'Volume', v:formatCurrency(companyValues[selected.id]||0), bg:'bg-amber-50', tc:'text-amber-800'},
            ].map(s=> (
              <div key={s.l} className={`text-center p-2 rounded-xl ${s.bg}`}>
                <p className={`text-sm font-bold ${s.tc}`}>{s.v}</p>
                <p className="text-[10px] text-slate-500">{s.l}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {[ 
              {icon:<Mail size={12}/>, val:selected.email},
              {icon:<Phone size={12}/>, val:selected.phone},
              {icon:<MapPin size={12}/>, val:[selected.address,selected.city,selected.country].filter(Boolean).join(', ')},
              {icon:<Globe size={12}/>, val:selected.website},
            ].filter(x=>x.val).map((x,i)=>(
              <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl text-xs">
                <span className="text-slate-400">{x.icon}</span>
                <span className="text-slate-700 break-all">{x.val}</span>
              </div>
            ))}
          </div>
          {(budgetsByCompany[selected.id]||[]).length>0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Orçamentos recentes</p>
              <div className="space-y-1.5">
                {(budgetsByCompany[selected.id]||[]).slice(0,5).map(b=>(
                  <div key={b.id} className="flex justify-between items-center p-2 bg-slate-50 rounded-xl text-xs">
                    <div className="min-w-0"><p className="font-medium text-slate-800 truncate">{b.name||b.ref}</p><p className="text-[10px] text-slate-400 font-mono">{b.ref}</p></div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{backgroundColor:`${STATUS_COLORS[b.status]}20`, color:STATUS_COLORS[b.status]}}>{STATUS_LABELS[b.status]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {canEdit && (
          <div className="border-t border-slate-200 p-4 flex gap-2">
            <button onClick={() => { setDetailOpen(false); openEdit(selected); }} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium flex items-center justify-center gap-1.5 hover:bg-slate-50"><Edit2 size={14}/>Editar</button>
            <button onClick={() => handleDelete(selected)} className="flex-1 py-2.5 rounded-xl bg-red-50 border border-red-200 text-sm font-medium text-red-700 flex items-center justify-center gap-1.5 hover:bg-red-100"><Trash2 size={14}/>Eliminar</button>
          </div>
        )}
      </div>
    </div>, document.body
  ) : null;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)} />}
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Empresas</h1>
          <p className="text-sm text-slate-500 flex items-center gap-2"><Briefcase size={14}/>{filtered.length} de {companies.length} empresa{companies.length!==1?'s':''}</p>
        </div>
        {canEdit && (
          <button onClick={openNew} className="px-5 py-2.5 bg-blue-800 text-white rounded-2xl font-semibold text-sm flex items-center gap-2 hover:bg-blue-900 shadow-lg shadow-blue-200 active:scale-95 transition-all">
            <Plus size={16} /> Nova Empresa
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[ 
          {l:'Total Empresas',v:companies.length,icon:<Building2 size={18}/>,bg:'from-blue-50 to-blue-100',ic:'text-blue-700'},
          {l:'Com Orçamentos',v:companiesWithBudgets,icon:<FileText size={18}/>,bg:'from-emerald-50 to-emerald-100',ic:'text-emerald-700'},
          {l:'Volume Total',v:formatCurrency(totalVolume),icon:<DollarSign size={18}/>,bg:'from-amber-50 to-amber-100',ic:'text-amber-700'},
        ].map((s,i)=>(
          <div key={i} className={`bg-gradient-to-br ${s.bg} rounded-2xl p-4 flex items-center gap-3 shadow-sm`}>
            <div className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center ${s.ic}`}>{s.icon}</div>
            <div><p className="text-xs text-slate-500">{s.l}</p><p className="text-lg font-bold text-slate-900">{s.v}</p></div>
          </div>
        ))}
      </div>

      {/* PESQUISA + FILTROS (dropdown compacto) */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-[2] min-w-[320px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar por nome, cidade ou email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all"
          />
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setSectorFilter('all')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              sectorFilter === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
            }`}
          >
            Todos
          </button>
          <div className="relative">
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 bg-white cursor-pointer hover:border-slate-300 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all"
            >
              <option value="all" disabled>Filtrar setor...</option>
              {SECTORS.map(s => (
                <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center"><Building2 size={36} className="mx-auto text-slate-300 mb-3"/><p className="text-slate-500">Nenhuma empresa encontrada</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c,idx) => <CompanyCard key={c.id} c={c} idx={idx} />)}
        </div>
      )}

      {DetailPanel}

      <Modal open={showModal} onClose={() => setShowModal(false)} size="xl" title={selected ? 'Editar Empresa' : 'Nova Empresa'}>
        <div className="grid lg:grid-cols-[300px_1fr] gap-6">
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full blur-xl" />
              <div className="flex flex-col items-center text-center">
                <ImageUpload
                  currentImage={form.logo}
                  onImageChange={(b64) => setForm({ ...form, logo: b64 })}
                />
                <h3 className="font-bold mt-3 truncate">{form.name || 'Nova Empresa'}</h3>
                <p className="text-xs text-slate-400">{form.sector}</p>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                {form.email && <div className="flex items-center gap-2 text-slate-300"><Mail size={14}/><span className="truncate">{form.email}</span></div>}
                {form.phone && <div className="flex items-center gap-2 text-slate-300"><Phone size={14}/><span>{form.phone}</span></div>}
                {(form.city || form.country) && <div className="flex items-center gap-2 text-slate-300"><MapPin size={14}/><span>{[form.city, form.country].filter(Boolean).join(', ')}</span></div>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200"><p className="text-xs text-emerald-800">Volume</p><p className="text-lg font-bold text-emerald-900">{selected ? formatCurrency(companyValues[selected.id]||0) : '0,00 €'}</p></div>
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-200"><p className="text-xs text-blue-800">Orçamentos</p><p className="text-lg font-bold text-blue-900">{selected ? (budgetsByCompany[selected.id]||[]).length : 0}</p></div>
            </div>
            {selected && (
              <div className="bg-white border border-slate-200 rounded-xl p-3 text-xs space-y-2">
                <div className="flex items-center gap-2 text-slate-600"><Calendar size={14} className="text-slate-400"/><span>{new Date(selected.created_at).toLocaleDateString('pt-PT')}</span></div>
                {selected.tax_id && <div className="flex items-center gap-2 text-slate-600"><Tag size={14} className="text-slate-400"/><span>NIF: {selected.tax_id}</span></div>}
                {selected.website && <div className="flex items-center gap-2 text-slate-600"><ExternalLink size={14} className="text-slate-400"/><a href={selected.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">{selected.website}</a></div>}
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Nome <span className="text-red-500">*</span></label>
              <Field icon={<Building2 size={18}/>} placeholder="Nome da empresa" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><label className="block text-sm font-semibold text-slate-700 mb-2">NIF</label><Field icon={<Tag size={18}/>} placeholder="510654321" value={form.tax_id} onChange={e => setForm({...form, tax_id: e.target.value})} /></div>
              <div><label className="block text-sm font-semibold text-slate-700 mb-2">Setor</label>
                <div className="relative group">
                  <Briefcase size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500" />
                  <select value={form.sector} onChange={e => setForm({...form, sector: e.target.value})} className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition bg-white">
                    {SECTORS.map(s => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="block text-sm font-semibold text-slate-700 mb-2">Website</label><Field icon={<Globe size={18}/>} placeholder="https://..." value={form.website} onChange={e => setForm({...form, website: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-sm font-semibold text-slate-700 mb-2">Email</label><Field icon={<Mail size={18}/>} placeholder="email@exemplo.pt" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
              <div><label className="block text-sm font-semibold text-slate-700 mb-2">Telefone</label><Field icon={<Phone size={18}/>} placeholder="+351..." value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="block text-sm font-semibold text-slate-700 mb-2">Morada</label><Field icon={<MapPin size={18}/>} placeholder="Rua..." value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
              <div><label className="block text-sm font-semibold text-slate-700 mb-2">Cidade</label><Field icon={<Building2 size={18}/>} placeholder="Cidade" value={form.city} onChange={e => setForm({...form, city: e.target.value})} /></div>
              <div><label className="block text-sm font-semibold text-slate-700 mb-2">País</label><Field icon={<Globe size={18}/>} placeholder="País" value={form.country} onChange={e => setForm({...form, country: e.target.value})} /></div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Notas</label>
              <div className="relative group">
                <FileText size={18} className="absolute left-4 top-4 text-slate-400 group-focus-within:text-blue-500" />
                <textarea rows={3} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition resize-none" placeholder="Observações..." />
              </div>
            </div>
            <div className="border-t pt-5 flex flex-col sm:flex-row gap-3 justify-between items-center">
              <div className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={16} className="text-blue-600"/>Dados guardados em segurança</div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={() => setShowModal(false)} className="flex-1 sm:flex-none px-5 py-2.5 border-2 border-slate-200 rounded-2xl font-medium text-sm hover:bg-slate-50">Cancelar</button>
                <button onClick={handleSave} disabled={!form.name.trim() || saving} className="flex-1 sm:flex-none px-6 py-2.5 bg-blue-800 text-white rounded-2xl font-bold text-sm hover:bg-blue-900 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-200">
                  {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <Save size={16}/>}
                  {selected ? 'Guardar' : 'Criar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <style>{`
        @keyframes modal-in { from { opacity:0; transform:scale(0.95) translateY(10px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes slide-in-right { from { opacity:0; transform:translateX(100%); } to { opacity:1; transform:translateX(0); } }
        @keyframes toast-in { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }
        .animate-modal-in { animation: modal-in 0.3s ease-out; }
        .animate-slide-in-right { animation: slide-in-right 0.3s ease-out; }
        .animate-toast-in { animation: toast-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}