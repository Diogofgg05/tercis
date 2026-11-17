/**
 * Componentes Reutilizáveis para o Sistema de Chat
 */

import React from 'react';
import {
  X,
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
  Send,
  Search,
} from 'lucide-react';
import {
  IconButtonProps,
  SearchInputProps,
  ModalProps,
  ConfirmDialogProps,
  ToastContainerProps,
  Toast,
  ToastType,
} from './types';

/**
 * Componente de Botão com Ícone
 */
export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onClick,
  title,
  variant = 'default',
  size = 'md',
  disabled = false,
  className = '',
}) => {
  const variantClasses: Record<string, string> = {
    default: 'hover:bg-gray-200 dark:hover:bg-gray-700',
    primary: 'hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400',
    danger: 'hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400',
    success: 'hover:bg-green-100 dark:hover:bg-green-900 text-green-600 dark:text-green-400',
  };

  const sizeClasses: Record<string, string> = {
    sm: 'p-1 text-sm',
    md: 'p-2 text-base',
    lg: 'p-3 text-lg',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        rounded-lg transition-colors duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {icon}
    </button>
  );
};

/**
 * Componente de Input de Pesquisa
 */
export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Pesquisar...',
  className = '',
}) => {
  return (
    <div className={`relative flex items-center ${className}`}>
      <Search className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="
          w-full pl-10 pr-4 py-2
          bg-gray-100 dark:bg-gray-700
          text-gray-900 dark:text-gray-100
          placeholder-gray-500 dark:placeholder-gray-400
          rounded-lg border border-gray-200 dark:border-gray-600
          focus:outline-none focus:ring-2 focus:ring-blue-500
          transition-colors duration-200
        "
      />
    </div>
  );
};

/**
 * Componente de Modal
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  size = 'md',
}) => {
  if (!open) return null;

  const sizeClasses: Record<string, string> = {
    sm: 'w-96',
    md: 'w-[500px]',
    lg: 'w-[700px]',
    xl: 'w-[900px]',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50 cursor-pointer"
        onClick={onClose}
        role="presentation"
      />
      <div className={`relative bg-white dark:bg-gray-800 rounded-lg shadow-xl ${sizeClasses[size]}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-4 max-h-[calc(100vh-200px)] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

/**
 * Componente de Diálogo de Confirmação
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50 cursor-pointer"
        onClick={onCancel}
        role="presentation"
      />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-96 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          {title}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="
              px-4 py-2 rounded-lg
              bg-gray-100 dark:bg-gray-700
              text-gray-900 dark:text-gray-100
              hover:bg-gray-200 dark:hover:bg-gray-600
              transition-colors duration-200
            "
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="
              px-4 py-2 rounded-lg
              bg-blue-600 text-white
              hover:bg-blue-700
              transition-colors duration-200
            "
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Componente Individual de Toast
 */
const ToastItem: React.FC<{
  toast: Toast;
  onRemove: (id: string) => void;
}> = ({ toast, onRemove }) => {
  const typeConfig: Record<ToastType, { icon: React.ReactNode; bgColor: string; textColor: string }> = {
    success: {
      icon: <CheckCircle2 className="w-5 h-5" />,
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      textColor: 'text-green-800 dark:text-green-200',
    },
    error: {
      icon: <AlertCircle className="w-5 h-5" />,
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      textColor: 'text-red-800 dark:text-red-200',
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5" />,
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      textColor: 'text-yellow-800 dark:text-yellow-200',
    },
    info: {
      icon: <Info className="w-5 h-5" />,
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      textColor: 'text-blue-800 dark:text-blue-200',
    },
  };

  const config = typeConfig[toast.type];

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg ${config.bgColor} ${config.textColor}`}>
      {config.icon}
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-opacity-50 hover:text-opacity-100 transition-opacity"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

/**
 * Contenedor de Toasts
 */
export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
};

/**
 * Componente de Botão Flutuante para Input
 */
export const FloatingActionButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}> = ({ onClick, disabled = false, icon = <Send className="w-5 h-5" /> }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="
        p-2 rounded-full
        bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400
        text-white transition-colors duration-200
      "
    >
      {icon}
    </button>
  );
};

/**
 * Componente de Badge
 */
export const Badge: React.FC<{
  label: string;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning';
  size?: 'sm' | 'md' | 'lg';
}> = ({ label, variant = 'primary', size = 'sm' }) => {
  const variantClasses: Record<string, string> = {
    primary: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    secondary: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    danger: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  };

  const sizeClasses: Record<string, string> = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <span className={`rounded-full font-medium ${variantClasses[variant]} ${sizeClasses[size]}`}>
      {label}
    </span>
  );
};

/**
 * Componente de Avatar
 */
export const Avatar: React.FC<{
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  online?: boolean;
}> = ({ name, src, size = 'md', online = false }) => {
  const sizeClasses: Record<string, string> = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  return (
    <div className={`relative ${sizeClasses[size]}`}>
      {src ? (
        <img
          src={src}
          alt={name}
          className="w-full h-full rounded-full object-cover"
        />
      ) : (
        <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold">
          {initials}
        </div>
      )}
      {online && (
        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800" />
      )}
    </div>
  );
};

/**
 * Componente de Indicador de Digitação
 */
export const TypingIndicator: React.FC = () => {
  return (
    <div className="flex items-center gap-1">
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
};

/**
 * Componente de Carregamento
 */
export const Loader: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeClasses: Record<string, string> = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={`${sizeClasses[size]} border-4 border-gray-200 dark:border-gray-700 border-t-blue-500 rounded-full animate-spin`} />
  );
};
