import { useState, useEffect, useMemo } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { TrendingUp, PieChart as PieChartIcon, ArrowUpRight, ArrowDownRight, Activity, Wallet, Calendar, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { IconRenderer } from '../ui/IconRenderer';
import { subscribeToUserSubscriptions } from '../../services/subscriptionService';
import { Subscription } from '../../types';
import { useUnifiedCategories } from '../../hooks/useUnifiedCategories';
import { formatCurrency, cn, isYearlyCycle } from '../../lib/utils';
import { subMonths, format, startOfMonth, endOfMonth, isBefore, parseISO, addDays } from 'date-fns';
import { pt } from 'date-fns/locale';

interface AnalyticsViewProps {
  userId: string;
  currency?: string;
}

export default function AnalyticsView({ userId, currency = 'EUR' }: AnalyticsViewProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const { categories: unifiedCategories } = useUnifiedCategories(userId);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<'monthly' | 'yearly'>('monthly');

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
    const activeSubs = subscriptions.filter(s => s.status === 'active');
    const today = new Date();
    
    // Monthly total calculation (as baseline)
    const monthlyTotal = activeSubs.reduce((acc, s) => {
      let amount = s.amount;
      if (isYearlyCycle(s.billingCycle)) amount = s.amount / 12;
      return acc + amount;
    }, 0);

    const periodTotal = view === 'yearly' ? monthlyTotal * 12 : monthlyTotal;

    // Spending History (Last 6 Months)
    const history = Array.from({ length: 6 }).map((_, i) => {
      const monthDate = subMonths(today, 5 - i);
      const mEnd = endOfMonth(monthDate);
      
      const total = activeSubs.reduce((acc, s) => {
        const start = s.startDate ? parseISO(s.startDate) : new Date(0);
        if (isBefore(start, mEnd)) {
          let amount = s.amount;
          if (isYearlyCycle(s.billingCycle)) amount = s.amount / 12;
          return acc + amount;
        }
        return acc;
      }, 0);

      // We maintain history as monthly even in yearly view for trend analysis
      return {
        name: format(monthDate, 'MMM', { locale: pt }).toUpperCase(),
        total: Math.round(total * 100) / 100
      };
    });

    // Yearly Projection (Next 12 Months)
    const projection = Array.from({ length: 12 }).map((_, i) => {
      const monthDate = addDays(today, (i + 1) * 30);
      return {
        name: format(monthDate, 'MMM', { locale: pt }).toUpperCase(),
        total: Math.round(monthlyTotal * (i + 1))
      };
    });

    // Potential Savings (Estimate 15% saving if monthly switched to annual)
    const monthlyOnlySubs = activeSubs.filter(s => s.billingCycle === 'monthly');
    const potentialMonthlySavings = monthlyOnlySubs.reduce((acc, s) => acc + (s.amount * 0.15), 0);
    const yearlyLostOpportunity = potentialMonthlySavings * 12;

    // Comparison with last month/year baseline
    const currentMonthVal = history[5].total;
    const lastMonthVal = history[4].total;
    const diff = currentMonthVal - lastMonthVal;
    const diffPercentage = lastMonthVal > 0 ? (diff / lastMonthVal) * 100 : 0;

    // Categories
    const categoryData = unifiedCategories.map(cat => {
      const value = activeSubs
        .filter(s => s.category === cat.name)
        .reduce((acc, s) => {
          let amount = s.amount;
          if (isYearlyCycle(s.billingCycle)) amount = s.amount / 12;
          return acc + amount;
        }, 0);
      
      const displayValue = view === 'yearly' ? value * 12 : value;

      return { 
        name: cat.name.toUpperCase(), 
        value: Math.round(displayValue * 100) / 100,
        color: cat.color 
      };
    }).filter(c => c.value > 0).sort((a, b) => b.value - a.value);

    const topSubs = [...activeSubs].sort((a, b) => {
      const valA = isYearlyCycle(a.billingCycle) ? a.amount / 12 : a.amount;
      const valB = isYearlyCycle(b.billingCycle) ? b.amount / 12 : b.amount;
      return valB - valA;
    }).slice(0, 5);

    // Insights logic
    const highDensityCategories = categoryData.filter(c => {
      const subsInCat = activeSubs.filter(s => s.category.toUpperCase() === c.name).length;
      return subsInCat >= 3;
    });

    return { 
      monthlyTotal,
      periodTotal,
      history, 
      projection, 
      diffPercentage, 
      categoryData, 
      topSubs, 
      yearlyLostOpportunity,
      highDensityCategories
    };
  }, [subscriptions, unifiedCategories, view]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="h-64 bg-card border border-border-dim rounded-3xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 px-1">
        <div className="min-w-0">
          <h2 className="text-2xl sm:text-3xl font-bold text-text-main tracking-tighter truncate">Inteligência de Gastos</h2>
          <p className="text-text-muted font-bold text-[10px] uppercase tracking-widest mt-1 opacity-70 truncate">Análise profunda das tuas finanças</p>
        </div>
        <div className="flex bg-card p-1.5 rounded-2xl border border-border-dim w-full sm:w-auto">
          <button 
            onClick={() => setView('monthly')}
            className={cn(
              "flex-1 sm:flex-none px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
              view === 'monthly' ? "bg-bg text-accent shadow-sm" : "text-text-muted hover:text-text-main"
            )}
          >
            Mensal
          </button>
          <button 
            onClick={() => setView('yearly')}
            className={cn(
              "flex-1 sm:flex-none px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
              view === 'yearly' ? "bg-bg text-accent shadow-sm" : "text-text-muted hover:text-text-main"
            )}
          >
            Anual
          </button>
        </div>
      </div>

      {/* Main Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-1 bg-accent rounded-3xl lg:rounded-[3rem] p-6 lg:p-8 flex flex-col justify-between shadow-2xl shadow-accent/20 relative overflow-hidden group min-h-[260px] lg:min-h-[300px]"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-white/20 transition-all opacity-50" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-white/20 rounded-xl shrink-0">
                <Wallet size={16} className="text-white" />
              </div>
              <p className="text-[10px] lg:text-[11px] font-bold text-white/70 uppercase tracking-[0.2em] lg:tracking-[0.3em] truncate">
                {view === 'monthly' ? 'Custo Mensal Ativo' : 'Custo Anual Projetado'}
              </p>
            </div>
            <h3 className="text-4xl lg:text-5xl font-bold text-white tracking-tighter tabular-nums leading-none mb-6">
              {formatCurrency(stats.periodTotal, currency)}
            </h3>
            
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full w-fit border text-[9px] lg:text-[10px] font-bold uppercase tracking-widest",
              stats.diffPercentage <= 0 
                ? "bg-white/20 border-white/20 text-white" 
                : "bg-red-500/20 border-red-400/20 text-white"
            )}>
              {stats.diffPercentage <= 0 ? <ArrowDownRight size={10} /> : <ArrowUpRight size={10} />}
              {Math.abs(Math.round(stats.diffPercentage))}% vs anterior
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-end">
            <div>
              <p className="text-[9px] lg:text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1 opacity-80">
                {view === 'monthly' ? 'Custo Diário' : 'Custo Mensal Médio'}
              </p>
              <p className="text-lg lg:text-xl font-bold text-white tabular-nums tracking-tight">
                {view === 'monthly' 
                  ? formatCurrency(stats.monthlyTotal / 30, currency)
                  : formatCurrency(stats.monthlyTotal, currency)
                }
              </p>
            </div>
            <div className="p-2 lg:p-3 bg-white/10 rounded-2xl border border-white/10 shrink-0">
              <Activity size={18} className="text-white animate-pulse" />
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 bg-card border border-border-dim p-6 lg:p-8 rounded-3xl lg:rounded-[3rem] shadow-xl shadow-bg flex flex-col group hover:border-accent transition-all min-h-[300px]"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="p-2.5 lg:p-3 bg-accent/5 rounded-2xl text-accent border border-accent/10 shrink-0">
                <TrendingUp className="w-5 h-5 lg:w-[22px] lg:h-[22px]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs lg:text-sm font-bold text-text-main tracking-tight truncate">Fluxo de Caixa (Histórico)</p>
                <p className="text-[9px] lg:text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mt-0.5 opacity-70 truncate">Últimos 6 meses</p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-center">
              <span className="w-2 h-2 rounded-full bg-accent"></span>
              <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Despesa Total</span>
            </div>
          </div>
          
          <div className="h-48 lg:h-64 mt-auto">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.history}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-dim)" opacity={0.3} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fontWeight: '900', fill: 'var(--color-text-muted)' }} 
                  dy={10}
                />
                <YAxis 
                  hide={true}
                  domain={['auto', 'auto']}
                />
                <Tooltip 
                  cursor={{ stroke: 'var(--color-accent)', strokeWidth: 1 }}
                  contentStyle={{ 
                    backgroundColor: 'var(--color-card)', 
                    borderRadius: '1.2rem', 
                    border: '1px solid var(--color-border-dim)', 
                    fontSize: '10px', 
                    fontWeight: '900',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'
                  }}
                  itemStyle={{ color: 'var(--color-accent)', textTransform: 'uppercase' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="total" 
                  stroke="var(--color-accent)" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorTotal)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Secondary Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-4 space-y-4 lg:space-y-6"
        >
          {/* Distribution card */}
          <div className="bg-card border border-border-dim p-6 lg:p-8 rounded-3xl lg:rounded-[3rem] shadow-xl shadow-bg flex flex-col group hover:border-accent transition-all">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-2.5 bg-purple-500/5 rounded-xl lg:rounded-2xl text-purple-500 border border-purple-500/10 shrink-0">
                <PieChartIcon size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs lg:text-sm font-bold text-text-main tracking-tight truncate">Distribuição</p>
                <p className="text-[9px] lg:text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mt-0.5 opacity-70 truncate">Por Categoria</p>
              </div>
            </div>
            
            <div className="h-40 lg:h-48 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {stats.categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || '#6366f1'} className="focus:outline-none" />
                    ))}
                  </Pie>
                  <Tooltip 
                     contentStyle={{ backgroundColor: 'var(--color-card)', borderRadius: '1rem', border: '1px solid var(--color-border-dim)', fontSize: '10px', fontWeight: '900' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-4 space-y-1.5">
              {stats.categoryData.slice(0, 3).map((cat, i) => (
                <div key={cat.name} className="flex items-center justify-between p-2.5 lg:p-3 bg-bg/50 rounded-xl border border-border-dim/50">
                  <div className="flex items-center gap-2 lg:gap-3 min-w-0">
                    <span className="w-2 h-2 lg:w-2.5 lg:h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color || '#6366f1' }}></span>
                    <span className="text-[9px] lg:text-[10px] font-bold text-text-muted uppercase tracking-widest truncate">{cat.name}</span>
                  </div>
                  <div className="text-right ml-2 shrink-0">
                    <span className="text-[10px] lg:text-[11px] font-bold text-text-main tabular-nums">{formatCurrency(cat.value, currency)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Optimization Card */}
          <div className="bg-bg border border-accent/20 p-6 lg:p-8 rounded-3xl lg:rounded-[3rem] shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 lg:p-6 opacity-10">
              <Sparkles className="text-accent w-20 h-20 lg:w-[100px] lg:h-[100px]" />
            </div>
            <h4 className="text-[10px] font-bold text-accent uppercase tracking-[0.2em] mb-4">Otimização Pró</h4>
            <div className="space-y-4">
              <div>
                <p className="text-xl lg:text-2xl font-bold text-text-main leading-none">
                  {formatCurrency(stats.yearlyLostOpportunity, currency)}
                </p>
                <p className="text-[8px] lg:text-[9px] text-text-muted font-bold uppercase tracking-widest mt-1 opacity-60">Perda anual em planos mensais</p>
              </div>
              <div className="p-3 bg-accent/5 rounded-xl border border-accent/10">
                <p className="text-[9px] text-accent font-bold uppercase leading-relaxed tracking-wider">
                  Mudar para faturamentos anuais pode reduzir custos em 15% em média.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-8 bg-card border border-border-dim p-6 lg:p-8 rounded-3xl lg:rounded-[3rem] shadow-xl shadow-bg group hover:border-accent transition-all overflow-hidden"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent/5 rounded-2xl text-accent border border-accent/10 shrink-0">
                <Calendar size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs lg:text-sm font-bold text-text-main tracking-tight truncate">Impacto Individual</p>
                <p className="text-[9px] lg:text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mt-0.5 opacity-70 truncate">Maiores custos</p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4 h-full content-start">
            {stats.topSubs.map((sub, idx) => (
              <div 
                key={sub.id} 
                className={cn(
                  "flex items-center justify-between p-4 lg:p-5 bg-bg/50 border border-border-dim/50 rounded-2xl lg:rounded-3xl hover:border-accent/40 transition-all group/item",
                  idx === 0 && "sm:col-span-2 bg-accent/5 border-accent/10 sm:scale-[1.01]"
                )}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl bg-card border border-border-dim flex items-center justify-center text-accent group-hover/item:scale-105 transition-transform shrink-0">
                    <IconRenderer name={sub.icon} className="w-5 h-5 lg:w-6 lg:h-6" fallback={<span className="font-bold text-[10px]">{idx + 1}</span>} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm lg:text-base font-bold text-text-main leading-tight tracking-tight truncate">{sub.name}</p>
                    <p className="text-[9px] lg:text-[10px] text-text-muted font-bold uppercase tracking-[0.2em] mt-0.5 opacity-80 truncate">{sub.category}</p>
                  </div>
                </div>
                <div className="text-right ml-2 shrink-0">
                  <p className="text-base lg:text-lg font-bold text-text-main tabular-nums">{formatCurrency(sub.amount, sub.currency || currency)}</p>
                  <p className="text-[9px] lg:text-[10px] text-text-muted font-bold uppercase tracking-widest opacity-40">/{sub.billingCycle === 'monthly' ? 'mês' : 'ano'}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 p-4 lg:p-6 bg-accent rounded-2xl lg:rounded-3xl flex items-center justify-between group/tip shadow-xl shadow-accent/20">
            <div className="flex items-center gap-3 lg:gap-4 min-w-0">
              <div className="w-9 h-9 lg:w-10 lg:h-10 bg-white/20 rounded-xl flex items-center justify-center text-white shrink-0">
                <Sparkles size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] lg:text-[11px] font-bold text-white/90 uppercase tracking-widest leading-relaxed line-clamp-2">
                  {stats.highDensityCategories.length > 0 
                    ? `Fadiga em ${stats.highDensityCategories[0].name.toLowerCase()}. Revisa duplicados.`
                    : `Estás a gerir bem os teus gastos em ${currency}.`}
                </p>
                <p className="text-[8px] lg:text-[9px] text-white/40 font-bold uppercase tracking-[0.2em] mt-0.5">
                  IA • Análise Ativa
                </p>
              </div>
            </div>
            <div className="hidden md:block p-2 bg-white/20 rounded-full text-white shrink-0 ml-4">
              <ArrowUpRight size={18} />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 lg:p-6 bg-bg border border-border-dim rounded-2xl lg:rounded-3xl">
              <p className="text-[9px] lg:text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-4">Projeção 12 Meses</p>
              <div className="h-24 lg:h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.projection}>
                    <Area 
                      type="monotone" 
                      dataKey="total" 
                      stroke="var(--color-accent)" 
                      fill="var(--color-accent)" 
                      fillOpacity={0.05} 
                      strokeWidth={2}
                    />
                    <Tooltip contentStyle={{ display: 'none' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-between items-end mt-4">
                <span className="text-[8px] font-bold text-text-muted uppercase tracking-widest">Ano Total:</span>
                <span className="text-base lg:text-lg font-bold text-text-main tabular-nums">{formatCurrency(stats.monthlyTotal * 12, currency)}</span>
              </div>
            </div>
            
            <div className="p-5 lg:p-6 bg-bg border border-border-dim rounded-2xl lg:rounded-3xl flex flex-col justify-between min-h-[160px]">
              <div>
                <p className="text-[9px] lg:text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-1">
                  Média por Item
                </p>
                <p className="text-lg lg:text-xl font-bold text-text-main tabular-nums">
                  {formatCurrency(stats.periodTotal / (subscriptions.length || 1), currency)}
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-border-dim">
                <p className="text-[9px] font-bold text-accent uppercase tracking-widest flex justify-between">
                  Score de Saúde
                  <span>{Math.min(100, Math.max(20, 100 - (subscriptions.length * 5)))}%</span>
                </p>
                <div className="h-1.5 w-full bg-card rounded-full mt-2 overflow-hidden">
                  <div 
                    className="h-full bg-accent transition-all duration-1000" 
                    style={{ width: `${Math.min(100, Math.max(20, 100 - (subscriptions.length * 5)))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
