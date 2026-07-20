/**
 * Funções Utilitárias para o Sistema de Chat
 */

import { MessageStatus, Theme } from './types';

/**
 * Extrai as iniciais de um nome
 */
export const getInitials = (name: string): string => {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((word: string) => word[0])
    .join('')
    .toUpperCase();
};

/**
 * Retorna o CSS class baseado no status da mensagem
 */
export const getStatusClass = (status: MessageStatus): string => {
  const statusMap: Record<MessageStatus, string> = {
    sent: 'text-yellow-500',
    delivered: 'text-blue-500',
    read: 'text-green-500',
  };
  return statusMap[status] || 'text-gray-500';
};

/**
 * Retorna o ícone do status da mensagem
 */
export const getStatusIcon = (status: MessageStatus): string => {
  const statusMap: Record<MessageStatus, string> = {
    sent: '✓',
    delivered: '✓✓',
    read: '✓✓',
  };
  return statusMap[status] || '○';
};

/**
 * Retorna o nome completo do tema
 */
export const getThemeName = (theme: Theme): string => {
  const themeMap: Record<Theme, string> = {
    light: '☀️ Claro',
    dark: '🌙 Escuro',
    ocean: '🌊 Oceano',
    forest: '🌿 Floresta',
    sunset: '🌅 Pôr do Sol',
  };
  return themeMap[theme] || 'Claro';
};

/**
 * Retorna a hora atual formatada
 */
export const getCurrentTime = (): string => {
  return new Date().toLocaleTimeString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Retorna a data atual formatada
 */
export const getCurrentDate = (): string => {
  return new Date().toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

/**
 * Formata duração em segundos para MM:SS
 */
export const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Formata timestamp ISO para formato legível
 */
export const formatTimestamp = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('pt-PT');
  } catch {
    return timestamp;
  }
};

/**
 * Escapa caracteres HTML
 */
export const escapeHtml = (text: string): string => {
  const htmlMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char: string) => htmlMap[char] || char);
};

/**
 * Gera um ID único
 */
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Formata número de bytes para unidade legível
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Verifica se um texto contém emojis
 */
export const containsEmoji = (text: string): boolean => {
  const emojiRegex =
    /(\u00d7|\u20e3|[\u0023-\u0039]|\u00a9|\u00ae|[\u200d\u2139\u2194-\u2199\u21a9-\u21aa\u231a-\u231b\u23e9-\u23ec\u23f0\u23f3\u25fd-\u25fe\u2614-\u2615\u2648-\u2653\u267f\u2693\u26a1\u26aa-\u26ab\u26bd-\u26be\u26c4-\u26c5\u26ce\u26d4\u26ea\u26f2-\u26f3\u26f5\u26fa\u26fd\u2705\u2728-\u274c\u274e\u2753-\u2755\u2757\u2795-\u2797\u27b0\u27bf\u2b1b-\u2b1c\u2b50\u2b55\u1f004\u1f0cf\u1f18-\u1f1ad\u1f1e6-\u1f202\u1f210-\u1f23b\u1f240-\u1f248\u1f250-\u1f251\u1f300-\u1f6d4\u1f6e0-\u1f6ec\u1f6f0-\u1f6f8\u1f910-\u1f93a\u1f93c-\u1f93e\u1f940-\u1f970\u1f973-\u1f976\u1f97a-\u1f9b9\u1f9c0-\u1f9ff\u1fa00-\u1fa6f\u1fa70-\u1faff\u2600-\u2605\u2607-\u2608\u2609-\u260e\u260f\u2611\u2612-\u2613\u2616-\u2617\u2618\u2619-\u261c\u261d\u261e-\u261f\u2620\u2621-\u2625\u2626-\u2637\u2638-\u263a\u263c-\u263f\u2640\u2641-\u2642\u2643-\u2647\u2648-\u2653\u2660\u2663\u2665-\u2666\u2667-\u2670\u2671\u2672-\u267d\u267e-\u267f\u2690-\u2698\u2699\u269a-\u269c\u269d-\u269f\u26a0-\u26a1\u26a2-\u26b1\u26b2-\u26ff]|\ud83c[\udde6-\uddff])/g;
  return emojiRegex.test(text);
};

/**
 * Formata número com separador de milhares
 */
export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('pt-PT').format(num);
};
