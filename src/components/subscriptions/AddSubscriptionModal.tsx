import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, DollarSign, Calendar, Tag, ChevronDown, Save, Zap } from 'lucide-react';
import { PREDEFINED_CATEGORIES, BillingCycle, SubscriptionStatus, Subscription, Category } from '../../types';
import { createSubscription, updateSubscription } from '../../services/subscriptionService';
import { subscribeToUserCategories, createCategory } from '../../services/categoryService';
import { SUBSCRIPTION_TEMPLATES, SubscriptionTemplate } from '../../constants/templates';
import { cn } from '../../lib/utils';

import { IconRenderer } from '../ui/IconRenderer';

interface AddSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  editSubscription?: Subscription | null;
  defaultCurrency?: string;
}

export default function AddSubscriptionModal({ isOpen, onClose, userId, editSubscription, defaultCurrency = 'EUR' }: AddSubscriptionModalProps) {
  const [loading, setLoading] = useState(false);
  const [userCategories, setUserCategories] = useState<Category[]>([]);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#6366f1');
  const [formData, setFormData] = useState({
    name: '',
    icon: '',
    amount: '',
    currency: defaultCurrency,
    billingDay: '1',
    billingMonth: (new Date().getMonth() + 1).toString(),
    billingCycle: 'monthly' as BillingCycle,
    category: PREDEFINED_CATEGORIES[0].name,
    startDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeToUserCategories(userId, (cats) => {
      setUserCategories(cats);
    });
    return () => unsub();
  }, [userId]);

  useEffect(() => {
    if (editSubscription) {
      setFormData({
        name: editSubscription.name,
        icon: editSubscription.icon || '',
        amount: editSubscription.amount.toString(),
        currency: editSubscription.currency || defaultCurrency,
        billingDay: editSubscription.billingDay.toString(),
        billingMonth: (editSubscription.billingMonth || (new Date().getMonth() + 1)).toString(),
        billingCycle: editSubscription.billingCycle,
        category: editSubscription.category,
        startDate: editSubscription.startDate,
      });
    } else {
      setFormData({
        name: '',
        icon: '',
        amount: '',
        currency: defaultCurrency,
        billingDay: '1',
        billingMonth: (new Date().getMonth() + 1).toString(),
        billingCycle: 'monthly',
        category: PREDEFINED_CATEGORIES[0].name,
        startDate: new Date().toISOString().split('T')[0],
      });
    }
  }, [editSubscription, isOpen, defaultCurrency]);

  const allCategories = [...PREDEFINED_CATEGORIES.map(c => c.name), ...userCategories.map(c => c.name)];

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    setLoading(true);
    try {
      await createCategory(userId, newCategoryName.trim(), selectedColor);
      setFormData({...formData, category: newCategoryName.trim()});
      setNewCategoryName('');
      setShowNewCategoryInput(false);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const CATEGORY_COLORS = [
    '#6366f1', '#10b981', '#f43f5e', '#06b6d4', '#eab308', 
    '#8b5cf6', '#f97316', '#ec4899', '#71717a', '#000000'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editSubscription) {
        await updateSubscription(editSubscription.id, {
          name: formData.name,
          icon: formData.icon,
          amount: parseFloat(formData.amount),
          currency: formData.currency,
          billingCycle: formData.billingCycle,
          billingDay: parseInt(formData.billingDay),
          billingMonth: (formData.billingCycle === 'yearly' || formData.billingCycle === 'annual') ? parseInt(formData.billingMonth) : undefined,
          category: formData.category,
          startDate: formData.startDate,
        });
      } else {
        await createSubscription({
          userId,
          name: formData.name,
          icon: formData.icon,
          amount: parseFloat(formData.amount),
          currency: formData.currency,
          billingCycle: formData.billingCycle,
          billingDay: parseInt(formData.billingDay),
          billingMonth: (formData.billingCycle === 'yearly' || formData.billingCycle === 'annual') ? parseInt(formData.billingMonth) : undefined,
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
                  {!editSubscription && (
                    <div className="mb-8">
                      <div className="flex items-center gap-2 mb-4 ml-1">
                        <Zap size={14} className="text-accent" />
                        <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Escolha Rápida</label>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {SUBSCRIPTION_TEMPLATES.map((tpl) => (
                          <button
                            key={tpl.name}
                            type="button"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                name: tpl.name,
                                icon: tpl.icon || '',
                                amount: tpl.defaultAmount.toString(),
                                category: tpl.category
                              });
                            }}
                            className="px-4 py-2 bg-bg border border-border-dim rounded-xl text-[10px] font-black uppercase tracking-widest text-text-muted hover:border-accent hover:text-accent transition-all active:scale-95 flex items-center gap-2"
                          >
                            <IconRenderer name={tpl.icon} size={14} />
                            {tpl.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

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

                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 ml-1">Valor</label>
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
                      <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 ml-1">Moeda</label>
                      <div className="relative">
                        <select
                          value={formData.currency}
                          onChange={(e) => setFormData({...formData, currency: e.target.value})}
                          className="w-full px-4 py-4 bg-bg border border-border-dim rounded-2xl text-xs text-text-main font-black focus:ring-2 focus:ring-accent outline-none transition-all appearance-none cursor-pointer"
                        >
                          <option value="EUR">EUR</option>
                          <option value="USD">USD</option>
                          <option value="GBP">GBP</option>
                          <option value="BRL">BRL</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  <div className={cn("grid gap-4", (formData.billingCycle === 'yearly' || formData.billingCycle === 'annual') ? "grid-cols-3" : "grid-cols-2")}>
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

                    {(formData.billingCycle === 'yearly' || formData.billingCycle === 'annual') && (
                      <div>
                        <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 ml-1">Mês</label>
                        <div className="relative">
                          <select
                            value={formData.billingMonth}
                            onChange={(e) => setFormData({...formData, billingMonth: e.target.value})}
                            className="w-full px-4 py-4 bg-bg border border-border-dim rounded-2xl text-xs text-text-main font-black focus:ring-2 focus:ring-accent outline-none transition-all appearance-none cursor-pointer"
                          >
                            <option value="1">Janeiro</option>
                            <option value="2">Fevereiro</option>
                            <option value="3">Março</option>
                            <option value="4">Abril</option>
                            <option value="5">Maio</option>
                            <option value="6">Junho</option>
                            <option value="7">Julho</option>
                            <option value="8">Agosto</option>
                            <option value="9">Setembro</option>
                            <option value="10">Outubro</option>
                            <option value="11">Novembro</option>
                            <option value="12">Dezembro</option>
                          </select>
                          <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 ml-1">Ciclo</label>
                      <div className="relative">
                        <select
                          value={formData.billingCycle}
                          onChange={(e) => setFormData({...formData, billingCycle: e.target.value as BillingCycle})}
                          className="w-full px-6 py-4 bg-bg border border-border-dim rounded-2xl text-xs text-text-main font-black focus:ring-2 focus:ring-accent outline-none transition-all appearance-none cursor-pointer"
                        >
                          <option value="monthly">Mensal</option>
                          <option value="yearly">Anual</option>
                          <option value="weekly">Semanal</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-6 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2 ml-1">
                      <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest">Categoria</label>
                      <button 
                        type="button"
                        onClick={() => setShowNewCategoryInput(!showNewCategoryInput)}
                        className="text-[10px] font-black text-accent uppercase tracking-widest hover:underline"
                      >
                        {showNewCategoryInput ? 'Cancelar' : '+ Nova Categoria'}
                      </button>
                    </div>
                    
                    {showNewCategoryInput ? (
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="Nome da categoria..."
                            className="flex-1 px-6 py-4 bg-bg border border-accent/30 rounded-2xl text-sm text-text-main focus:ring-2 focus:ring-accent outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleAddCategory}
                            className="px-6 bg-accent text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-accent/90"
                          >
                            OK
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 px-1">
                          {CATEGORY_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setSelectedColor(color)}
                              className={cn(
                                "w-6 h-6 rounded-full border-2 transition-all active:scale-90",
                                selectedColor === color ? "border-accent scale-110 shadow-lg" : "border-transparent opacity-50 hover:opacity-100"
                              )}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <Tag size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted" />
                        <select
                          value={formData.category}
                          onChange={(e) => setFormData({...formData, category: e.target.value})}
                          className="w-full pl-12 pr-6 py-4 bg-bg border border-border-dim rounded-2xl text-sm text-text-main font-bold focus:ring-2 focus:ring-accent outline-none transition-all appearance-none cursor-pointer"
                        >
                          {allCategories.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-6 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                      </div>
                    )}
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

