import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle } from 'lucide-react';

interface Toast {
  id:      number;
  message: string;
}

interface ToastContextType {
  showToast: (message?: string) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message = 'Cambios realizados') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast container */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className="flex items-center gap-3 bg-slate-800 text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-xl
                       animate-in fade-in slide-in-from-right-4 duration-300"
          >
            <CheckCircle size={17} className="text-emerald-400 shrink-0" />
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
