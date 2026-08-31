import { useState } from 'react';

export interface Toast {
  id: string;
  msg: string;
}

export function useToasts(autoDismissMs = 4000) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (msg: string) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, msg }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, autoDismissMs);
  };

  return { toasts, addToast };
}
