    // ─────────────────────────────────────────────────────────────────────────────
    // ChatViewComplete.tsx
    // Aplicação de chat profissional com suporte a chamadas de voz/vídeo
    // + controlo de câmara, microfone e partilha de ecrã (tudo no mesmo ficheiro)
    // ─────────────────────────────────────────────────────────────────────────────

    import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
    import { createPortal } from 'react-dom';
    import {
    Phone, Video, PhoneOff, Mic, MicOff, Camera, CameraOff, Monitor, MonitorOff,
    Send, Plus, Smile, Search, X, Menu, Info, Star, Paperclip, Settings,
    CheckCircle2, Circle, Clock3, AlertCircle, FileText, Download, RefreshCw
    } from 'lucide-react';

    // ─── Simulação de AuthContext (substituir pelo teu) ────────────────────────
    const useAuth = () => ({ user: { id: 'user1', name: 'Carlos Silva' } });

    // ─── Tipos ─────────────────────────────────────────────────────────────────
    export interface Client {
    id: string;
    name: string;
    company: string;
    role: string;
    email: string;
    phone: string;
    avatar?: string;
    online: boolean;
    unread: number;
    typing: boolean;
    lastMsg: string;
    time: string;
    pinned: boolean;
    }

    export interface Message {
    id: string;
    sender: 'user' | 'client';
    text: string;
    time: string;
    status: 'sent' | 'delivered' | 'read' | 'error' | 'pending';
    file?: { name: string; url: string; size: string };
    }

    export type CallType = 'voice' | 'video' | null;
    export type FilterType = 'all' | 'unread' | 'online' | 'pinned';
    export type ToastType = 'success' | 'error' | 'info';

    export interface CallState {
    status: 'idle' | 'ringing' | 'connected' | 'ended';
    type: CallType;
    remoteName: string;
    remoteAvatar?: string;
    startTime: Date | null;
    duration: number;
    isMuted: boolean;
    isVideoOff: boolean;
    isScreenSharing: boolean;
    isRecording: boolean;
    }

    export interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration: number;
    }

    // ─── Dados estáticos ───────────────────────────────────────────────────────
    const CLIENTS_DATA: Client[] = [
    { id: '1', name: 'Ana Martins', company: 'Construtora Nova Era', role: 'Diretora de Projetos', email: 'ana@novaera.pt', phone: '911234567', online: true, unread: 3, typing: false, lastMsg: 'Confirmado para amanhã às 10h', time: '10:45', pinned: true },
    { id: '2', name: 'Bruno Costa', company: 'EletroPlus', role: 'Engenheiro Eletrotécnico', email: 'bruno@eletroplus.pt', phone: '922345678', online: true, unread: 0, typing: true, lastMsg: 'Já recebeu o esquema?', time: '09:30', pinned: false },
    { id: '3', name: 'Carla Sousa', company: 'Águas do Tejo', role: 'Gestora de Contratos', email: 'carla@aguasdotejo.pt', phone: '933456789', online: false, unread: 1, typing: false, lastMsg: 'O relatório está pronto.', time: 'Ontem', pinned: false },
    { id: '4', name: 'Diogo Neves', company: 'TechPark', role: 'CTO', email: 'diogo@techpark.pt', phone: '944567890', online: true, unread: 2, typing: false, lastMsg: 'Podemos agendar uma demo?', time: '12:15', pinned: true },
    { id: '5', name: 'Eva Rodrigues', company: 'Hospital São Lucas', role: 'Administradora', email: 'eva@saolucas.pt', phone: '955678901', online: false, unread: 0, typing: false, lastMsg: 'Ok, obrigada.', time: 'Seg', pinned: false },
    { id: '6', name: 'Filipe Santos', company: 'EduPrime', role: 'Coordenador', email: 'filipe@eduprime.pt', phone: '966789012', online: true, unread: 5, typing: false, lastMsg: 'Preciso dos manuais revistos.', time: '11:02', pinned: false },
    { id: '7', name: 'Gabriela Lima', company: 'TurisBeira', role: 'CEO', email: 'gabriela@turisbeira.pt', phone: '977890123', online: false, unread: 0, typing: false, lastMsg: 'Obrigado pela parceria.', time: '28/06', pinned: false },
    { id: '8', name: 'Hugo Pereira', company: 'LogiTrans', role: 'Logistics Manager', email: 'hugo@logitrans.pt', phone: '988901234', online: true, unread: 1, typing: false, lastMsg: 'A encomenda já foi expedida.', time: '16:40', pinned: false },
    { id: '9', name: 'Inês Ferreira', company: 'Construtora Nova Era', role: 'Arquiteta', email: 'ines@novaera.pt', phone: '999012345', online: true, unread: 0, typing: false, lastMsg: 'As plantas estão aprovadas.', time: '14:20', pinned: false },
    { id: '10', name: 'João Almeida', company: 'EletroPlus', role: 'Técnico', email: 'joao@eletroplus.pt', phone: '910123456', online: false, unread: 4, typing: true, lastMsg: 'O transformador chegou?', time: '08:15', pinned: false },
    ];

    const MESSAGES_DATA: Record<string, Message[]> = {
    '1': [
        { id: 'm1', sender: 'client', text: 'Bom dia! Já tem a lista de materiais?', time: '10:00', status: 'read' },
        { id: 'm2', sender: 'user', text: 'Sim, enviei agora por email.', time: '10:05', status: 'read' },
        { id: 'm3', sender: 'client', text: 'Perfeito. Confirmado para amanhã às 10h.', time: '10:45', status: 'read' },
    ],
    '2': [
        { id: 'm4', sender: 'client', text: 'Já recebeu o esquema?', time: '09:30', status: 'delivered' },
    ],
    '3': [
        { id: 'm5', sender: 'client', text: 'O relatório está pronto.', time: 'Ontem', status: 'read' },
        { id: 'm6', sender: 'user', text: 'Obrigado, vou analisar.', time: 'Ontem', status: 'read' },
    ],
    '4': [
        { id: 'm7', sender: 'client', text: 'Podemos agendar uma demo?', time: '12:15', status: 'delivered' },
        { id: 'm8', sender: 'user', text: 'Claro, que tal sexta-feira às 15h?', time: '12:18', status: 'delivered' },
    ],
    '5': [
        { id: 'm9', sender: 'client', text: 'A reunião foi produtiva.', time: 'Seg', status: 'read' },
        { id: 'm10', sender: 'user', text: 'Concordo. Já enviei a ata.', time: 'Seg', status: 'read' },
    ],
    '6': [
        { id: 'm11', sender: 'client', text: 'Preciso dos manuais revistos.', time: '11:02', status: 'delivered' },
        { id: 'm12', sender: 'user', text: 'Estou a trabalhar nisso.', time: '11:10', status: 'delivered' },
        { id: 'm13', sender: 'client', text: 'Urgente!', time: '11:20', status: 'delivered' },
    ],
    '7': [
        { id: 'm14', sender: 'client', text: 'Obrigado pela parceria.', time: '28/06', status: 'read' },
    ],
    '8': [
        { id: 'm15', sender: 'client', text: 'A encomenda já foi expedida.', time: '16:40', status: 'delivered' },
        { id: 'm16', sender: 'user', text: 'Ótimo, tracking?', time: '16:42', status: 'delivered' },
        { id: 'm17', sender: 'client', text: 'CT123456789PT', time: '16:45', status: 'delivered' },
    ],
    '9': [
        { id: 'm18', sender: 'client', text: 'As plantas estão aprovadas.', time: '14:20', status: 'read' },
        { id: 'm19', sender: 'user', text: 'Finalmente! Vamos avançar.', time: '14:25', status: 'read' },
    ],
    '10': [
        { id: 'm20', sender: 'client', text: 'O transformador chegou?', time: '08:15', status: 'delivered' },
    ],
    };

    // ─── Utilitários ────────────────────────────────────────────────────────────
    const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const escapeHtml = (text: string) => text.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const getInitials = (name: string): string =>
    name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

    const avatarColor = (name: string): string => {
    const colors = [
        'bg-slate-800', 'bg-blue-800', 'bg-slate-700', 'bg-indigo-800',
        'bg-slate-900', 'bg-blue-900', 'bg-gray-800', 'bg-slate-600',
        'bg-cyan-800', 'bg-teal-800',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
    };

    // ─── Hook de Toasts (inline) ───────────────────────────────────────────────
    const useToasts = () => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { id, message, type, duration }]);
        setTimeout(() => removeToast(id), duration);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return { toasts, addToast, removeToast };
    };

    // ─── Hook useMediaStream (inline) ─────────────────────────────────────────
    const useMediaStream = () => {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [videoEnabled, setVideoEnabled] = useState(true);
    const [screenSharing, setScreenSharing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const originalStreamRef = useRef<MediaStream | null>(null);

    const startStream = useCallback(async (constraints: MediaStreamConstraints = { audio: true, video: true }) => {
        try {
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
        }
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        originalStreamRef.current = newStream;
        setStream(newStream);
        setAudioEnabled(true);
        setVideoEnabled(constraints.video !== false);
        setScreenSharing(false);
        setError(null);
        return newStream;
        } catch (err: any) {
        setError(err?.message || 'Erro ao aceder aos dispositivos');
        throw err;
        }
    }, [stream]);

    const stopStream = useCallback(() => {
        if (stream) {
        stream.getTracks().forEach(t => t.stop());
        setStream(null);
        }
        if (originalStreamRef.current) {
        originalStreamRef.current.getTracks().forEach(t => t.stop());
        originalStreamRef.current = null;
        }
        setAudioEnabled(false);
        setVideoEnabled(false);
        setScreenSharing(false);
    }, [stream]);

    const toggleAudio = useCallback((enable: boolean) => {
        if (stream) {
        stream.getAudioTracks().forEach(t => t.enabled = enable);
        setAudioEnabled(enable);
        }
    }, [stream]);

    const toggleVideo = useCallback((enable: boolean) => {
        if (stream) {
        stream.getVideoTracks().forEach(t => {
            if (t.kind === 'video' && !t.label.includes('screen')) t.enabled = enable;
        });
        setVideoEnabled(enable);
        }
    }, [stream]);

    const startScreenShare = useCallback(async () => {
        try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        if (!stream) {
            setStream(screenStream);
            setScreenSharing(true);
            return;
        }
        const oldVideo = stream.getVideoTracks().find(t => !t.label.includes('screen'));
        if (oldVideo) {
            stream.removeTrack(oldVideo);
            oldVideo.stop();
        }
        const newVideo = screenStream.getVideoTracks()[0];
        stream.addTrack(newVideo);
        const screenAudio = screenStream.getAudioTracks()[0];
        if (screenAudio) {
            const oldAudio = stream.getAudioTracks()[0];
            if (oldAudio) {
            stream.removeTrack(oldAudio);
            oldAudio.stop();
            }
            stream.addTrack(screenAudio);
        }
        newVideo.addEventListener('ended', () => stopScreenShare());
        setScreenSharing(true);
        } catch (err: any) {
        setError(err?.message || 'Erro ao partilhar ecrã');
        }
    }, [stream]);

    const stopScreenShare = useCallback(async () => {
        if (!stream) return;
        stream.getVideoTracks().forEach(t => {
        if (t.label.includes('screen')) {
            t.stop();
            stream.removeTrack(t);
        }
        });
        if (originalStreamRef.current) {
        const camTrack = originalStreamRef.current.getVideoTracks()[0];
        if (camTrack && camTrack.readyState === 'live') {
            stream.addTrack(camTrack);
            setVideoEnabled(true);
        }
        }
        setScreenSharing(false);
    }, [stream]);

    return {
        stream, audioEnabled, videoEnabled, screenSharing, error,
        startStream, stopStream, toggleAudio, toggleVideo, startScreenShare, stopScreenShare
    };
    };

    // ─── Página de Chamada (inline) ────────────────────────────────────────────
    const CallPage: React.FC<{
    callState: CallState;
    stream: MediaStream | null;
    videoEnabled: boolean;
    audioEnabled: boolean;
    screenSharing: boolean;
    onToggleMute: () => void;
    onToggleVideo: () => void;
    onToggleScreenShare: () => void;
    onEnd: () => void;
    }> = ({ callState, stream, videoEnabled, audioEnabled, screenSharing, onToggleMute, onToggleVideo, onToggleScreenShare, onEnd }) => {
    const localVideoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (localVideoRef.current && stream) {
        localVideoRef.current.srcObject = stream;
        }
    }, [stream]);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black animate-fade-in">
        {/* Fundo */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-black flex items-center justify-center">
            <div className="text-center">
            <div className={`w-20 h-20 mx-auto mb-4 rounded-full ${avatarColor(callState.remoteName)} flex items-center justify-center ring-4 ring-slate-700`}>
                <span className="text-2xl font-black text-white">{getInitials(callState.remoteName)}</span>
            </div>
            <h1 className="text-3xl font-black text-white mb-2 tracking-tight">{callState.remoteName}</h1>
            <p className="text-slate-400 text-sm">
                {callState.status === 'ringing' && 'A chamar...'}
                {callState.status === 'connected' && (
                <span className="flex items-center justify-center gap-2 text-emerald-400">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    Ligado: {callState.duration > 0 ? formatDuration(callState.duration) : '00:00'}
                </span>
                )}
                {screenSharing && <span className="block text-xs text-amber-400 mt-1">A partilhar ecrã</span>}
            </p>
            </div>
        </div>

        {/* Vídeo local */}
        <div className="absolute bottom-6 right-6 w-32 h-40 bg-slate-800 rounded-xl overflow-hidden border-2 border-slate-600 shadow-xl animate-fade-in">
            <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-cover ${videoEnabled && !screenSharing ? '' : 'hidden'}`}
            />
            {(!videoEnabled || screenSharing) && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-700 text-white text-xs font-medium">
                {screenSharing ? 'Ecrã partilhado' : 'Câmara desligada'}
            </div>
            )}
        </div>

        {/* Controlos */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4">
            <button
            onClick={onToggleMute}
            className={`p-4 rounded-full transition-colors ${!audioEnabled ? 'bg-red-600' : 'bg-slate-700 hover:bg-slate-600'} text-white`}
            title={audioEnabled ? 'Desligar microfone' : 'Ligar microfone'}
            >
            {!audioEnabled ? <MicOff size={24} /> : <Mic size={24} />}
            </button>
            <button
            onClick={onToggleVideo}
            className={`p-4 rounded-full transition-colors ${!videoEnabled || screenSharing ? 'bg-red-600' : 'bg-slate-700 hover:bg-slate-600'} text-white`}
            title={videoEnabled ? 'Desligar câmara' : 'Ligar câmara'}
            >
            {!videoEnabled || screenSharing ? <CameraOff size={24} /> : <Camera size={24} />}
            </button>
            <button
            onClick={onToggleScreenShare}
            className={`p-4 rounded-full transition-colors ${screenSharing ? 'bg-blue-800' : 'bg-slate-700 hover:bg-slate-600'} text-white`}
            title={screenSharing ? 'Parar partilha' : 'Partilhar ecrã'}
            >
            {screenSharing ? <MonitorOff size={24} /> : <Monitor size={24} />}
            </button>
            <button
            onClick={onEnd}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold transition-colors"
            >
            <PhoneOff size={24} />
            Desligar
            </button>
        </div>
        </div>,
        document.body
    );
    };

    // ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────
    export const ChatView: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const { user } = useAuth();
    const { toasts, addToast, removeToast } = useToasts();

    // Estado do chat
    const [clients] = useState<Client[]>(CLIENTS_DATA);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageText, setMessageText] = useState('');
    const [searchText, setSearchText] = useState('');
    const [filter, setFilter] = useState<FilterType>('all');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [showClientInfo, setShowClientInfo] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // Estado da chamada
    const [callState, setCallState] = useState<CallState>({
        status: 'idle', type: null, remoteName: '', startTime: null,
        duration: 0, isMuted: false, isVideoOff: false, isScreenSharing: false, isRecording: false
    });
    const [showCallPage, setShowCallPage] = useState(false);
    const callTimerRef = useRef<NodeJS.Timeout | null>(null);

    const {
        stream, audioEnabled, videoEnabled, screenSharing, error: mediaError,
        startStream, stopStream, toggleAudio, toggleVideo, startScreenShare, stopScreenShare
    } = useMediaStream();

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const debouncedSearch = useDebounce(searchText, 300);

    // Filtro de clientes
    const filteredClients = useMemo(() =>
        clients.filter(c => {
        const matchSearch = c.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                            c.company.toLowerCase().includes(debouncedSearch.toLowerCase());
        const matchFilter =
            filter === 'all' ||
            (filter === 'unread' && c.unread > 0) ||
            (filter === 'online' && c.online) ||
            (filter === 'pinned' && c.pinned);
        return matchSearch && matchFilter;
        }), [clients, debouncedSearch, filter]);

    // Selecionar cliente
    const handleSelectClient = useCallback((client: Client) => {
        setSelectedClient(client);
        const clientMsgs = MESSAGES_DATA[client.id] || [];
        setMessages(clientMsgs);
        if (window.innerWidth < 768) setIsSidebarCollapsed(true);
    }, []);

    // Enviar mensagem
    const handleSendMessage = useCallback(() => {
        if (!messageText.trim() || !selectedClient) return;
        const newMsg: Message = {
        id: `m${Date.now()}`,
        sender: 'user',
        text: escapeHtml(messageText),
        time: getCurrentTime(),
        status: 'delivered',
        };
        setMessages(prev => [...prev, newMsg]);
        setMessageText('');
        addToast('Mensagem enviada', 'success', 2000);

        // Simulação de resposta do cliente
        setTimeout(() => {
        const replies = [
            'Obrigado pela sua mensagem! 👍',
            'Vou verificar e já respondo.',
            'Perfeito! Podemos avançar com isso.',
            'Entendido. Vou atualizar o processo.',
            'Obrigado! Falo consigo em breve.',
        ];
        const reply: Message = {
            id: `m${Date.now()}_r`,
            sender: 'client',
            text: replies[Math.floor(Math.random() * replies.length)],
            time: getCurrentTime(),
            status: 'read',
        };
        setMessages(prev => [...prev, reply]);
        }, 1200);
    }, [messageText, selectedClient, addToast]);

    // Chamadas
    const handleStartCall = useCallback(async (type: CallType) => {
        if (!selectedClient) return;
        try {
        const constraints = type === 'video' ? { video: true, audio: true } : { audio: true };
        await startStream(constraints);
        setCallState({
            status: 'ringing', type, remoteName: selectedClient.name,
            startTime: new Date(), duration: 0, isMuted: false,
            isVideoOff: false, isScreenSharing: false, isRecording: false
        });
        setShowCallPage(true);
        addToast(`A iniciar chamada de ${type === 'voice' ? 'voz' : 'vídeo'}...`, 'info');

        // Simular que a chamada é atendida após 3s
        setTimeout(() => {
            setCallState(prev => ({ ...prev, status: 'connected' }));
            // Iniciar timer
            callTimerRef.current = setInterval(() => {
            setCallState(prev => ({ ...prev, duration: prev.duration + 1 }));
            }, 1000);
        }, 3000);
        } catch (err) {
        addToast('Erro ao aceder aos dispositivos de mídia', 'error');
        }
    }, [selectedClient, startStream, addToast]);

    const handleEndCall = useCallback(() => {
        stopStream();
        if (callTimerRef.current) clearInterval(callTimerRef.current);
        setShowCallPage(false);
        setCallState(prev => ({ ...prev, status: 'idle' }));
        addToast('Chamada terminada', 'info');
    }, [stopStream, addToast]);

    const handleToggleMute = useCallback(() => {
        toggleAudio(!audioEnabled);
        setCallState(prev => ({ ...prev, isMuted: !audioEnabled }));
    }, [audioEnabled, toggleAudio]);

    const handleToggleVideo = useCallback(() => {
        toggleVideo(!videoEnabled);
        setCallState(prev => ({ ...prev, isVideoOff: !videoEnabled }));
    }, [videoEnabled, toggleVideo]);

    const handleToggleScreenShare = useCallback(async () => {
        if (screenSharing) {
        await stopScreenShare();
        setCallState(prev => ({ ...prev, isScreenSharing: false }));
        } else {
        await startScreenShare();
        setCallState(prev => ({ ...prev, isScreenSharing: true }));
        }
    }, [screenSharing, startScreenShare, stopScreenShare]);

    // Scroll para o fim quando mensagens mudam
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Limpar timer ao desmontar
    useEffect(() => {
        return () => { if (callTimerRef.current) clearInterval(callTimerRef.current); };
    }, []);

    // Página de chamada ativa
    if (showCallPage && callState.type) {
        return (
        <CallPage
            callState={callState}
            stream={stream}
            videoEnabled={videoEnabled}
            audioEnabled={audioEnabled}
            screenSharing={screenSharing}
            onToggleMute={handleToggleMute}
            onToggleVideo={handleToggleVideo}
            onToggleScreenShare={handleToggleScreenShare}
            onEnd={handleEndCall}
        />
        );
    }

    // ─── RENDER PRINCIPAL ────────────────────────────────────────────────────
    return (
        <div className="flex h-screen bg-white">
        {/* ── Sidebar ── */}
        <div className={`w-80 bg-white border-r border-slate-100 flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'hidden md:flex' : ''}`}>
            {/* Header */}
            <div className="px-4 py-4 border-b border-slate-100">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Chat</h1>
                <div className="flex gap-2">
                {onBack && (
                    <button onClick={onBack} className="md:hidden p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                    <X size={18} />
                    </button>
                )}
                
                </div>
            </div>
            {/* Pesquisa */}
            <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                type="text"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder="Pesquisar clientes..."
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-transparent transition-all"
                />
            </div>
            </div>

            {/* Filtros */}
            <div className="px-4 py-3 border-b border-slate-100 flex gap-2 overflow-x-auto">
            {(['all', 'unread', 'online', 'pinned'] as const).map(f => (
                <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    filter === f ? 'bg-slate-800 text-white shadow-sm' : 'bg-slate-50 text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }`}
                >
                {f === 'all' ? 'Todos' : f === 'unread' ? 'Não lidos' : f === 'online' ? 'Online' : 'Fixados'}
                </button>
            ))}
            </div>

            {/* Lista de clientes */}
            <div className="flex-1 overflow-y-auto">
            {filteredClients.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm font-medium">
                Nenhum cliente encontrado
                </div>
            ) : (
                filteredClients.map(client => (
                <button
                    key={client.id}
                    onClick={() => handleSelectClient(client)}
                    className={`w-full px-4 py-3 border-b border-slate-50 flex items-start gap-3 transition-all duration-150 text-left ${
                    selectedClient?.id === client.id ? 'bg-blue-50 border-l-[3px] border-l-blue-800' : 'hover:bg-slate-50'
                    }`}
                >
                    <div className="relative flex-shrink-0">
                    <div className={`w-10 h-10 rounded-full ${avatarColor(client.name)} flex items-center justify-center ring-2 ring-white`}>
                        <span className="text-sm font-bold text-white">{getInitials(client.name)}</span>
                    </div>
                    {client.online && <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />}
                    </div>
                    <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline gap-2">
                        <p className="font-semibold text-slate-800 truncate text-sm">{client.name}</p>
                        <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">{client.time}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{client.lastMsg}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                        {client.unread > 0 && (
                        <span className="px-1.5 py-0.5 bg-slate-800 text-white text-[10px] font-bold rounded-full leading-none">{client.unread}</span>
                        )}
                        {client.typing && <span className="text-[10px] font-medium text-blue-700 italic">a escrever...</span>}
                    </div>
                    </div>
                </button>
                ))
            )}
            </div>
        </div>

        {/* ── Área principal do chat ── */}
        {selectedClient ? (
            <div className="flex-1 flex flex-col bg-slate-50/50">
            {/* Header */}
            <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                <button className="md:hidden p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" onClick={() => setIsSidebarCollapsed(false)}>
                    <Menu size={18} />
                </button>
                <div className={`w-10 h-10 rounded-full ${avatarColor(selectedClient.name)} flex items-center justify-center`}>
                    <span className="text-sm font-bold text-white">{getInitials(selectedClient.name)}</span>
                </div>
                <div>
                    <h2 className="text-base font-bold text-slate-900">{selectedClient.name}</h2>
                    <p className="text-xs text-slate-500">{selectedClient.company}</p>
                </div>
                </div>
                <div className="flex items-center gap-2">
                <button onClick={() => handleStartCall('voice')} className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" title="Chamada de voz"><Phone size={18} /></button>
                <button onClick={() => handleStartCall('video')} className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" title="Chamada de vídeo"><Video size={18} /></button>
                <button onClick={() => setShowClientInfo(true)} className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" title="Informações"><Info size={18} /></button>
                </div>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {messages.map(msg => {
                const isUser = msg.sender === 'user';
                const statusIcon = msg.status === 'read' ? <CheckCircle2 size={12} className="text-blue-400" /> :
                                    msg.status === 'delivered' ? <CheckCircle2 size={12} className="text-slate-400" /> :
                                    msg.status === 'sent' ? <Circle size={12} className="text-slate-400" /> :
                                    msg.status === 'error' ? <AlertCircle size={12} className="text-red-400" /> :
                                    <Clock3 size={12} className="text-slate-400" />;
                return (
                    <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                    <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl ${isUser ? 'bg-slate-800 text-white rounded-br-md shadow-sm' : 'bg-white text-slate-800 border border-slate-100 rounded-bl-md shadow-sm'}`}>
                        <p className="text-sm leading-relaxed">{msg.text}</p>
                        <div className={`flex items-center gap-1.5 mt-1.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <span className={`text-[10px] font-medium ${isUser ? 'text-slate-300' : 'text-slate-400'}`}>{msg.time}</span>
                        {isUser && statusIcon}
                        </div>
                    </div>
                    </div>
                );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-6 py-4 bg-white border-t border-slate-100">
                <div className="flex items-end gap-3">
                <button className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><Paperclip size={18} /></button>
                <input
                    type="text"
                    value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Escrever mensagem..."
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-transparent transition-all"
                />
                <button className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><Smile size={18} /></button>
                <button onClick={handleSendMessage} disabled={!messageText.trim()} className="p-2.5 bg-slate-800 text-white rounded-xl disabled:bg-slate-200 disabled:text-slate-400 hover:bg-slate-700 transition-colors">
                    <Send size={18} />
                </button>
                </div>
            </div>
            </div>
        ) : (
            <div className="flex-1 flex items-center justify-center bg-slate-50/50">
            <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                </div>
                <p className="text-slate-400 font-medium text-sm">Selecione um cliente para começar</p>
            </div>
            </div>
        )}

        {/* ── Modal de informações do cliente ── */}
        {showClientInfo && selectedClient && (
            <div className="fixed inset-0 z-40 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowClientInfo(false)}>
            <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" />
            <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-2xl shadow-slate-300/50 border border-slate-100 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">Informações do cliente</h3>
                <button onClick={() => setShowClientInfo(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
                </div>
                <div className="p-6 space-y-4">
                <div className="flex flex-col items-center text-center">
                    <div className={`w-16 h-16 rounded-full ${avatarColor(selectedClient.name)} flex items-center justify-center ring-4 ring-slate-50 mb-3`}>
                    <span className="text-xl font-black text-white">{getInitials(selectedClient.name)}</span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-lg">{selectedClient.name}</h4>
                    <p className="text-sm text-slate-500">{selectedClient.role}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Empresa</p>
                    <p className="font-semibold text-slate-800">{selectedClient.company}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Email</p>
                    <p className="font-semibold text-slate-800 text-xs truncate">{selectedClient.email}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Telefone</p>
                    <p className="font-semibold text-slate-800">{selectedClient.phone}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Status</p>
                    <p className="font-semibold text-slate-800">{selectedClient.online ? <span className="text-emerald-600">🟢 Online</span> : <span className="text-slate-400">⚫ Offline</span>}</p>
                    </div>
                </div>
                </div>
            </div>
            </div>
        )}

    
        {/* ── Toasts ── */}
        <div className="fixed bottom-6 right-6 space-y-2 z-50">
            {toasts.map(toast => (
            <div
                key={toast.id}
                className={`px-4 py-2.5 rounded-xl shadow-lg text-white text-sm font-medium flex items-center gap-2 animate-fade-in ${
                toast.type === 'success' ? 'bg-slate-800' : toast.type === 'error' ? 'bg-red-600' : 'bg-slate-700'
                }`}
            >
                <span>{toast.message}</span>
                <button onClick={() => removeToast(toast.id)} className="ml-2 p-0.5 rounded-lg hover:bg-white/20 transition-colors"><X size={14} /></button>
            </div>
            ))}
        </div>

        {/* Estilos globais inline */}
        <style>{`
            @keyframes fade-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
            .animate-fade-in { animation: fade-in 0.2s ease-out; }
        `}</style>
        </div>
    );
    };

    // ─── Hook useDebounce auxiliar (inline) ─────────────────────────────────────
    function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
    }

    export default ChatView;