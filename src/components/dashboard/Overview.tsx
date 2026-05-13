import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar as CalendarIcon, 
  AlertCircle,
  Clock,
  ArrowRight,
  CreditCard,
  SlidersHorizontal,
  Sparkles,
  Zap,
  Target
} from 'lucide-react';
import { subscribeToUserSubscriptions } from '../../services/subscriptionService';
import { generateAIInsights, AIInsight } from '../../services/geminiService';
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
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

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

  const generateAI = useCallback(async (subs: Subscription[]) => {
    if (subs.length === 0) return;
    setIsGenerating(true);
    try {
      const result = await generateAIInsights(subs, userProfile?.monthlyBudget);
      setAiInsights(result);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  }, [userProfile?.monthlyBudget]);

  useEffect(() => {
    if (!loading && subscriptions.length > 0) {
      generateAI(subscriptions);
    }
  }, [subscriptions.length, loading, generateAI]);

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
      active,
      fatigueScore: Math.min(active.length * 8 + (active.filter(s => s.billingCycle === 'monthly').length * 2), 100),
      potentialSavings: active.filter(s => s.billingCycle === 'monthly').reduce((acc, s) => acc + (s.amount * 0.15), 0)
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
    <div className="space-y-6 sm:space-y-8 pb-12">
      {/* Header Greeting */}
      <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-6 px-2">
        <div className="flex items-center gap-4 sm:gap-5 w-full">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-accent overflow-hidden border-2 border-accent shadow-xl flex items-center justify-center text-white shrink-0">
             {userProfile?.photoURL ? (
                <img src={userProfile.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
             ) : (
                <span className="text-xl sm:text-2xl font-black">{(userProfile?.displayName || 'U').charAt(0).toUpperCase()}</span>
             )}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-3xl font-black text-text-main tracking-tighter truncate">Olá, {userProfile?.displayName ? userProfile.displayName.split(' ')[0] : 'Utilizador'}! 👋</h1>
            <p className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] mt-0.5 truncate">Gestão ativa de subscrições</p>
          </div>
        </div>
        <button 
          onClick={() => onNavigate?.('settings')}
          className="flex items-center gap-2 px-4 py-2 bg-card border border-border-dim rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-accent transition-all w-full sm:w-auto justify-center"
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
        className="grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-6"
      >
        {/* Main Stat Card - Monthly Expense */}
        <motion.div 
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0 }
          }}
          className="col-span-1 md:col-span-12 lg:col-span-8 min-h-[280px] lg:min-h-[340px] bg-accent rounded-[2rem] lg:rounded-[3rem] p-6 lg:p-10 flex flex-col justify-between group relative overflow-hidden shadow-premium shadow-accent/20"
        >
          {/* Decorative gradients */}
          <div className="absolute -right-20 -top-20 w-64 lg:w-96 h-64 lg:h-96 bg-white/10 rounded-full blur-[100px] group-hover:bg-white/20 transition-all duration-700" />
          <div className="absolute -left-20 -bottom-20 w-48 lg:w-64 h-48 lg:h-64 bg-black/10 rounded-full blur-[80px]" />
          
          <div className="relative z-10">
            <p className="micro-label text-white/60 mb-2 lg:mb-4 ml-1">Despesa Mensal Estimada</p>
            <h3 className="text-4xl sm:text-6xl lg:text-8xl font-black text-white tracking-[-0.05em] tabular-nums font-display leading-[0.9]">
              {formatCurrency(stats.monthlyTotal, currency)}
            </h3>
          </div>

          <div 
            onClick={() => onNavigate?.('subscriptions')}
            className="relative z-10 flex items-center justify-between bg-white/10 lg:bg-white/5 backdrop-blur-2xl p-4 lg:p-6 rounded-2xl lg:rounded-[2rem] border border-white/10 mt-8 cursor-pointer hover:bg-white/10 transition-all active:scale-[0.98] group/item"
          >
            <div className="flex items-center gap-3 lg:gap-5">
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl bg-white/10 flex items-center justify-center border border-white/10 shadow-lg shrink-0">
                <CreditCard size={18} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="micro-label text-white/90 truncate">{stats.activeCount} Subscrições em curso</p>
                <p className="text-[10px] lg:text-sm text-white/50 font-bold mt-0.5 truncate">Controladas e otimizadas</p>
              </div>
            </div>
            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-white/10 flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-all transform group-hover/item:translate-x-1 shrink-0">
              <ArrowRight size={16} className="text-white" />
            </div>
          </div>
        </motion.div>

        {/* Monthly Budget & Annual Projection Card */}
        <motion.div 
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0 }
          }}
          className="col-span-1 md:col-span-6 lg:col-span-4 bg-card rounded-[2rem] lg:rounded-[3rem] border border-border-dim p-6 lg:p-10 flex flex-col justify-between group hover:border-accent transition-all duration-500 shadow-premium"
        >
          <div>
            <div className="flex items-center justify-between mb-6 lg:mb-8">
              <div className="flex items-center gap-2">
                <p className="micro-label">Budget Mensal</p>
              </div>
              {userProfile?.monthlyBudget && (
                <div className="px-2.5 py-0.5 rounded-full bg-accent/5 border border-accent/10">
                  <span className="text-[9px] font-black text-accent uppercase tracking-widest">
                    {Math.round((stats.monthlyTotal / userProfile.monthlyBudget) * 100)}%
                  </span>
                </div>
              )}
            </div>
            
            {userProfile?.monthlyBudget ? (
              <div className="space-y-4 lg:space-y-6">
                <h3 className="text-3xl lg:text-4xl font-black text-text-main tracking-tight tabular-nums font-display">
                  {formatCurrency(userProfile.monthlyBudget - stats.monthlyTotal, currency)}
                  <span className="block text-[10px] text-text-muted mt-2 font-black uppercase tracking-[0.2em] opacity-50">Disponível</span>
                </h3>
                <div className="h-3 lg:h-4 bg-bg rounded-full overflow-hidden border border-border-dim/50 p-0.5 lg:p-1">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((stats.monthlyTotal / userProfile.monthlyBudget) * 100, 100)}%` }}
                    className={cn(
                      "h-full rounded-full transition-all duration-1000 shadow-lg",
                      stats.monthlyTotal > userProfile.monthlyBudget ? "bg-red-500 shadow-red-500/20" : "bg-accent shadow-accent/20"
                    )}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="text-xl lg:text-2xl font-black text-text-main tracking-tight opacity-20 font-display">Sem Limite</h3>
                <p className="text-[10px] normal-case text-text-muted font-semibold leading-relaxed">
                  Define um budget mensal nas definições para veres o teu aproveitamento real.
                </p>
              </div>
            )}
          </div>
          
          <div className="pt-6 lg:pt-8 border-t border-border-dim/50 mt-8">
            <p className="micro-label mb-1">Projeção Anual</p>
            <p className="text-2xl lg:text-3xl font-black text-text-main tracking-tighter tabular-nums font-display">
              {formatCurrency(stats.yearlyTotal, currency)}
            </p>
          </div>
        </motion.div>

        {/* Category Breakdown Card */}
        <motion.div 
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0 }
          }}
          className="col-span-1 md:col-span-6 lg:col-span-5 bg-card rounded-[2rem] lg:rounded-[3rem] border border-border-dim p-6 lg:p-10 flex flex-col group hover:border-accent transition-all duration-500 shadow-premium"
        >
          <div className="flex items-center justify-between mb-8 lg:mb-10">
            <p className="micro-label">Categorias principais</p>
            <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-accent/5 flex items-center justify-center text-accent">
               <TrendingUp size={16} />
            </div>
          </div>
          
          <div className="space-y-6 lg:space-y-8 flex-1">
            {stats.categories.slice(0, 5).map((cat, i) => {
              const categoryDetails = unifiedCategories.find(c => c.name === cat.name);
              return (
                <div key={cat.name} className="space-y-2 lg:space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3 lg:gap-4">
                      <div 
                        className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl lg:rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0"
                        style={{ 
                          backgroundColor: categoryDetails?.color || 'var(--color-accent)',
                          boxShadow: `0 8px 16px ${categoryDetails?.color}40`
                        }}
                      >
                        <IconRenderer name={categoryDetails?.icon} size={14} />
                      </div>
                      <span className="text-[10px] lg:text-xs font-bold text-text-main uppercase tracking-widest truncate">{cat.name}</span>
                    </div>
                    <span className="text-[10px] lg:text-xs font-black text-text-main tabular-nums ml-2">{formatCurrency(cat.value, currency)}</span>
                  </div>
                  <div className="h-1.5 lg:h-2 bg-bg rounded-full overflow-hidden border border-border-dim/50 ml-11 lg:ml-14">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(cat.value / stats.monthlyTotal) * 100}%` }}
                      transition={{ delay: 0.5 + (i * 0.1), duration: 1 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: categoryDetails?.color || 'var(--color-accent)' }}
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
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0 }
          }}
          className="col-span-1 md:col-span-12 lg:col-span-7 bg-card rounded-[2rem] lg:rounded-[3rem] border border-border-dim p-6 lg:p-10 flex flex-col group hover:border-accent transition-all duration-500 shadow-premium"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 lg:mb-10">
            <div className="flex items-center gap-3">
              <p className="micro-label">Insights Estratégicos</p>
              {isGenerating && (
                 <div className="flex gap-1">
                   <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1 h-1 bg-accent rounded-full" />
                   <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1 h-1 bg-accent rounded-full" />
                   <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1 h-1 bg-accent rounded-full" />
                 </div>
              )}
            </div>
            <div className="px-3 py-1 bg-accent/5 rounded-full border border-accent/20 flex items-center gap-2 self-start sm:self-center">
              <Sparkles size={10} className="text-accent" />
              <span className="text-[8px] lg:text-[9px] font-black text-accent uppercase tracking-widest">IA Trackify Ativa</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6 flex-1">
            {aiInsights.length > 0 ? aiInsights.map((insight, idx) => (
              <motion.div 
                key={idx} 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.1 }}
                className={cn(
                  "p-6 lg:p-8 rounded-2xl lg:rounded-[2rem] flex flex-col gap-4 lg:gap-6 border transition-all hover:-translate-y-1 duration-500 relative overflow-hidden",
                  insight.type === 'warning' ? "bg-red-500/5 border-red-500/10" : "bg-bg border-border-dim hover:border-accent/30"
                )}
              >
                {insight.score && (
                   <div className="absolute top-4 right-4 flex items-center gap-1">
                      <Zap size={10} className={cn(insight.score > 70 ? "text-accent" : "text-text-muted")} />
                      <span className="text-[8px] font-black opacity-30 tracking-widest">{insight.score}%</span>
                   </div>
                )}
                <div className="w-10 h-10 lg:w-14 lg:h-14 bg-bg rounded-xl lg:rounded-2xl flex items-center justify-center text-xl lg:text-3xl shadow-sm border border-border-dim group-hover:bg-accent group-hover:text-white transition-colors shrink-0">
                  {insight.icon}
                </div>
                <div className="min-w-0">
                  <p className={cn(
                    "text-[12px] lg:text-sm font-black mb-1 lg:mb-2 uppercase tracking-tight truncate",
                    insight.type === 'warning' ? "text-red-500" : "text-text-main"
                  )}>{insight.title}</p>
                  <p className="text-[10px] lg:text-[11px] text-text-muted font-bold leading-relaxed uppercase tracking-widest opacity-60 line-clamp-3">{insight.description}</p>
                </div>
              </motion.div>
            )) : (
              <div className="col-span-full flex flex-col items-center justify-center py-10 lg:py-16 text-center bg-bg/50 border border-dashed border-border-dim rounded-[2rem] lg:rounded-[2.5rem]">
                <div className="w-14 h-14 lg:w-20 lg:h-20 bg-accent/5 rounded-full flex items-center justify-center mb-6">
                  <span className="text-3xl lg:text-4xl animate-bounce">✨</span>
                </div>
                <p className="text-[12px] lg:text-sm font-black text-text-main uppercase tracking-widest">A aguardar dados...</p>
                <p className="text-[9px] lg:text-[10px] text-text-muted font-bold uppercase mt-2 tracking-[0.2em] opacity-40 px-6">Adiciona subscrições para ativar a análise inteligente.</p>
              </div>
            )}
          </div>

          {/* New indicators row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6 mt-8 lg:mt-10">
             <div className="p-5 lg:p-6 bg-bg border border-border-dim rounded-2xl lg:rounded-[2rem] flex items-center gap-4">
                <div className="w-10 h-10 lg:w-12 lg:h-12 bg-accent/10 rounded-xl lg:rounded-2xl flex items-center justify-center text-accent shrink-0">
                   <Target size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="micro-label mb-1">Fadiga Financeira</p>
                  <div className="flex items-center gap-2 lg:gap-3">
                    <p className="text-lg lg:text-xl font-black text-text-main font-display shrink-0">{stats.fatigueScore}%</p>
                    <div className="flex-1 h-1 lg:h-1.5 bg-border-dim rounded-full overflow-hidden">
                       <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${stats.fatigueScore}%` }}
                          className={cn("h-full", stats.fatigueScore > 70 ? "bg-red-500" : "bg-accent")}
                       />
                    </div>
                  </div>
                </div>
             </div>
             <div className="p-5 lg:p-6 bg-bg border border-border-dim rounded-2xl lg:rounded-[2rem] flex items-center gap-4">
                <div className="w-10 h-10 lg:w-12 lg:h-12 bg-health/10 rounded-xl lg:rounded-2xl flex items-center justify-center text-health shrink-0">
                   <TrendingDown size={18} />
                </div>
                <div className="min-w-0">
                  <p className="micro-label mb-1">Poupança Sugerida</p>
                   <p className="text-lg lg:text-xl font-black text-health font-display truncate">~{formatCurrency(stats.potentialSavings, currency)}<span className="text-[10px] opacity-40 ml-1">/mês</span></p>
                </div>
             </div>
          </div>

          <div className="mt-8 lg:mt-10 flex items-center justify-center">
            <button 
              disabled={isGenerating}
              onClick={() => generateAI(subscriptions)}
              className="group/btn relative w-full sm:w-auto px-6 lg:px-10 py-3.5 lg:py-4 bg-accent text-white rounded-xl lg:rounded-2xl text-[9px] lg:text-[10px] font-black tracking-[0.2em] lg:tracking-[0.3em] uppercase transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-accent/20 overflow-hidden disabled:opacity-50"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500" />
              <span className="relative z-10 flex items-center justify-center gap-2">
                {isGenerating ? 'A ANALISAR...' : 'RECALCULAR IA'}
              </span>
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
