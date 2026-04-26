import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning';

interface Toast {
  id:      number;
  message: string;
  type:    ToastType;
}

interface ToastContextType {
  showToast: (message?: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

const TOAST_STYLES: Record<ToastType, { bg: string; icon: React.ReactNode }> = {
  success: { bg: 'bg-slate-800',  icon: <CheckCircle  size={17} className="text-emerald-400 shrink-0" /> },
  error:   { bg: 'bg-rose-600',   icon: <XCircle      size={17} className="text-white shrink-0" /> },
  warning: { bg: 'bg-amber-500',  icon: <AlertTriangle size={17} className="text-white shrink-0" /> },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message = 'Cambios realizados', type: ToastType = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => {
          const { bg, icon } = TOAST_STYLES[t.type];
          return (
            <div
              key={t.id}
              className={`flex items-center gap-3 ${bg} text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-xl
                         animate-in fade-in slide-in-from-right-4 duration-300`}
            >
              {icon}
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
