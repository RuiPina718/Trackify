import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, DollarSign, Calendar, Tag, ChevronDown, Save, Zap } from 'lucide-react';
import { PREDEFINED_CATEGORIES, BillingCycle, SubscriptionStatus, Subscription, Category, CATEGORY_COLORS, CATEGORY_ICONS } from '../../types';
import { createSubscription, updateSubscription } from '../../services/subscriptionService';
import { createCategory } from '../../services/categoryService';
import { useUnifiedCategories } from '../../hooks/useUnifiedCategories';
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
  const { categories } = useUnifiedCategories(userId);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#6366f1');
  const [selectedIcon, setSelectedIcon] = useState('Tag');
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

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    setLoading(true);
    try {
      await createCategory(userId, newCategoryName.trim(), selectedColor, undefined, selectedIcon);
      setFormData({...formData, category: newCategoryName.trim()});
      setNewCategoryName('');
      setSelectedIcon('Tag');
      setShowNewCategoryInput(false);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const billingCycleValue = formData.billingCycle;
      const isYearlyOrAnnual = billingCycleValue === 'yearly' || billingCycleValue === 'annual';
      
      const subscriptionData: any = {
        name: formData.name,
        icon: formData.icon,
        amount: parseFloat(formData.amount) || 0,
        currency: formData.currency,
        billingCycle: billingCycleValue,
        billingDay: parseInt(formData.billingDay) || 1,
        category: formData.category,
        startDate: formData.startDate,
      };

      if (isYearlyOrAnnual) {
        subscriptionData.billingMonth = parseInt(formData.billingMonth);
      } else {
        subscriptionData.billingMonth = null;
      }

      if (editSubscription) {
        await updateSubscription(editSubscription.id, subscriptionData);
      } else {
        await createSubscription({
          ...subscriptionData,
          userId,
          status: 'active' as SubscriptionStatus,
        });
      }
      onClose();
    } catch (error: any) {
      console.error('Erro ao guardar subscrição:', error);
      alert('Erro ao guardar: ' + (error.message || 'Ocorreu um erro inesperado.'));
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
              className="bg-card w-full max-w-xl rounded-[2.5rem] border border-border-dim shadow-2xl overflow-hidden flex flex-col md:flex-row h-auto max-h-[90vh]"
            >
              {/* Left Side - Visual Style */}
              <div className="hidden md:flex md:w-1/3 bg-bg p-10 flex-col justify-between text-text-main border-r border-border-dim shrink-0">
                <div>
                  <h2 className="text-sm md:text-[0.95rem] font-black tracking-tighter mb-4 leading-tight text-accent uppercase">
                    {editSubscription ? 'Editar' : 'Nova'} Subscrição
                  </h2>
                  <div className="w-full h-px bg-accent/20 mb-8"></div>
                  <p className="text-[10px] text-text-muted leading-relaxed font-bold uppercase tracking-wider">
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
              <div className="flex-1 p-6 sm:p-10 overflow-y-auto relative">
                <button 
                  onClick={onClose} 
                  className="absolute top-6 right-6 p-2 sm:p-3 text-text-muted hover:text-text-main hover:bg-bg border border-transparent hover:border-border-dim rounded-2xl transition-all z-20"
                >
                  <X size={20} />
                </button>
                <div className="flex justify-between items-center mb-6 md:mb-8">
                  <h2 className="md:hidden text-xl font-black text-accent tracking-tight">
                    {editSubscription ? 'Editar' : 'Nova'} Subscrição
                  </h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                  {!editSubscription && (
                    <div className="mb-6 sm:mb-8">
                      <div className="flex items-center gap-2 mb-3 sm:mb-4 ml-1">
                        <Zap size={14} className="text-accent" />
                        <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Escolha Rápida</label>
                      </div>
                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
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
                            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-bg border border-border-dim rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-text-muted hover:border-accent hover:text-accent transition-all active:scale-95 flex items-center gap-1.5 sm:gap-2"
                          >
                            <IconRenderer name={tpl.icon} size={14} />
                            {tpl.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-1.5 sm:mb-2 ml-1">Nome do Serviço</label>
                    <div className="relative">
                      <input
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full px-5 sm:px-6 py-3.5 sm:py-4 bg-bg border border-border-dim rounded-2xl text-sm text-text-main focus:ring-2 focus:ring-accent outline-none transition-all placeholder:text-text-muted/30"
                        placeholder="Ex: Netflix, Spotify..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-1.5 sm:mb-2 ml-1">Valor</label>
                      <div className="relative">
                        <div className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 text-text-muted font-black text-sm">
                          {formData.currency === 'EUR' ? '€' : formData.currency === 'USD' ? '$' : formData.currency === 'GBP' ? '£' : 'R$'}
                        </div>
                        <input
                          required
                          type="number"
                          step="0.01"
                          value={formData.amount}
                          onChange={(e) => setFormData({...formData, amount: e.target.value})}
                          className="w-full pl-11 sm:pl-14 pr-5 sm:pr-6 py-3.5 sm:py-4 bg-bg border border-border-dim rounded-2xl text-sm text-text-main font-bold focus:ring-2 focus:ring-accent outline-none transition-all"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-1.5 sm:mb-2 ml-1">Moeda</label>
                      <div className="relative">
                        <select
                          value={formData.currency}
                          onChange={(e) => setFormData({...formData, currency: e.target.value})}
                          className="w-full px-4 py-3.5 sm:py-4 bg-bg border border-border-dim rounded-2xl text-xs text-text-main font-black focus:ring-2 focus:ring-accent outline-none transition-all appearance-none cursor-pointer"
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

                  <div className={cn("grid gap-3 sm:gap-4", (formData.billingCycle === 'yearly' || formData.billingCycle === 'annual') ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2")}>
                    <div>
                      <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-1.5 sm:mb-2 ml-1">Dia</label>
                      <div className="relative">
                        <Calendar size={16} className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input
                          required
                          type="number"
                          min="1"
                          max="31"
                          value={formData.billingDay}
                          onChange={(e) => setFormData({...formData, billingDay: e.target.value})}
                          className="w-full pl-11 sm:pl-12 pr-5 sm:pr-6 py-3.5 sm:py-4 bg-bg border border-border-dim rounded-2xl text-sm text-text-main font-bold focus:ring-2 focus:ring-accent outline-none transition-all"
                        />
                      </div>
                    </div>

                    {(formData.billingCycle === 'yearly' || formData.billingCycle === 'annual') && (
                      <div>
                        <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-1.5 sm:mb-2 ml-1">Mês</label>
                        <div className="relative">
                          <select
                            value={formData.billingMonth}
                            onChange={(e) => setFormData({...formData, billingMonth: e.target.value})}
                            className="w-full px-4 py-3.5 sm:py-4 bg-bg border border-border-dim rounded-2xl text-xs text-text-main font-black focus:ring-2 focus:ring-accent outline-none transition-all appearance-none cursor-pointer"
                          >
                            <option value="1">Jan</option>
                            <option value="2">Fev</option>
                            <option value="3">Mar</option>
                            <option value="4">Abr</option>
                            <option value="5">Mai</option>
                            <option value="6">Jun</option>
                            <option value="7">Jul</option>
                            <option value="8">Ago</option>
                            <option value="9">Set</option>
                            <option value="10">Out</option>
                            <option value="11">Nov</option>
                            <option value="12">Dez</option>
                          </select>
                          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                        </div>
                      </div>
                    )}

                    <div className={cn((formData.billingCycle === 'yearly' || formData.billingCycle === 'annual') ? "col-span-2 sm:col-span-1" : "")}>
                      <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-1.5 sm:mb-2 ml-1">Ciclo</label>
                      <div className="relative">
                        <select
                          value={formData.billingCycle}
                          onChange={(e) => setFormData({...formData, billingCycle: e.target.value as BillingCycle})}
                          className="w-full px-5 sm:px-6 py-3.5 sm:py-4 bg-bg border border-border-dim rounded-2xl text-xs text-text-main font-black focus:ring-2 focus:ring-accent outline-none transition-all appearance-none cursor-pointer"
                        >
                          <option value="monthly">Mensal</option>
                          <option value="yearly">Anual</option>
                          <option value="weekly">Semanal</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-5 sm:right-6 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
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
                        <div className="flex flex-wrap gap-2 px-1 items-center">
                          <div className="flex-1 flex gap-1 bg-bg border border-border-dim rounded-xl p-2 overflow-x-auto">
                            {CATEGORY_ICONS.map((iconSlug) => (
                              <button
                                key={iconSlug}
                                type="button"
                                onClick={() => setSelectedIcon(iconSlug)}
                                className={cn(
                                  "p-1.5 rounded-lg transition-all flex-shrink-0",
                                  selectedIcon === iconSlug ? "bg-accent text-white" : "text-text-muted hover:bg-card"
                                )}
                              >
                                <IconRenderer name={iconSlug} size={14} />
                              </button>
                            ))}
                          </div>
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
                          <div className="relative">
                            <input
                              type="color"
                              value={selectedColor}
                              onChange={(e) => setSelectedColor(e.target.value)}
                              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                            />
                            <div 
                              className={cn(
                                "w-6 h-6 rounded-full border-2 border-dashed border-text-muted/50 flex items-center justify-center hover:border-accent transition-all",
                                !CATEGORY_COLORS.includes(selectedColor) && "border-solid border-accent scale-110"
                              )}
                              style={{ backgroundColor: !CATEGORY_COLORS.includes(selectedColor) ? selectedColor : 'transparent' }}
                            >
                              <Plus size={10} className={cn(!CATEGORY_COLORS.includes(selectedColor) ? "text-white" : "text-text-muted")} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted">
                          <IconRenderer 
                            name={categories.find(c => c.name === formData.category)?.icon || 'Tag'} 
                            size={16} 
                          />
                        </div>
                        <select
                          value={formData.category}
                          onChange={(e) => setFormData({...formData, category: e.target.value})}
                          className="w-full pl-12 pr-6 py-4 bg-bg border border-border-dim rounded-2xl text-sm text-text-main font-bold focus:ring-2 focus:ring-accent outline-none transition-all appearance-none cursor-pointer"
                        >
                          {categories.map(c => (
                            <option key={c.id} value={c.name}>{c.name}</option>
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

