import { useState, useEffect } from 'react';
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
  Shield
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Subscription, UserProfile } from '../../types';
import Dashboard from '../dashboard/Overview';
import SubscriptionList from '../subscriptions/SubscriptionList';
import CalendarView from '../calendar/CalendarView';
import AddSubscriptionModal from '../subscriptions/AddSubscriptionModal';
import AdminDashboard from '../admin/AdminDashboard';
import SettingsView from '../settings/Settings';
import { subscribeToUserProfile } from '../../services/userService';

interface ShellProps {
  user: User;
}

export type ViewType = 'dashboard' | 'subscriptions' | 'calendar' | 'settings' | 'admin';

export default function Shell({ user }: ShellProps) {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editSubscription, setEditSubscription] = useState<Subscription | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsub = subscribeToUserProfile(user.uid, (profile) => {
      setUserProfile(profile);
    });
    return () => unsub();
  }, [user.uid]);

  const handleEdit = (sub: Subscription) => {
    setEditSubscription(sub);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditSubscription(null);
  };

  const isAdmin = user.email === 'ruialexandrepina@gmail.com';

  const navItems = [
    { id: 'dashboard', label: 'Monitor', icon: LayoutDashboard },
    { id: 'subscriptions', label: 'Subscrições', icon: CreditCard },
    { id: 'calendar', label: 'Calendário', icon: Calendar },
    { id: 'settings', label: 'Definições', icon: Settings },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', label: 'Admin', icon: Shield });
  }

  const handleLogout = () => signOut(auth);

  return (
    <div className="flex h-screen bg-bg overflow-hidden text-text-main">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border-dim flex flex-col">
        <div className="p-8">
          <h1 className="text-xl font-extrabold tracking-tighter text-accent flex items-center gap-2">
            TRACKIFY
          </h1>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as ViewType)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all group",
                activeView === item.id 
                  ? "bg-accent text-white shadow-xl shadow-accent/20" 
                  : "text-text-muted hover:text-text-main hover:bg-bg border border-transparent hover:border-border-dim"
              )}
            >
              <item.icon size={18} className={cn(
                "transition-transform group-hover:scale-110",
                activeView === item.id ? "text-white" : "text-text-muted group-hover:text-text-main"
              )} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 mt-auto">
          <div className="bg-bg border border-border-dim rounded-3xl p-6 mb-4">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-1">Upgrade</p>
            <p className="text-xs text-text-muted mb-3 leading-relaxed">Obtenha insights ilimitados e notificações push.</p>
            <button className="w-full py-2 bg-card border border-border-dim text-[11px] font-bold rounded-xl hover:border-accent hover:text-accent transition-all">
              SABER MAIS
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
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-card border-b border-border-dim flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4 bg-bg px-4 py-2 rounded-2xl w-96 border border-border-dim focus-within:border-accent focus-within:bg-card transition-all group">
            <Search size={18} className="text-text-muted group-focus-within:text-accent" />
            <input 
              type="text" 
              placeholder="Pesquisar subscrições..." 
              className="bg-transparent border-none outline-none text-sm w-full text-text-main placeholder:text-text-muted/30"
            />
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2.5 rounded-xl bg-bg text-text-muted border border-border-dim hover:text-accent hover:border-accent transition-all relative">
              <Bell size={20} />
              <div className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full border-2 border-card"></div>
            </button>
            
            <div className="h-10 w-px bg-border-dim mx-2"></div>
            
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-bold text-text-main leading-tight">{user.displayName || 'Utilizador'}</p>
                <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Premium User</p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-accent flex items-center justify-center text-white text-xs font-black shadow-lg shadow-accent/20">
                {user.email?.charAt(0).toUpperCase()}
              </div>
            </div>

            <button 
              onClick={() => setIsModalOpen(true)}
              className="ml-4 px-6 py-3 bg-accent text-white rounded-2xl text-sm font-bold hover:bg-accent/90 transition-all flex items-center gap-2 shadow-xl shadow-accent/20"
            >
              <Plus size={18} />
              Adicionar
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-bg p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-6xl mx-auto"
            >
              {activeView === 'dashboard' && <Dashboard userId={user.uid} currency={userProfile?.currency} />}
              {activeView === 'subscriptions' && <SubscriptionList userId={user.uid} onEdit={handleEdit} currency={userProfile?.currency} />}
              {activeView === 'calendar' && <CalendarView userId={user.uid} currency={userProfile?.currency} />}
              {activeView === 'admin' && isAdmin && <AdminDashboard />}
              {activeView === 'settings' && <SettingsView user={user} />}
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
    </div>
  );
}

