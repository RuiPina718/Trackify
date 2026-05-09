import React, { useState, useEffect } from 'react';
import { X, Save, Plus } from 'lucide-react';
import { Category, CATEGORY_COLORS, CATEGORY_ICONS } from '../../types';
import { IconRenderer } from '../ui/IconRenderer';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (catData: { name: string, color: string, icon: string }) => Promise<void>;
  editCategory?: Category | null;
  loading?: boolean;
}

export default function CategoryModal({ isOpen, onClose, onSave, editCategory, loading }: CategoryModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [icon, setIcon] = useState(CATEGORY_ICONS[0]);

  useEffect(() => {
    if (editCategory) {
      setName(editCategory.name);
      setColor(editCategory.color);
      setIcon(editCategory.icon || 'Tag');
    } else {
      setName('');
      setColor(CATEGORY_COLORS[0]);
      setIcon(CATEGORY_ICONS[0]);
    }
  }, [editCategory, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onSave({ name: name.trim(), color, icon });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-bg/80 backdrop-blur-xl"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-card border border-border-dim rounded-[2.5rem] shadow-2xl overflow-hidden"
          >
            <div className="p-8 sm:p-10">
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h3 className="text-3xl font-black text-text-main tracking-tighter">
                    {editCategory ? 'Editar Categoria' : 'Nova Categoria'}
                  </h3>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mt-2">
                    {editCategory ? 'Personaliza esta categoria de sistema ou manual' : 'Define um novo agrupamento para as tuas subscrições'}
                  </p>
                </div>
                <button 
                  onClick={onClose}
                  className="p-3 text-text-muted hover:text-text-main hover:bg-bg rounded-2xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-3 ml-1">Nome da Categoria</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-6 py-4 bg-bg border border-border-dim rounded-2xl text-sm text-text-main font-bold focus:ring-2 focus:ring-accent outline-none transition-all"
                      placeholder="Ex: Streaming, Lazer, Saúde..."
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-3 ml-1">Ícone</label>
                    <div className="grid grid-cols-6 gap-2 p-4 bg-bg border border-border-dim rounded-3xl">
                      {CATEGORY_ICONS.map((iconSlug) => (
                        <button
                          key={iconSlug}
                          type="button"
                          onClick={() => setIcon(iconSlug)}
                          className={cn(
                            "flex items-center justify-center p-3 rounded-xl transition-all",
                            icon === iconSlug 
                              ? "bg-accent text-white shadow-lg shadow-accent/20" 
                              : "text-text-muted hover:bg-card hover:text-text-main"
                          )}
                        >
                          <IconRenderer name={iconSlug} size={18} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-3 ml-1">Cor</label>
                    <div className="flex flex-wrap gap-3 items-center p-4 bg-bg border border-border-dim rounded-3xl">
                      {CATEGORY_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setColor(c)}
                          className={cn(
                            "w-8 h-8 rounded-full border-2 transition-all active:scale-90",
                            color === c ? "border-white scale-110 shadow-lg" : "border-transparent opacity-50 hover:opacity-100"
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      <div className="relative">
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                        />
                        <div 
                          className={cn(
                            "w-8 h-8 rounded-full border-2 border-dashed border-text-muted/50 flex items-center justify-center hover:border-accent transition-all",
                            !CATEGORY_COLORS.includes(color) && "border-solid border-accent scale-110"
                          )}
                          style={{ backgroundColor: !CATEGORY_COLORS.includes(color) ? color : 'transparent' }}
                        >
                          <Plus size={12} className={cn(!CATEGORY_COLORS.includes(color) ? "text-white" : "text-text-muted")} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-8 py-4 bg-bg border border-border-dim rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-card transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !name.trim()}
                    className="flex-1 px-8 py-4 bg-accent text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-accent/90 transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    {editCategory ? 'Guardar Alterações' : 'Criar Categoria'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
