/**
 * Tipos e Interfaces para o Sistema de Chat
 */

export type Theme = 'light' | 'dark' | 'ocean' | 'forest' | 'sunset';
export type FilterType = 'all' | 'unread' | 'online' | 'pinned';
export type MessageSender = 'user' | 'client';
export type MessageStatus = 'sent' | 'delivered' | 'read';
export type CallStatus = 'idle' | 'ringing' | 'connected' | 'ended';
export type CallType = 'voice' | 'video';
export type ReactionType = '👍' | '❤️' | '😂' | '🎉' | '😮' | '😢' | '😡';
export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type CallRecordStatus = 'missed' | 'answered' | 'rejected';
export type UserStatus = 'online' | 'away' | 'busy' | 'offline';
export type ButtonVariant = 'default' | 'primary' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface Client {
  id: string;
  name: string;
  company: string;
  email?: string;
  phone?: string;
  role?: string;
  department?: string;
  avatar?: string | null;
  lastMsg: string;
  time: string;
  unread: number;
  online: boolean;
  pinned: boolean;
  typing: boolean;
  tags: string[];
  notes?: string;
  lastSeen?: string;
}

export interface MessageReaction {
  type: ReactionType;
  count: number;
}

export interface MessageAttachment {
  name: string;
  size: string;
  type: string;
}

export interface Message {
  id: string;
  sender: MessageSender;
  text: string;
  time: string;
  status: MessageStatus;
  reactions?: MessageReaction[];
  isPinned?: boolean;
  isEdited?: boolean;
  attachments?: MessageAttachment[];
}

export interface CallRecord {
  id: string;
  clientId: string;
  clientName: string;
  type: CallType;
  status: CallRecordStatus;
  duration: number;
  timestamp: string;
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

export interface NotificationSettings {
  sound: boolean;
  desktop: boolean;
  email: boolean;
}

export interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
  status: UserStatus;
}

export interface CallState {
  status: CallStatus;
  type: CallType | null;
  remoteName: string;
  remoteAvatar?: string;
  startTime: Date | null;
  duration: number;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
}

export interface IconButtonProps {
  icon: React.ReactNode;
  onClick?: () => void;
  title?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  className?: string;
}

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: ModalSize;
}

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

export interface CallPageProps {
  callState: CallState;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleRecording: () => void;
}
