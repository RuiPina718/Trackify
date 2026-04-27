import { useState, useEffect, useMemo } from 'react';
import { subscribeToUserSubscriptions } from '../../services/subscriptionService';
import { Subscription } from '../../types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';

interface CalendarViewProps {
  userId: string;
  currency?: string;
}

export default function CalendarView({ userId, currency = 'EUR' }: CalendarViewProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  useEffect(() => {
    const unsub = subscribeToUserSubscriptions(
      userId,
      (subs) => setSubscriptions(subs),
      () => {}
    );
    return () => unsub();
  }, [userId]);

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Calculate empty slats for start of month
  const startDay = getDay(startOfMonth(currentMonth));
  const blanks = Array.from({ length: startDay }, (_, i) => i);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-center bg-card p-6 rounded-[2rem] border border-border-dim shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-text-main tracking-tighter flex items-center gap-3 lowercase">
            <span className="capitalize">{format(currentMonth, 'MMMM', { locale: pt })}</span>
            <span className="text-text-muted">{format(currentMonth, 'yyyy')}</span>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest bg-bg px-2 py-1 rounded-lg border border-border-dim italic">
              Calendário de Pagamentos
            </span>
          </h2>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-3 bg-bg text-text-muted hover:text-accent hover:bg-card border border-border-dim rounded-xl transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          <button 
            onClick={() => setCurrentMonth(new Date())}
            className="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-bg text-text-muted hover:text-text-main rounded-xl border border-border-dim transition-all"
          >
            Hoje
          </button>
          <button 
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-3 bg-bg text-text-muted hover:text-accent hover:bg-card border border-border-dim rounded-xl transition-all"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="bg-card p-2 rounded-[2.5rem] border border-border-dim shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 gap-px bg-border-dim/30 border border-border-dim rounded-[2rem] overflow-hidden">
          {dayLabels.map((label, idx) => (
            <div key={idx} className="bg-card py-4 text-center text-[10px] font-black text-text-muted uppercase tracking-widest border-b border-border-dim">
              {label}
            </div>
          ))}
          
          {blanks.map(i => (
            <div key={`blank-${i}`} className="bg-bg/50 h-40" />
          ))}

          {days.map(day => {
            const daySubs = subscriptions.filter(s => s.status === 'active' && s.billingDay === day.getDate());
            const hasPayments = daySubs.length > 0;
            const isToday = isSameDay(day, new Date());
            
            return (
              <div 
                key={day.toString()} 
                className={cn(
                  "bg-card h-44 p-3 border-r border-b border-border-dim transition-colors hover:bg-bg/50 group relative",
                  isToday && "bg-accent/5"
                )}
              >
                <div className="flex justify-between items-start mb-4">
                  <span className={cn(
                    "text-xs font-black w-8 h-8 flex items-center justify-center rounded-xl transition-all",
                    isToday ? "bg-accent text-white shadow-xl shadow-accent/20" : "text-text-muted group-hover:text-text-main"
                  )}>
                    {day.getDate()}
                  </span>
                  {hasPayments && (
                    <div className="w-2 h-2 rounded-full bg-accent shadow-[0_0_12px_rgba(59,130,246,0.5)]"></div>
                  )}
                </div>

                <div className="space-y-1.5 overflow-y-auto max-h-[100px] custom-scrollbar pr-1">
                  {daySubs.map(s => (
                    <div key={s.id} className="p-2 bg-bg border border-border-dim rounded-xl hover:border-accent/30 transition-all cursor-pointer">
                      <p className="text-[10px] font-bold text-text-main truncate leading-tight tracking-tight">{s.name}</p>
                      <p className="text-[9px] text-accent font-black">{formatCurrency(s.amount, currency)}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-accent/5 border border-accent/20 text-text-main p-8 rounded-[2.5rem] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center text-accent">
            <Info size={24} />
          </div>
          <div>
            <h4 className="font-black text-lg tracking-tight">Dica de Gestão</h4>
            <p className="text-sm text-text-muted font-bold">Clica em qualquer pagamento no calendário para ver detalhes ou gerir a subscrição.</p>
          </div>
        </div>
        <button className="px-8 py-4 bg-accent text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-accent/90 transition-all shadow-xl shadow-accent/20">
          ANÁLISE DE CICLO
        </button>
      </div>
    </div>
  );
}
