import { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar as CalendarIcon, 
  AlertCircle,
  Clock,
  ArrowRight,
  CreditCard,
  SlidersHorizontal
} from 'lucide-react';
import { subscribeToUserSubscriptions } from '../../services/subscriptionService';
import { Subscription, UserProfile } from '../../types';
import { useUnifiedCategories } from '../../hooks/useUnifiedCategories';
import { formatCurrency, cn } from '../../lib/utils';
import { format, addDays } from 'date-fns';
import { pt } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { IconRenderer } from '../ui/IconRenderer';

interface DashboardProps {
  userId: string;
  userProfile: UserProfile | null;
  onNavigate?: (view: any, tab?: string) => void;
}

export default function Dashboard({ userId, userProfile, onNavigate }: DashboardProps) {
  const currency = userProfile?.currency || 'EUR';
  const notifications = userProfile?.notifications;
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const { categories: unifiedCategories } = useUnifiedCategories(userId);
  const [loading, setLoading] = useState(true);

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

  const stats = useMemo(() => {
    const active = subscriptions.filter(s => s.status === 'active');
    const monthlyTotal = active.reduce((acc, s) => {
      return acc + (s.billingCycle === 'monthly' ? s.amount : s.amount / 12);
    }, 0);
    
    const yearlyTotal = monthlyTotal * 12;
    
    // Categories breakdown
    const categories: Record<string, number> = {};
    active.forEach(s => {
      categories[s.category] = (categories[s.category] || 0) + (s.billingCycle === 'monthly' ? s.amount : s.amount / 12);
    });

    const sortedCategories = Object.entries(categories)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }));

    // Upcoming payments (next 7 days)
    const today = new Date();
    const upcoming = active.map(s => {
      let nextDate: Date;
      
      if (s.billingCycle === 'yearly' || s.billingCycle === 'annual') {
        const month = (s.billingMonth || 1) - 1;
        nextDate = new Date(today.getFullYear(), month, s.billingDay);
        if (nextDate < today) nextDate.setFullYear(today.getFullYear() + 1);
      } else {
        nextDate = new Date(today.getFullYear(), today.getMonth(), s.billingDay);
        if (nextDate < today) nextDate.setMonth(nextDate.getMonth() + 1);
      }
      
      return { ...s, nextDate };
    }).sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime())
      .filter(s => s.nextDate < addDays(today, 7));

    return {
      monthlyTotal,
      yearlyTotal,
      activeCount: active.length,
      categories: sortedCategories,
      upcoming,
      active
    };
  }, [subscriptions]);

  const insights = useMemo(() => {
    const list = [];
    const activeSubs = stats.active;
    
    // Insight: High Streaming cost
    const streamingData = stats.categories.find(c => c.name === 'Streaming');
    if (streamingData && streamingData.value > stats.monthlyTotal * 0.25) {
      list.push({
        type: 'warning',
        title: 'Gastos em Streaming',
        description: `Estás a gastar ${Math.round((streamingData.value / stats.monthlyTotal) * 100)}% em entretenimento. Considera cancelar serviços que não usas diariamente.`,
        icon: '💡'
      });
    }

    // Insight: Monthly vs Yearly potential
    const monthlySubs = activeSubs.filter(s => s.billingCycle === 'monthly');
    if (monthlySubs.length >= 3) {
      list.push({
        type: 'info',
        title: 'Pode Poupar Mais',
        description: `Tens ${monthlySubs.length} subscrições mensais. Mudar para planos anuais pode reduzir os custos em até 20%.`,
        icon: '⚡'
      });
    }

    // Insight: "Inactive" (Simulated based on creation date > 6 months)
    const oldSubs = activeSubs.filter(s => {
      const createdDate = new Date(s.createdAt);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      return createdDate < sixMonthsAgo;
    });

    if (oldSubs.length > 0) {
      list.push({
        type: 'suggestion',
        title: 'Revisão de Veteranos',
        description: `Tens ${oldSubs.length} subscrições com mais de 6 meses (ex: ${oldSubs[0].name}). Costumas usá-las todas?`,
        icon: '🔍'
      });
    }

    // Insight: Budget Alert
    if (userProfile?.monthlyBudget && stats.monthlyTotal > userProfile.monthlyBudget) {
      list.push({
        type: 'warning',
        title: 'Orçamento Excedido',
        description: `Ultrapassaste o teu limite mensal em ${formatCurrency(stats.monthlyTotal - userProfile.monthlyBudget, currency)}.`,
        icon: '⚠️'
      });
    }

    return list.slice(0, 2); // Show top 2 insights
  }, [stats]);

  const urgentAlerts = useMemo(() => {
    if (!notifications?.billingReminders) return [];
    
    const today = new Date();
    const reminderDays = notifications.reminderDays || 3;
    
    return stats.upcoming.filter(s => {
      const diffTime = s.nextDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= reminderDays;
    });
  }, [stats.upcoming, notifications]);

  if (loading) {
    return <div className="animate-pulse space-y-8">
      <div className="grid grid-cols-4 gap-6">
        {[1,2,3,4].map(i => <div key={i} className="h-32 bg-card rounded-3xl" />)}
      </div>
      <div className="h-96 bg-card rounded-3xl" />
    </div>;
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header Greeting */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-accent overflow-hidden border-2 border-accent shadow-xl flex items-center justify-center text-white shrink-0">
             {userProfile?.photoURL ? (
                <img src={userProfile.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
             ) : (
                <span className="text-2xl font-black">{(userProfile?.displayName || 'U').charAt(0).toUpperCase()}</span>
             )}
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-text-main tracking-tighter">Olá, {userProfile?.displayName ? userProfile.displayName.split(' ')[0] : 'Utilizador'}! 👋</h1>
            <p className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] mt-1">Tens tudo sob controlo para este mês.</p>
          </div>
        </div>
        <button 
          onClick={() => onNavigate?.('settings')}
          className="hidden sm:flex items-center gap-2 px-4 py-2 bg-card border border-border-dim rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-accent transition-all"
        >
          <SlidersHorizontal size={14} />
          Configurar
        </button>
      </div>

      {/* Bento Layout Grid with Staggered Entrance */}
      <motion.div 
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.05 } }
        }}
        className="grid grid-cols-1 md:grid-cols-12 gap-5"
      >
        {/* Main Stat Card - Monthly Expense */}
        <motion.div 
          variants={{
            hidden: { opacity: 0, scale: 0.95 },
            visible: { opacity: 1, scale: 1 }
          }}
          className="col-span-1 md:col-span-12 lg:col-span-8 min-h-[300px] bg-accent rounded-[2.5rem] sm:rounded-[3rem] p-6 sm:p-10 flex flex-col justify-between group relative overflow-hidden shadow-2xl shadow-accent/20"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-white/10 transition-colors" />
          
          <div className="relative z-10">
            <p className="text-[11px] font-black text-white/50 uppercase tracking-[0.3em] mb-2 sm:mb-4">Despesa Mensal Estimada</p>
            <h3 className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tighter tabular-nums drop-shadow-sm">
              {formatCurrency(stats.monthlyTotal, currency)}
            </h3>
          </div>

          <div 
            onClick={() => onNavigate?.('subscriptions')}
            className="relative z-10 flex items-center justify-between bg-white/10 backdrop-blur-md p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-white/10 mt-8 cursor-pointer hover:bg-white/20 transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <CreditCard size={14} className="text-white sm:size-4" />
              </div>
              <div>
                <p className="text-[11px] font-black text-white uppercase tracking-widest">{stats.activeCount} Subscrições Ativas</p>
                <p className="text-[10px] text-white/60 font-black uppercase mt-0.5 opacity-80 tracking-wider">Renovações Mensais</p>
              </div>
            </div>
            <ArrowRight size={20} className="text-white/40 group-hover:text-white transition-all transform group-hover:translate-x-1" />
          </div>
        </motion.div>

        {/* Monthly Budget & Annual Projection Card */}
        <motion.div 
          variants={{
            hidden: { opacity: 0, scale: 0.95 },
            visible: { opacity: 1, scale: 1 }
          }}
          className="col-span-1 md:col-span-6 lg:col-span-4 bg-card rounded-[2.5rem] sm:rounded-[3rem] border border-border-dim p-6 sm:p-8 flex flex-col justify-between group hover:border-accent transition-all shadow-xl shadow-bg min-h-[250px]"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.3em]">Orçamento Mensal</p>
                <button 
                  onClick={() => onNavigate?.('settings', 'preferences')}
                  className="p-1 hover:bg-bg rounded-md text-text-muted hover:text-accent transition-colors"
                  title="Editar Orçamento"
                >
                  <SlidersHorizontal size={12} />
                </button>
              </div>
              {userProfile?.monthlyBudget && (
                <span className={cn(
                  "text-[11px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-bg border border-border-dim",
                  stats.monthlyTotal > userProfile.monthlyBudget ? "text-red-500 border-red-500/20" : "text-health border-health/20"
                )}>
                  {Math.round((stats.monthlyTotal / userProfile.monthlyBudget) * 100)}%
                </span>
              )}
            </div>
            
            {userProfile?.monthlyBudget ? (
              <div className="space-y-4">
                <h3 className="text-2xl sm:text-3xl font-black text-text-main tracking-tight tabular-nums truncate">
                  {formatCurrency(userProfile.monthlyBudget - stats.monthlyTotal, currency)}
                  <span className="text-[11px] text-text-muted ml-2 font-black uppercase tracking-widest opacity-50 block sm:inline">Restantes</span>
                </h3>
                <div className="h-3 bg-bg rounded-full overflow-hidden border border-border-dim/50">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((stats.monthlyTotal / userProfile.monthlyBudget) * 100, 100)}%` }}
                    className={cn(
                      "h-full rounded-full transition-all duration-1000",
                      stats.monthlyTotal > userProfile.monthlyBudget ? "bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]" : "bg-health shadow-[0_0_15px_rgba(34,197,94,0.4)]"
                    )}
                  />
                </div>
                <p className="text-[10px] text-text-muted font-black uppercase tracking-[0.1em] opacity-70">
                  Total Faturado: {formatCurrency(stats.monthlyTotal, currency)}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="text-xl sm:text-2xl font-black text-text-main tracking-tight opacity-40">Sem Orçamento</h3>
                <p className="text-[10px] sm:text-[11px] text-text-muted font-black uppercase leading-relaxed tracking-wider">
                  Define um limite mensal nas <span onClick={() => onNavigate?.('settings', 'preferences')} className="text-accent underline cursor-pointer">definições</span> para monitorizares as tuas finanças.
                </p>
              </div>
            )}
          </div>
          
          <div className="pt-6 border-t border-border-dim/50">
            <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.3em] mb-2">Projeção Anual</p>
            <p className="text-xl sm:text-2xl font-black text-text-main tracking-tight tabular-nums">
              {formatCurrency(stats.yearlyTotal, currency)}
            </p>
          </div>
        </motion.div>

        {/* Category Breakdown Card */}
        <motion.div 
          variants={{
            hidden: { opacity: 0, scale: 0.95 },
            visible: { opacity: 1, scale: 1 }
          }}
          className="col-span-1 md:col-span-6 lg:col-span-5 bg-card rounded-[2.5rem] sm:rounded-[3rem] border border-border-dim p-6 sm:p-8 flex flex-col group hover:border-accent transition-all shadow-xl shadow-bg min-h-[350px]"
        >
          <div className="flex items-center justify-between mb-8">
            <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.3em]">Distribuição por Categoria</p>
            <TrendingUp size={18} className="text-text-muted group-hover:text-accent transition-colors" />
          </div>
          
          <div className="space-y-6 flex-1 pr-1">
            {stats.categories.map((cat, i) => {
              const categoryDetails = unifiedCategories.find(c => c.name === cat.name);
              return (
                <div key={cat.name} className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <div className="flex items-center gap-2 mr-4 min-w-0">
                      <div 
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: categoryDetails?.color || 'var(--color-accent)' }}
                      >
                        <IconRenderer name={categoryDetails?.icon} size={12} />
                      </div>
                      <span className="text-[11px] font-black text-text-main uppercase tracking-widest truncate">{cat.name}</span>
                    </div>
                    <span className="text-[11px] font-black text-text-muted tabular-nums whitespace-nowrap">{formatCurrency(cat.value, currency)}</span>
                  </div>
                  <div className="h-3 bg-bg rounded-full overflow-hidden border border-border-dim/50 ml-8">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(cat.value / stats.monthlyTotal) * 100}%` }}
                      transition={{ delay: 0.5 + (i * 0.1) }}
                      className="h-full rounded-full shadow-sm"
                      style={{ 
                        backgroundColor: categoryDetails?.color || 'var(--color-accent)',
                        boxShadow: `0 0 10px ${categoryDetails?.color}40` 
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Saving Insights Big Card */}
        <motion.div 
          variants={{
            hidden: { opacity: 0, scale: 0.95 },
            visible: { opacity: 1, scale: 1 }
          }}
          className="col-span-1 md:col-span-12 lg:col-span-7 bg-bg rounded-[2.5rem] sm:rounded-[3rem] border border-border-dim p-6 sm:p-10 flex flex-col group hover:border-accent transition-all shadow-xl shadow-bg min-h-[350px]"
        >
          <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.3em] mb-8 sm:mb-10">Insights Inteligentes</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {insights.length > 0 ? insights.map((insight, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "p-5 sm:p-6 rounded-[2rem] flex gap-4 sm:gap-5 items-start border transition-all hover:scale-[1.02]",
                  insight.type === 'warning' ? "bg-red-500/5 border-red-500/10" : "bg-accent/5 border-accent/10"
                )}
              >
                <div className="text-2xl sm:text-3xl filter grayscale group-hover:grayscale-0 transition-all">{insight.icon}</div>
                <div>
                  <p className={cn(
                    "text-xs font-black mb-1.5 uppercase tracking-widest",
                    insight.type === 'warning' ? "text-red-500" : "text-accent"
                  )}>{insight.title}</p>
                  <p className="text-[11px] text-text-muted font-black uppercase leading-relaxed tracking-wider opacity-70">{insight.description}</p>
                </div>
              </div>
            )) : (
              <div className="col-span-full flex flex-col items-center justify-center py-10 text-center bg-bg border border-dashed border-border-dim rounded-[2rem]">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-accent/5 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl sm:text-3xl">⭐</span>
                </div>
                <p className="text-xs font-black text-text-main tracking-tight uppercase">Nada a melhorar por agora!</p>
                <p className="text-[10px] text-text-muted font-black uppercase mt-2 tracking-[0.2em] opacity-60">As tuas finanças parecem otimizadas.</p>
              </div>
            )}
          </div>
          <div className="mt-8 sm:mt-10 pt-4 flex justify-center">
            <button className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-white px-8 sm:px-10 py-3.5 sm:py-4 rounded-2xl text-[10px] sm:text-[11px] font-black tracking-[0.25em] transition-all shadow-2xl shadow-accent/30 uppercase active:scale-95">
              Refinar Sugestões de IA
            </button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, trend, positive, description }: any) {
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-lg hover:shadow-black/5 transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-gray-50 rounded-2xl text-black group-hover:bg-black group-hover:text-white transition-all">
          <Icon size={20} />
        </div>
        {trend && (
          <span className={cn(
            "text-[10px] font-bold px-2 py-1 rounded-lg border",
            positive ? "bg-green-50 text-green-600 border-green-100" : "bg-red-50 text-red-600 border-red-100"
          )}>
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">{label}</p>
        <p className="text-2xl font-bold text-black tracking-tight">{value}</p>
        {description && <p className="text-[10px] text-gray-400 mt-1">{description}</p>}
      </div>
    </div>
  );
}
