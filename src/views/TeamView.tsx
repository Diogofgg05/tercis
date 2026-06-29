import React, {
  useState, useMemo, useCallback, useEffect, useReducer, useRef
} from 'react';
import {
  UserPlus, Copy, ToggleLeft, ToggleRight, Shield, Users,
  Award, Mail, Phone, Briefcase, X, Search, CheckCircle,
  Circle, SlidersHorizontal, ChevronDown, AlertCircle,
  RefreshCw, Check, Loader2, UserX, Eye, Calendar, Tag,
  Euro, Edit3, MessageSquare, TrendingUp, Clock, Hash,
  Mic, MicOff, GripVertical, Moon, Sun, Download, Upload,
  Trash2, RotateCcw, Save, Building2, FileText,
  ArrowUpDown, ChevronUp, Filter,
} from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ───────────────────────────────── Mocks autossuficientes ─────────────────────────────────
const useAuth = () => ({ profile: { role: 'admin' } });

// ───────────────────────────────── Tipos ─────────────────────────────────
type Role = 'admin' | 'collaborator' | 'client';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  department: string;
  role: Role;
  active: boolean;
}

interface BudgetItem {
  id: string;
  unit_cost: number;
  margin: number;
  discount: number;
  quantity: number;
}

interface Budget {
  id: string;
  assigned_to: string | null;
  created_by: string;
  status: string;
  items: BudgetItem[];
}

// ───────────────────────────────── Dados fixos ─────────────────────────────────
const FIXED_TEAM: Profile[] = [
  { id: 'user1', full_name: 'Carlos Silva', email: 'carlos@exemplo.pt', phone: '+351 912 345 678', department: 'Direção Técnica', role: 'admin', active: true },
  { id: 'user2', full_name: 'Marta Oliveira', email: 'marta@exemplo.pt', phone: '+351 923 456 789', department: 'Orçamentação', role: 'collaborator', active: true },
  { id: 'user3', full_name: 'Rui Sousa', email: 'rui@exemplo.pt', phone: '+351 934 567 890', department: 'Cliente Externo', role: 'client', active: true },
  { id: 'user4', full_name: 'Ana Pereira', email: 'ana@exemplo.pt', phone: '+351 945 678 901', department: 'Compras', role: 'collaborator', active: false },
  { id: 'user5', full_name: 'João Martins', email: 'joao@exemplo.pt', phone: '+351 956 789 012', department: 'Manutenção', role: 'client', active: true },
];

const FIXED_BUDGETS: Budget[] = [
  { id: 'b1', assigned_to: 'user1', created_by: 'user1', status: 'aprovado', items: [{ id: 'i1', unit_cost: 2500, margin: 20, discount: 5, quantity: 1 }] },
  { id: 'b2', assigned_to: 'user2', created_by: 'user1', status: 'aprovado', items: [{ id: 'i2', unit_cost: 150, margin: 25, discount: 0, quantity: 10 }] },
  { id: 'b3', assigned_to: 'user3', created_by: 'user2', status: 'rascunho', items: [{ id: 'i3', unit_cost: 300, margin: 18, discount: 3, quantity: 50 }] },
  { id: 'b4', assigned_to: 'user1', created_by: 'user1', status: 'enviado', items: [{ id: 'i4', unit_cost: 1200, margin: 30, discount: 10, quantity: 1 }] },
  { id: 'b5', assigned_to: 'user5', created_by: 'user2', status: 'concluido', items: [{ id: 'i5', unit_cost: 3500, margin: 10, discount: 0, quantity: 1 }] },
];

// ───────────────────────────────── Constantes visuais ─────────────────────────────────
const ROLE_LABELS: Record<Role, string> = { admin: 'Admin', collaborator: 'Colaborador', client: 'Cliente' };
const ROLE_COLORS: Record<Role, string> = {
  admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  collaborator: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  client: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
};
const AVATAR_COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];
const STATUS_COLORS: Record<string, string> = {
  aprovado: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  rascunho: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  enviado: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  concluido: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

// ───────────────────────────────── Helpers ─────────────────────────────────
function getInitials(name: string) { return name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase(); }
function formatCurrency(value: number) { return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value); }
function computeBudgetTotal(budget: Budget) {
  return budget.items.reduce((sum, item) => {
    const base = item.unit_cost * item.quantity;
    const discounted = base * (1 - item.discount / 100);
    const final = discounted * (1 + item.margin / 100);
    return sum + final;
  }, 0);
}

// ───────────────────────────────── Toast ─────────────────────────────────
let toastId = 0;
function useToast() {
  const [toasts, setToasts] = useState<{id:number;message:string;type:'success'|'error'|'info'}[]>([]);
  const add = useCallback((message:string, type:'success'|'error'|'info'='info', duration=3000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, {id,message,type}]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);
  return { toasts, addToast: add };
}

// ───────────────────────────────── Hooks reutilizáveis ─────────────────────────────────
function useDebounce<T>(value:T, delay:number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const h = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(h); }, [value, delay]);
  return debounced;
}
function useLocalStorage<T>(key:string, initial:T) {
  const [stored, setStored] = useState<T>(() => { try { const item = window.localStorage.getItem(key); return item ? JSON.parse(item) : initial; } catch { return initial; } });
  const setValue = (value:T|((val:T)=>T)) => {
    const next = value instanceof Function ? value(stored) : value;
    setStored(next);
    window.localStorage.setItem(key, JSON.stringify(next));
  };
  return [stored, setValue] as const;
}
function useSpeechRecognition() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const ref = useRef<any>(null);
  const supported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  useEffect(() => {
    if (!supported) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    ref.current = new SR();
    ref.current.continuous = false; ref.current.interimResults = false; ref.current.lang = 'pt-PT';
    ref.current.onresult = (e:any) => { setTranscript(e.results[0][0].transcript); setListening(false); };
    ref.current.onerror = () => setListening(false);
    ref.current.onend = () => setListening(false);
  }, [supported]);
  const start = useCallback(() => { if(ref.current) { setTranscript(''); setListening(true); ref.current.start(); } }, []);
  const stop = useCallback(() => { if(ref.current) { ref.current.stop(); setListening(false); } }, []);
  return { listening, transcript, start, stop, supported };
}
function useKeyboardShortcut(key:string, cb:()=>void, mods?:{ctrl?:boolean;shift?:boolean}) {
  useEffect(() => {
    const h = (e:KeyboardEvent) => { if(e.key===key && (!mods?.ctrl || e.ctrlKey) && (!mods?.shift || e.shiftKey)) { e.preventDefault(); cb(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [key, cb, mods]);
}

// ───────────────────────────────── Modal (melhorado) ─────────────────────────────────
interface ModalProps { open: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'; }
const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, size = 'md' }) => {
  // Efeito para fechar com Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 transition-opacity duration-300"
      onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full ${
        size==='sm'?'max-w-sm':size==='lg'?'max-w-2xl':size==='xl'?'max-w-5xl':'max-w-lg'
      } mx-4 p-6 max-h-[90vh] overflow-y-auto transform transition-all duration-300 scale-100 opacity-100`}
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-700"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
};

// ───────────────────────────────── Reducer da equipa ─────────────────────────────────
type TeamAction =
  | { type: 'SET_TEAM'; payload: Profile[] }
  | { type: 'ADD_MEMBER'; payload: Profile }
  | { type: 'UPDATE_MEMBER'; payload: Profile }
  | { type: 'TOGGLE_ACTIVE'; payload: string }
  | { type: 'UPDATE_ROLE'; payload: { id: string; role: Role } }
  | { type: 'REMOVE_MEMBER'; payload: string }
  | { type: 'REORDER_TEAM'; payload: Profile[] };

function teamReducer(state: Profile[], action: TeamAction): Profile[] {
  switch (action.type) {
    case 'SET_TEAM': return action.payload;
    case 'ADD_MEMBER': return [...state, action.payload];
    case 'UPDATE_MEMBER': return state.map(p => p.id === action.payload.id ? action.payload : p);
    case 'TOGGLE_ACTIVE': return state.map(p => p.id === action.payload ? { ...p, active: !p.active } : p);
    case 'UPDATE_ROLE': return state.map(p => p.id === action.payload.id ? { ...p, role: action.payload.role } : p);
    case 'REMOVE_MEMBER': return state.filter(p => p.id !== action.payload);
    case 'REORDER_TEAM': return action.payload;
    default: return state;
  }
}

// ───────────────────────────────── Card de membro (com drag & drop corrigido) ─────────────────────────────────
interface TeamMemberCardProps {
  member: Profile; initials: string; color: string; assignedCount: number; createdCount: number;
  isAdmin: boolean; onToggleActive: (id: string) => void; onUpdateRole: (id: string, role: Role) => void;
  onCopyEmail: (email: string) => void; onPhoneClick: (phone: string) => void;
  onOpenDetail: (id: string) => void; onRemove: (id: string) => void;
  dragEnabled: boolean;
}

const SortableTeamMemberCard: React.FC<TeamMemberCardProps & { id: string }> = (props) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.id, disabled: !props.dragEnabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <TeamMemberCard {...props} dragHandleProps={props.dragEnabled ? listeners : undefined} />
    </div>
  );
};

const TeamMemberCard: React.FC<TeamMemberCardProps & { dragHandleProps?: any }> = ({
  member:m, initials, color, assignedCount, createdCount, isAdmin, onToggleActive, onUpdateRole, onCopyEmail, onPhoneClick, onOpenDetail, onRemove, dragHandleProps, dragEnabled
}) => {
  const [showConfirmToggle, setShowConfirmToggle] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const handleToggleClick = (e: React.MouseEvent) => { e.stopPropagation(); if(isAdmin) setShowConfirmToggle(true); };
  const confirmToggle = () => { onToggleActive(m.id); setShowConfirmToggle(false); };
  const handleDeleteClick = (e: React.MouseEvent) => { e.stopPropagation(); setShowDeleteConfirm(true); };

  return (
    <>
      <div onClick={() => onOpenDetail(m.id)}
        className={`relative group bg-white dark:bg-slate-800 rounded-2xl border p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 cursor-pointer ${
          !m.active ? 'opacity-60 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50' : 'border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-700 hover:ring-2 hover:ring-blue-50 dark:hover:ring-blue-900/20'
        }`}
        role="button" tabIndex={0} aria-label={`Ver detalhes de ${m.full_name}`}
        onKeyDown={e => { if(e.key==='Enter'||e.key===' ') onOpenDetail(m.id); }}>
        {/* Drag handle visível apenas quando dragEnabled */}
        {dragEnabled && dragHandleProps && (
          <button {...dragHandleProps} className="absolute top-2 left-2 p-1 rounded-md text-slate-300 hover:text-slate-500 dark:hover:text-slate-400 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Arrastar para reordenar" onClick={e=>e.stopPropagation()}><GripVertical size={14} /></button>
        )}
        <div className="flex items-start gap-4 mb-4">
          <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center text-white font-black text-base flex-shrink-0 shadow-sm`}>{initials}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-slate-800 dark:text-white truncate">{m.full_name}{!m.active && <span className="ml-2 text-xs font-medium text-slate-400 dark:text-slate-500">(Inativo)</span>}</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                  <button onClick={e=>{e.stopPropagation();onCopyEmail(m.email);}} className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate hover:text-blue-600 dark:hover:text-blue-400 transition-colors"><Mail size={10} className="flex-shrink-0" /><span className="group-hover:underline">{m.email}</span><Copy size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" /></button>
                  {m.phone && <button onClick={e=>{e.stopPropagation();onPhoneClick(m.phone);}} className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"><Phone size={10} /> {m.phone}</button>}
                </div>
                {m.department && <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-1"><Briefcase size={10} /> {m.department}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isAdmin ? (
                  <select value={m.role} onChange={e=>{e.stopPropagation();onUpdateRole(m.id, e.target.value as Role);}} onClick={e=>e.stopPropagation()}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer border-0 appearance-none ${ROLE_COLORS[m.role]} pr-6 bg-no-repeat`}
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%23475569' stroke-width='2'%3E%3Cpath d='m2 4 4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 4px center' }}>
                    <option value="admin">Admin</option><option value="collaborator">Colaborador</option><option value="client">Cliente</option>
                  </select>
                ) : <span className={`px-2 py-1 rounded-lg text-[11px] font-bold ${ROLE_COLORS[m.role]}`}>{ROLE_LABELS[m.role]}</span>}
                {isAdmin && <div className="flex items-center gap-1">
                  <button onClick={handleToggleClick} className={`p-1 rounded-lg transition-colors ${m.active?'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20':'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`} title={m.active?'Desativar':'Ativar'}>{m.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}</button>
                  <button onClick={handleDeleteClick} className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Remover"><Trash2 size={16} /></button>
                </div>}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mb-3">
          {m.active ? <><CheckCircle size={12} className="text-emerald-500" /><span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Ativo</span></> : <><Circle size={12} className="text-slate-300 dark:text-slate-600" /><span className="text-xs font-medium text-slate-400 dark:text-slate-500">Inativo</span></>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-2 bg-slate-50 dark:bg-slate-700/50 rounded-xl group-hover:bg-blue-50 dark:group-hover:bg-blue-900/10 transition-colors"><p className="text-lg font-black text-slate-800 dark:text-white">{assignedCount}</p><p className="text-[10px] text-slate-400 dark:text-slate-500">Atribuídos</p></div>
          <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/10 rounded-xl"><p className="text-lg font-black text-blue-700 dark:text-blue-400">{createdCount}</p><p className="text-[10px] text-slate-400 dark:text-slate-500">Criados por si</p></div>
        </div>
      </div>

      <Modal open={showConfirmToggle} onClose={()=>setShowConfirmToggle(false)} title={m.active?'Desativar membro':'Ativar membro'} size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-xl">
            <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center text-white font-bold`}>{initials}</div>
            <div><p className="font-semibold text-slate-800 dark:text-white">{m.full_name}</p><p className="text-xs text-slate-500 dark:text-slate-400">{m.email}</p></div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">{m.active?'Tem a certeza de que deseja desativar este membro?':'Tem a certeza de que deseja reativar este membro?'}</p>
          <div className="flex gap-3 justify-end">
            <button onClick={()=>setShowConfirmToggle(false)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600">Cancelar</button>
            <button onClick={confirmToggle} className={`px-4 py-2 text-sm font-semibold text-white rounded-xl ${m.active?'bg-rose-600 hover:bg-rose-700':'bg-emerald-600 hover:bg-emerald-700'}`}>{m.active?'Sim, desativar':'Sim, ativar'}</button>
          </div>
        </div>
      </Modal>

      <Modal open={showDeleteConfirm} onClose={()=>setShowDeleteConfirm(false)} title="Remover membro" size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
            <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center text-white font-bold`}>{initials}</div>
            <div><p className="font-semibold text-slate-800 dark:text-white">{m.full_name}</p><p className="text-xs text-red-600 dark:text-red-400">Esta ação é irreversível.</p></div>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={()=>setShowDeleteConfirm(false)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600">Cancelar</button>
            <button onClick={()=>{onRemove(m.id);setShowDeleteConfirm(false);}} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl">Remover permanentemente</button>
          </div>
        </div>
      </Modal>
    </>
  );
};

// ───────────────────────────────── Modal de detalhes do membro (HORIZONTAL + EDIÇÃO) ─────────────────────────────────
const MemberDetailModal: React.FC<{
  open: boolean; onClose: () => void; member: Profile | null;
  budgets: Budget[]; onUpdateMember: (m: Profile) => void;
}> = ({ open, onClose, member, budgets, onUpdateMember }) => {
  if (!member) return null;
  const initials = getInitials(member.full_name);
  const colorIndex = member.id.split('').reduce((acc,c)=>acc+c.charCodeAt(0),0) % AVATAR_COLORS.length;
  const avatarColor = AVATAR_COLORS[colorIndex];

  const assignedBudgets = useMemo(() => budgets.filter(b => b.assigned_to === member.id), [budgets, member.id]);
  const createdBudgets = useMemo(() => budgets.filter(b => b.created_by === member.id), [budgets, member.id]);
  const totalAssigned = useMemo(() => assignedBudgets.reduce((s,b)=>s+computeBudgetTotal(b),0), [assignedBudgets]);
  const totalCreated = useMemo(() => createdBudgets.reduce((s,b)=>s+computeBudgetTotal(b),0), [createdBudgets]);

  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Profile>({...member});
  const [saving, setSaving] = useState(false);
  const isDirty = useMemo(() => {
    return editData.full_name !== member.full_name || editData.email !== member.email || editData.phone !== member.phone || editData.department !== member.department || editData.role !== member.role;
  }, [editData, member]);

  useEffect(() => { setEditData({...member}); setEditing(false); }, [member]);

  const handleCancelEdit = () => {
    if (isDirty && !window.confirm('Descartar alterações?')) return;
    setEditing(false);
    setEditData({...member});
  };

  const handleSave = async () => {
    if (!editData.full_name || !editData.email) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    onUpdateMember(editData);
    setEditing(false);
    setSaving(false);
  };

  const [budgetFilter, setBudgetFilter] = useState<'all'|string>('all');
  const filteredAssigned = budgetFilter==='all' ? assignedBudgets : assignedBudgets.filter(b => b.status === budgetFilter);
  const filteredCreated = budgetFilter==='all' ? createdBudgets : createdBudgets.filter(b => b.status === budgetFilter);

  return (
    <Modal open={open} onClose={onClose} title="Detalhes do Membro" size="xl">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUNA ESQUERDA – Perfil + Edição */}
        <div className="lg:col-span-1 space-y-5">
          <div className="flex items-start gap-4 p-4 bg-gradient-to-br from-slate-50 to-white dark:from-slate-700 dark:to-slate-800 rounded-2xl border border-slate-100 dark:border-slate-600">
            <div className={`w-14 h-14 rounded-2xl ${avatarColor} flex items-center justify-center text-white font-black text-xl shadow-sm flex-shrink-0`}>{initials}</div>
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="space-y-2">
                  <input type="text" value={editData.full_name} onChange={e=>setEditData({...editData, full_name:e.target.value})} className="w-full px-2 py-1 text-sm font-bold border rounded-md dark:bg-slate-700 dark:text-white" placeholder="Nome completo" />
                  <input type="email" value={editData.email} onChange={e=>setEditData({...editData, email:e.target.value})} className="w-full px-2 py-1 text-xs border rounded-md dark:bg-slate-700 dark:text-white" placeholder="Email" />
                  <input type="tel" value={editData.phone} onChange={e=>setEditData({...editData, phone:e.target.value})} className="w-full px-2 py-1 text-xs border rounded-md dark:bg-slate-700 dark:text-white" placeholder="Telefone" />
                  <input type="text" value={editData.department} onChange={e=>setEditData({...editData, department:e.target.value})} className="w-full px-2 py-1 text-xs border rounded-md dark:bg-slate-700 dark:text-white" placeholder="Departamento" />
                  <select value={editData.role} onChange={e=>setEditData({...editData, role:e.target.value as Role})} className="w-full px-2 py-1 text-xs border rounded-md dark:bg-slate-700 dark:text-white">
                    <option value="admin">Admin</option><option value="collaborator">Colaborador</option><option value="client">Cliente</option>
                  </select>
                </div>
              ) : (
                <>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{member.full_name}</h3>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600 dark:text-slate-400 mt-1">
                    <span className="flex items-center gap-1"><Mail size={14} /> {member.email}</span>
                    {member.phone && <span className="flex items-center gap-1"><Phone size={14} /> {member.phone}</span>}
                  </div>
                  {member.department && <p className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 mt-1"><Briefcase size={14} /> {member.department}</p>}
                </>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${ROLE_COLORS[member.role]}`}>{ROLE_LABELS[member.role]}</span>
                <span className={`flex items-center gap-1 text-xs font-medium ${member.active?'text-emerald-600 dark:text-emerald-400':'text-slate-400 dark:text-slate-500'}`}>
                  {member.active ? <CheckCircle size={14} className="text-emerald-500" /> : <Circle size={14} className="text-slate-300 dark:text-slate-600" />}
                  {member.active?'Ativo':'Inativo'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {!editing ? (
              <>
                <button onClick={() => { setEditData({...member}); setEditing(true); }} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 flex items-center justify-center gap-1"><Edit3 size={14} /> Editar</button>
                <button onClick={() => navigator.clipboard.writeText(member.email)} className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"><Copy size={14} /></button>
              </>
            ) : (
              <div className="flex gap-2 w-full">
                <button onClick={handleCancelEdit} disabled={saving} className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700">Cancelar</button>
                <button onClick={handleSave} disabled={!isDirty || saving} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1"><Save size={14} /> {saving?'A guardar...':'Guardar'}</button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 border border-emerald-100 dark:border-emerald-800">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Atribuído</p>
              <p className="text-lg font-black text-emerald-800 dark:text-emerald-200">{formatCurrency(totalAssigned)}</p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400">{assignedBudgets.length} orç.</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-800">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Criado</p>
              <p className="text-lg font-black text-blue-800 dark:text-blue-200">{formatCurrency(totalCreated)}</p>
              <p className="text-[10px] text-blue-600 dark:text-blue-400">{createdBudgets.length} orç.</p>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA – Orçamentos */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-800 dark:text-white">Orçamentos</h4>
            <div className="flex gap-1 flex-wrap">
              {['all','aprovado','rascunho','enviado','concluido'].map(st => (
                <button key={st} onClick={()=>setBudgetFilter(st)} className={`px-2 py-1 rounded-full text-[10px] font-bold transition-colors ${
                  budgetFilter===st ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-800' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}>{st==='all'?'Todos':st}</button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-[10px] text-slate-400">Ref</th>
                    <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-[10px] text-slate-400">Estado</th>
                    <th className="px-3 py-2 text-right font-bold uppercase tracking-wider text-[10px] text-slate-400">Total</th>
                    <th className="px-3 py-2 text-right font-bold uppercase tracking-wider text-[10px] text-slate-400">Itens</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssigned.concat(filteredCreated).length === 0 ? (
                    <tr><td colSpan={4} className="py-4 text-center text-slate-400">Nenhum orçamento encontrado</td></tr>
                  ) : (
                    [...filteredAssigned.map(b=>({...b, type:'Atribuído'})), ...filteredCreated.map(b=>({...b, type:'Criado'}))]
                      .sort((a,b) => b.id.localeCompare(a.id))
                      .map(b => (
                        <tr key={b.id} className="border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">{b.id.toUpperCase()}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[b.status]}`}>{b.status}</span>
                            {b.type && <span className="ml-1 text-[10px] text-slate-400">({b.type})</span>}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-slate-800 dark:text-white">{formatCurrency(computeBudgetTotal(b))}</td>
                          <td className="px-3 py-2 text-right text-slate-500">{b.items.length}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

// ───────────────────────────────── COMPONENTE PRINCIPAL (cores ajustadas, drag funcional) ─────────────────────────────────
export function TeamView(_props: {
  team?: unknown[];
  budgets?: unknown[];
  onRefresh?: () => void;
} = {}) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  // Dark mode opcional
  const [dark, setDark] = useLocalStorage('darkMode', false);
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);

  const [team, dispatch] = useReducer(teamReducer, []);
  const [budgets] = useState<Budget[]>(FIXED_BUDGETS);
  const [loading, setLoading] = useState(true);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const cached = localStorage.getItem('team');
      dispatch({ type: 'SET_TEAM', payload: cached ? JSON.parse(cached) : FIXED_TEAM });
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => { if (!loading) localStorage.setItem('team', JSON.stringify(team)); }, [team, loading]);

  const { toasts, addToast } = useToast();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('collaborator');
  const [emailError, setEmailError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [roleFilter, setRoleFilter] = useState<Role|'all'>('all');
  const [sortKey, setSortKey] = useState<'name'|'role'|'active'>('name');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc');

  const { listening, transcript, start: startVoice, stop: stopVoice, supported: voiceSupported } = useSpeechRecognition();
  useEffect(() => { if(transcript) setSearchTerm(transcript); }, [transcript]);

  useKeyboardShortcut('k', () => { document.querySelector<HTMLInputElement>('[data-search-input]')?.focus(); }, { ctrl: true });
  useKeyboardShortcut('n', () => { if(isAdmin) setShowInviteModal(true); }, { ctrl: true });

  useEffect(() => { if(!showInviteModal) { setEmail(''); setEmailError(''); setInviteRole('collaborator'); } }, [showInviteModal]);

  const selectedMember = useMemo(() => team.find(m=>m.id===selectedMemberId)||null, [team, selectedMemberId]);

  const stats = useMemo(() => ({
    total: team.length, admins: team.filter(m=>m.role==='admin').length,
    collaborators: team.filter(m=>m.role==='collaborator').length,
    clients: team.filter(m=>m.role==='client').length, active: team.filter(m=>m.active).length
  }), [team]);

  // Drag & drop só ativo sem filtros de pesquisa/função e quando a ordenação é por nome (para evitar conflitos)
  const dragEnabled = useMemo(() => {
    return isAdmin && searchTerm === '' && roleFilter === 'all' && sortKey === 'name';
  }, [isAdmin, searchTerm, roleFilter, sortKey]);

  const filteredTeam = useMemo(() => {
    let list = team.filter(m => {
      const okRole = roleFilter==='all'||m.role===roleFilter;
      const term = debouncedSearch;
      const okSearch = !term || m.full_name.toLowerCase().includes(term) || m.email.toLowerCase().includes(term) || m.department.toLowerCase().includes(term);
      return okRole && okSearch;
    });
    list = [...list].sort((a,b) => {
      let cmp = 0;
      if(sortKey==='name') cmp = a.full_name.localeCompare(b.full_name);
      else if(sortKey==='role') { const order = ['admin','collaborator','client']; cmp = order.indexOf(a.role) - order.indexOf(b.role); }
      else if(sortKey==='active') cmp = Number(b.active) - Number(a.active);
      return sortDir==='asc' ? cmp : -cmp;
    });
    return list;
  }, [team, roleFilter, debouncedSearch, sortKey, sortDir]);

  const memberData = useMemo(() => filteredTeam.map(m => {
    const assigned = budgets.filter(b=>b.assigned_to===m.id);
    const created = budgets.filter(b=>b.created_by===m.id);
    return { member:m, initials:getInitials(m.full_name), assignedCount:assigned.length, createdCount:created.length };
  }), [filteredTeam, budgets]);

  const copyToClipboard = useCallback((text:string, label='Texto') => {
    navigator.clipboard.writeText(text);
    addToast(`${label} copiado!`, 'success');
  }, [addToast]);

  const handleCopyEmail = useCallback((email:string) => copyToClipboard(email, 'Email'), [copyToClipboard]);
  const handlePhoneClick = useCallback((phone:string) => { navigator.clipboard.writeText(phone); addToast('Telefone copiado', 'info'); }, [addToast]);

  const handleInvite = useCallback(() => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError('Email inválido'); return; }
    if (team.some(m=>m.email.toLowerCase()===email.toLowerCase())) { setEmailError('Email já pertence a um membro'); return; }
    const newMember: Profile = { id: Date.now().toString(), full_name: email.split('@')[0], email, phone: '', department: '', role: inviteRole, active: true };
    dispatch({ type:'ADD_MEMBER', payload:newMember });
    addToast('Membro convidado!', 'success');
    setShowInviteModal(false);
  }, [email, inviteRole, team, addToast]);

  const toggleActive = useCallback((id:string) => {
    dispatch({ type:'TOGGLE_ACTIVE', payload:id });
    const member = team.find(m=>m.id===id);
    if(member) addToast(member.active ? `${member.full_name} desativado` : `${member.full_name} reativado`, 'info');
  }, [team, addToast]);

  const updateRole = useCallback((id:string, role:Role) => {
    dispatch({ type:'UPDATE_ROLE', payload:{id, role} });
    addToast('Função atualizada', 'success');
  }, [addToast]);

  const updateMember = useCallback((updated:Profile) => {
    dispatch({ type:'UPDATE_MEMBER', payload:updated });
    addToast('Membro atualizado', 'success');
  }, [addToast]);

  const removeMember = useCallback((id:string) => {
    dispatch({ type:'REMOVE_MEMBER', payload:id });
    addToast('Membro removido', 'info');
  }, [addToast]);

  const clearFilters = useCallback(() => { setSearchTerm(''); setRoleFilter('all'); setSortKey('name'); setSortDir('asc'); }, []);

  // Sensores de drag
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Handler corrigido: atualiza a lista completa 'team' com base nos índices atuais da lista ordenada (filteredTeam)
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Como o drag é ativado apenas quando não há filtros, filteredTeam é igual a team (ordenado por nome)
    const oldIndex = team.findIndex(m => m.id === active.id);
    const newIndex = team.findIndex(m => m.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(team, oldIndex, newIndex);
    dispatch({ type: 'REORDER_TEAM', payload: newOrder });
    addToast('Ordem atualizada', 'info');
  }, [team, addToast]);

  const exportTeam = () => {
    const csv = [['Nome','Email','Telefone','Departamento','Função','Ativo'], ...team.map(m=>[m.full_name,m.email,m.phone,m.department,ROLE_LABELS[m.role],m.active?'Sim':'Não'])].map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`equipa_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    addToast('Equipa exportada', 'success');
  };

  return (
    <div className={`min-h-screen ${dark?'dark':''}`}>
      {/* Container principal com fundo claro (slate-50) e dark opcional */}
      <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto bg-slate-50 dark:bg-slate-900 min-h-screen transition-colors">
        {/* Toasts */}
        <div className="fixed bottom-6 right-6 z-50 space-y-2">
          {toasts.map(t => (
            <div key={t.id} className={`px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-fade-in ${
              t.type==='success'?'bg-emerald-50 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800':
              t.type==='error'?'bg-rose-50 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800':
              'bg-blue-50 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
            }`}>
              {t.type==='success'?<Check size={16}/>:t.type==='error'?<AlertCircle size={16}/>:<CheckCircle size={16}/>}
              {t.message}
            </div>
          ))}
        </div>

        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Equipa</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{loading?'A carregar…':`${stats.total} membros · ${stats.active} ativos`}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={()=>setDark(!dark)} className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" title={dark?'Modo claro':'Modo escuro'}>{dark?<Sun size={16}/>:<Moon size={16}/>}</button>
            {isAdmin && <button onClick={()=>setShowInviteModal(true)} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 active:scale-95 flex items-center gap-2 shadow-sm"><UserPlus size={16} /> Convidar Membro</button>}
            <button onClick={exportTeam} className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" title="Exportar CSV"><Download size={16} /></button>
            <button onClick={clearFilters} className="p-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl" title="Limpar filtros"><RefreshCw size={16} /></button>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Total" value={stats.total} icon={<Users size={15} className="text-blue-600"/>} bg="bg-blue-50 dark:bg-blue-900/20" />
          <StatCard label="Ativos" value={stats.active} icon={<CheckCircle size={15} className="text-emerald-600"/>} bg="bg-emerald-50 dark:bg-emerald-900/20" />
          <StatCard label="Admins" value={stats.admins} icon={<Shield size={15} className="text-blue-600"/>} bg="bg-blue-50 dark:bg-blue-900/20" />
          <StatCard label="Colaboradores" value={stats.collaborators} icon={<Users size={15} className="text-slate-600"/>} bg="bg-slate-100 dark:bg-slate-800" />
          <StatCard label="Clientes" value={stats.clients} icon={<Award size={15} className="text-amber-600"/>} bg="bg-amber-50 dark:bg-amber-900/20" />
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Pesquisar... (Ctrl+K)" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} data-search-input
              className="w-full pl-9 pr-10 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 dark:focus:ring-blue-900/20 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
            {voiceSupported && <button onClick={listening?stopVoice:startVoice} className={`absolute right-8 top-1/2 -translate-y-1/2 p-1 rounded-md ${listening?'text-red-500 bg-red-50 dark:bg-red-900/20':'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>{listening?<MicOff size={16}/>:<Mic size={16}/>}</button>}
            {searchTerm && <button onClick={()=>setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"><X size={14}/></button>}
          </div>
          <select value={roleFilter} onChange={e=>setRoleFilter(e.target.value as Role|'all')} className="px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            <option value="all">Todas as funções</option><option value="admin">Admin</option><option value="collaborator">Colaborador</option><option value="client">Cliente</option>
          </select>
          <div className="flex gap-2">
            <select value={sortKey} onChange={e=>setSortKey(e.target.value as any)} className="px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <option value="name">Nome</option><option value="role">Função</option><option value="active">Estado</option>
            </select>
            <button onClick={()=>setSortDir(d=>d==='asc'?'desc':'asc')} className="px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1 text-slate-700 dark:text-slate-300">
              <SlidersHorizontal size={14} /> <ChevronDown size={14} className={`transition-transform ${sortDir==='desc'?'rotate-180':''}`} />
            </button>
          </div>
        </div>

        {/* Grid com drag & drop */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{Array.from({length:6}).map((_,i)=><SkeletonCard key={i}/>)}</div>
        ) : memberData.length===0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500 gap-3">
            <UserX size={48} className="text-slate-300 dark:text-slate-600" />
            <p className="text-lg font-medium">Nenhum membro encontrado.</p>
            {isAdmin && !searchTerm && roleFilter==='all' && <button onClick={()=>setShowInviteModal(true)} className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-xl">Convidar Membro</button>}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={memberData.map(d => d.member.id)} strategy={verticalListSortingStrategy}>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {memberData.map((data, idx) => (
                  <SortableTeamMemberCard key={data.member.id} id={data.member.id}
                    member={data.member} initials={data.initials} color={AVATAR_COLORS[idx%AVATAR_COLORS.length]}
                    assignedCount={data.assignedCount} createdCount={data.createdCount} isAdmin={isAdmin}
                    onToggleActive={toggleActive} onUpdateRole={updateRole} onCopyEmail={handleCopyEmail}
                    onPhoneClick={handlePhoneClick} onOpenDetail={setSelectedMemberId} onRemove={removeMember}
                    dragEnabled={dragEnabled} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Modal detalhes + edição */}
        <MemberDetailModal open={!!selectedMemberId} onClose={()=>setSelectedMemberId(null)} member={selectedMember} budgets={budgets} onUpdateMember={updateMember} />

        {/* Modal convite */}
        <Modal open={showInviteModal} onClose={()=>setShowInviteModal(false)} title="Convidar Membro" size="md">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
              <input type="email" placeholder="exemplo@dominio.pt" value={email} onChange={e=>{setEmail(e.target.value);if(emailError)setEmailError('');}}
                className={`w-full px-3 py-2.5 border rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white ${emailError?'border-rose-300':'border-slate-200 dark:border-slate-600'}`} />
              {emailError && <p className="mt-1 text-xs text-rose-600 flex items-center gap-1"><AlertCircle size={12}/> {emailError}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Função</label>
              <select value={inviteRole} onChange={e=>setInviteRole(e.target.value as Role)} className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <option value="admin">Admin</option><option value="collaborator">Colaborador</option><option value="client">Cliente</option>
              </select>
            </div>
            <button onClick={handleInvite} disabled={!email} className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <UserPlus size={16} /> Enviar Convite
            </button>
          </div>
        </Modal>
      </div>
    </div>
  );
}

// Componentes auxiliares (StatCard, SkeletonCard)
function StatCard({ label, value, icon, bg, tooltip }: { label: string; value: number; icon: React.ReactNode; bg: string; tooltip?: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4 flex items-center gap-3 transition-all hover:shadow-md" title={tooltip}>
      <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>{icon}</div>
      <div><p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{label}</p><p className="text-xl font-black text-slate-900 dark:text-white">{value}</p></div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm animate-pulse">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
          <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-1/2" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-1/3" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-12 bg-slate-100 dark:bg-slate-700 rounded-xl" />
          <div className="h-12 bg-slate-100 dark:bg-slate-700 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
