import { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar as CalendarIcon, 
  AlertCircle,
  Clock,
  ArrowRight
} from 'lucide-react';
import { subscribeToUserSubscriptions } from '../../services/subscriptionService';
import { Subscription } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { format, addDays, isSameDay } from 'date-fns';
import { pt } from 'date-fns/locale';

interface DashboardProps {
  userId: string;
  currency?: string;
}

export default function Dashboard({ userId, currency = 'EUR' }: DashboardProps) {
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
      upcoming
    };
  }, [subscriptions]);

  if (loading) {
    return <div className="animate-pulse space-y-8">
      <div className="grid grid-cols-4 gap-6">
        {[1,2,3,4].map(i => <div key={i} className="h-32 bg-gray-100 rounded-3xl" />)}
      </div>
      <div className="h-96 bg-gray-100 rounded-3xl" />
    </div>;
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Bento Layout Grid */}
      <div className="grid grid-cols-12 grid-rows-10 gap-4 h-[700px]">
        {/* Main Stat Card - Monthly Expense */}
        <div className="col-span-4 row-span-3 bg-card rounded-3xl border border-border-dim p-6 flex flex-col justify-between group hover:border-accent transition-all">
          <div>
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-4">Despesa Mensal</p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-5xl font-black text-text-main tracking-tighter">{formatCurrency(stats.monthlyTotal, currency)}</h2>
            </div>
            <p className={cn(
               "text-xs font-bold mt-2",
               stats.monthlyTotal > 0 ? "text-health" : "text-text-muted"
            )}>
              {stats.activeCount} subscrições activas
            </p>
          </div>
          <div className="flex gap-1 h-1 mt-6">
            {stats.categories.map((cat, i) => (
              <div 
                key={cat.name} 
                className="h-full rounded-full" 
                style={{ 
                  flex: cat.value, 
                  backgroundColor: `var(--color-${['streaming', 'software', 'gaming', 'health'][i % 4]})` 
                }}
              />
            ))}
          </div>
        </div>

        {/* Subscription List Summary */}
        <div className="col-span-5 row-span-6 bg-card rounded-3xl border border-border-dim p-6 flex flex-col overflow-hidden group hover:border-accent transition-all">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-6">Subscrições Ativas ({stats.activeCount})</p>
          <div className="flex-1 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
            {stats.upcoming.length > 0 ? subscriptions.filter(s => s.status === 'active').slice(0, 7).map((sub) => (
              <div key={sub.id} className="flex items-center justify-between py-3 border-b border-border-dim/50 last:border-0 hover:bg-bg/50 px-2 rounded-xl transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-bg border border-border-dim flex items-center justify-center font-bold text-accent">
                    {sub.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-text-main">{sub.name}</p>
                    <p className="text-[10px] text-text-muted font-bold uppercase">{sub.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-text-main">{formatCurrency(sub.amount, currency)}</p>
                  <p className="text-[10px] text-text-muted font-bold text-accent">Dia {sub.billingDay}</p>
                </div>
              </div>
            )) : (
              <p className="text-center text-xs text-text-muted mt-20 italic">Sem subscrições activas</p>
            )}
          </div>
        </div>

        {/* Upcoming Payments List */}
        <div className="col-span-3 row-span-4 bg-card rounded-3xl border border-border-dim p-6 group hover:border-accent transition-all">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-6">Próximos Pagamentos</p>
          <div className="space-y-6">
            {stats.upcoming.length > 0 ? stats.upcoming.slice(0, 3).map((sub, idx) => (
              <div key={sub.id} className={cn(
                "pl-4 border-l-2",
                idx === 0 ? "border-accent" : "border-border-dim"
              )}>
                <p className="text-xs font-bold text-text-main">{idx === 0 ? 'Amanhã' : idx === 1 ? 'Em breve' : format(sub.nextDate, 'd MMM', { locale: pt })}</p>
                <p className="text-[11px] text-text-muted font-medium truncate">{sub.name} • {formatCurrency(sub.amount, currency)}</p>
              </div>
            )) : (
              <p className="text-xs text-text-muted italic">Sem pagamentos próximos</p>
            )}
          </div>
        </div>

        {/* Yearly Projection */}
        <div className="col-span-4 row-span-3 bg-card rounded-3xl border border-border-dim p-6 flex flex-col justify-between group hover:border-accent transition-all">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-4">Projeção Anual</p>
          <h3 className="text-3xl font-black text-text-main tracking-tighter">{formatCurrency(stats.yearlyTotal, currency)}</h3>
          <p className="text-[11px] text-text-muted leading-relaxed mt-4">Estimativa baseada nos teus consumos actuais e ciclos de facturação.</p>
        </div>

        {/* Distribution Breakdown */}
        <div className="col-span-3 row-span-2 bg-card rounded-3xl border border-border-dim p-6 group hover:border-accent transition-all">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-4">Distribuição</p>
          <div className="space-y-2">
            {stats.categories.slice(0, 3).map((cat, i) => (
              <div key={cat.name} className="flex items-center gap-2 text-xs font-bold text-text-muted">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: `var(--color-${['streaming', 'software', 'gaming', 'health'][i % 4]})` }}
                />
                <span className="truncate">{cat.name}</span>
                <span className="ml-auto text-text-main">{Math.round((cat.value / stats.monthlyTotal) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Saving Insights Big Card */}
        <div className="col-span-7 row-span-4 bg-bg rounded-3xl border border-border-dim p-6 flex flex-col group hover:border-accent transition-all">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-6">Insights de Poupança</p>
          <div className="grid grid-cols-2 gap-4 flex-1">
            <div className="bg-accent/5 border border-accent/20 p-5 rounded-2xl flex gap-4 items-start">
              <div className="text-2xl">💡</div>
              <div>
                <p className="text-sm font-bold text-text-main mb-1">Serviços Inativos</p>
                <p className="text-[11px] text-text-muted leading-relaxed">Considera rever subscrições que não utilizas há mais de 30 dias.</p>
              </div>
            </div>
            <div className="bg-amber-500/5 border border-amber-500/20 p-5 rounded-2xl flex gap-4 items-start">
              <div className="text-2xl">⚡</div>
              <div>
                <p className="text-sm font-bold text-amber-500 mb-1">Upgrade disponível</p>
                <p className="text-[11px] text-text-muted leading-relaxed">Planos anuais podem poupar-te até 20% do valor mensal.</p>
              </div>
            </div>
          </div>
          <div className="mt-auto pt-6 flex justify-center">
            <button className="bg-accent hover:bg-accent/90 text-white px-8 py-3 rounded-2xl text-xs font-bold transition-all shadow-xl shadow-accent/20">
              EXPLORAR TODAS AS DICAS
            </button>
          </div>
        </div>

        {/* Mini Calendar Card */}
        <div className="col-span-5 row-span-4 bg-card rounded-3xl border border-border-dim p-6 group hover:border-accent transition-all">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-4">Calendário {format(new Date(), 'MMMM', { locale: pt })}</p>
          <div className="grid grid-cols-7 gap-1 text-center">
            {['S','T','Q','Q','S','S','D'].map((d, idx) => (
               <div key={idx} className="text-[9px] font-bold text-text-muted py-2">{d}</div>
            ))}
            {/* Mocking a small grid for visual theme */}
            {Array.from({length: 31}).map((_, i) => {
              const day = i + 1;
              const isToday = day === new Date().getDate();
              const hasPayment = stats.activeCount > 0 && subscriptions.some(s => s.billingDay === day);
              return (
                <div 
                  key={i} 
                  className={cn(
                    "aspect-square flex items-center justify-center text-[10px] rounded-lg transition-all",
                    isToday ? "bg-accent text-white font-bold" : "text-text-muted hover:bg-bg",
                    hasPayment && !isToday && "border border-accent/30 text-accent font-bold"
                  )}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </div>
      </div>
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
