import { useState, useEffect, useMemo } from 'react';
import { User, signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
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
    const unsub = subscribeToUserSubscriptions(user.uid, (subs) => {
      setSubscriptions(subs);
    }, (error) => console.error('Error fetching subscriptions for notifications:', error));
    return () => unsub();
  }, [user.uid]);

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
      await updateUserProfile(user.uid, { theme: newTheme });
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
    return userEmail === 'ruialexandrepina@gmail.com' || userProfile?.isAdmin === true;
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

  const handleLogout = () => signOut(auth);

  return (
    <div className="flex h-screen bg-bg overflow-hidden text-text-main relative">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-[70] w-64 bg-card border-r border-border-dim flex flex-col transition-transform duration-300 lg:static lg:translate-x-0 outline-none",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8 flex items-center justify-between">
          <button 
            onClick={() => {
              setActiveView('dashboard');
              setIsSidebarOpen(false);
            }}
            className="text-2xl font-black tracking-tighter text-accent flex items-center gap-2 hover:opacity-80 transition-opacity active:scale-95 group"
          >
            <div className="relative w-10 h-10 group-hover:rotate-12 transition-transform duration-500 rounded-xl overflow-hidden shadow-lg shadow-accent/20 border border-accent/20">
              <img 
                src="/logo.png?v=1.3" 
                alt="Trackify Logo" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <span className="font-display lowercase tracking-tight text-3xl">trackify.</span>
          </button>
          <button className="lg:hidden p-2 text-text-muted hover:text-accent" onClick={() => setIsSidebarOpen(false)}>
            <Plus className="rotate-45" size={24} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id as ViewType)}
              className={cn(
                "w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl text-[13px] font-bold tracking-tight transition-all group relative",
                activeView === item.id 
                  ? "bg-accent/10 text-accent border border-accent/20" 
                  : "text-text-muted hover:text-text-main hover:bg-bg border border-transparent hover:border-border-dim"
              )}
            >
              <item.icon size={20} className={cn(
                "transition-all duration-300",
                activeView === item.id ? "text-accent scale-110" : "text-text-muted/60 group-hover:text-text-main group-hover:scale-110"
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

        <div className="p-4 mt-auto">
          <div className="bg-accent/5 border border-accent/10 rounded-3xl p-6 mb-4 hidden sm:block relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-accent/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
            <div className="flex items-center justify-between mb-2">
              <p className="micro-label">Upgrade Pro</p>
              <span className="text-[8px] font-black bg-accent/20 text-accent px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">Brevemente</span>
            </div>
            <p className="text-[11px] text-text-muted mb-4 leading-relaxed font-semibold">Desbloqueia insights profundos e controlo absoluto.</p>
            <button 
              disabled
              className="w-full py-3 bg-accent/50 text-white/50 text-[10px] font-black rounded-xl cursor-not-allowed uppercase tracking-[0.2em]"
            >
              INDISPONÍVEL
            </button>
          </div>

          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-red-500/70 hover:text-red-500 hover:bg-red-500/5 transition-all group"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-20 bg-card border-b border-border-dim flex items-center justify-between px-4 sm:px-8 shrink-0 z-50">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-text-muted hover:text-accent bg-bg rounded-xl border border-border-dim"
            >
              <LayoutDashboard size={20} />
            </button>
            <div className="hidden md:flex items-center gap-4 bg-bg px-4 py-2 rounded-2xl w-64 lg:w-96 border border-border-dim focus-within:border-accent focus-within:bg-card transition-all group">
              <Search size={18} className="text-text-muted group-focus-within:text-accent" />
              <input 
                type="text" 
                placeholder="Pesquisar..." 
                className="bg-transparent border-none outline-none text-sm w-full text-text-main placeholder:text-text-muted/30"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-bg text-text-muted border border-border-dim hover:text-accent hover:border-accent transition-all group"
              title={localTheme === 'light' ? 'Mudar para Modo Escuro' : 'Mudar para Modo Claro'}
            >
              {localTheme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={cn(
                  "p-2.5 rounded-xl bg-bg text-text-muted border transition-all relative",
                  showNotifications ? "border-accent text-accent" : "border-border-dim hover:text-accent hover:border-accent"
                )}
              >
                <Bell size={18} />
                {urgentAlerts.length > 0 && (
                  <div className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full border-2 border-card animate-pulse shadow-lg shadow-accent/50"></div>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-4 w-72 sm:w-80 bg-card border border-border-dim rounded-[2.5rem] shadow-2xl z-50 overflow-hidden"
                  >
                    <div className="p-5 border-b border-border-dim flex items-center justify-between">
                      <h4 className="text-[10px] font-black text-text-main tracking-widest uppercase ml-2">Notificações</h4>
                      {urgentAlerts.length > 0 && (
                        <span className="text-[9px] font-black text-accent uppercase tracking-widest bg-accent/10 px-3 py-1 rounded-full">
                          {urgentAlerts.length} {urgentAlerts.length === 1 ? 'Pendente' : 'Pendentes'}
                        </span>
                      )}
                    </div>
                    
                    <div className="max-h-[400px] overflow-y-auto no-scrollbar">
                      {urgentAlerts.length > 0 ? (
                        <div className="p-4 space-y-3">
                          {urgentAlerts.map(sub => (
                            <button 
                              key={sub.id} 
                              onClick={() => {
                                setShowNotifications(false);
                                setActiveView('subscriptions');
                                handleEdit(sub as Subscription);
                              }}
                              className="w-full text-left p-4 bg-bg border border-border-dim rounded-2xl flex items-center gap-4 group hover:border-accent transition-all active:scale-[0.98]"
                            >
                              <div className="w-10 h-10 bg-card rounded-xl border border-border-dim flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-all shadow-sm shrink-0">
                                <IconRenderer name={sub.icon} size={18} fallback={<span className="font-black text-xs">{sub.name.charAt(0)}</span>} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-black text-text-main truncate uppercase tracking-tight">{sub.name}</p>
                                  <p className="text-[10px] font-black text-accent whitespace-nowrap">
                                    {formatCurrency(sub.amount, userProfile?.currency || 'EUR')}
                                  </p>
                                </div>
                                <p className="text-[9px] text-text-muted font-bold mt-1 uppercase tracking-widest flex items-center gap-1.5 opacity-70">
                                  <AlertCircle size={10} className="text-accent" />
                                  Vence a {format(sub.nextDate, "dd 'de' MMM", { locale: pt })}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="p-10 flex flex-col items-center text-center">
                          <div className="w-16 h-16 bg-bg rounded-3xl flex items-center justify-center mb-4 border border-border-dim relative overflow-hidden group">
                            <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <Bell size={24} className="text-text-muted/20 relative z-10" />
                          </div>
                          <p className="text-xs font-black text-text-main mb-1">Tudo limpo por aqui!</p>
                          <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest leading-relaxed opacity-60">
                            Não tens nenhuma notificação de cobrança pendente para os próximos dias.
                          </p>
                        </div>
                      )}
                    </div>

                    {urgentAlerts.length > 0 && (
                      <div className="p-4 bg-bg/50 border-t border-border-dim">
                        <button 
                          onClick={() => {
                            setActiveView('calendar');
                            setShowNotifications(false);
                          }}
                          className="w-full py-3 bg-card border border-border-dim rounded-xl text-[9px] font-black uppercase tracking-[0.2em] text-text-muted hover:text-accent hover:border-accent transition-all"
                        >
                          Ver no Calendário
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <div className="h-8 w-px bg-border-dim mx-1 hidden sm:block"></div>
            
            <button 
              onClick={() => setActiveView('settings')}
              className="hidden sm:flex items-center gap-3 hover:opacity-80 transition-opacity text-left"
            >
              <div className="text-right hidden lg:block">
                <p className="text-sm font-black text-text-main leading-tight tracking-tight">{userProfile?.displayName || user.displayName || 'Utilizador'}</p>
                <p className={cn(
                  "text-[10px] font-black uppercase tracking-widest",
                  isAdmin ? "text-accent" : "text-text-muted"
                )}>
                  {isAdmin ? 'Administrador' : (userProfile?.isPremium ? 'Premium User' : 'Standard User')}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-accent overflow-hidden flex items-center justify-center text-white text-xs font-black shadow-lg shadow-accent/20 border-2 border-accent">
                {userProfile?.photoURL ? (
                  <img src={userProfile.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  (userProfile?.displayName || user.displayName || 'U').charAt(0).toUpperCase()
                )}
              </div>
            </button>

            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-4 sm:px-6 py-2.5 sm:py-3 bg-accent text-white rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black hover:bg-accent/90 transition-all flex items-center gap-2 shadow-xl shadow-accent/20 uppercase tracking-widest active:scale-95"
            >
              <Plus size={18} className="sm:size-[18px]" />
              <span className="hidden xs:inline">Adicionar</span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-bg p-4 sm:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-6xl mx-auto"
            >
              {activeView === 'dashboard' && <Dashboard userId={user.uid} userProfile={userProfile} onNavigate={handleNavigate} />}
              {activeView === 'subscriptions' && <SubscriptionList userId={user.uid} onEdit={handleEdit} currency={userProfile?.currency} />}
              {activeView === 'calendar' && <CalendarView userId={user.uid} currency={userProfile?.currency} />}
              {activeView === 'analytics' && <AnalyticsView userId={user.uid} currency={userProfile?.currency} />}
              {activeView === 'admin' && isAdmin && <AdminDashboard />}
              {activeView === 'settings' && <SettingsView user={user} initialTab={settingsTab as any} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <AddSubscriptionModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        userId={user.uid} 
        editSubscription={editSubscription}
        defaultCurrency={userProfile?.currency}
      />
      <Chatbot userId={user.uid} />
    </div>
  );
}

