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
  Target,
  X,
  Layout
} from 'lucide-react';
import { subscribeToUserSubscriptions } from '../../services/subscriptionService';
import { generateAIInsights, AIInsight } from '../../services/geminiService';
import { Subscription, UserProfile, DashboardConfig } from '../../types';
import { useUnifiedCategories } from '../../hooks/useUnifiedCategories';
import { formatCurrency, cn } from '../../lib/utils';
import { format, addDays } from 'date-fns';
import { pt } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { IconRenderer } from '../ui/IconRenderer';
import { updateUserProfile } from '../../services/userService';

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
  const [showConfigModal, setShowConfigModal] = useState(false);

  const dashboardConfig = useMemo(() => {
    const defaultConfig: DashboardConfig = {
      sections: {
        monthlyExpense: true,
        budget: true,
        categories: true,
        insights: true,
        indicators: true,
        upcoming: true,
        topSpending: true,
        cycleBreakdown: true,
        calendar: true
      }
    };
    return userProfile?.dashboardConfig || defaultConfig;
  }, [userProfile?.dashboardConfig]);

  const toggleSection = async (section: keyof DashboardConfig['sections']) => {
    const newConfig = {
      ...dashboardConfig,
      sections: {
        ...dashboardConfig.sections,
        [section]: !dashboardConfig.sections[section]
      }
    };
    await updateUserProfile(userId, { dashboardConfig: newConfig });
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
      let amount = s.amount;
      if (s.billingCycle === 'yearly' || s.billingCycle === 'annual') {
        amount = s.amount / 12;
      } else if (s.billingCycle === 'weekly') {
        amount = s.amount * (52 / 12);
      } else if (s.billingCycle === 'biweekly') {
        amount = s.amount * (26 / 12);
      }
      return acc + amount;
    }, 0);
    
    const yearlyTotal = monthlyTotal * 12;
    
    // Categories breakdown
    const categories: Record<string, number> = {};
    active.forEach(s => {
      let amount = s.amount;
      if (s.billingCycle === 'yearly' || s.billingCycle === 'annual') {
        amount = s.amount / 12;
      } else if (s.billingCycle === 'weekly') {
        amount = s.amount * (52 / 12);
      } else if (s.billingCycle === 'biweekly') {
        amount = s.amount * (26 / 12);
      } else if (s.billingCycle === 'monthly') {
        amount = s.amount;
      }
      categories[s.category] = (categories[s.category] || 0) + amount;
    });

    const sortedCategories = Object.entries(categories)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }));

    // Upcoming payments (next 7 days)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const upcoming = active.map(s => {
      let nextDate: Date;
      
      if (s.billingCycle === 'yearly' || s.billingCycle === 'annual') {
        const month = (s.billingMonth || 1) - 1;
        nextDate = new Date(today.getFullYear(), month, s.billingDay);
        if (nextDate < today) nextDate.setFullYear(today.getFullYear() + 1);
      } else {
        nextDate = new Date(today.getFullYear(), today.getMonth(), s.billingDay);
        
        if (nextDate < today) {
          if (s.billingCycle === 'weekly') {
            while (nextDate < today) {
              nextDate.setDate(nextDate.getDate() + 7);
            }
          } else if (s.billingCycle === 'biweekly') {
            while (nextDate < today) {
              nextDate.setDate(nextDate.getDate() + 14);
            }
          } else {
            nextDate.setMonth(nextDate.getMonth() + 1);
          }
        }
      }
      
      return { ...s, nextDate };
    }).sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());

    const topSubscriptions = [...active].sort((a, b) => {
      const getMonthlyValue = (s: Subscription) => {
        if (s.billingCycle === 'yearly' || s.billingCycle === 'annual') return s.amount / 12;
        if (s.billingCycle === 'weekly') return s.amount * (52 / 12);
        if (s.billingCycle === 'biweekly') return s.amount * (26 / 12);
        return s.amount;
      };
      return getMonthlyValue(b) - getMonthlyValue(a);
    }).slice(0, 5);

    const cycleStats = {
      monthly: active.filter(s => s.billingCycle === 'monthly'),
      yearly: active.filter(s => s.billingCycle === 'yearly' || s.billingCycle === 'annual'),
      weekly: active.filter(s => s.billingCycle === 'weekly'),
      biweekly: active.filter(s => s.billingCycle === 'biweekly'),
      monthlyTotal: active.filter(s => s.billingCycle === 'monthly').reduce((acc, s) => acc + s.amount, 0),
      yearlyTotal: active.filter(s => s.billingCycle === 'yearly' || s.billingCycle === 'annual').reduce((acc, s) => acc + s.amount, 0)
    };

    const calendarMap: Record<number, number> = {};
    active.forEach(s => {
      calendarMap[s.billingDay] = (calendarMap[s.billingDay] || 0) + 1;
    });

    return {
      monthlyTotal,
      yearlyTotal,
      activeCount: active.length,
      categories: sortedCategories,
      upcoming: upcoming.filter(s => s.nextDate < addDays(today, 7)),
      allUpcoming: upcoming.slice(0, 10),
      topSubscriptions,
      cycleStats,
      calendarMap,
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
                <span className="text-xl sm:text-2xl font-bold">{(userProfile?.displayName || 'U').charAt(0).toUpperCase()}</span>
             )}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-3xl font-bold text-text-main tracking-tighter truncate">Olá, {userProfile?.displayName ? userProfile.displayName.split(' ')[0] : 'Utilizador'}! 👋</h1>
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-[0.2em] mt-0.5 truncate">Gestão ativa de subscrições</p>
          </div>
        </div>
        <button 
          onClick={() => setShowConfigModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-card border border-border-dim rounded-xl text-[10px] font-bold uppercase tracking-widest hover:border-accent transition-all w-full sm:w-auto justify-center"
        >
          <SlidersHorizontal size={14} />
          Personalizar
        </button>
      </div>

      {/* Config Modal */}
      <AnimatePresence>
        {showConfigModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfigModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-card border border-border-dim w-full max-w-md overflow-hidden rounded-[2.5rem] shadow-2xl"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                      <Layout size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-text-main tracking-tight uppercase leading-none">Personalizar Dashboard</h3>
                      <p className="text-[9px] text-text-muted font-bold uppercase tracking-widest mt-1">Gere o que queres visualizar</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowConfigModal(false)}
                    className="p-2 hover:bg-bg text-text-muted rounded-full transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  {[
                    { id: 'monthlyExpense', label: 'Despesa Mensal (Principal)', desc: 'Visualização da despesa total estimada' },
                    { id: 'budget', label: 'Budget & Projeção', desc: 'Progresso do limite mensal e propostas anuais' },
                    { id: 'categories', label: 'Distribuição por Categoria', desc: 'Gráficos de barras por tipo de serviço' },
                    { id: 'upcoming', label: 'Próximos Pagamentos', desc: 'O que vais pagar nos próximos dias' },
                    { id: 'topSpending', label: 'Top Subscrições', desc: 'As tuas subscrições mais caras' },
                    { id: 'cycleBreakdown', label: 'Ciclos de Faturação', desc: 'Resumo de Mensal vs Anual' },
                    { id: 'calendar', label: 'Calendário de Vencimentos', desc: 'Dias do mês com mais pagamentos' },
                    { id: 'insights', label: 'Insights de IA', desc: 'Sugestões geradas por inteligência artificial' },
                    { id: 'indicators', label: 'Indicadores de Performance', desc: 'Fadiga financeira e poupança sugerida' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => toggleSection(item.id as any)}
                      className={cn(
                        "w-full p-5 rounded-2xl border transition-all text-left flex items-center justify-between group",
                        dashboardConfig.sections[item.id as keyof typeof dashboardConfig.sections]
                          ? "bg-accent/5 border-accent/20"
                          : "bg-bg border-border-dim hover:border-text-muted/30"
                      )}
                    >
                      <div className="min-w-0">
                        <p className={cn(
                          "text-[10px] font-bold uppercase tracking-widest mb-1 transition-colors",
                          dashboardConfig.sections[item.id as keyof typeof dashboardConfig.sections] ? "text-accent" : "text-text-main"
                        )}>
                          {item.label}
                        </p>
                        <p className="text-[10px] text-text-muted font-bold normal-case opacity-60 leading-tight">
                          {item.desc}
                        </p>
                      </div>
                      <div className={cn(
                        "w-10 h-6 rounded-full relative transition-colors flex items-center px-1 shrink-0 ml-4",
                        dashboardConfig.sections[item.id as keyof typeof dashboardConfig.sections] ? "bg-accent" : "bg-border-dim"
                      )}>
                        <motion.div 
                          animate={{ x: dashboardConfig.sections[item.id as keyof typeof dashboardConfig.sections] ? 16 : 0 }}
                          className="w-4 h-4 bg-white rounded-full shadow-sm"
                        />
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-8 pt-8 border-t border-border-dim">
                  <button 
                    onClick={() => setShowConfigModal(false)}
                    className="w-full py-4 bg-accent text-white rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] shadow-xl shadow-accent/20 hover:bg-accent/90 transition-all active:scale-[0.98]"
                  >
                    Guardar Alterações
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bento Layout Grid with Staggered Entrance and Layout Animations */}
      <motion.div 
        layout
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.05 } }
        }}
        className="grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-6"
      >
        <AnimatePresence mode="popLayout">
          {/* Main Stat Card - Monthly Expense */}
          {dashboardConfig.sections.monthlyExpense && (
            <motion.div 
              layout
              key="monthlyExpense"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
              className={cn(
                "bg-accent rounded-3xl lg:rounded-[2rem] p-4 lg:p-5 flex flex-col justify-between group relative overflow-hidden shadow-premium shadow-accent/20",
                dashboardConfig.sections.budget ? "col-span-1 md:col-span-12 lg:col-span-6" : "col-span-1 md:col-span-12"
              )}
            >
              <div className="relative z-10">
                <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-white/50 mb-1 ml-0.5">Mensal Estimado</p>
                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tighter tabular-nums font-display leading-none">
                  {formatCurrency(stats.monthlyTotal, currency)}
                </h3>
              </div>

              <div 
                onClick={() => onNavigate?.('subscriptions')}
                className="relative z-10 flex items-center justify-between bg-white/10 backdrop-blur-md p-2 lg:p-3 rounded-xl border border-white/10 mt-4 cursor-pointer hover:bg-white/20 transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/10 shrink-0">
                    <CreditCard size={14} className="text-white" />
                  </div>
                  <p className="text-[10px] font-bold text-white/90 truncate uppercase tracking-widest">
                    {stats.activeCount} Ativos
                  </p>
                </div>
                <ArrowRight size={12} className="text-white/50" />
              </div>
            </motion.div>
          )}

          {/* Monthly Budget & Annual Projection Card */}
          {dashboardConfig.sections.budget && (
            <motion.div 
              layout
              key="budget"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
              className={cn(
                "bg-card rounded-3xl lg:rounded-[2rem] border border-border-dim p-4 lg:p-5 flex flex-col justify-between group hover:border-accent transition-all duration-500 shadow-premium",
                dashboardConfig.sections.monthlyExpense ? "col-span-1 md:col-span-12 lg:col-span-6" : "col-span-1 md:col-span-12"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-text-muted">Budget Disponível</p>
                {userProfile?.monthlyBudget && (
                  <span className="text-[8px] font-bold text-accent uppercase tracking-widest px-1.5 py-0.5 bg-accent/5 rounded-md border border-accent/10">
                    {Math.round((stats.monthlyTotal / userProfile.monthlyBudget) * 100)}%
                  </span>
                )}
              </div>
              
              {userProfile?.monthlyBudget ? (
                <div className="space-y-2">
                  <h3 className="text-2xl lg:text-3xl font-bold text-text-main tracking-tighter tabular-nums font-display leading-none">
                    {formatCurrency(userProfile.monthlyBudget - stats.monthlyTotal, currency)}
                  </h3>
                  <div className="h-1.5 bg-bg rounded-full overflow-hidden border border-border-dim/50">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((stats.monthlyTotal / userProfile.monthlyBudget) * 100, 100)}%` }}
                      className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        stats.monthlyTotal > userProfile.monthlyBudget ? "bg-red-500" : "bg-accent"
                      )}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-[9px] font-bold text-text-muted/40 uppercase tracking-widest">Sem budget definido</p>
              )}
              
              <div className="pt-3 border-t border-border-dim/50 mt-4 flex items-center justify-between">
                <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-text-muted">Projeção Anual</p>
                <p className="text-sm font-bold text-text-main tracking-tight tabular-nums">
                  {formatCurrency(stats.yearlyTotal, currency)}
                </p>
              </div>
            </motion.div>
          )}

          {/* Category Breakdown Card */}
          {dashboardConfig.sections.categories && (
            <motion.div 
              layout
              key="categories"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
              className={cn(
                "bg-card rounded-3xl lg:rounded-[2rem] border border-border-dim p-6 lg:p-8 flex flex-col group hover:border-accent transition-all duration-500 shadow-premium",
                !dashboardConfig.sections.upcoming ? "col-span-1 md:col-span-12" : "col-span-1 md:col-span-12 lg:col-span-6"
              )}
            >
              <div className="flex items-center justify-between mb-8 lg:mb-10">
                <p className="micro-label">Categorias principais</p>
                <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-accent/5 flex items-center justify-center text-accent">
                   <TrendingUp size={16} />
                </div>
              </div>
              
              <div className="space-y-6 lg:space-y-8 flex-1">
                {stats.categories.length > 0 ? stats.categories.slice(0, 5).map((cat, i) => {
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
                        <span className="text-[10px] lg:text-xs font-bold text-text-main tabular-nums ml-2">{formatCurrency(cat.value, currency)}</span>
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
                }) : (
                  <div className="h-full flex items-center justify-center opacity-30">
                    <p className="text-[10px] font-bold uppercase tracking-widest">Sem dados</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Upcoming Payments Widget */}
          {dashboardConfig.sections.upcoming && (
            <motion.div 
              layout
              key="upcoming"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
              className={cn(
                "bg-card rounded-3xl lg:rounded-[2rem] border border-border-dim p-6 lg:p-8 flex flex-col group hover:border-accent transition-all duration-500 shadow-premium",
                !dashboardConfig.sections.categories ? "col-span-1 md:col-span-12" : "col-span-1 md:col-span-12 lg:col-span-6"
              )}
            >
              <div className="flex items-center justify-between mb-8">
                <p className="micro-label">Próximos Pagamentos</p>
                <CalendarIcon size={16} className="text-accent opacity-50" />
              </div>
              <div className="space-y-4 flex-1">
                {stats.allUpcoming.length > 0 ? stats.allUpcoming.slice(0, 5).map((sub, i) => (
                  <div key={sub.id} className="flex items-center justify-between p-4 bg-bg rounded-2xl border border-border-dim/50 group-hover:border-accent/10 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-card border border-border-dim flex items-center justify-center text-accent">
                        <IconRenderer name={unifiedCategories.find(c => c.name === sub.category)?.icon} size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-text-main leading-none mb-1">{sub.name}</p>
                        <p className="text-[9px] text-text-muted font-bold uppercase tracking-widest">
                          {sub.nextDate.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-text-main">{formatCurrency(sub.amount, currency)}</p>
                      <p className="text-[9px] text-health font-bold uppercase tracking-widest">
                        {sub.nextDate.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
                      </p>
                    </div>
                  </div>
                )) : (
                  <div className="h-full flex items-center justify-center opacity-30">
                    <p className="text-[10px] font-bold uppercase tracking-widest">Nada agendado</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Top Spending Widget */}
          {dashboardConfig.sections.topSpending && (
            <motion.div 
              layout
              key="topSpending"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
              className={cn(
                "bg-card rounded-3xl lg:rounded-[2rem] border border-border-dim p-4 lg:p-5 flex flex-col group hover:border-accent transition-all duration-500 shadow-premium",
                !dashboardConfig.sections.cycleBreakdown ? "col-span-1 md:col-span-12" : "col-span-1 md:col-span-12 lg:col-span-6"
              )}
            >
              <div className="mb-4">
                <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-text-muted">Maiores Investimentos</p>
              </div>
              <div className="space-y-4">
                {stats.topSubscriptions.map((sub, i) => (
                  <div key={sub.id} className="space-y-1.5">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-bold text-text-main uppercase tracking-tight truncate max-w-[150px]">{sub.name}</span>
                      <span className="text-[10px] font-mono text-text-muted">{formatCurrency(sub.amount, currency)}</span>
                    </div>
                    <div className="h-1 bg-bg rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: stats.topSubscriptions[0] ? `${(sub.amount / stats.topSubscriptions[0].amount) * 100}%` : "0%" }}
                        className="h-full bg-accent/40 rounded-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Billing Cycle Breakdown Widget */}
          {dashboardConfig.sections.cycleBreakdown && (
            <motion.div 
              layout
              key="cycleBreakdown"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
              className={cn(
                "bg-card rounded-3xl lg:rounded-[2rem] border border-border-dim p-4 lg:p-5 flex flex-col group hover:border-accent transition-all duration-500 shadow-premium",
                !dashboardConfig.sections.topSpending ? "col-span-1 md:col-span-12" : "col-span-1 md:col-span-12 lg:col-span-6" 
              )}
            >
              <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-text-muted mb-4">Ciclos de Faturação</p>
              <div className="grid grid-cols-2 gap-3 flex-1">
                <div className="p-3.5 bg-bg/50 border border-border-dim rounded-xl flex flex-col justify-between">
                  <div>
                    <p className="text-[8px] font-bold text-text-muted/60 uppercase tracking-widest mb-0.5">Pagamentos</p>
                    <p className="text-lg font-bold text-text-main font-display leading-tight">Mensais</p>
                  </div>
                  <div className="mt-2">
                    <p className="text-[10px] font-bold text-accent">{stats.cycleStats.monthly.length} Ativos</p>
                    <p className="text-[9px] text-text-muted opacity-60">Total {formatCurrency(stats.cycleStats.monthlyTotal, currency)}</p>
                  </div>
                </div>
                <div className="p-3.5 bg-bg/50 border border-border-dim rounded-xl flex flex-col justify-between">
                  <div>
                    <p className="text-[8px] font-bold text-text-muted/60 uppercase tracking-widest mb-0.5">Pagamentos</p>
                    <p className="text-lg font-bold text-text-main font-display leading-tight">Anuais</p>
                  </div>
                  <div className="mt-2">
                    <p className="text-[10px] font-bold text-purple-500">{stats.cycleStats.yearly.length} Ativos</p>
                    <p className="text-[9px] text-text-muted opacity-60">Faturação Recorrente</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Calendar Frequency Widget */}
          {dashboardConfig.sections.calendar && (
            <motion.div 
              layout
              key="calendar"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
              className="col-span-1 md:col-span-12 bg-card rounded-3xl lg:rounded-[2rem] border border-border-dim p-6 lg:p-8 flex flex-col group hover:border-accent transition-all duration-500 shadow-premium"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-text-muted mb-1">Mapa de Fluxo Mensal</p>
                  <h4 className="text-lg font-bold text-text-main tracking-tight uppercase">Saídas por Dia</h4>
                </div>
                <div className="w-10 h-10 rounded-xl bg-accent/5 flex items-center justify-center text-accent">
                  <CalendarIcon size={20} />
                </div>
              </div>
              
              <div className="grid grid-cols-7 gap-2 lg:gap-3 flex-1 items-center max-w-4xl mx-auto w-full">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                    const count = stats.calendarMap[day] || 0;
                    return (
                      <div 
                        key={day}
                        className={cn(
                          "aspect-square rounded-xl flex flex-col items-center justify-center transition-all border relative group/day",
                          count > 2 ? "bg-accent text-white border-accent shadow-lg shadow-accent/20 z-10" :
                          count > 0 ? "bg-accent/10 text-accent border-accent/20 hover:bg-accent/20" :
                          "bg-bg/50 text-text-muted/20 border-border-dim/30 hover:border-border-dim/60"
                        )}
                      >
                        <span className={cn(
                          "text-[11px] lg:text-xs font-bold",
                          count === 0 && "opacity-40"
                        )}>{day}</span>
                        {count > 0 && (
                          <span className={cn(
                            "text-[7px] font-bold uppercase mt-0.5",
                            count > 2 ? "text-white/80" : "text-accent/60"
                          )}>
                            {count}P
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
              <div className="mt-8 pt-6 border-t border-border-dim/30 flex flex-wrap justify-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-bg border border-border-dim" />
                    <span className="text-[8px] font-bold text-text-muted uppercase tracking-widest">Sem Pagamentos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-accent/20 border border-accent/30" />
                    <span className="text-[8px] font-bold text-text-muted uppercase tracking-widest">Ativo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-accent" />
                    <span className="text-[8px] font-bold text-text-muted uppercase tracking-widest">Fluxo Elevado</span>
                  </div>
              </div>
            </motion.div>
          )}

          {/* Saving Insights Big Card */}
          {(dashboardConfig.sections.insights || dashboardConfig.sections.indicators) && (
            <motion.div 
              layout
              key="insightsPanel"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
              className="col-span-1 md:col-span-12 bg-card rounded-3xl lg:rounded-[3rem] border border-border-dim p-6 lg:p-10 flex flex-col group hover:border-accent transition-all duration-500 shadow-premium"
            >
              {dashboardConfig.sections.insights && (
                <>
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
                      <span className="text-[8px] lg:text-[9px] font-bold text-accent uppercase tracking-widest">IA Trackify Ativa</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 flex-1">
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
                              <span className="text-[8px] font-bold opacity-30 tracking-widest">{insight.score}%</span>
                          </div>
                        )}
                        <div className="w-10 h-10 lg:w-14 lg:h-14 bg-bg rounded-xl lg:rounded-2xl flex items-center justify-center text-xl lg:text-3xl shadow-sm border border-border-dim group-hover:bg-accent group-hover:text-white transition-colors shrink-0">
                          {insight.icon}
                        </div>
                        <div className="min-w-0">
                          <p className={cn(
                            "text-[12px] lg:text-sm font-bold mb-1 lg:mb-2 uppercase tracking-tight truncate",
                            insight.type === 'warning' ? "text-red-500" : "text-text-main"
                          )}>{insight.title}</p>
                          <p className="text-[10px] lg:text-[11px] text-text-muted font-bold leading-relaxed uppercase tracking-widest opacity-60 line-clamp-3">{insight.description}</p>
                        </div>
                      </motion.div>
                    )) : (
                      <div className="col-span-full flex flex-col items-center justify-center py-10 lg:py-16 text-center bg-bg/50 border border-dashed border-border-dim rounded-3xl lg:rounded-[2.5rem]">
                        <div className="w-14 h-14 lg:w-20 lg:h-20 bg-accent/5 rounded-full flex items-center justify-center mb-6">
                          <span className="text-3xl lg:text-4xl animate-bounce">✨</span>
                        </div>
                        <p className="text-[12px] lg:text-sm font-bold text-text-main uppercase tracking-widest">A aguardar dados...</p>
                        <p className="text-[9px] lg:text-[10px] text-text-muted font-bold uppercase mt-2 tracking-[0.2em] opacity-40 px-6">Adiciona subscrições para ativar a análise inteligente.</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* New indicators row */}
              {dashboardConfig.sections.indicators && (
                <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6", dashboardConfig.sections.insights ? "mt-8 lg:mt-10" : "")}>
                  <div className="p-5 lg:p-6 bg-bg border border-border-dim rounded-2xl lg:rounded-[2rem] flex items-center gap-4">
                      <div className="w-10 h-10 lg:w-12 lg:h-12 bg-accent/10 rounded-xl lg:rounded-2xl flex items-center justify-center text-accent shrink-0">
                        <Target size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="micro-label mb-1">Fadiga Financeira</p>
                        <div className="flex items-center gap-2 lg:gap-3">
                          <p className="text-lg lg:text-xl font-bold text-text-main font-display shrink-0">{stats.fatigueScore}%</p>
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
                        <p className="text-lg lg:text-xl font-bold text-health font-display truncate">~{formatCurrency(stats.potentialSavings, currency)}<span className="text-[10px] opacity-40 ml-1">/mês</span></p>
                      </div>
                  </div>
                </div>
              )}

              {dashboardConfig.sections.insights && (
                <div className="mt-8 lg:mt-10 flex items-center justify-center">
                  <button 
                    disabled={isGenerating}
                    onClick={() => generateAI(subscriptions)}
                    className="group/btn relative w-full sm:w-auto px-6 lg:px-10 py-3.5 lg:py-4 bg-accent text-white rounded-xl lg:rounded-2xl text-[9px] lg:text-[10px] font-bold tracking-[0.2em] lg:tracking-[0.3em] uppercase transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-accent/20 overflow-hidden disabled:opacity-50"
                  >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500" />
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {isGenerating ? 'A ANALISAR...' : 'RECALCULAR IA'}
                    </span>
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
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
