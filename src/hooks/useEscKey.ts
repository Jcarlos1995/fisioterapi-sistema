import { useEffect } from 'react';

const useEscKey = (onEsc: () => void, active = true) => {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onEsc(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onEsc, active]);
};

export default useEscKey;
