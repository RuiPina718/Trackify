import { useState, useEffect } from 'react';
import { 
  MoreVertical, 
  Trash2, 
  Edit2, 
  Search,
  Filter,
  ExternalLink,
  ChevronRight,
  Download,
  ChevronDown
} from 'lucide-react';
import { subscribeToUserSubscriptions, deleteSubscription, updateSubscription } from '../../services/subscriptionService';
import { Subscription, PREDEFINED_CATEGORIES } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { exportSubscriptionsToCSV } from '../../lib/exportUtils';
import { useUnifiedCategories } from '../../hooks/useUnifiedCategories';
import { IconRenderer } from '../ui/IconRenderer';
import DeleteConfirmationModal from '../ui/DeleteConfirmationModal';

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
  const { categories } = useUnifiedCategories(userId);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cycleFilter, setCycleFilter] = useState('all');
  const [sortBy, setSortBy] = useState('amount-desc');
  const [showFilters, setShowFilters] = useState(false);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [subToDelete, setSubToDelete] = useState<Subscription | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchesCycle = cycleFilter === 'all' || s.billingCycle === cycleFilter;
    return matchesSearch && matchesCategory && matchesStatus && matchesCycle;
  }).sort((a, b) => {
    if (sortBy === 'amount-desc') return b.amount - a.amount;
    if (sortBy === 'amount-asc') return a.amount - b.amount;
    if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
    if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
    return 0;
  });

  const handleDeleteClick = (e: React.MouseEvent, sub: Subscription) => {
    e.preventDefault();
    e.stopPropagation();
    setSubToDelete(sub);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!subToDelete) return;
    
    setIsDeleting(true);
    try {
      console.log('A eliminar subscrição no Firestore:', subToDelete.id);
      await deleteSubscription(subToDelete.id, userId);
      console.log('Subscrição eliminada com sucesso');
      setIsDeleteModalOpen(false);
      setSubToDelete(null);
    } catch (error) {
      console.error('Erro ao eliminar subscrição:', error);
      alert('Não foi possível eliminar a subscrição. Por favor, tenta novamente.');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleStatus = async (sub: Subscription) => {
    const nextStatus = sub.status === 'active' ? 'cancelled' : 'active';
    await updateSubscription(sub.id, userId, { status: nextStatus });
  };

  if (loading) {
    return <div className="space-y-4">
      {[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-card rounded-2xl animate-pulse" />)}
    </div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-text-main tracking-tighter shrink-0">As Tuas Subscrições</h2>
          <p className="text-text-muted font-black text-[11px] uppercase tracking-widest mt-1 opacity-70">Gere e monitoriza os teus serviços recorrentes</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative group flex-1 sm:flex-none">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent transition-colors" size={18} />
            <input
              type="text"
              placeholder="Pesquisar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64 pl-11 pr-4 py-3 bg-card border border-border-dim rounded-2xl text-sm focus:ring-2 focus:ring-accent outline-none text-text-main transition-all placeholder:text-text-muted/30"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "p-3 rounded-2xl border transition-all flex items-center gap-2 text-xs font-black uppercase tracking-widest",
                showFilters ? "bg-accent border-accent text-white" : "bg-card border-border-dim text-text-muted hover:text-accent hover:border-accent"
              )}
            >
              <Filter size={18} />
              <span className="hidden sm:inline">Filtros</span>
            </button>

            <button 
              onClick={handleExport}
              className="p-3 bg-card border border-border-dim rounded-2xl text-text-muted hover:text-accent hover:border-accent transition-all group shrink-0"
              title="Exportar CSV"
            >
              <Download size={18} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-card border border-border-dim rounded-[2rem] shadow-sm">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">Categoria</label>
                <div className="relative">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-4 pr-10 py-3 bg-bg border border-border-dim rounded-xl text-xs focus:ring-2 focus:ring-accent outline-none text-text-main transition-all font-black uppercase tracking-widest cursor-pointer appearance-none"
                  >
                    <option value="all">TODAS</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name.toUpperCase()}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">Estado</label>
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-4 pr-10 py-3 bg-bg border border-border-dim rounded-xl text-xs focus:ring-2 focus:ring-accent outline-none text-text-main transition-all font-black uppercase tracking-widest cursor-pointer appearance-none"
                  >
                    <option value="all">TODOS</option>
                    <option value="active">ATIVAS</option>
                    <option value="cancelled">CANCELADAS</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">Ciclo</label>
                <div className="relative">
                  <select
                    value={cycleFilter}
                    onChange={(e) => setCycleFilter(e.target.value)}
                    className="w-full px-4 pr-10 py-3 bg-bg border border-border-dim rounded-xl text-xs focus:ring-2 focus:ring-accent outline-none text-text-main transition-all font-black uppercase tracking-widest cursor-pointer appearance-none"
                  >
                    <option value="all">TODOS</option>
                    <option value="monthly">MENSAL</option>
                    <option value="yearly">ANUAL</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">Ordenar por</label>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-4 pr-10 py-3 bg-bg border border-border-dim rounded-xl text-xs focus:ring-2 focus:ring-accent outline-none text-text-main transition-all font-black uppercase tracking-widest cursor-pointer appearance-none"
                  >
                    <option value="amount-desc">MAIOR PREÇO</option>
                    <option value="amount-asc">MENOR PREÇO</option>
                    <option value="name-asc">NOME (A-Z)</option>
                    <option value="name-desc">NOME (Z-A)</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-8">
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
                "group relative bg-card border border-border-dim rounded-[2rem] lg:rounded-[3rem] p-6 lg:p-10 hover:border-accent transition-all duration-500 hover:shadow-premium overflow-hidden",
                sub.status === 'cancelled' && "opacity-60 grayscale"
              )}
            >
              {/* Background accent glow */}
              <div className="absolute -right-20 -top-20 w-40 h-40 bg-accent/5 rounded-full blur-3xl group-hover:bg-accent/10 transition-colors duration-500" />

              <div className="flex justify-between items-start mb-6 lg:mb-10 relative z-10">
                <div className="flex items-center gap-4 lg:gap-6">
                  <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-2xl lg:rounded-[2rem] bg-accent/5 border border-accent/10 flex items-center justify-center text-accent shadow-inner group-hover:bg-accent group-hover:text-white transition-all duration-300 shrink-0">
                    <IconRenderer 
                      name={sub.icon || categories.find(c => c.name === sub.category)?.icon} 
                      size={24} 
                      className="transition-transform duration-500 group-hover:scale-110" 
                      fallback={<span className="text-xl lg:text-3xl font-black">{sub.name.charAt(0)}</span>} 
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl lg:text-2xl font-black text-text-main tracking-tight leading-tight mb-1 lg:mb-2 group-hover:text-accent transition-colors truncate">{sub.name}</h3>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 lg:w-2.5 h-2 lg:h-2.5 rounded-full" 
                        style={{ backgroundColor: categories.find(c => c.name === sub.category)?.color || '#94a3b8' }}
                      />
                      <p className="micro-label opacity-70 truncate">{sub.category}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6 lg:space-y-8 relative z-10">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="micro-label mb-2 lg:mb-3">Valor / Período</p>
                    <p className="text-3xl lg:text-4xl font-black text-text-main tracking-tighter tabular-nums font-display">
                      {formatCurrency(sub.amount, sub.currency || currency)}
                      <span className="text-[10px] text-text-muted ml-1.5 lg:ml-2 font-black uppercase tracking-widest opacity-40">/{sub.billingCycle === 'monthly' ? 'mês' : 'ano'}</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 py-4 lg:py-6 border-y border-border-dim/50">
                  <div>
                    <p className="micro-label mb-1">Próxima Cobrança</p>
                    <p className="text-xs lg:text-sm font-bold text-text-main uppercase tracking-tight">
                      Dia {sub.billingDay}
                      {(sub.billingCycle === 'yearly' || sub.billingCycle === 'annual') && sub.billingMonth && (
                        <span className="text-accent ml-1.5">
                          {getMonthName(sub.billingMonth).toUpperCase()}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="micro-label mb-1">Estado</p>
                    <div className="flex items-center justify-end gap-1.5 lg:gap-2">
                      <div className={cn(
                        "w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full animate-pulse",
                        sub.status === 'active' ? "bg-health" : "bg-text-muted/30"
                      )} />
                      <p className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest text-text-main">
                        {sub.status === 'active' ? 'Ativo' : 'Pausado'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 lg:gap-3">
                  <button 
                    onClick={() => onEdit(sub)}
                    className="flex-1 py-3 lg:py-3.5 bg-bg border border-border-dim rounded-xl lg:rounded-2xl text-[9px] lg:text-[10px] font-black text-text-main uppercase tracking-[0.2em] hover:border-accent hover:text-accent transition-all active:scale-[0.98]"
                  >
                    Editar
                  </button>
                  <button 
                    onClick={() => toggleStatus(sub)}
                    className={cn(
                      "flex-1 py-3 lg:py-3.5 rounded-xl lg:rounded-2xl text-[9px] lg:text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98] border",
                      sub.status === 'active' 
                        ? "bg-red-500/5 border-red-500/10 text-red-500 hover:bg-red-500 hover:text-white" 
                        : "bg-accent text-white border-accent hover:bg-accent/90"
                    )}
                  >
                    {sub.status === 'active' ? 'Pausar' : 'Ativar'}
                  </button>
                  <button 
                    onClick={(e) => handleDeleteClick(e, sub)}
                    className="p-3 lg:p-3.5 bg-bg border border-border-dim rounded-xl lg:rounded-2xl text-text-muted hover:text-red-500 hover:border-red-500 transition-all active:scale-[0.98]"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
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
                onClick={() => { setSearch(''); setCategoryFilter('all'); setStatusFilter('all'); setCycleFilter('all'); setSortBy('amount-desc'); }}
                className="mt-8 text-[10px] font-black text-accent uppercase tracking-[0.3em] hover:underline"
              >
                Limpar Filtros
              </button>
            </div>
          )}
        </AnimatePresence>
      </div>

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Eliminar Subscrição"
        itemName={subToDelete?.name || ''}
        loading={isDeleting}
      />
    </div>
  );
}

function IterationIcon({ cycle }: { cycle: string }) {
  return cycle === 'monthly' ? <Filter size={12} className="rotate-90" /> : <ChevronRight size={12} />;
}
