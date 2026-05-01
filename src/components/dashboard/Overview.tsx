import { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar as CalendarIcon, 
  AlertCircle,
  Clock,
  ArrowRight,
  CreditCard
} from 'lucide-react';
import { subscribeToUserSubscriptions } from '../../services/subscriptionService';
import { Subscription, UserProfile } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { format, addDays } from 'date-fns';
import { pt } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { IconRenderer } from '../ui/IconRenderer';

interface DashboardProps {
  userId: string;
  userProfile: UserProfile | null;
}

export default function Dashboard({ userId, userProfile }: DashboardProps) {
  const currency = userProfile?.currency || 'EUR';
  const notifications = userProfile?.notifications;
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
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
      const nextDate = new Date(today.getFullYear(), today.getMonth(), s.billingDay);
      if (nextDate < today) nextDate.setMonth(nextDate.getMonth() + 1);
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
      {/* Urgent Alerts Banner */}
      <AnimatePresence>
        {urgentAlerts.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-accent/10 border border-accent/20 p-6 rounded-[2.5rem] flex items-center justify-between group overflow-hidden relative"
          >
            <div className="absolute top-0 right-0 w-32 h-full bg-accent/5 -skew-x-12 translate-x-12 pointer-events-none" />
            <div className="flex items-center gap-5 relative z-10">
              <div className="w-12 h-12 bg-accent rounded-2xl flex items-center justify-center text-white shadow-xl shadow-accent/30">
                <AlertCircle size={22} className="animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-black text-text-main tracking-tight">Pagamentos em Breve</h4>
                <p className="text-[10px] text-accent font-black uppercase tracking-widest mt-0.5">
                  Tens {urgentAlerts.length} {urgentAlerts.length === 1 ? 'cobrança' : 'cobranças'} nos próximos {notifications?.reminderDays || 3} dias
                </p>
              </div>
            </div>
            <div className="flex gap-3 relative z-10">
              <div className="flex -space-x-3">
                {urgentAlerts.slice(0, 3).map(s => (
                  <div key={s.id} title={s.name} className="w-10 h-10 rounded-xl bg-card border-2 border-accent/20 flex items-center justify-center text-accent shadow-sm">
                    <IconRenderer name={s.icon} size={18} fallback={<span className="font-black text-[10px]">{s.name.charAt(0)}</span>} />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bento Layout Grid with Staggered Entrance */}
      <motion.div 
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.05 } }
        }}
        className="grid grid-cols-12 grid-rows-10 gap-5 lg:h-[750px]"
      >
        {/* Main Stat Card - Monthly Expense */}
        <motion.div 
          variants={{
            hidden: { opacity: 0, scale: 0.95 },
            visible: { opacity: 1, scale: 1 }
          }}
          className="col-span-12 md:col-span-8 row-span-4 bg-accent rounded-[3rem] p-10 flex flex-col justify-between group relative overflow-hidden shadow-2xl shadow-accent/20"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-white/10 transition-colors" />
          
          <div className="relative z-10">
            <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em] mb-2">Despesa Mensal Estimada</p>
            <h3 className="text-6xl font-black text-white tracking-tighter tabular-nums drop-shadow-sm">
              {formatCurrency(stats.monthlyTotal, currency)}
            </h3>
          </div>

          <div className="relative z-10 flex items-center justify-between bg-white/10 backdrop-blur-md p-4 rounded-3xl border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <CreditCard size={14} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black text-white uppercase tracking-widest">{stats.activeCount} Subscrições Ativas</p>
                <p className="text-[9px] text-white/60 font-bold uppercase mt-0.5">Renovações Mensais</p>
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
          className="col-span-12 md:col-span-4 row-span-4 bg-card rounded-[3rem] border border-border-dim p-8 flex flex-col justify-between group hover:border-accent transition-all shadow-xl shadow-bg"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em]">Orçamento Mensal</p>
              {userProfile?.monthlyBudget && (
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-widest",
                  stats.monthlyTotal > userProfile.monthlyBudget ? "text-red-500" : "text-health"
                )}>
                  {Math.round((stats.monthlyTotal / userProfile.monthlyBudget) * 100)}%
                </span>
              )}
            </div>
            
            {userProfile?.monthlyBudget ? (
              <div className="space-y-4">
                <h3 className="text-3xl font-black text-text-main tracking-tight tabular-nums">
                  {formatCurrency(userProfile.monthlyBudget - stats.monthlyTotal, currency)}
                  <span className="text-[10px] text-text-muted ml-2 font-black uppercase tracking-widest opacity-50">Restantes</span>
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
                <p className="text-[9px] text-text-muted font-bold uppercase tracking-[0.1em]">
                  Total Faturado: {formatCurrency(stats.monthlyTotal, currency)}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-text-main tracking-tight opacity-50">Sem Orçamento</h3>
                <p className="text-[10px] text-text-muted font-bold uppercase leading-relaxed">
                  Define um limite mensal nas <span className="text-accent underline">definições</span> para monitorizares as tuas poupanças.
                </p>
              </div>
            )}
          </div>
          
          <div className="pt-6 border-t border-border-dim/50">
            <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] mb-2">Projeção Anual</p>
            <p className="text-xl font-black text-text-main tracking-tight tabular-nums">
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
          className="col-span-12 md:col-span-5 row-span-6 bg-card rounded-[3rem] border border-border-dim p-8 flex flex-col group hover:border-accent transition-all shadow-xl shadow-bg"
        >
          <div className="flex items-center justify-between mb-8">
            <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em]">Distribuição</p>
            <TrendingUp size={18} className="text-text-muted group-hover:text-accent transition-colors" />
          </div>
          
          <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {stats.categories.map((cat, i) => (
              <div key={cat.name} className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[11px] font-black text-text-main uppercase tracking-widest">{cat.name}</span>
                  <span className="text-[11px] font-black text-text-muted tabular-nums">{formatCurrency(cat.value, currency)}</span>
                </div>
                <div className="h-3 bg-bg rounded-full overflow-hidden border border-border-dim/50">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(cat.value / stats.monthlyTotal) * 100}%` }}
                    transition={{ delay: 0.8 + (i * 0.1) }}
                    className="h-full bg-accent rounded-full shadow-lg shadow-accent/20"
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Saving Insights Big Card */}
        <motion.div 
          variants={{
            hidden: { opacity: 0, scale: 0.95 },
            visible: { opacity: 1, scale: 1 }
          }}
          className="col-span-12 md:col-span-7 row-span-6 bg-bg rounded-[3rem] border border-border-dim p-10 flex flex-col group hover:border-accent transition-all shadow-xl shadow-bg"
        >
          <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] mb-10">Insights Inteligentes</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 flex-1">
            {insights.length > 0 ? insights.map((insight, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "p-6 rounded-[2rem] flex gap-5 items-start border transition-all hover:scale-[1.02]",
                  insight.type === 'warning' ? "bg-red-500/5 border-red-500/10" : "bg-accent/5 border-accent/10"
                )}
              >
                <div className="text-3xl filter grayscale group-hover:grayscale-0 transition-all">{insight.icon}</div>
                <div>
                  <p className={cn(
                    "text-xs font-black mb-1.5 uppercase tracking-widest",
                    insight.type === 'warning' ? "text-red-500" : "text-accent"
                  )}>{insight.title}</p>
                  <p className="text-[10px] text-text-muted font-bold leading-relaxed uppercase tracking-wider">{insight.description}</p>
                </div>
              </div>
            )) : (
              <div className="col-span-2 flex flex-col items-center justify-center py-12 text-center bg-bg border border-dashed border-border-dim rounded-[2rem]">
                <div className="w-16 h-16 bg-accent/5 rounded-full flex items-center justify-center mb-4">
                  <span className="text-3xl">⭐</span>
                </div>
                <p className="text-xs font-black text-text-main tracking-tight uppercase">Nada a melhorar por agora!</p>
                <p className="text-[9px] text-text-muted font-black uppercase mt-2 tracking-[0.2em] opacity-60">As tuas finanças parecem otimizadas.</p>
              </div>
            )}
          </div>
          <div className="mt-auto pt-10 flex justify-center">
            <button className="bg-accent hover:bg-accent/90 text-white px-10 py-4 rounded-2xl text-[10px] font-black tracking-[0.25em] transition-all shadow-2xl shadow-accent/30 uppercase active:scale-95">
              Refinar Sugestões
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
