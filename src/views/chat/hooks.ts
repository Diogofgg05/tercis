/**
 * Hooks Customizados para o Sistema de Chat
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Toast, ToastType } from './types';
import { generateId } from './utils';

/**
 * Hook para debounce de valores
 */
export const useDebounce = <T,>(value: T, delay: number = 500): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Hook para gerir toasts (notificações)
 */
export const useToasts = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 3000) => {
      const id = generateId();
      const toast: Toast = { id, message, type };
      setToasts((prev) => [...prev, toast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }

      return id;
    },
    [removeToast]
  );

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  return { toasts, addToast, removeToast, clearAll };
};

/**
 * Hook para localStorage
 */
export const useLocalStorage = <T,>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue] as const;
};

/**
 * Hook para media stream (áudio/vídeo)
 */
export const useMediaStream = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const startStream = useCallback(async (constraints: MediaStreamConstraints) => {
    try {
      setIsLoading(true);
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      return mediaStream;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao aceder aos dispositivos de mídia';
      setError(errorMessage);
      console.error('Error accessing media stream:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  const toggleAudio = useCallback(
    (enabled: boolean) => {
      if (stream) {
        stream.getAudioTracks().forEach((track) => {
          track.enabled = enabled;
        });
      }
    },
    [stream]
  );

  const toggleVideo = useCallback(
    (enabled: boolean) => {
      if (stream) {
        stream.getVideoTracks().forEach((track) => {
          track.enabled = enabled;
        });
      }
    },
    [stream]
  );

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return {
    stream,
    error,
    isLoading,
    startStream,
    stopStream,
    toggleAudio,
    toggleVideo,
  };
};

/**
 * Hook para gerir estado com validação
 */
export const useValidatedState = <T,>(initialValue: T, validator?: (value: T) => boolean) => {
  const [value, setValue] = useState<T>(initialValue);

  const setValidatedValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      const resolvedValue = newValue instanceof Function ? newValue(value) : newValue;
      if (!validator || validator(resolvedValue)) {
        setValue(resolvedValue);
      }
    },
    [value, validator]
  );

  return [value, setValidatedValue] as const;
};

/**
 * Hook para efeitos com cleanup automático
 */
export const useAsync = <T,>(asyncFunction: () => Promise<T>, immediate: boolean = true) => {
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [value, setValue] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async () => {
    setStatus('pending');
    setValue(null);
    setError(null);

    try {
      const response = await asyncFunction();
      setValue(response);
      setStatus('success');
      return response;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setStatus('error');
    }
  }, [asyncFunction]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return { execute, status, value, error };
};

/**
 * Hook para refs com callback
 */
export const useCallbackRef = <T,>(callback?: (value: T | null) => void) => {
  return useRef((value: T | null) => {
    callback?.(value);
  });
};

/**
 * Hook para gerenciar abas/tabs
 */
export const useTabs = (defaultTab: string) => {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return {
    activeTab,
    setActiveTab,
    isActive: (tab: string) => activeTab === tab,
  };
};
