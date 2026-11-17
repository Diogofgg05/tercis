import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  User, Mail, Phone, Shield, Bell, Lock,
  Save, Eye, EyeOff, AlertCircle, CheckCircle2,
  Globe, Info, Briefcase, Building2,
  Calendar, BarChart3, Users, Package, Activity,
  Zap, Layers, Check, X,
  Upload, Trash2, Download,
  QrCode, ShieldCheck, Smartphone, MessageSquare,
  RefreshCw, Copy, Settings as SettingsIcon,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { MFASettings } from '../components/MFASettings';

// ---------- Tipos ----------

interface ProfileFormData {
  fullName: string;
  phone: string;
  jobTitle: string;
  department: string;
  nif: string;
  address: string;
  postalCode: string;
  locality: string;
  website: string;
}

// ---------- Hooks personalizados ----------
function useLocalStorage<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initial;
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue];
}

function useForm<T extends Record<string, any>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };
  const setField = (name: keyof T, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };
  const validate = (rules: Partial<Record<keyof T, (v: any) => string | undefined>>) => {
    const newErrors: Partial<Record<keyof T, string>> = {};
    for (const [key, rule] of Object.entries(rules)) {
      const error = typeof rule === 'function' ? rule(values[key as keyof T]) : undefined;
      if (error) newErrors[key as keyof T] = error;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  return { values, setValues, errors, setErrors, handleChange, setField, validate };
}

// ---------- Componentes reutilizáveis (tons claros) ----------
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm ${className}`}>
    {children}
  </div>
);

const CardHeader: React.FC<{ icon?: React.ReactNode; title: string; subtitle?: string }> = ({ icon, title, subtitle }) => (
  <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-slate-100">
    {icon && <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600">{icon}</div>}
    <div>
      <h3 className="font-bold text-slate-800">{title}</h3>
      {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
    </div>
  </div>
);

const InputField: React.FC<{
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon?: React.ReactNode;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  type?: string;
}> = ({ label, name, value, onChange, icon, placeholder, error, disabled = false, type = 'text' }) => (
  <div className="space-y-1.5">
    <label htmlFor={name} className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
      {label}
    </label>
    <div className="relative">
      {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>}
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full ${icon ? 'pl-9' : 'pl-4'} pr-4 py-2.5 border rounded-xl text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-slate-300 ${
          error
            ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
            : 'border-slate-200 focus:border-slate-400'
        } bg-white text-slate-800 placeholder:text-slate-400 disabled:opacity-60 disabled:cursor-not-allowed`}
      />
    </div>
    {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} /> {error}</p>}
  </div>
);

const ToggleSwitch: React.FC<{ enabled: boolean; onChange: () => void; label?: string }> = ({ enabled, onChange, label }) => (
  <button
    type="button"
    onClick={onChange}
    className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-slate-300 ${
      enabled ? 'bg-slate-800' : 'bg-slate-200'
    }`}
    aria-label={label || 'Toggle'}
  >
    <span
      className={`block w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
        enabled ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

const Badge: React.FC<{ children: React.ReactNode; color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray' }> = ({
  children,
  color = 'gray',
}) => {
  const colors = {
    blue: 'bg-slate-100 text-slate-800',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    yellow: 'bg-amber-50 text-amber-700',
    purple: 'bg-purple-50 text-purple-700',
    gray: 'bg-slate-100 text-slate-600',
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${colors[color]}`}>{children}</span>;
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; sub?: string }> = ({ icon, label, value, sub }) => (
  <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm transition-all hover:shadow-md">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-2xl font-black text-slate-800 mt-1">{value}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600">
        {icon}
      </div>
    </div>
  </div>
);

const MapPin = (props: any) => {
  const { size = 24, ...rest } = props;
  return (
    <svg {...rest} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
};

const ROLE_LABELS: Record<string, string> = { admin: 'Administrador', collaborator: 'Colaborador', client: 'Cliente' };

export function SettingsView() {
  const { profile, refreshProfile, demoMode } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'stats' | 'about'>('profile');

  // --- Perfil ---
  const profileForm = useForm<ProfileFormData>({
    fullName: profile?.full_name || '',
    phone: profile?.phone || '',
    jobTitle: profile?.job_title || '',
    department: profile?.department || '',
    nif: profile?.nif || '',
    address: profile?.address || '',
    postalCode: profile?.postal_code || '',
    locality: profile?.locality || '',
    website: profile?.website || '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- Avatar ---
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatar_url || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Segurança ---
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  // --- Notificações ---
  const [notifSettings, setNotifSettings] = useState({
    newBudget: { enabled: true, channels: { email: true, push: true, sms: false } },
    statusChange: { enabled: true, channels: { email: true, push: true, sms: false } },
    approved: { enabled: true, channels: { email: true, push: false, sms: false } },
    expiring: { enabled: false, channels: { email: true, push: false, sms: false } },
    weeklyDigest: { enabled: false, channels: { email: true, push: false, sms: false } },
  });

  // --- Logs de atividade (mock) ---
  const [logs] = useState([
    { id: 1, action: 'Alteração de perfil', timestamp: '2026-06-29 14:32', type: 'profile' },
    { id: 2, action: 'Alteração de senha', timestamp: '2026-06-28 10:15', type: 'security' },
    { id: 3, action: 'Exportação de dados', timestamp: '2026-06-27 09:00', type: 'export' },
    { id: 4, action: 'Login desde novo dispositivo', timestamp: '2026-06-26 08:45', type: 'auth' },
  ]);

  // --- Estatísticas (mock) ---
  const monthlyBudgets = [
    { month: 'Jan', value: 12 },
    { month: 'Fev', value: 18 },
    { month: 'Mar', value: 15 },
    { month: 'Abr', value: 22 },
    { month: 'Mai', value: 19 },
    { month: 'Jun', value: 25 },
  ];
  const maxBudget = Math.max(...monthlyBudgets.map((d) => d.value));

  // --- Exportação ---
  const [exporting, setExporting] = useState(false);
  const [exportType, setExportType] = useState<'json' | 'csv'>('json');

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const saveProfile = useCallback(async () => {
    if (demoMode) { setProfileMsg({ type: 'error', text: 'O modo demonstração não permite editar dados reais do perfil.' }); return; }
    if (!profile) {
      setProfileMsg({ type: 'error', text: 'Perfil não carregado.' });
      return;
    }
    const rules = {
      fullName: (v: string) => (!v.trim() ? 'Nome é obrigatório' : undefined),
      nif: (v: string) => (v && !/^\d{9}$/.test(v) ? 'NIF deve ter 9 dígitos' : undefined),
    };
    if (!profileForm.validate(rules)) return;

    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const updateData: any = {
        full_name: profileForm.values.fullName.trim(),
        phone: profileForm.values.phone.trim(),
        job_title: profileForm.values.jobTitle.trim(),
        department: profileForm.values.department.trim(),
        nif: profileForm.values.nif.trim(),
        address: profileForm.values.address.trim(),
        postal_code: profileForm.values.postalCode.trim(),
        locality: profileForm.values.locality.trim(),
        website: profileForm.values.website.trim(),
      };
      const { error } = await supabase.from('profiles').update(updateData).eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      setProfileMsg({ type: 'success', text: 'Perfil atualizado com sucesso.' });
    } catch {
      setProfileMsg({ type: 'error', text: 'Erro ao atualizar perfil.' });
    }
    setProfileSaving(false);
  }, [profile, profileForm, refreshProfile, demoMode]);

  const changePassword = useCallback(async () => {
    if (demoMode) { setPwMsg({ type: 'error', text: 'A palavra-passe só pode ser alterada numa conta real do Supabase.' }); return; }
    if (newPw !== confirmPw) {
      setPwMsg({ type: 'error', text: 'As palavras-passe não coincidem.' });
      return;
    }
    if (newPw.length < 8) {
      setPwMsg({ type: 'error', text: 'A senha deve ter pelo menos 8 caracteres.' });
      return;
    }
    setPwSaving(true);
    setPwMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setNewPw('');
      setConfirmPw('');
      setPwMsg({ type: 'success', text: 'Senha alterada com sucesso.' });
    } catch {
      setPwMsg({ type: 'error', text: 'Erro ao alterar senha.' });
    }
    setPwSaving(false);
  }, [newPw, confirmPw, demoMode]);

  const toggleNotif = (key: keyof typeof notifSettings, channel?: 'email' | 'push' | 'sms') => {
    if (channel) {
      setNotifSettings((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          channels: { ...prev[key].channels, [channel]: !prev[key].channels[channel] },
        },
      }));
    } else {
      setNotifSettings((prev) => ({
        ...prev,
        [key]: { ...prev[key], enabled: !prev[key].enabled },
      }));
    }
  };

  const exportData = useCallback(async () => {
    setExporting(true);
    await new Promise((r) => setTimeout(r, 1500));
    const data = {
      profile,
      settings: { notifications: notifSettings },
      stats: monthlyBudgets,
    };
    let content: string;
    let filename: string;
    if (exportType === 'json') {
      content = JSON.stringify(data, null, 2);
      filename = `settings_export_${new Date().toISOString().slice(0, 10)}.json`;
    } else {
      const rows = [['Month', 'Budgets'], ...monthlyBudgets.map((d) => [d.month, d.value])];
      content = rows.map((r) => r.join(',')).join('\n');
      filename = `budgets_export_${new Date().toISOString().slice(0, 10)}.csv`;
    }
    const blob = new Blob([content], { type: exportType === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExporting(false);
  }, [exportType, profile, notifSettings, monthlyBudgets]);

  const tabs = [
    { id: 'profile' as const, label: 'Perfil', icon: <User size={16} /> },
    { id: 'security' as const, label: 'Segurança', icon: <Lock size={16} /> },
    { id: 'notifications' as const, label: 'Notificações', icon: <Bell size={16} /> },
    { id: 'stats' as const, label: 'Estatísticas', icon: <BarChart3 size={16} /> },
    { id: 'about' as const, label: 'Sobre', icon: <Info size={16} /> },
  ];

  const initials = profile?.full_name?.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  const joinedDate = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('pt-PT', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

  if (!profile) {
    return (
      <div className="w-full min-h-screen bg-white flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-slate-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">A carregar perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Cabeçalho */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <SettingsIcon size={28} className="text-slate-700" />
              Definições
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">Gerencie a sua conta, preferências e segurança</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Calendar size={14} /> Membro desde {joinedDate}
            </span>
          </div>
        </div>

        {/* Abas horizontais */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-100 pb-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-slate-800 text-white shadow-md shadow-slate-200'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div className="space-y-6">
          {/* Perfil */}
          {activeTab === 'profile' && (
            <Card>
              <CardHeader icon={<User size={18} />} title="Perfil" subtitle="Edite as suas informações pessoais" />
              <div className="p-6 space-y-6">
                {/* Avatar */}
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center text-white text-3xl font-black shadow-md">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover rounded-2xl" />
                      ) : (
                        initials
                      )}
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-1 -right-1 p-1.5 bg-slate-800 text-white rounded-full shadow-md hover:bg-slate-700 transition-colors"
                      aria-label="Upload avatar"
                    >
                      <Upload size={14} />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                    {avatarPreview && (
                      <button
                        onClick={removeAvatar}
                        className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition-colors"
                        aria-label="Remover avatar"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{profile.full_name}</p>
                    <p className="text-xs text-slate-400">{profile.email}</p>
                    <Badge color={profile.role === 'admin' ? 'purple' : profile.role === 'client' ? 'green' : 'gray'}>
                      {ROLE_LABELS[profile.role || 'collaborator']}
                    </Badge>
                  </div>
                </div>

                {/* Campos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <InputField
                    label="Nome completo"
                    name="fullName"
                    value={profileForm.values.fullName}
                    onChange={profileForm.handleChange}
                    icon={<User size={14} />}
                    error={profileForm.errors.fullName}
                  />
                  <InputField
                    label="Email"
                    name="email"
                    value={profile.email || ''}
                    onChange={() => {}}
                    icon={<Mail size={14} />}
                    disabled
                  />
                  <InputField
                    label="Telefone"
                    name="phone"
                    value={profileForm.values.phone}
                    onChange={profileForm.handleChange}
                    icon={<Phone size={14} />}
                    placeholder="+351 900 000 000"
                  />
                  <InputField
                    label="NIF"
                    name="nif"
                    value={profileForm.values.nif}
                    onChange={profileForm.handleChange}
                    icon={<ShieldCheck size={14} />}
                    placeholder="123456789"
                    error={profileForm.errors.nif}
                  />
                  <InputField
                    label="Cargo"
                    name="jobTitle"
                    value={profileForm.values.jobTitle}
                    onChange={profileForm.handleChange}
                    icon={<Briefcase size={14} />}
                    placeholder="Engenheiro Elétrico"
                  />
                  <InputField
                    label="Departamento"
                    name="department"
                    value={profileForm.values.department}
                    onChange={profileForm.handleChange}
                    icon={<Building2 size={14} />}
                    placeholder="Projetos"
                  />
                  <InputField
                    label="Morada"
                    name="address"
                    value={profileForm.values.address}
                    onChange={profileForm.handleChange}
                    icon={<MapPin size={14} />}
                    placeholder="Rua das Flores, 123"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <InputField
                      label="Código Postal"
                      name="postalCode"
                      value={profileForm.values.postalCode}
                      onChange={profileForm.handleChange}
                      placeholder="1000-001"
                    />
                    <InputField
                      label="Localidade"
                      name="locality"
                      value={profileForm.values.locality}
                      onChange={profileForm.handleChange}
                      placeholder="Lisboa"
                    />
                  </div>
                  <InputField
                    label="Website"
                    name="website"
                    value={profileForm.values.website}
                    onChange={profileForm.handleChange}
                    icon={<Globe size={14} />}
                    placeholder="https://exemplo.com"
                  />
                </div>

                {profileMsg && (
                  <div
                    className={`flex items-center gap-2 text-sm px-4 py-3 rounded-xl ${
                      profileMsg.type === 'success'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : 'bg-red-50 text-red-700 border border-red-100'
                    }`}
                  >
                    {profileMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    {profileMsg.text}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    onClick={saveProfile}
                    disabled={profileSaving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-white text-sm font-bold rounded-xl hover:bg-slate-700 disabled:opacity-50 transition-all active:scale-95 shadow-sm"
                  >
                    <Save size={14} />
                    {profileSaving ? 'A guardar...' : 'Guardar alterações'}
                  </button>
                  <button
                    onClick={() => {
                      profileForm.setValues({
                        fullName: profile.full_name || '',
                        phone: profile.phone || '',
                        jobTitle: profile.job_title || '',
                        department: profile.department || '',
                        nif: profile.nif || '',
                        address: profile.address || '',
                        postalCode: profile.postal_code || '',
                        locality: profile.locality || '',
                        website: profile.website || '',
                      });
                      setAvatarPreview(profile.avatar_url || null);
                      setAvatarFile(null);
                      setProfileMsg(null);
                    }}
                    className="text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* Segurança */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <Card>
                <CardHeader icon={<Lock size={18} />} title="Alterar palavra-passe" subtitle="Mínimo 8 caracteres" />
                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Nova senha
                      </label>
                      <div className="relative">
                        <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type={showPw ? 'text' : 'password'}
                          value={newPw}
                          onChange={(e) => setNewPw(e.target.value)}
                          className="w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white text-slate-800"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Confirmar nova senha
                      </label>
                      <div className="relative">
                        <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type={showPw ? 'text' : 'password'}
                          value={confirmPw}
                          onChange={(e) => setConfirmPw(e.target.value)}
                          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                  {pwMsg && (
                    <div
                      className={`flex items-center gap-2 text-sm px-4 py-3 rounded-xl ${
                        pwMsg.type === 'success'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-red-50 text-red-700 border border-red-100'
                      }`}
                    >
                      {pwMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                      {pwMsg.text}
                    </div>
                  )}
                  <button
                    onClick={changePassword}
                    disabled={pwSaving || !newPw || !confirmPw}
                    className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 text-white text-sm font-bold rounded-xl hover:bg-amber-700 disabled:opacity-50 transition-all active:scale-95 shadow-sm"
                  >
                    <Shield size={14} />
                    {pwSaving ? 'A alterar...' : 'Alterar senha'}
                  </button>
                </div>
              </Card>

              {/* Verified TOTP MFA (no fictitious codes or switches) */}
              <Card><div className="p-6"><MFASettings demoMode={demoMode}/></div></Card>
            </div>
          )}

          {/* Notificações */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <Card>
                <CardHeader icon={<Bell size={18} />} title="Preferências de notificações" subtitle="Escolha os eventos e canais" />
                <div className="p-6 space-y-5">
                  {Object.entries(notifSettings).map(([key, value]) => {
                    const labelMap: Record<string, string> = {
                      newBudget: 'Novo orçamento criado',
                      statusChange: 'Estado alterado',
                      approved: 'Orçamento aprovado',
                      expiring: 'Validade a expirar',
                      weeklyDigest: 'Resumo semanal',
                    };
                    const subMap: Record<string, string> = {
                      newBudget: 'Quando um novo orçamento for criado',
                      statusChange: 'Quando o estado for modificado',
                      approved: 'Notificação imediata de aprovação',
                      expiring: 'Aviso 3 dias antes de expirar',
                      weeklyDigest: 'Resumo das atividades da semana',
                    };
                    return (
                      <div key={key} className="border-b border-slate-100 last:border-0 pb-4 last:pb-0">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-sm font-bold text-slate-800">{labelMap[key] || key}</p>
                            <p className="text-xs text-slate-400">{subMap[key] || ''}</p>
                          </div>
                          <ToggleSwitch
                            enabled={value.enabled}
                            onChange={() => toggleNotif(key as keyof typeof notifSettings)}
                          />
                        </div>
                        {value.enabled && (
                          <div className="flex flex-wrap gap-4 mt-2 pl-1">
                            {['email', 'push', 'sms'].map((channel) => (
                              <label key={channel} className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                <input
                                  type="checkbox"
                                  checked={value.channels[channel as keyof typeof value.channels]}
                                  onChange={() => toggleNotif(key as keyof typeof notifSettings, channel as 'email' | 'push' | 'sms')}
                                  className="rounded border-slate-300 text-slate-600 focus:ring-slate-500"
                                />
                                {channel === 'email' && <Mail size={12} />}
                                {channel === 'push' && <Smartphone size={12} />}
                                {channel === 'sms' && <MessageSquare size={12} />}
                                {channel.charAt(0).toUpperCase() + channel.slice(1)}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}

          {/* Estatísticas */}
          {activeTab === 'stats' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={<Package size={18} />} label="Orçamentos totais" value="147" sub="32 ativos" />
                <StatCard icon={<Users size={18} />} label="Clientes" value="89" />
                <StatCard icon={<Layers size={18} />} label="Fornecedores" value="41" />
                <StatCard icon={<Activity size={18} />} label="Tempo de atividade" value="99.97%" sub="Últimos 30 dias" />
              </div>

              <Card>
                <CardHeader icon={<BarChart3 size={18} />} title="Orçamentos por mês" subtitle="Últimos 6 meses" />
                <div className="p-6">
                  <div className="flex items-end justify-between h-40 gap-2">
                    {monthlyBudgets.map((d) => (
                      <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full bg-slate-800 rounded-t transition-all duration-500"
                          style={{ height: `${(d.value / maxBudget) * 100}%`, minHeight: '4px' }}
                        />
                        <span className="text-xs font-medium text-slate-400">{d.month}</span>
                        <span className="text-xs font-bold text-slate-700">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Exportação */}
              <Card>
                <CardHeader icon={<Download size={18} />} title="Exportar dados" subtitle="Exporte as suas definições e estatísticas" />
                <div className="p-6 flex flex-wrap items-center gap-4">
                  <select
                    value={exportType}
                    onChange={(e) => setExportType(e.target.value as 'json' | 'csv')}
                    className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    <option value="json">JSON</option>
                    <option value="csv">CSV</option>
                  </select>
                  <button
                    onClick={exportData}
                    disabled={exporting}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-95 shadow-sm"
                  >
                    {exporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                    {exporting ? 'A exportar...' : `Exportar ${exportType.toUpperCase()}`}
                  </button>
                </div>
              </Card>
            </div>
          )}

          {/* Sobre */}
          {activeTab === 'about' && (
            <Card>
              <CardHeader icon={<Globe size={18} />} title="QuadroElétrico" subtitle="Plataforma de Gestão de Orçamentos" />
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Versão', value: 'v4.0.0' },
                    { label: 'Ano', value: '2026' },
                    { label: 'Setores', value: '10+' },
                    { label: 'Componentes', value: '200+' },
                  ].map((item) => (
                    <div key={item.label} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.label}</p>
                      <p className="font-bold text-slate-800 mt-0.5">{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    <strong>QuadroElétrico</strong> é uma plataforma profissional de gestão de orçamentos para projetos de engenharia elétrica, automação, HVAC, telecomunicações e outros setores industriais. Desenvolvida para equipas técnicas e comerciais que necessitam de agilidade e precisão.
                  </p>
                </div>
                <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-400">
                  <span className="flex items-center gap-1"><Check size={12} className="text-emerald-500" /> Segurança SSL</span>
                  <span className="flex items-center gap-1"><Check size={12} className="text-emerald-500" /> Backup diário</span>
                  <span className="flex items-center gap-1"><Check size={12} className="text-emerald-500" /> Suporte 24/7</span>
                  <span className="flex items-center gap-1"><Check size={12} className="text-emerald-500" /> API aberta</span>
                  <span className="flex items-center gap-1"><Check size={12} className="text-emerald-500" /> GDPR compliant</span>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}