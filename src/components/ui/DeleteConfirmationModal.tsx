import { motion, AnimatePresence } from 'motion/react';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  itemName: string;
  loading?: boolean;
}

export default function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemName,
  loading = false
}: DeleteConfirmationModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-bg/80 backdrop-blur-xl"
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-card border border-border-dim rounded-[2.5rem] shadow-2xl overflow-hidden"
          >
            <div className="p-8 sm:p-10 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-[1.5rem] flex items-center justify-center text-red-500 mx-auto mb-6">
                <AlertTriangle size={32} />
              </div>
              
              <h2 className="text-xl sm:text-2xl font-bold text-text-main tracking-tighter mb-2">
                {title}
              </h2>
              <p className="text-text-muted text-xs sm:text-sm font-bold uppercase tracking-widest leading-relaxed mb-8">
                Estás prestes a eliminar <span className="text-red-500">"{itemName}"</span>. Esta ação não pode ser revertida.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="py-4 px-6 bg-bg border border-border-dim rounded-2xl text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-text-muted hover:text-text-main hover:border-text-main transition-all active:scale-95 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={onConfirm}
                  disabled={loading}
                  className={cn(
                    "py-4 px-6 bg-red-500 rounded-2xl text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-white hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50",
                    loading && "animate-pulse"
                  )}
                >
                  <Trash2 size={16} />
                  {loading ? 'A ELIMINAR...' : 'ELIMINAR'}
                </button>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 text-text-muted hover:text-text-main transition-colors"
            >
              <X size={20} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
