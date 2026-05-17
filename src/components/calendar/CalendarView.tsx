import { useState, useEffect, useMemo } from 'react';
import { subscribeToUserSubscriptions } from '../../services/subscriptionService';
import { Subscription } from '../../types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { cn, formatCurrency, isYearlyCycle } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface CalendarViewProps {
  userId: string;
  currency?: string;
}

export default function CalendarView({ userId, currency = 'EUR' }: CalendarViewProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  
  useEffect(() => {
    const unsub = subscribeToUserSubscriptions(
      userId,
      (subs) => setSubscriptions(subs),
      () => {}
    );
    return () => unsub();
  }, [userId]);

  const selectedDaySubs = useMemo(() => {
    if (!selectedDay) return [];
    return subscriptions.filter(s => s.status === 'active' && s.billingDay === selectedDay.getDate());
  }, [selectedDay, subscriptions]);

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
    <div className="space-y-4 sm:space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-card p-4 sm:p-6 rounded-[2rem] border border-border-dim shadow-sm gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-text-main tracking-tighter flex flex-wrap items-center gap-2 sm:gap-3 lowercase">
            <span className="capitalize">{format(currentMonth, 'MMMM', { locale: pt })}</span>
            <span className="text-text-muted">{format(currentMonth, 'yyyy')}</span>
            <span className="text-[9px] sm:text-[10px] font-bold text-text-muted uppercase tracking-widest bg-bg px-2 py-1 rounded-lg border border-border-dim italic">
              Calendário
            </span>
          </h2>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="flex-1 sm:flex-none p-2.5 sm:p-3 bg-bg text-text-muted hover:text-accent hover:bg-card border border-border-dim rounded-xl transition-all flex items-center justify-center"
          >
            <ChevronLeft size={18} />
          </button>
          <button 
            onClick={() => setCurrentMonth(new Date())}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest bg-bg text-text-muted hover:text-text-main rounded-xl border border-border-dim transition-all"
          >
            Hoje
          </button>
          <button 
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="flex-1 sm:flex-none p-2.5 sm:p-3 bg-bg text-text-muted hover:text-accent hover:bg-card border border-border-dim rounded-xl transition-all flex items-center justify-center"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="bg-card p-1 sm:p-2 rounded-3xl sm:rounded-[2.5rem] border border-border-dim shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 gap-px bg-border-dim/20 border border-border-dim/50 rounded-2xl sm:rounded-3xl overflow-hidden">
          {dayLabels.map((label, idx) => (
            <div key={idx} className="bg-card py-2 sm:py-4 text-center text-[8px] sm:text-[10px] font-bold text-text-muted uppercase tracking-widest border-b border-border-dim">
              {label}
            </div>
          ))}
          
          {blanks.map(i => (
            <div key={`blank-${i}`} className="bg-bg/50 aspect-square sm:h-40" />
          ))}

          {days.map(day => {
            const daySubs = subscriptions.filter(s => s.status === 'active' && s.billingDay === day.getDate());
            const hasPayments = daySubs.length > 0;
            const isToday = isSameDay(day, new Date());
            const isSelected = selectedDay && isSameDay(day, selectedDay);
            
            return (
              <div 
                key={day.toString()} 
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "bg-card aspect-square sm:h-44 p-2 sm:p-3 border-r border-b border-border-dim transition-all hover:bg-bg/50 group relative cursor-pointer",
                  isToday && "bg-accent/5",
                  isSelected && "bg-accent/10 shadow-[inset_0_0_0_2px_rgba(59,130,246,0.3)] z-10"
                )}
              >
                <div className="flex justify-between items-start mb-1 sm:mb-4">
                  <span className={cn(
                    "text-[10px] sm:text-xs font-bold w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg sm:rounded-xl transition-all",
                    isToday ? "bg-accent text-white shadow-lg shadow-accent/20" : 
                    isSelected ? "bg-accent/20 text-accent" : "text-text-muted group-hover:text-text-main"
                  )}>
                    {day.getDate()}
                  </span>
                  {hasPayments && (
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-accent shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                  )}
                </div>

                <div className="hidden sm:block space-y-1.5 overflow-hidden">
                  {daySubs.slice(0, 3).map(s => (
                    <div key={s.id} className="p-2 bg-bg/50 border border-border-dim/50 rounded-xl transition-all">
                      <p className="text-[9px] font-bold text-text-main truncate uppercase tracking-tight">{s.name}</p>
                    </div>
                  ))}
                  {daySubs.length > 3 && (
                    <p className="text-[9px] font-bold text-accent uppercase tracking-widest pl-1">+{daySubs.length - 3}</p>
                  )}
                </div>

                {/* Mobile indicators */}
                <div className="sm:hidden flex flex-wrap gap-0.5 mt-1 justify-center">
                  {daySubs.slice(0, 2).map((s, i) => (
                    <div key={i} className="w-1 h-1 rounded-full bg-text-muted/30" />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedDay && (
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedDay.toISOString()}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-card border border-border-dim p-6 sm:p-8 rounded-3xl sm:rounded-[2.5rem] shadow-xl shadow-bg"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-text-main tracking-tight uppercase">
                  {format(selectedDay, "dd 'de' MMMM", { locale: pt })}
                </h3>
                <p className="text-[9px] lg:text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mt-1">
                  {selectedDaySubs.length} {selectedDaySubs.length === 1 ? 'Subscrição' : 'Subscrições'}
                </p>
              </div>
              <div className="flex items-center justify-between sm:text-right border-t sm:border-t-0 pt-4 sm:pt-0 border-border-dim">
                <span className="sm:hidden text-[9px] font-bold text-text-muted uppercase tracking-widest">Total:</span>
                <p className="text-xl sm:text-2xl font-bold text-accent tabular-nums">
                  {formatCurrency(selectedDaySubs.reduce((acc, s) => acc + s.amount, 0), currency)}
                </p>
              </div>
            </div>

            {selectedDaySubs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {selectedDaySubs.map(s => (
                  <div key={s.id} className="p-4 sm:p-5 bg-bg border border-border-dim rounded-2xl sm:rounded-3xl flex items-center justify-between group hover:border-accent transition-all">
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-text-main uppercase tracking-tight truncate pr-2">{s.name}</h4>
                      <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mt-1 opacity-70 truncate">{s.category}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-text-main tabular-nums">{formatCurrency(s.amount, s.currency || currency)}</p>
                      <p className="text-[9px] font-bold text-accent uppercase tracking-widest mt-1">{isYearlyCycle(s.billingCycle) ? 'Anual' : 'Mensal'}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 sm:py-12 flex flex-col items-center text-center opacity-50">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-bg rounded-2xl sm:rounded-3xl border border-border-dim flex items-center justify-center mb-4">
                  <Info className="text-text-muted w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <p className="text-[10px] sm:text-xs font-bold text-text-main uppercase tracking-widest">Sem pagamentos agendados</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      <div className="bg-accent/5 border border-accent/20 text-text-main p-6 sm:p-8 rounded-3xl sm:rounded-[2.5rem] flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-accent/20 flex items-center justify-center text-accent shrink-0">
            <Info className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h4 className="font-bold text-base sm:text-lg tracking-tight">Dica de Gestão</h4>
            <p className="text-[11px] sm:text-sm text-text-muted font-bold truncate-2-lines">Toca em qualquer dia para ver os pagamentos detalhados.</p>
          </div>
        </div>
        <button className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-accent text-white rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest hover:bg-accent/90 transition-all shadow-lg shadow-accent/20">
          ANÁLISE DE CICLO
        </button>
      </div>
    </div>
  );
}
