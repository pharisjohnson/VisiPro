import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ToastKind = 'success' | 'error';
interface ToastItem { id: number; kind: ToastKind; message: string }
interface ToastApi { success: (message: string) => void; error: (message: string) => void }

const ToastContext = createContext<ToastApi | null>(null);

export const useToast = (): ToastApi => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
    return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [items, setItems] = useState<ToastItem[]>([]);

    const push = useCallback((kind: ToastKind, message: string) => {
        const id = Date.now() + Math.random();
        setItems(prev => [...prev, { id, kind, message }]);
        setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), kind === 'error' ? 6000 : 3500);
    }, []);

    const api = useMemo<ToastApi>(() => ({
        success: (m) => push('success', m),
        error: (m) => push('error', m),
    }), [push]);

    return (
        <ToastContext.Provider value={api}>
            {children}
            <div className="fixed bottom-4 right-4 z-[60] space-y-2 w-80 max-w-[calc(100vw-2rem)]" role="status" aria-live="polite">
                {items.map(t => (
                    <div key={t.id} className={`px-4 py-3 rounded-md shadow-lg text-sm text-white ${t.kind === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
                        {t.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
