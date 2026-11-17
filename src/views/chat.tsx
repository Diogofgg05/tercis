import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard, FileText, BookOpen, Building2, Users,
  BarChart3, Settings, LogOut, Zap, ChevronRight,
  TrendingUp, Bell, HelpCircle, Menu, ChevronLeft,
  Search, User, ChevronDown, X, MessageSquare, PlusCircle,
  Star, Send, Clock, CheckCheck, AlertCircle,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import type { UserRole } from '../types';

export type View = 'dashboard' | 'budgets' | 'editor' | 'catalog' | 'companies' | 'team' | 'reports' | 'settings' | 'chat';

interface Props {
  current: View;
  onChange: (v: View) => void;
  budgetCount?: number;
  messageCount?: number;
}

interface NavItem {
  id: View;
  label: string;
  icon: React.ReactNode;
  roles: UserRole[];
  badge?: number;
}

const ROLE_LABELS: Record<UserRole, string> = {
  app_admin: 'Admin da App',
  company_admin: 'Admin da Empresa',
  admin: 'Administrador',
  collaborator: 'Colaborador',
  client: 'Cliente',
};

const ROLE_COLORS: Record<UserRole, string> = {
  app_admin: 'bg-fuchsia-500/20 text-fuchsia-300',
  company_admin: 'bg-blue-500/20 text-blue-300',
  admin: 'bg-blue-500/20 text-blue-300',
  collaborator: 'bg-emerald-500/20 text-emerald-300',
  client: 'bg-amber-500/20 text-amber-300',
};

const DUMMY_NOTIFICATIONS = [
  { id: 1, text: 'Orçamento #1024 aprovado', time: '5 min atrás', read: false, icon: CheckCheck },
  { id: 2, text: 'Novo comentário em #1023', time: '1 hora atrás', read: false, icon: MessageSquare },
  { id: 3, text: 'Reunião agendada para amanhã', time: '3 horas atrás', read: true, icon: Clock },
  { id: 4, text: 'Limite de orçamentos atualizado', time: '1 dia atrás', read: true, icon: AlertCircle },
];

const DUMMY_CHAT_MESSAGES = [
  { id: 1, sender: 'Sistema', text: 'Bem-vindo ao suporte rápido! Como posso ajudar?', time: '10:30', isUser: false },
  { id: 2, sender: 'Você', text: 'Preciso de ajuda com um orçamento.', time: '10:31', isUser: true },
  { id: 3, sender: 'Sistema', text: 'Claro! Qual é o número do orçamento?', time: '10:32', isUser: false },
];

export function Sidebar({ current, onChange, budgetCount = 0, messageCount = 3 }: Props) {
  const { profile, signOut } = useAuth();
  const role = profile?.role ?? 'collaborator';

  // Sidebar states
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Favoritos: true,
    Principal: true,
    Gestão: true,
    Analytics: true,
    Sistema: true,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Interactive features
  const [favorites, setFavorites] = useState<View[]>(() => {
    const saved = localStorage.getItem('sidebarFavorites');
    return saved ? JSON.parse(saved) : ['dashboard', 'budgets'];
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState(DUMMY_NOTIFICATIONS);
  
  // Chat panel (integrated in sidebar)
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState(DUMMY_CHAT_MESSAGES);
  const [newMessage, setNewMessage] = useState('');
  

  // Refs for click outside
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Persist states
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    localStorage.setItem('sidebarFavorites', JSON.stringify(favorites));
  }, [favorites]);

  // Close popups on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus chat input when opening
  useEffect(() => {
    if (chatOpen && chatInputRef.current) {
      chatInputRef.current.focus();
    }
  }, [chatOpen]);

  // Navigation items
  const NAV: NavItem[] = [
    { id: 'dashboard', label: 'Painel', icon: <LayoutDashboard size={18} />, roles: ['admin', 'collaborator', 'client'] },
    { id: 'budgets', label: 'Orçamentos', icon: <FileText size={18} />, roles: ['admin', 'collaborator', 'client'], badge: budgetCount > 0 ? budgetCount : undefined },
    { id: 'companies', label: 'Empresas', icon: <Building2 size={18} />, roles: ['admin', 'collaborator'] },
    { id: 'catalog', label: 'Catálogo', icon: <BookOpen size={18} />, roles: ['admin', 'collaborator'] },
    { id: 'reports', label: 'Relatórios', icon: <BarChart3 size={18} />, roles: ['admin'] },
    { id: 'team', label: 'Equipa', icon: <Users size={18} />, roles: ['admin'] },
    { id: 'settings', label: 'Definições', icon: <Settings size={18} />, roles: ['admin', 'collaborator'] },
    { id: 'chat', label: 'Mensagens', icon: <MessageSquare size={18} />, roles: ['admin', 'collaborator', 'client'], badge: messageCount },
  ];

  const visible = NAV.filter((n) => n.roles.includes(role));
  const initials = profile?.full_name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?';

  const groups = [
    { label: 'Favoritos', items: visible.filter(n => favorites.includes(n.id)) },
    { label: 'Principal', items: visible.filter(n => ['dashboard', 'budgets'].includes(n.id) && !favorites.includes(n.id)) },
    { label: 'Gestão', items: visible.filter(n => ['companies', 'catalog'].includes(n.id) && !favorites.includes(n.id)) },
    { label: 'Analytics', items: visible.filter(n => ['reports', 'team'].includes(n.id) && !favorites.includes(n.id)) },
    { label: 'Sistema', items: visible.filter(n => ['settings', 'chat'].includes(n.id) && !favorites.includes(n.id)) },
  ].filter(g => g.items.length > 0);

  const filteredGroups = searchQuery.trim()
    ? groups.map(group => ({
        ...group,
        items: group.items.filter(item =>
          item.label.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter(group => group.items.length > 0)
    : groups;

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);
  const isActive = (id: View) => current === id || (current === 'editor' && id === 'budgets');

  const toggleFavorite = (id: View, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // Chat functions
  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const msg = {
      id: Date.now(),
      sender: 'Você',
      text: newMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isUser: true,
    };
    setChatMessages(prev => [...prev, msg]);
    setNewMessage('');
    // Simulate reply
    setTimeout(() => {
      const reply = {
        id: Date.now() + 1,
        sender: 'Sistema',
        text: 'Obrigado pela sua mensagem. Um especialista entrará em contato em breve.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isUser: false,
      };
      setChatMessages(prev => [...prev, reply]);
    }, 1000);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <>
      {/* Mobile overlay */}
      {!isCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={toggleCollapse}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 z-50 h-screen
        bg-slate-950/95 backdrop-blur-xl border-r border-white/5
        flex flex-col transition-all duration-300 ease-in-out
        shadow-2xl shadow-black/30
        ${isCollapsed ? 'w-20' : 'w-64'}
        ${isCollapsed ? '-translate-x-full lg:translate-x-0' : 'translate-x-0'}
      `}>
        {/* Header */}
        <div className="px-4 py-5 border-b border-white/5 flex items-center justify-between">
          {!isCollapsed ? (
            <>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/40">
                  <Zap size={16} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-white text-sm leading-tight">QuadroElétrico</p>
                  <p className="text-slate-600 text-[10px] font-medium mt-0.5">Gestão de Orçamentos</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowNewBudgetModal(true)}
                  className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-md"
                  title="Novo Orçamento"
                >
                  <PlusCircle size={16} />
                </button>
                <button
                  onClick={toggleCollapse}
                  className="hidden lg:flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 border border-white/10 hover:bg-slate-700 transition-colors"
                >
                  <ChevronLeft size={14} className="text-slate-400" />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="w-full flex justify-center">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/40">
                  <Zap size={16} className="text-white" />
                </div>
              </div>
              <button
                onClick={toggleCollapse}
                className="hidden lg:flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 border border-white/10 hover:bg-slate-700 transition-colors absolute -right-3 top-1/2 -translate-y-1/2"
              >
                <ChevronRight size={14} className="text-slate-400" />
              </button>
            </>
          )}
        </div>

        {/* Mobile close button */}
        <button
          onClick={toggleCollapse}
          className="lg:hidden absolute top-4 right-4 p-1 rounded-lg hover:bg-white/10"
        >
          <ChevronLeft size={18} className="text-slate-400" />
        </button>

        {/* User section */}
        <div className="px-3 py-4 border-b border-white/5" ref={userMenuRef}>
          <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
            <button
              onClick={() => !isCollapsed && setUserMenuOpen(!userMenuOpen)}
              className={`relative flex items-center gap-3 w-full ${isCollapsed ? 'justify-center' : 'hover:bg-white/5 rounded-lg p-1 -m-1'}`}
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white text-xs font-bold shadow-md flex-shrink-0">
                {initials}
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-white text-xs font-semibold truncate">{profile?.full_name ?? 'Utilizador'}</p>
                  <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-md mt-0.5 ${ROLE_COLORS[role]}`}>
                    {ROLE_LABELS[role]}
                  </span>
                </div>
              )}
              {!isCollapsed && (
                <ChevronDown size={14} className={`text-slate-500 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              )}
            </button>
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-1 rounded-lg hover:bg-white/5 transition-colors"
                title="Notificações"
              >
                <Bell size={isCollapsed ? 16 : 13} className="text-slate-500" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white border border-slate-950">
                    {unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && !isCollapsed && (
                <div className="absolute left-0 mt-2 w-72 bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
                    <p className="text-white text-xs font-semibold">Notificações</p>
                    <button onClick={markAllRead} className="text-blue-400 text-[10px] hover:underline">Marcar todas lidas</button>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-slate-600 text-xs p-4 text-center">Nenhuma notificação</p>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className={`px-4 py-3 flex gap-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors ${!n.read ? 'bg-blue-900/10' : ''}`}>
                          <n.icon size={14} className={`mt-0.5 ${n.read ? 'text-slate-600' : 'text-blue-400'}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs ${n.read ? 'text-slate-400' : 'text-white'}`}>{n.text}</p>
                            <p className="text-[10px] text-slate-600 mt-1">{n.time}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          {!isCollapsed && userMenuOpen && (
            <div className="mt-2 bg-slate-900 border border-white/10 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <button onClick={() => { onChange('settings'); setUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-xs text-slate-400 hover:bg-white/5 hover:text-white transition-colors">
                <User size={14} /> Perfil
              </button>
              <button onClick={() => { onChange('settings'); setUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-xs text-slate-400 hover:bg-white/5 hover:text-white transition-colors">
                <Settings size={14} /> Definições
              </button>
              <div className="border-t border-white/5" />
              <button onClick={() => { setShowLogoutConfirm(true); setUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-xs text-red-400 hover:bg-red-900/20 transition-colors">
                <LogOut size={14} /> Terminar sessão
              </button>
            </div>
          )}
        </div>

        {/* Search (expanded only) */}
        {!isCollapsed && !chatOpen && (
          <div className="px-3 py-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Pesquisar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-white/5 rounded-lg pl-8 pr-8 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-white/10">
                  <X size={12} className="text-slate-500" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Navigation (hidden when chat is open) */}
        {!chatOpen && (
          <nav className="flex-1 px-2 py-2 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            {filteredGroups.length === 0 && searchQuery && !isCollapsed && (
              <p className="text-slate-600 text-xs text-center py-4">Nenhum resultado encontrado</p>
            )}
            {filteredGroups.map((group) => {
              const isOpen = openGroups[group.label] ?? true;
              return (
                <div key={group.label} className="mb-2">
                  {!isCollapsed ? (
                    <button
                      onClick={() => toggleGroup(group.label)}
                      className="w-full flex items-center justify-between px-2 py-1 mb-1 rounded-lg hover:bg-white/5 transition-colors group"
                    >
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 group-hover:text-slate-400 transition-colors">
                        {group.label}
                      </p>
                      <ChevronRight size={12} className={`text-slate-600 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                    </button>
                  ) : (
                    <div className="border-t border-white/5 my-2" />
                  )}
                  <div className={`space-y-1 overflow-hidden transition-all duration-300 ease-in-out ${isCollapsed ? 'max-h-screen' : isOpen ? 'max-h-96' : 'max-h-0'}`}>
                    {group.items.map((item) => {
                      const active = isActive(item.id);
                      const isFavorite = favorites.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => onChange(item.id)}
                          title={isCollapsed ? item.label : undefined}
                          className={`
                            w-full flex items-center rounded-xl text-xs font-medium transition-all duration-200 group
                            ${active ? 'bg-blue-600/90 text-white shadow-lg shadow-blue-900/30 ring-1 ring-blue-500/50' : 'text-slate-400 hover:text-white hover:bg-white/5 hover:shadow-md'}
                            ${isCollapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2'}
                            relative
                          `}
                        >
                          {active && !isCollapsed && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-400 rounded-r-full" />
                          )}
                          <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
                            <span className={active ? 'text-white' : 'text-slate-500 group-hover:text-white transition-colors'}>
                              {item.icon}
                            </span>
                            {!isCollapsed && <span>{item.label}</span>}
                          </div>
                          {!isCollapsed && (
                            <div className="flex items-center gap-2">
                              {item.badge !== undefined && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-300'}`}>
                                  {item.badge > 99 ? '99+' : item.badge}
                                </span>
                              )}
                              <button
                                onClick={(e) => toggleFavorite(item.id, e)}
                                className={`p-0.5 rounded hover:bg-white/10 transition-colors ${isFavorite ? 'text-yellow-400' : 'text-slate-700 hover:text-yellow-500'}`}
                                title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                              >
                                <Star size={12} fill={isFavorite ? 'currentColor' : 'none'} />
                              </button>
                            </div>
                          )}
                          {isCollapsed && item.badge !== undefined && (
                            <span className="absolute top-1 right-1 flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        )}

        {/* Integrated Chat Panel */}
        {chatOpen && !isCollapsed && (
          <div className="flex-1 flex flex-col border-t border-white/5 animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-slate-900/50">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                  <MessageSquare size={12} className="text-white" />
                </div>
                <span className="text-white text-xs font-semibold">Suporte rápido</span>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="p-1 rounded hover:bg-white/10 transition-colors"
              >
                <X size={14} className="text-slate-400" />
              </button>
            </div>
            <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[calc(100vh-450px)] scrollbar-thin">
              {chatMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-2 rounded-xl text-xs ${
                    msg.isUser ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
                  }`}>
                    <p>{msg.text}</p>
                    <p className="text-[10px] mt-1 opacity-60 text-right">{msg.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={sendChatMessage} className="p-3 border-t border-white/5 flex gap-2">
              <input
                ref={chatInputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Escreva a sua mensagem..."
                className="flex-1 bg-slate-800 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50"
              />
              <button type="submit" className="p-2 bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors">
                <Send size={14} className="text-white" />
              </button>
            </form>
          </div>
        )}

        {/* Footer with chat toggle */}
        <div className="px-2 py-3 border-t border-white/5 space-y-1">
          <button
            className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl text-xs text-slate-600 hover:text-slate-400 hover:bg-white/5 transition-all ${isCollapsed ? 'justify-center' : ''}`}
            title="Ajuda & Suporte"
          >
            <HelpCircle size={16} />
            {!isCollapsed && 'Ajuda & Suporte'}
          </button>

          <button
            onClick={() => setChatOpen(!chatOpen)}
            className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl text-xs text-slate-600 hover:text-slate-400 hover:bg-white/5 transition-all ${isCollapsed ? 'justify-center' : ''}`}
            title="Chat rápido"
          >
            <MessageSquare size={16} />
            {!isCollapsed && 'Chat rápido'}
          </button>

          {showLogoutConfirm ? (
            <div className="mt-2 bg-red-950/50 border border-red-800/50 rounded-xl p-2 space-y-2 animate-in fade-in zoom-in-95 duration-200">
              {!isCollapsed && <p className="text-red-400 text-[10px] font-semibold text-center">Sair da conta?</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-semibold hover:bg-slate-700 transition-colors"
                >
                  {isCollapsed ? 'X' : 'Cancelar'}
                </button>
                <button
                  onClick={signOut}
                  className="flex-1 py-1.5 rounded-lg bg-red-700 text-white text-[10px] font-semibold hover:bg-red-600 transition-colors"
                >
                  {isCollapsed ? '✓' : 'Sair'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl text-xs text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-all ${isCollapsed ? 'justify-center' : ''}`}
              title="Terminar sessão"
            >
              <LogOut size={16} />
              {!isCollapsed && 'Terminar sessão'}
            </button>
          )}

          {!isCollapsed && (
            <p className="text-slate-800 text-[9px] mt-3 px-2 flex items-center gap-1">
              <TrendingUp size={9} />
              v4.0 · 2026
            </p>
          )}
        </div>
      </aside>

      {/* Mobile open button */}
      {isCollapsed && (
        <button
          onClick={toggleCollapse}
          className="lg:hidden fixed bottom-6 left-4 z-40 w-10 h-10 bg-slate-800 border border-white/10 rounded-xl flex items-center justify-center hover:bg-slate-700 shadow-lg transition-all hover:scale-105"
        >
          <Menu size={18} className="text-white" />
        </button>
      )}
    </>
  );
}