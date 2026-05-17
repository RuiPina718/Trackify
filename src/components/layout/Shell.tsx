import { useState, useEffect, useMemo } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { 
  LayoutDashboard, 
  CreditCard, 
  Calendar, 
  Settings, 
  LogOut, 
  Plus, 
  Search,
  Bell,
  Shield,
  BarChart3,
  Sun,
  Moon,
  AlertCircle
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { ADMIN_EMAIL } from '../../lib/config';
import { motion, AnimatePresence } from 'motion/react';
import { Subscription, UserProfile } from '../../types';
import Dashboard from '../dashboard/Overview';
import SubscriptionList from '../subscriptions/SubscriptionList';
import CalendarView from '../calendar/CalendarView';
import AnalyticsView from '../analytics/AnalyticsView';
import AddSubscriptionModal from '../subscriptions/AddSubscriptionModal';
import AdminDashboard from '../admin/AdminDashboard';
import SettingsView from '../settings/Settings';
import Chatbot from '../chat/Chatbot';
import { subscribeToUserProfile, updateUserProfile } from '../../services/userService';
import { subscribeToUserSubscriptions } from '../../services/subscriptionService';
import { addDays, format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { IconRenderer } from '../ui/IconRenderer';

interface ShellProps {
  user: User;
  userProfile: UserProfile | null;
}

export type ViewType = 'dashboard' | 'subscriptions' | 'calendar' | 'analytics' | 'settings' | 'admin';

export default function Shell({ user, userProfile }: ShellProps) {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [settingsTab, setSettingsTab] = useState<string | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [editSubscription, setEditSubscription] = useState<Subscription | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [localTheme, setLocalTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    if (userProfile?.theme) {
      setLocalTheme(userProfile.theme);
      document.documentElement.classList.toggle('dark', userProfile.theme === 'dark');
    }
  }, [userProfile?.theme]);

  useEffect(() => {
    const unsub = subscribeToUserSubscriptions(user.id, (subs) => {
      setSubscriptions(subs);
    }, (error) => console.error('Error fetching subscriptions for notifications:', error));
    return () => unsub();
  }, [user.id]);

  const urgentAlerts = useMemo(() => {
    if (!userProfile?.notifications?.billingReminders) return [];
    
    const today = new Date();
    const reminderDays = userProfile.notifications.reminderDays || 3;
    const active = subscriptions.filter(s => s.status === 'active');
    
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
    }).filter(s => {
      const diffTime = s.nextDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= reminderDays;
    }).sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());

    return upcoming;
  }, [subscriptions, userProfile?.notifications]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleTheme = async () => {
    const newTheme = localTheme === 'light' ? 'dark' : 'light';
    
    setLocalTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');

    try {
      await updateUserProfile(user.id, { theme: newTheme });
    } catch (error) {
      console.error('Error updating theme:', error);
      setLocalTheme(localTheme);
      document.documentElement.classList.toggle('dark', localTheme === 'dark');
    }
  };

  const handleEdit = (sub: Subscription) => {
    setEditSubscription(sub);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditSubscription(null);
  };

  const handleNavigate = (view: ViewType, tab?: string) => {
    setActiveView(view);
    if (view === 'settings' && tab) {
      setSettingsTab(tab);
    } else if (view !== 'settings') {
      setSettingsTab(undefined);
    }
    setIsSidebarOpen(false);
  };

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const userEmail = (user.email || '').toLowerCase().trim();
    // Allow hardcoded admin OR Firestore flag
    return userEmail === ADMIN_EMAIL || userProfile?.isAdmin === true;
  }, [user.email, userProfile?.isAdmin]);

  const navItems = useMemo(() => {
    const items = [
      { id: 'dashboard', label: 'Monitor', icon: LayoutDashboard },
      { id: 'subscriptions', label: 'Subscrições', icon: CreditCard },
      { id: 'calendar', label: 'Calendário', icon: Calendar },
      { id: 'analytics', label: 'Análise', icon: BarChart3 },
      { id: 'settings', label: 'Definições', icon: Settings },
    ];

    if (isAdmin) {
      items.push({ id: 'admin', label: 'Admin', icon: Shield });
    }
    
    return items;
  }, [isAdmin]);

  const handleLogout = () => supabase.auth.signOut();

  return (
    <div className="flex h-screen bg-bg overflow-hidden text-text-main relative">
      {/* Mobile/Desktop Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[60]"
          />
        )}
      </AnimatePresence>

      {/* Sidebar - Drawer on all screens */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-[70] w-72 bg-card border-r border-border-dim flex flex-col transition-transform duration-500 ease-in-out shadow-2xl outline-none",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8 flex items-center justify-between">
          <button 
            onClick={() => {
              if (activeView === 'dashboard') {
                const contentArea = document.querySelector('.overflow-y-auto.bg-bg');
                if (contentArea) contentArea.scrollTo({ top: 0, behavior: 'smooth' });
              } else {
                setActiveView('dashboard');
              }
              setIsSidebarOpen(false);
            }}
            className="text-2xl font-bold tracking-tight text-accent flex items-center gap-3 hover:opacity-80 transition-opacity active:scale-95 group"
          >
            <div className="relative w-9 h-9 group-hover:rotate-6 transition-transform duration-500 rounded-xl overflow-hidden shadow-lg shadow-accent/10 border border-accent/20">
              <img 
                src="/logo.png?v=1.3" 
                alt="Trackify Logo" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <span className="font-display lowercase tracking-tight text-2xl font-bold">trackify.</span>
          </button>
          <button className="lg:hidden p-2 text-text-muted hover:text-accent bg-bg rounded-xl border border-border-dim" onClick={() => setIsSidebarOpen(false)}>
            <Plus className="rotate-45" size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id as ViewType)}
              className={cn(
                "w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium tracking-tight transition-all group relative",
                activeView === item.id 
                  ? "bg-accent/5 text-accent border border-accent/10" 
                  : "text-text-muted hover:text-text-main hover:bg-bg border border-transparent hover:border-border-dim"
              )}
            >
              <item.icon size={18} className={cn(
                "transition-all duration-300",
                activeView === item.id ? "text-accent" : "text-text-muted/60 group-hover:text-text-main"
              )} />
              {item.label}
              {activeView === item.id && (
                <motion.div 
                  layoutId="active-indicator"
                  className="absolute left-0 w-1 h-4 bg-accent rounded-full"
                />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 mt-auto space-y-4">
          <div className="bg-accent/5 border border-accent/10 rounded-2xl p-5 hidden lg:block relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-accent/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
            <div className="flex items-center justify-between mb-2">
              <p className="micro-label font-bold">Upgrade Pro</p>
              <span className="text-[10px] font-bold bg-accent/20 text-accent px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">Brevemente</span>
            </div>
            <p className="text-xs text-text-muted mb-4 leading-relaxed font-medium">Desbloqueia insights profundos e controlo absoluto.</p>
            <button 
              disabled
              className="w-full py-2.5 bg-accent/10 text-accent/40 text-[10px] font-bold rounded-lg cursor-not-allowed uppercase tracking-widest"
            >
              INDISPONÍVEL
            </button>
          </div>

          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-500 hover:text-red-500 hover:bg-red-500/5 transition-all group"
          >
            <LogOut size={18} className="group-hover:translate-x-0.5 transition-transform" />
            Sair da conta
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0 pb-20 lg:pb-0">
        {/* Header */}
        <header className="h-16 lg:h-20 bg-card border-b border-border-dim flex items-center px-4 sm:px-8 shrink-0 z-50 relative">
          {/* Left Side */}
          <div className="flex-1 flex items-center gap-3 sm:gap-4 z-10">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 sm:p-2.5 text-text-muted hover:text-accent bg-bg rounded-xl border border-border-dim transition-all hover:scale-105 active:scale-95 shadow-sm"
              title="Abrir Menu"
            >
              <div className="flex flex-col gap-1 w-4 sm:w-5">
                <div className="h-0.5 w-full bg-current rounded-full" />
                <div className="h-0.5 w-full bg-current rounded-full" />
                <div className="h-0.5 w-full bg-current rounded-full" />
              </div>
            </button>
            <div className="hidden lg:flex items-center gap-3 bg-bg px-3.5 py-2.5 rounded-xl w-40 xl:w-56 border border-border-dim focus-within:border-accent focus-within:bg-card transition-all group">
              <Search size={16} className="text-text-muted group-focus-within:text-accent shrink-0" />
              <input 
                type="text" 
                placeholder="Pesquisar..." 
                className="bg-transparent border-none outline-none text-xs w-full text-text-main placeholder:text-text-muted/40"
              />
            </div>
          </div>

          {/* LOGO - True absolute center */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60]">
            <button 
              className="flex items-center gap-x-2 group cursor-pointer focus:outline-none transition-transform active:scale-95" 
              onClick={() => {
                if (activeView === 'dashboard') {
                  const contentArea = document.querySelector('.overflow-y-auto.bg-bg');
                  if (contentArea) contentArea.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  setActiveView('dashboard');
                }
              }}
              aria-label="Ir para o Dashboard"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden border border-accent/20 shadow-lg shadow-accent/5 transition-transform group-hover:scale-105 group-active:scale-95">
                <img src="/logo.png?v=1.3" alt="Logo" className="w-full h-full object-cover" />
              </div>
              <span className="font-display lowercase tracking-tight text-lg sm:text-xl text-text-main font-bold">trackify.</span>
            </button>
          </div>

          {/* Right Side */}
          <div className="flex-1 flex items-center justify-end gap-1.5 sm:gap-3 z-10">
            <button 
              onClick={toggleTheme}
              className="p-2 lg:p-2.5 rounded-xl bg-bg text-text-muted border border-border-dim hover:text-accent hover:border-accent transition-all animate-in fade-in zoom-in duration-300"
              title={localTheme === 'light' ? 'Mudar para Modo Escuro' : 'Mudar para Modo Claro'}
            >
              {localTheme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>

            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={cn(
                  "p-2 lg:p-2.5 rounded-xl bg-bg text-text-muted border transition-all relative",
                  showNotifications ? "border-accent text-accent" : "border-border-dim hover:text-accent hover:border-accent"
                )}
              >
                <Bell size={16} />
                {urgentAlerts.length > 0 && (
                  <div className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-accent rounded-full border border-card animate-pulse shadow-lg shadow-accent/50"></div>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setShowNotifications(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-[-80px] sm:right-0 mt-4 w-[calc(100vw-32px)] sm:w-80 bg-card border border-border-dim rounded-2xl shadow-2xl z-50 overflow-hidden"
                    >
                      <div className="p-4 border-b border-border-dim flex items-center justify-between bg-card/50 backdrop-blur-xl">
                        <h4 className="text-[10px] font-bold text-text-main tracking-widest uppercase ml-1">Notificações</h4>
                        {urgentAlerts.length > 0 && (
                          <span className="text-[9px] font-bold text-accent uppercase tracking-widest bg-accent/10 px-2.5 py-1 rounded-full border border-accent/20">
                            {urgentAlerts.length}
                          </span>
                        )}
                      </div>
                      
                      <div className="max-h-[60vh] sm:max-h-[400px] overflow-y-auto no-scrollbar pb-2">
                        {urgentAlerts.length > 0 ? (
                          <div className="p-2 space-y-1">
                            {urgentAlerts.map(sub => (
                              <button 
                                key={sub.id} 
                                onClick={() => {
                                  setShowNotifications(false);
                                  setActiveView('subscriptions');
                                  handleEdit(sub as Subscription);
                                }}
                                className="w-full text-left p-3 rounded-xl flex items-center gap-3 group hover:bg-bg transition-all active:scale-[0.98]"
                              >
                                <div className="w-10 h-10 bg-bg rounded-xl border border-border-dim flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-all shadow-sm shrink-0">
                                  <IconRenderer name={sub.icon} size={16} fallback={<span className="font-bold text-[10px]">{sub.name.charAt(0)}</span>} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-[11px] font-bold text-text-main truncate uppercase tracking-tight">{sub.name}</p>
                                    <p className="text-[10px] font-bold text-accent whitespace-nowrap">
                                      {formatCurrency(sub.amount, userProfile?.currency || 'EUR')}
                                    </p>
                                  </div>
                                  <p className="text-[9px] text-text-muted font-medium mt-0.5 uppercase tracking-widest flex items-center gap-1.5 opacity-70">
                                    <AlertCircle size={9} className="text-accent" />
                                    Vence a {format(sub.nextDate, "dd 'de' MMM", { locale: pt })}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="p-10 flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-bg rounded-2xl flex items-center justify-center mb-4 border border-border-dim relative overflow-hidden group">
                              <Bell size={24} className="text-text-muted/20" />
                            </div>
                            <p className="text-xs font-semibold text-text-main mb-1 uppercase tracking-tight">Tudo em dia!</p>
                            <p className="text-[10px] text-text-muted font-medium uppercase tracking-widest leading-relaxed opacity-60">
                              Sem cobranças pendentes.
                            </p>
                          </div>
                        )}
                      </div>

                      {urgentAlerts.length > 0 && (
                        <div className="p-3 border-t border-border-dim bg-bg/30">
                          <button 
                            onClick={() => {
                              setActiveView('calendar');
                              setShowNotifications(false);
                            }}
                            className="w-full py-2.5 bg-card border border-border-dim rounded-xl text-[9px] font-bold uppercase tracking-widest text-text-muted hover:text-accent hover:border-accent transition-all"
                          >
                            Ver Calendário
                          </button>
                        </div>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            
            <div className="h-6 w-px bg-border-dim mx-1 hidden sm:block"></div>
            
            <button 
              onClick={() => setActiveView('settings')}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left"
            >
              <div className="text-right hidden lg:block">
                <p className="text-sm font-bold text-text-main leading-tight tracking-tight">{userProfile?.displayName || user.user_metadata?.full_name || 'Utilizador'}</p>
                <p className={cn(
                  "text-[10px] font-semibold uppercase tracking-widest",
                  isAdmin ? "text-accent" : "text-text-muted"
                )}>
                  {isAdmin ? 'Administrador' : (userProfile?.isPremium ? 'Premium User' : 'Standard User')}
                </p>
              </div>
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-accent overflow-hidden flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-accent/20 border-2 border-accent shrink-0">
                {userProfile?.photoURL ? (
                  <img src={userProfile.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  (userProfile?.displayName || user.user_metadata?.full_name || 'U').charAt(0).toUpperCase()
                )}
              </div>
            </button>

            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-3 sm:px-6 py-2.5 lg:py-3 bg-accent text-white rounded-xl text-[10px] sm:text-xs font-bold hover:bg-accent/90 transition-all flex items-center gap-2 shadow-xl shadow-accent/20 uppercase tracking-widest active:scale-95"
            >
              <Plus size={16} className="shrink-0" />
              <span className="hidden sm:inline tracking-widest">Adicionar</span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-bg p-4 sm:p-6 lg:p-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto"
            >
              {activeView === 'dashboard' && <Dashboard userId={user.id} userProfile={userProfile} onNavigate={handleNavigate} />}
              {activeView === 'subscriptions' && <SubscriptionList userId={user.id} onEdit={handleEdit} currency={userProfile?.currency} />}
              {activeView === 'calendar' && <CalendarView userId={user.id} currency={userProfile?.currency} />}
              {activeView === 'analytics' && <AnalyticsView userId={user.id} currency={userProfile?.currency} />}
              {activeView === 'admin' && isAdmin && <AdminDashboard />}
              {activeView === 'settings' && <SettingsView user={user} initialTab={settingsTab as any} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom Navigation for Mobile */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-card/80 backdrop-blur-xl border-t border-border-dim px-2 py-1 flex items-center justify-around z-40 shadow-[0_-8px_30px_rgb(0,0,0,0.1)]">
          {navItems.filter(item => item.id !== 'settings').map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id as ViewType)}
              className={cn(
                "flex flex-col items-center justify-center p-2 rounded-xl transition-all relative min-w-[56px] sm:min-w-[64px]",
                activeView === item.id ? "text-accent" : "text-text-muted hover:text-text-main"
              )}
            >
              <item.icon size={18} className={cn(
                "mb-1 transition-transform duration-300",
                activeView === item.id ? "scale-110" : ""
              )} />
              <span className="text-[9px] font-bold uppercase tracking-tight">{item.label}</span>
              {activeView === item.id && (
                <motion.div 
                  layoutId="bottom-indicator"
                  className="absolute -bottom-1 w-8 h-1 bg-accent rounded-full"
                />
              )}
            </button>
          ))}
          <button
            onClick={() => handleNavigate('settings')}
            className={cn(
              "flex flex-col items-center justify-center p-2 rounded-xl transition-all relative min-w-[56px] sm:min-w-[64px]",
              activeView === 'settings' ? "text-accent" : "text-text-muted"
            )}
          >
            <Settings size={18} />
            <span className="text-[9px] font-bold uppercase tracking-tight">Definições</span>
            {activeView === 'settings' && <div className="absolute -bottom-1 w-8 h-1 bg-accent rounded-full" />}
          </button>
        </nav>
      </main>

      <AddSubscriptionModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        userId={user.id} 
        editSubscription={editSubscription}
        defaultCurrency={userProfile?.currency}
      />
      <Chatbot userId={user.id} />
    </div>
  );
}

