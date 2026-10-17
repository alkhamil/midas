import { createContext, useContext, type ReactNode } from 'react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ShowToastParams {
  message: string | ReactNode;
  variant: ToastVariant;
  duration?: number;
  closable?: boolean;
  containerId?: string;
  className?: string;
  widthClass?: string;
}

interface ToastContextType {
  showToast: (params: ShowToastParams) => void;
}

export const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
