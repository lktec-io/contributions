import { createContext, useState, useCallback } from 'react';

export const ToastContext = createContext(null);

const EXIT_MS = 300; // must match toast-out animation duration in Toast.css

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    // Mark as exiting so CSS plays the exit animation
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    // Actually remove after animation completes
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, EXIT_MS);
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), duration);
  }, [removeToast]);

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error:   (msg) => addToast(msg, 'error'),
    info:    (msg) => addToast(msg, 'info'),
    warning: (msg) => addToast(msg, 'warning'),
  };

  return (
    <ToastContext.Provider value={{ toasts, toast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}
