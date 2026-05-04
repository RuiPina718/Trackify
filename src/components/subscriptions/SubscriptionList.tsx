import { useState, useEffect } from 'react';
import { 
  MoreVertical, 
  Trash2, 
  Edit2, 
  Search,
  Filter,
  ExternalLink,
  ChevronRight,
  Download
} from 'lucide-react';
import { subscribeToUserSubscriptions, deleteSubscription, updateSubscription } from '../../services/subscriptionService';
import { Subscription, PREDEFINED_CATEGORIES } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { exportSubscriptionsToCSV } from '../../lib/exportUtils';
import { IconRenderer } from '../ui/IconRenderer';

interface SubscriptionListProps {
  userId: string;
  onEdit: (sub: Subscription) => void;
  currency?: string;
}

const getMonthName = (month: number) => {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return months[month - 1] || '';
};

export default function SubscriptionList({ userId, onEdit, currency = 'EUR' }: SubscriptionListProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const handleExport = () => {
    exportSubscriptionsToCSV(subscriptions);
  };

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
      {[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-card rounded-2xl animate-pulse" />)}
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

          <button 
            onClick={handleExport}
            className="p-3 bg-card border border-border-dim rounded-2xl text-text-muted hover:text-accent hover:border-accent transition-all group"
            title="Exportar CSV"
          >
            <Download size={18} className="group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-8">
        <AnimatePresence mode="popLayout">
          {filtered.length > 0 ? filtered.map((sub, idx) => (
            <motion.div
              layout
              key={sub.id}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: idx * 0.05 }}
              className={cn(
                "group relative bg-card border border-border-dim rounded-[3rem] p-10 hover:border-accent transition-all hover:shadow-2xl hover:shadow-accent/5",
                sub.status === 'cancelled' && "opacity-60 grayscale-[0.5]"
              )}
            >
              <div className="flex justify-between items-start mb-10">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-[2rem] bg-accent/5 border border-accent/10 flex items-center justify-center text-accent shadow-inner">
                    <IconRenderer 
                      name={sub.icon} 
                      size={28} 
                      className="group-hover:scale-110 transition-transform" 
                      fallback={<span className="text-3xl font-black">{sub.name.charAt(0)}</span>} 
                    />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-text-main tracking-tighter leading-none">{sub.name}</h3>
                    <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.2em] mt-2">{sub.category}</p>
                  </div>
                </div>
                <div className="flex bg-bg/50 rounded-2xl border border-border-dim/50 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                  <button 
                    onClick={() => onEdit(sub)}
                    className="p-2.5 text-text-muted hover:text-accent transition-colors"
                    title="Editar"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(sub.id)}
                    className="p-2.5 text-text-muted hover:text-red-500 transition-colors"
                    title="Remover"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="flex items-end justify-between mb-10">
                <div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] mb-1.5">Investimento</p>
                  <p className="text-3xl font-black text-text-main tracking-tight tabular-nums">
                    {formatCurrency(sub.amount, sub.currency || currency)}
                    <span className="text-xs text-text-muted ml-2 font-black uppercase tracking-widest opacity-50">/{sub.billingCycle === 'monthly' ? 'mês' : 'ano'}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] mb-1.5">Renovação</p>
                  <p className="text-sm font-black text-accent uppercase tracking-widest text-right">
                    Dia {sub.billingDay}
                    {(sub.billingCycle === 'yearly' || sub.billingCycle === 'annual') && sub.billingMonth && (
                      <span className="block text-[8px] opacity-70">
                        {getMonthName(sub.billingMonth)}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-border-dim/50">
                <div className="flex items-center gap-2.5">
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    sub.status === 'active' ? "bg-health shadow-[0_0_12px_rgba(34,197,94,0.4)]" : "bg-text-muted/30"
                  )}></div>
                  <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.25em]">
                    {sub.status === 'active' ? 'Ativa' : 'Pausada'}
                  </span>
                </div>
                
                <button
                  onClick={() => toggleStatus(sub)}
                  className={cn(
                    "text-[10px] font-black uppercase tracking-[0.2em] py-2.5 px-6 rounded-2xl border transition-all active:scale-95",
                    sub.status === 'active' ? "bg-bg border-border-dim text-text-muted hover:border-red-500 hover:text-red-500" : "bg-accent text-white border-accent hover:opacity-90"
                  )}
                >
                  {sub.status === 'active' ? 'Cancelar' : 'Reativar'}
                </button>
              </div>
            </motion.div>
          )) : (
            <div className="col-span-full py-32 bg-card border border-dashed border-border-dim rounded-[4rem] text-center flex flex-col items-center">
              <div className="w-20 h-20 bg-bg rounded-[2rem] flex items-center justify-center mb-6 border border-border-dim shadow-xl">
                <Search size={32} className="text-text-muted/40" />
              </div>
              <h3 className="text-xl font-black text-text-main tracking-tight">O horizonte está limpo</h3>
              <p className="text-text-muted text-xs font-bold uppercase tracking-widest mt-2 max-w-xs mx-auto leading-relaxed">
                Não encontrámos nenhuma subscrição com estes critérios. Tenta simplificar a tua pesquisa.
              </p>
              <button 
                onClick={() => { setSearch(''); setCategoryFilter('all'); }}
                className="mt-8 text-[10px] font-black text-accent uppercase tracking-[0.3em] hover:underline"
              >
                Limpar Filtros
              </button>
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
