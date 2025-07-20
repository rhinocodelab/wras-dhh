import React, { createContext, useContext, useState, useCallback } from 'react';
import Toast, { Toast as ToastType, ToastType as ToastTypeEnum } from './Toast';

interface ToastContextType {
  addToast: (toast: Omit<ToastType, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastContainerProps {
  children: React.ReactNode;
}

export default function ToastContainer({ children }: ToastContainerProps) {
  const [toasts, setToasts] = useState<ToastType[]>([]);

  const addToast = useCallback((toast: Omit<ToastType, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: ToastType = { ...toast, id };
    setToasts(prev => [...prev, newToast]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            toast={toast}
            onDismiss={removeToast}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Convenience functions for common toast types
export const toast = {
  success: (title: string, message?: string, duration?: number) => {
    const { addToast } = useToast();
    addToast({ type: 'success', title, message, duration });
  },
  error: (title: string, message?: string, duration?: number) => {
    const { addToast } = useToast();
    addToast({ type: 'error', title, message, duration });
  },
  warning: (title: string, message?: string, duration?: number) => {
    const { addToast } = useToast();
    addToast({ type: 'warning', title, message, duration });
  },
  info: (title: string, message?: string, duration?: number) => {
    const { addToast } = useToast();
    addToast({ type: 'info', title, message, duration });
  }
}; 