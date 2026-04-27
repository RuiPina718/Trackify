import { useState, useEffect } from 'react';
import { 
  MoreVertical, 
  Trash2, 
  Edit2, 
  Search,
  Filter,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { subscribeToUserSubscriptions, deleteSubscription, updateSubscription } from '../../services/subscriptionService';
import { Subscription, PREDEFINED_CATEGORIES } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface SubscriptionListProps {
  userId: string;
  onEdit: (sub: Subscription) => void;
  currency?: string;
}

export default function SubscriptionList({ userId, onEdit, currency = 'EUR' }: SubscriptionListProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    const unsub = subscribeToUserSubscriptions(
      userId,
      (subs) => {
        setSubscriptions(subs);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [userId]);

  const filtered = subscriptions.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || s.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => b.amount - a.amount);

  const handleDelete = async (id: string) => {
    if (confirm('Tem a certeza que deseja remover esta subscrição?')) {
      await deleteSubscription(id);
    }
  };

  const toggleStatus = async (sub: Subscription) => {
    const nextStatus = sub.status === 'active' ? 'cancelled' : 'active';
    await updateSubscription(sub.id, { status: nextStatus });
  };

  if (loading) {
    return <div className="space-y-4">
      {[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
    </div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-text-main tracking-tighter">As Tuas Subscrições</h2>
          <p className="text-text-muted font-bold text-[10px] uppercase tracking-widest mt-1">Gere e monitoriza os teus serviços recorrentes</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent transition-colors" size={18} />
            <input
              type="text"
              placeholder="Pesquisar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 pr-4 py-3 bg-card border border-border-dim rounded-2xl text-sm focus:ring-2 focus:ring-accent outline-none text-text-main transition-all min-w-[240px] placeholder:text-text-muted/30"
            />
          </div>
          
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-3 bg-card border border-border-dim rounded-2xl text-sm focus:ring-2 focus:ring-accent outline-none text-text-main transition-all font-bold cursor-pointer"
          >
            <option value="all">Todas as Categorias</option>
            {PREDEFINED_CATEGORIES.map(cat => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filtered.length > 0 ? filtered.map((sub) => (
            <motion.div
              layout
              key={sub.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "group relative bg-card border border-border-dim rounded-[2.5rem] p-8 hover:border-accent transition-all hover:shadow-2xl hover:shadow-accent/5",
                sub.status === 'cancelled' && "opacity-60 bg-bg"
              )}
            >
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-3xl bg-accent/5 border border-accent/10 flex items-center justify-center text-accent text-2xl font-black shadow-inner shadow-accent/5">
                    {sub.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-text-main tracking-tight">{sub.name}</h3>
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{sub.category}</p>
                  </div>
                </div>
                <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => onEdit(sub)}
                    className="p-2 text-text-muted hover:text-accent transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(sub.id)}
                    className="p-2 text-text-muted hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-bg border border-border-dim rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Preço</p>
                  <p className="text-lg font-black text-text-main">{formatCurrency(sub.amount, currency)}</p>
                </div>
                <div className="bg-bg border border-border-dim rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Cobrança</p>
                  <p className="text-lg font-black text-accent">Dia {sub.billingDay}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border-dim">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    sub.status === 'active' ? "bg-health shadow-[0_0_8px_rgba(74,222,128,0.5)]" : "bg-text-muted"
                  )}></div>
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    {sub.status === 'active' ? 'Ativa' : 'Cancelada'}
                  </span>
                </div>
                
                <button
                  onClick={() => toggleStatus(sub)}
                  className="text-[10px] font-black uppercase tracking-widest py-2 px-4 rounded-xl border border-border-dim hover:border-accent hover:text-accent transition-all"
                >
                  {sub.status === 'active' ? 'Cancelar' : 'Reativar'}
                </button>
              </div>
            </motion.div>
          )) : (
            <div className="col-span-full py-20 bg-card border border-dashed border-border-dim rounded-[3rem] text-center">
              <div className="w-16 h-16 bg-bg rounded-3xl flex items-center justify-center mx-auto mb-4 border border-border-dim">
                <Search size={24} className="text-text-muted" />
              </div>
              <p className="text-text-main font-bold">Nenhuma subscrição encontrada</p>
              <p className="text-text-muted text-sm mt-1">Tenta ajustar os teus filtros ou pesquisa.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function IterationIcon({ cycle }: { cycle: string }) {
  return cycle === 'monthly' ? <Filter size={12} className="rotate-90" /> : <ChevronRight size={12} />;
}
