import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const Toast = ({ message, type = 'info', onClose, duration = 4000 }) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      if (onClose) onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const styles = {
    success: {
      bg: 'bg-[#2F6F4F] text-white',
      icon: CheckCircle2,
    },
    error: {
      bg: 'bg-red-800 text-white',
      icon: AlertCircle,
    },
    info: {
      bg: 'bg-[#12151C] text-white',
      icon: Info,
    },
  };

  const current = styles[type] || styles.info;
  const Icon = current.icon;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full shadow-lg">
      <div className={`flex items-center justify-between px-4 py-3 border border-black/10 ${current.bg}`}>
        <div className="flex items-center space-x-3">
          <Icon className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs font-medium">{message}</span>
        </div>
        <button
          onClick={onClose}
          className="text-white/80 hover:text-white p-1 ml-3"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default Toast;
