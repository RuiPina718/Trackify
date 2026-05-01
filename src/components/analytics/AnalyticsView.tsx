import { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
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
import { TrendingUp, PieChart as PieChartIcon, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { IconRenderer } from '../ui/IconRenderer';
import { subscribeToUserSubscriptions } from '../../services/subscriptionService';
import { Subscription, PREDEFINED_CATEGORIES } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';

interface AnalyticsViewProps {
  userId: string;
  currency?: string;
}

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4'];

export default function AnalyticsView({ userId, currency = 'EUR' }: AnalyticsViewProps) {
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

  if (loading) {
    return <div className="space-y-4">
      {[1,2,3,4].map(i => <div key={i} className="h-64 bg-card border border-border-dim rounded-[3rem] animate-pulse" />)}
    </div>;
  }

  // Monthly breakdown
  const activeSubs = subscriptions.filter(s => s.status === 'active');
  const monthlyTotal = activeSubs.reduce((acc, s) => {
    const amount = s.billingCycle === 'monthly' ? s.amount : s.billingCycle === 'yearly' ? s.amount / 12 : s.amount * 4;
    return acc + amount;
  }, 0);

  const categoryData = PREDEFINED_CATEGORIES.map(cat => {
    const value = activeSubs
      .filter(s => s.category === cat.name)
      .reduce((acc, s) => {
        const amount = s.billingCycle === 'monthly' ? s.amount : s.billingCycle === 'yearly' ? s.amount / 12 : s.amount * 4;
        return acc + amount;
      }, 0);
    return { name: cat.name, value };
  }).filter(c => c.value > 0);

  const topSubs = [...activeSubs].sort((a, b) => b.amount - a.amount).slice(0, 5);

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h2 className="text-3xl font-black text-text-main tracking-tighter">Análise de Gastos</h2>
        <p className="text-text-muted font-bold text-[10px] uppercase tracking-widest mt-1">Insights detalhados sobre as tuas finanças recorrentes</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-accent rounded-[3rem] p-10 flex flex-col justify-between shadow-2xl shadow-accent/20 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-white/20 transition-all" />
          <div className="relative z-10">
            <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em] mb-2">Despesa Mensal Médio</p>
            <h3 className="text-5xl font-black text-white tracking-tighter tabular-nums">{formatCurrency(monthlyTotal, currency)}</h3>
          </div>
          <div className="flex items-center gap-3 mt-8 py-3 px-5 bg-white/10 backdrop-blur-md rounded-[2rem] w-fit border border-white/10">
            <Activity size={16} className="text-white animate-pulse" />
            <span className="text-[10px] font-black text-white tracking-[0.2em] uppercase leading-none mt-0.5">Fluxo Estável</span>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border-dim p-10 rounded-[3rem] md:col-span-2 shadow-xl shadow-bg group hover:border-accent transition-all"
        >
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent/5 rounded-2xl text-accent">
                <PieChartIcon size={22} />
              </div>
              <div>
                <p className="text-sm font-black text-text-main tracking-tight">Distribuição de Capital</p>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mt-0.5">Por Categoria Principal</p>
              </div>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="focus:outline-none transition-all hover:opacity-80" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--color-card)', borderRadius: '2rem', border: '1px solid var(--color-border-dim)', fontSize: '12px', fontWeight: '900', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}
                />
                <Legend iconType="circle" iconSize={8} formatter={(value) => <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-2">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border-dim p-10 rounded-[3rem] shadow-xl shadow-bg group hover:border-accent transition-all"
        >
          <div className="flex items-center gap-4 mb-10">
            <div className="p-3 bg-health/5 rounded-2xl text-health">
              <TrendingUp size={22} />
            </div>
            <div>
              <p className="text-sm font-black text-text-main tracking-tight">Histórico de Gastos</p>
              <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mt-0.5">Projeção Baseada em Subscrições</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { month: 'Jan', total: monthlyTotal * 0.92 },
                { month: 'Fev', total: monthlyTotal * 0.96 },
                { month: 'Mar', total: monthlyTotal * 0.98 },
                { month: 'Abr', total: monthlyTotal },
              ]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-dim)" opacity={0.5} />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: '900', fill: 'var(--color-text-muted)' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: '900', fill: 'var(--color-text-muted)' }}
                  dx={-10}
                  tickFormatter={(val) => `€${val}`}
                />
                <Tooltip 
                  cursor={{ fill: 'var(--color-accent)', opacity: 0.05 }} 
                  contentStyle={{ borderRadius: '2rem', border: '1px solid var(--color-border-dim)', backgroundColor: 'var(--color-card)', fontSize: '11px', fontWeight: '900' }}
                />
                <Bar dataKey="total" fill="var(--color-accent)" radius={[12, 12, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border-dim p-10 rounded-[3rem] shadow-xl shadow-bg group hover:border-accent transition-all overflow-hidden"
        >
          <div className="flex items-center justify-between mb-10">
            <div>
              <p className="text-sm font-black text-text-main tracking-tight">Métricas de Topo</p>
              <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mt-1">Serviços com Maior Impacto</p>
            </div>
            <ArrowUpRight size={20} className="text-text-muted group-hover:text-accent transition-colors" />
          </div>
          <div className="space-y-4">
            {topSubs.map((sub, idx) => (
              <div key={sub.id} className="flex items-center justify-between p-5 bg-bg/50 border border-border-dim/50 rounded-[2rem] hover:border-accent/40 transition-all group/item">
                <div className="flex items-center gap-5">
                  <div className="w-10 h-10 rounded-2xl bg-accent/5 border border-accent/10 flex items-center justify-center text-accent group-hover/item:scale-110 transition-transform">
                    <IconRenderer name={sub.icon} size={20} fallback={<span className="font-black text-[10px]">{idx + 1}</span>} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-text-main leading-tight">{sub.name}</p>
                    <p className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] mt-1">{sub.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-base font-black text-text-main tabular-nums">{formatCurrency(sub.amount, sub.currency || currency)}</p>
                  <div className="flex items-center gap-1.5 justify-end mt-1">
                    <span className="text-[9px] text-accent font-black uppercase tracking-widest">{sub.billingCycle === 'monthly' ? 'Mês' : 'Ano'}</span>
                    <ArrowUpRight size={10} className="text-accent" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

    </div>
  );
}
