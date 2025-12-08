import React, { useEffect, useState } from 'react';
import { X, AlertTriangle, AlertCircle, CheckCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // ms, 0 = no auto-dismiss
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastSystemProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  theme?: string;
}

const ToastSystem: React.FC<ToastSystemProps> = ({
  toasts,
  onDismiss,
  position = 'bottom-right',
  theme = 'Default'
}) => {
  const isDark = theme === 'Midnight';

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  return (
    <div className={`fixed ${positionClasses[position]} z-50 flex flex-col gap-2 pointer-events-none`}>
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={onDismiss}
          isDark={isDark}
        />
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
  isDark: boolean;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss, isDark }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setIsVisible(true));

    // Auto-dismiss
    if (toast.duration !== 0) {
      const duration = toast.duration || 5000;
      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration]);

  const handleDismiss = () => {
    setIsLeaving(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  const icons = {
    success: <CheckCircle className="h-5 w-5 text-emerald-500" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
    error: <AlertCircle className="h-5 w-5 text-red-500" />,
    info: <Info className="h-5 w-5 text-blue-500" />,
  };

  const borderColors = {
    success: isDark ? 'border-emerald-500/30' : 'border-emerald-200',
    warning: isDark ? 'border-amber-500/30' : 'border-amber-200',
    error: isDark ? 'border-red-500/30' : 'border-red-200',
    info: isDark ? 'border-blue-500/30' : 'border-blue-200',
  };

  const bgColors = {
    success: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50',
    warning: isDark ? 'bg-amber-500/10' : 'bg-amber-50',
    error: isDark ? 'bg-red-500/10' : 'bg-red-50',
    info: isDark ? 'bg-blue-500/10' : 'bg-blue-50',
  };

  return (
    <div
      className={`
        pointer-events-auto w-80 rounded-xl border shadow-lg backdrop-blur-sm
        transition-all duration-300 ease-out
        ${isDark ? 'bg-slate-900/95 border-slate-700' : 'bg-white/95 border-gray-200'}
        ${isVisible && !isLeaving ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'}
      `}
    >
      <div className={`flex items-start gap-3 p-4 rounded-xl ${bgColors[toast.type]} ${borderColors[toast.type]} border`}>
        <div className="flex-shrink-0 mt-0.5">
          {icons[toast.type]}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {toast.title}
          </p>
          {toast.message && (
            <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
              {toast.message}
            </p>
          )}
          {toast.action && (
            <button
              onClick={() => {
                toast.action?.onClick();
                handleDismiss();
              }}
              className={`mt-2 text-sm font-medium ${
                toast.type === 'error' ? 'text-red-600 hover:text-red-700' :
                toast.type === 'warning' ? 'text-amber-600 hover:text-amber-700' :
                toast.type === 'success' ? 'text-emerald-600 hover:text-emerald-700' :
                'text-blue-600 hover:text-blue-700'
              }`}
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className={`flex-shrink-0 p-1 rounded-lg transition-colors ${
            isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-400'
          }`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

// Hook for managing toasts
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts(prev => [...prev, { ...toast, id }]);
    return id;
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const clearAllToasts = () => {
    setToasts([]);
  };

  // Convenience methods
  const success = (title: string, message?: string, options?: Partial<Toast>) =>
    addToast({ type: 'success', title, message, ...options });

  const warning = (title: string, message?: string, options?: Partial<Toast>) =>
    addToast({ type: 'warning', title, message, ...options });

  const error = (title: string, message?: string, options?: Partial<Toast>) =>
    addToast({ type: 'error', title, message, ...options });

  const info = (title: string, message?: string, options?: Partial<Toast>) =>
    addToast({ type: 'info', title, message, ...options });

  return {
    toasts,
    addToast,
    dismissToast,
    clearAllToasts,
    success,
    warning,
    error,
    info,
  };
}

export default ToastSystem;
