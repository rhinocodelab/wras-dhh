import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const toastStyles = {
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: CheckCircle,
    iconColor: 'text-green-400',
    titleColor: 'text-green-800',
    messageColor: 'text-green-700'
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: XCircle,
    iconColor: 'text-red-400',
    titleColor: 'text-red-800',
    messageColor: 'text-red-700'
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    icon: AlertCircle,
    iconColor: 'text-yellow-400',
    titleColor: 'text-yellow-800',
    messageColor: 'text-yellow-700'
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: Info,
    iconColor: 'text-blue-400',
    titleColor: 'text-blue-800',
    messageColor: 'text-blue-700'
  }
};

export default function Toast({ toast, onDismiss }: ToastProps) {
  const styles = toastStyles[toast.type];
  const Icon = styles.icon;

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div className={`${styles.bg} border ${styles.border} rounded-lg p-4 shadow-lg max-w-sm w-full`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <Icon className={`h-5 w-5 ${styles.iconColor}`} />
        </div>
        <div className="ml-3 flex-1">
          <p className={`text-sm font-medium ${styles.titleColor}`}>
            {toast.title}
          </p>
          {toast.message && (
            <p className={`mt-1 text-sm ${styles.messageColor}`}>
              {toast.message}
            </p>
          )}
        </div>
        <div className="ml-4 flex-shrink-0">
          <button
            onClick={() => onDismiss(toast.id)}
            className={`inline-flex ${styles.iconColor} hover:${styles.iconColor.replace('text-', 'text-').replace('-400', '-600')} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${styles.iconColor.replace('text-', '').replace('-400', '-500')}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
} 