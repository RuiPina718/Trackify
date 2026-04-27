import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, DollarSign, Calendar, Tag, ChevronDown, Save } from 'lucide-react';
import { PREDEFINED_CATEGORIES, BillingCycle, SubscriptionStatus, Subscription } from '../../types';
import { createSubscription, updateSubscription } from '../../services/subscriptionService';
import { cn } from '../../lib/utils';

interface AddSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  editSubscription?: Subscription | null;
  defaultCurrency?: string;
}

export default function AddSubscriptionModal({ isOpen, onClose, userId, editSubscription, defaultCurrency = 'EUR' }: AddSubscriptionModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    billingDay: '1',
    billingCycle: 'monthly' as BillingCycle,
    category: PREDEFINED_CATEGORIES[0].name,
    startDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (editSubscription) {
      setFormData({
        name: editSubscription.name,
        amount: editSubscription.amount.toString(),
        billingDay: editSubscription.billingDay.toString(),
        billingCycle: editSubscription.billingCycle,
        category: editSubscription.category,
        startDate: editSubscription.startDate,
      });
    } else {
      setFormData({
        name: '',
        amount: '',
        billingDay: '1',
        billingCycle: 'monthly',
        category: PREDEFINED_CATEGORIES[0].name,
        startDate: new Date().toISOString().split('T')[0],
      });
    }
  }, [editSubscription, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editSubscription) {
        await updateSubscription(editSubscription.id, {
          name: formData.name,
          amount: parseFloat(formData.amount),
          billingCycle: formData.billingCycle,
          billingDay: parseInt(formData.billingDay),
          category: formData.category,
          startDate: formData.startDate,
        });
      } else {
        await createSubscription({
          userId,
          name: formData.name,
          amount: parseFloat(formData.amount),
          currency: defaultCurrency,
          billingCycle: formData.billingCycle,
          billingDay: parseInt(formData.billingDay),
          category: formData.category,
          status: 'active' as SubscriptionStatus,
          startDate: formData.startDate,
        });
      }
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-bg/80 backdrop-blur-md z-50 flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card w-full max-w-xl rounded-[2.5rem] border border-border-dim shadow-2xl overflow-hidden flex flex-col md:flex-row"
            >
              {/* Left Side - Visual Style */}
              <div className="hidden md:flex md:w-1/3 bg-bg p-10 flex-col justify-between text-text-main border-r border-border-dim">
                <div>
                  <h2 className="text-3xl font-black tracking-tighter mb-4 leading-tight text-accent">
                    {editSubscription ? 'Editar' : 'Nova'}<br/>Subscrição
                  </h2>
                  <div className="w-12 h-1 bg-accent rounded-full mb-8"></div>
                  <p className="text-xs text-text-muted leading-relaxed font-bold uppercase tracking-wider">
                    {editSubscription ? 'Atualiza os dados do teu serviço.' : 'Preenche os detalhes do serviço para começares a monitorizar.'}
                  </p>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[10px] font-black text-accent uppercase tracking-[0.2em]">
                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                    READY TO TRACK
                  </div>
                </div>
              </div>

              {/* Right Side - Form */}
              <div className="flex-1 p-10">
                <div className="flex justify-end mb-4">
                  <button onClick={onClose} className="p-3 text-text-muted hover:text-text-main hover:bg-bg border border-transparent hover:border-border-dim rounded-2xl transition-all">
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 ml-1">Nome do Serviço</label>
                    <div className="relative">
                      <input
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full px-6 py-4 bg-bg border border-border-dim rounded-2xl text-sm text-text-main focus:ring-2 focus:ring-accent outline-none transition-all placeholder:text-text-muted/30"
                        placeholder="Ex: Netflix, Spotify, Gym..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 ml-1">Valor Mensal</label>
                      <div className="relative">
                        <DollarSign size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input
                          required
                          type="number"
                          step="0.01"
                          value={formData.amount}
                          onChange={(e) => setFormData({...formData, amount: e.target.value})}
                          className="w-full pl-12 pr-6 py-4 bg-bg border border-border-dim rounded-2xl text-sm text-text-main font-bold focus:ring-2 focus:ring-accent outline-none transition-all"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 ml-1">Dia de Cobrança</label>
                      <div className="relative">
                        <Calendar size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input
                          required
                          type="number"
                          min="1"
                          max="31"
                          value={formData.billingDay}
                          onChange={(e) => setFormData({...formData, billingDay: e.target.value})}
                          className="w-full pl-12 pr-6 py-4 bg-bg border border-border-dim rounded-2xl text-sm text-text-main font-bold focus:ring-2 focus:ring-accent outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 ml-1">Categoria</label>
                    <div className="relative">
                      <Tag size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted" />
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                        className="w-full pl-12 pr-6 py-4 bg-bg border border-border-dim rounded-2xl text-sm text-text-main font-bold focus:ring-2 focus:ring-accent outline-none transition-all appearance-none cursor-pointer"
                      >
                        {PREDEFINED_CATEGORIES.map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="absolute right-6 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-5 bg-accent text-white rounded-2xl text-sm font-black shadow-xl shadow-accent/20 hover:bg-accent/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        {editSubscription ? <Save size={18} /> : <Plus size={18} />}
                        {editSubscription ? 'GUARDAR ALTERAÇÕES' : 'ADICIONAR SERVIÇO'}
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

