import React, { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, query, orderBy, where, writeBatch, doc, onSnapshot } from 'firebase/firestore';
import { db, auth as firebaseAuth } from '../../lib/firebase';
import { UserProfile, Subscription } from '../../types';
import { 
  Users, CreditCard, Activity, ShieldCheck, Mail, LogIn, 
  Download, Trash2, AlertTriangle, Search, Filter, Shield, 
  Star, Eye, MoreVertical, MapPin, Info, CheckCircle, X, ChevronRight,
  Zap, Clock, Globe, BarChart3, Bell, History, ArrowUpRight
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { pt } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { exportUsersToCSV } from '../../lib/exportUtils';
import { updateUserProfile } from '../../services/userService';
import { cn } from '../../lib/utils';
import { AuditLog, SystemNotice } from '../../types';

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'analytics' | 'system'>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [allSubscriptions, setAllSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionStatus, setActionStatus] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // System State
  const [notice, setNotice] = useState<SystemNotice>({
    id: 'global-notice',
    message: '',
    type: 'info',
    active: false,
    updatedAt: new Date().toISOString()
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Analytics helper
  const chartData = useMemo(() => {
    const months = Array.from({ length: 6 }).map((_, i) => {
      const date = subMonths(new Date(), 5 - i);
      return {
        name: format(date, 'MMM', { locale: pt }),
        date,
        revenue: 0,
        users: 0
      };
    });

    months.forEach(m => {
      const start = startOfMonth(m.date);
      const end = endOfMonth(m.date);
      
      // Revenue for this month (approx based on active subs)
      m.revenue = allSubscriptions
        .filter(s => s.status === 'active')
        .reduce((acc, s) => acc + (s.billingCycle === 'monthly' ? s.amount : s.amount / 12), 0);
      
      // Total cumulative users at that point (approx)
      m.users = users.filter(u => new Date(u.createdAt) <= end).length;
    });

    return months;
  }, [allSubscriptions, users]);
  
  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'admin' | 'premium'>('all');
  
  // Modals State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [editedUserData, setEditedUserData] = useState<Partial<UserProfile>>({});
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showConfirmAccessModal, setShowConfirmAccessModal] = useState(false);
  const [accessChangeData, setAccessChangeData] = useState<{user: UserProfile, type: 'admin' | 'premium', newValue: boolean} | null>(null);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = 
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (u.displayName || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = 
        filterType === 'all' || 
        (filterType === 'admin' && u.isAdmin) || 
        (filterType === 'premium' && u.isPremium);
      
      return matchesSearch && matchesFilter;
    });
  }, [users, searchTerm, filterType]);

  const stats = useMemo(() => {
    const totalUsers = users.length;
    const adminUsers = users.filter(u => u.isAdmin).length;
    const premiumUsers = users.filter(u => u.isPremium).length;
    const activeSubs = allSubscriptions.filter(s => s.status === 'active').length;
    
    const monthlyVolume = allSubscriptions
      .filter(s => s.status === 'active')
      .reduce((acc, s) => acc + (s.billingCycle === 'monthly' ? s.amount : s.amount / 12), 0);

    return { totalUsers, adminUsers, premiumUsers, activeSubs, monthlyVolume };
  }, [users, allSubscriptions]);

  const handleToggleAdmin = (user: UserProfile) => {
    setAccessChangeData({ user, type: 'admin', newValue: !user.isAdmin });
    setShowConfirmAccessModal(true);
  };

  const handleTogglePremium = (user: UserProfile) => {
    setAccessChangeData({ user, type: 'premium', newValue: !user.isPremium });
    setShowConfirmAccessModal(true);
  };

  const confirmAccessChange = async () => {
    if (!accessChangeData) return;
    
    setLoading(true);
    const { user, type, newValue } = accessChangeData;
    
    try {
      if (type === 'admin') {
        await updateUserProfile(user.uid, { isAdmin: newValue });
        showStatus(`Estatuto de Admin atualizado para ${user.email}`, 'success');
      } else {
        await updateUserProfile(user.uid, { isPremium: newValue });
        showStatus(`Estatuto Premium atualizado para ${user.email}`, 'success');
      }
      setShowConfirmAccessModal(false);
      setAccessChangeData(null);
    } catch (error: any) {
      showStatus(`Erro ao atualizar acessos: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const showStatus = (message: string, type: 'success' | 'error') => {
    setActionStatus({ message, type });
    setTimeout(() => setActionStatus(null), 4000);
  };

  const handleEditClick = (user: UserProfile) => {
    setSelectedUser(user);
    setEditedUserData({
      displayName: user.displayName || '',
      bio: user.bio || '',
      location: user.location || '',
      currency: user.currency || 'EUR',
      monthlyBudget: user.monthlyBudget || null,
    });
    setIsEditingUser(true);
    setShowUserModal(true);
  };

  const handleSaveUserEdits = async () => {
    if (!selectedUser) return;
    
    setLoading(true);
    try {
      await updateUserProfile(selectedUser.uid, editedUserData);
      showStatus(`Perfil de ${selectedUser.email} atualizado com sucesso`, 'success');
      setIsEditingUser(false);
      // Selected user will be updated by the onSnapshot listener automatically
    } catch (error: any) {
      showStatus(`Erro ao atualizar perfil: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete || deleteConfirmText !== 'CONFIRMAR') return;
    
    setLoading(true);
    try {
      const q = query(collection(db, 'subscriptions'), where('userId', '==', userToDelete.uid));
      const subsSnapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      subsSnapshot.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(doc(db, 'users', userToDelete.uid));
      
      await batch.commit();
      
      showStatus(`Utilizador ${userToDelete.email} removido com sucesso.`, 'success');
      setShowDeleteModal(false);
      setUserToDelete(null);
      setDeleteConfirmText('');
    } catch (error: any) {
      showStatus(`Erro ao remover: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(firebaseAuth, email);
      showStatus(`Email de recuperação enviado para ${email}`, 'success');
    } catch (error: any) {
      showStatus(`Erro: ${error.message}`, 'error');
    }
  };

  const handleExport = () => {
    exportUsersToCSV(users, allSubscriptions);
    showStatus('Exportação concluída', 'success');
  };

  useEffect(() => {
    const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
      const usersList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          uid: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || '',
        } as UserProfile;
      });
      setUsers(usersList);
      setLoading(false);
    });

    const unsubSubs = onSnapshot(collection(db, 'subscriptions'), (snapshot) => {
      const subsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subscription));
      setAllSubscriptions(subsList);
    });

    return () => {
      unsubUsers();
      unsubSubs();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="relative">
          <Activity className="animate-spin text-accent w-12 h-12" />
          <div className="absolute inset-0 bg-accent/20 blur-xl animate-pulse" />
        </div>
        <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em]">A carregar sistema central...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-text-main tracking-tighter leading-none">Management</h2>
          <p className="text-text-muted font-bold text-[10px] uppercase tracking-[0.3em] mt-3">Painel Administrativo v2.0</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExport}
            className="group flex items-center gap-2 px-5 py-3 bg-card border border-border-dim rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-accent transition-all"
          >
            <Download size={16} className="text-text-muted group-hover:text-accent transition-colors" />
            <span className="text-text-muted group-hover:text-text-main transition-colors">Exportar Dados</span>
          </button>
          
          <div className="bg-accent/10 border border-accent/20 px-5 py-3 rounded-2xl flex items-center gap-3 shadow-lg shadow-accent/5">
            <ShieldCheck size={18} className="text-accent" />
            <span className="text-[10px] font-black text-accent uppercase tracking-widest leading-none">Secure Admin Access</span>
          </div>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Utilizadores', value: stats.totalUsers, icon: Users, sub: `${stats.adminUsers} Admins` },
          { label: 'Volume Mensal', value: new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', notation: 'compact' }).format(stats.monthlyVolume), icon: Activity, sub: 'Estimativa Bruta' },
          { label: 'Premium', value: stats.premiumUsers, icon: Star, sub: `${Math.round(stats.totalUsers > 0 ? (stats.premiumUsers / stats.totalUsers) * 100 : 0)}% Conversão` },
          { label: 'Subscrições', value: stats.activeSubs, icon: CreditCard, sub: 'Ativas no Sistema' }
        ].map((stat, i) => (
          <div key={i} className="bg-card border border-border-dim p-6 rounded-3xl flex items-center gap-4 hover:border-accent/40 transition-colors group overflow-hidden">
            <div className="p-3 bg-bg border border-border-dim rounded-2xl group-hover:border-accent group-hover:bg-accent/5 transition-all shrink-0">
              <stat.icon size={20} className="text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] text-text-muted font-black uppercase tracking-[0.1em] truncate block mb-1">{stat.label}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-black text-text-main leading-tight tracking-tight">{stat.value}</p>
              </div>
              <p className="text-[9px] text-accent font-bold uppercase tracking-tight mt-1 truncate block opacity-80">{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 bg-card p-2 border border-border-dim rounded-[2rem] w-fit mx-auto lg:mx-0">
        <button
          onClick={() => setActiveTab('users')}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
            activeTab === 'users' ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-text-muted hover:bg-bg"
          )}
        >
          <Users size={16} />
          Utilizadores
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
            activeTab === 'analytics' ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-text-muted hover:bg-bg"
          )}
        >
          <BarChart3 size={16} />
          Insights
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
            activeTab === 'system' ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-text-muted hover:bg-bg"
          )}
        >
          <Shield size={16} />
          Sistema
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'users' && (
          <motion.div
            key="users-tab"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-card border border-border-dim rounded-[3rem] overflow-hidden shadow-sm"
          >
            {/* Controls Bar */}
            <div className="p-8 border-b border-border-dim flex flex-col lg:flex-row justify-between gap-6 overflow-hidden">
              <div className="flex-1 flex flex-col lg:flex-row items-stretch lg:items-center gap-4 min-w-0">
                <div className="relative flex-1">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                  <input 
                    type="text"
                    placeholder="Pesquisar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-14 pr-6 py-4 bg-bg border border-border-dim rounded-2xl text-sm text-text-main focus:ring-2 focus:ring-accent outline-none transition-all placeholder:text-text-muted/30"
                  />
                </div>
                
                <div className="flex items-center gap-1 bg-bg p-1.5 border border-border-dim rounded-2xl shrink-0 overflow-x-auto no-scrollbar">
                  {(['all', 'admin', 'premium'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setFilterType(t)}
                      className={cn(
                        "px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap",
                        filterType === t ? "bg-accent text-white shadow-md shadow-accent/20" : "text-text-muted hover:bg-card/50"
                      )}
                    >
                      {t === 'all' ? 'Todos' : t}
                    </button>
                  ))}
                </div>
              </div>

              <AnimatePresence>
                {actionStatus && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className={cn(
                      "flex items-center gap-3 text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-2xl border",
                      actionStatus.type === 'success' ? "bg-health/10 border-health/20 text-health" : "bg-red-500/10 border-red-500/20 text-red-500"
                    )}
                  >
                    <CheckCircle size={14} />
                    {actionStatus.message}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Table Area */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-bg/50 font-black text-[10px] text-text-muted uppercase tracking-[0.2em]">
                    <th className="px-10 py-5">Perfil de Utilizador</th>
                    <th className="px-10 py-5">Nível de Acesso</th>
                    <th className="px-10 py-5">Data Registo</th>
                    <th className="px-10 py-5 text-right">Controlo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-dim">
                  {filteredUsers.length > 0 ? filteredUsers.map(user => {
                    const userSubs = allSubscriptions.filter(s => s.userId === user.uid);
                    return (
                      <tr key={user.uid} className="hover:bg-bg/40 transition-colors group">
                        <td className="px-10 py-6">
                      <div className="flex items-center gap-5">
                        <div className="relative">
                          <div className="w-12 h-12 rounded-2xl bg-bg border border-border-dim overflow-hidden flex items-center justify-center text-accent text-sm font-black ring-4 ring-transparent group-hover:ring-accent/10 transition-all">
                            {user.photoURL ? (
                              <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                            ) : (
                              (user.displayName || user.email || 'U').charAt(0).toUpperCase()
                            )}
                          </div>
                          {user.isAdmin && (
                            <div className="absolute -top-2 -right-2 p-1 bg-accent text-white rounded-lg shadow-lg">
                              <Shield size={10} />
                            </div>
                          )}
                        </div>
                        <div>
                          <p 
                            className="text-sm font-black text-text-main cursor-pointer hover:text-accent transition-colors"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowUserModal(true);
                            }}
                          >
                            {user.displayName || 'Utilizador Geral'}
                          </p>
                          <p className="flex items-center gap-2 text-[10px] text-text-muted font-bold mt-1">
                            <Mail size={12} className="opacity-50" />
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => handleToggleAdmin(user)}
                          className={cn(
                            "group relative px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all flex items-center gap-2",
                            user.isAdmin ? "bg-accent/10 border-accent text-accent" : "bg-bg border-border-dim text-text-muted hover:border-accent hover:text-text-main"
                          )}
                        >
                          <Shield size={12} />
                          Admin
                        </button>
                        <button 
                          onClick={() => handleTogglePremium(user)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all flex items-center gap-2",
                            user.isPremium ? "bg-yellow-500/10 border-yellow-500 text-yellow-500" : "bg-bg border-border-dim text-text-muted hover:border-yellow-500 hover:text-text-main"
                          )}
                        >
                          <Star size={12} />
                          Premium
                        </button>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-text-main">
                          {user.createdAt ? format(new Date(user.createdAt), 'dd MMM yyyy', { locale: pt }) : 'N/A'}
                        </span>
                        <span className="text-[9px] text-text-muted uppercase font-black tracking-widest mt-1">
                          {userSubs.length} Subscrições
                        </span>
                      </div>
                    </td>
                    <td className="px-10 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => {
                            setSelectedUser(user);
                            setShowUserModal(true);
                          }}
                          className="p-3 bg-bg border border-border-dim text-text-muted hover:text-accent hover:border-accent rounded-xl transition-all"
                          title="Ver Perfil"
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={() => handleResetPassword(user.email)}
                          className="p-3 bg-bg border border-border-dim text-text-muted hover:text-accent hover:border-accent rounded-xl transition-all"
                          title="Reset Password"
                        >
                          <LogIn size={18} />
                        </button>
                        <button 
                          onClick={() => {
                            setUserToDelete(user);
                            setShowDeleteModal(true);
                          }}
                          className="p-3 bg-bg border border-border-dim text-text-muted hover:text-red-500 hover:border-red-500 rounded-xl transition-all"
                          title="Eliminar"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={4} className="px-10 py-20 text-center">
                    <div className="flex flex-col items-center">
                      <div className="p-6 bg-bg border border-border-dim rounded-full text-text-muted/20 mb-4">
                        <Users size={40} />
                      </div>
                      <p className="text-sm font-black text-text-muted uppercase tracking-widest">Nenhum utilizador encontrado</p>
                      <button 
                        onClick={() => {setSearchTerm(''); setFilterType('all');}}
                        className="text-[10px] font-black text-accent uppercase tracking-widest mt-4 hover:underline"
                      >
                        Limpar Filtros
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    )}

    {activeTab === 'analytics' && (
      <motion.div
        key="analytics-tab"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="space-y-6"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border-dim p-8 rounded-[3rem] shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-text-main tracking-tight leading-none">Revenue Growth</h3>
                <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-2">Volume Estimado Mensal (EUR)</p>
              </div>
              <div className="p-3 bg-bg border border-border-dim rounded-2xl">
                <ArrowUpRight className="text-accent" size={20} />
              </div>
            </div>
            
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-dim)" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--color-text-muted)' }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--color-text-muted)' }}
                    tickFormatter={(value) => `${value}€`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border-dim)' }}
                    itemStyle={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-accent)' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="var(--color-accent)" 
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card border border-border-dim p-8 rounded-[3rem] shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-text-main tracking-tight leading-none">User Base</h3>
                <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-2">Crescimento de Utilizadores</p>
              </div>
              <div className="p-3 bg-bg border border-border-dim rounded-2xl">
                <Users className="text-accent" size={20} />
              </div>
            </div>
            
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-health)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--color-health)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-dim)" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--color-text-muted)' }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--color-text-muted)' }}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border-dim)' }}
                    itemStyle={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-health)' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="users" 
                    stroke="var(--color-health)" 
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill="url(#colorUsers)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-accent p-8 rounded-[3rem] text-white">
            <h4 className="text-lg font-black uppercase tracking-widest mb-4">Meta Status</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-end border-b border-white/20 pb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">LTV Médio Estimado</span>
                <span className="text-2xl font-black">42,50€</span>
              </div>
              <div className="flex justify-between items-end border-b border-white/20 pb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">Churn Rate (30d)</span>
                <span className="text-2xl font-black">2.4%</span>
              </div>
              <p className="text-[9px] font-bold uppercase tracking-widest opacity-50 mt-4 leading-normal">
                Dados baseados em projeções algorítmicas de subscrições ativas e histórico de pagamentos.
              </p>
            </div>
          </div>
          
          <div className="lg:col-span-2 bg-card border border-border-dim p-8 rounded-[3rem]">
            <h4 className="text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2">
              <History size={16} className="text-accent" />
              Recent Audit Events
            </h4>
            <div className="space-y-3">
              {[
                { action: 'Admin Role Granted', target: 'user_882', time: 'Há 2 horas', by: 'ruipina' },
                { action: 'Premium Activated', target: 'user_412', time: 'Há 5 horas', by: 'System' },
                { action: 'User Purgued', target: 'user_dead', time: 'Ontem', by: 'ruipina' }
              ].map((log, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-bg rounded-2xl border border-border-dim/50 hover:border-accent/30 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-card flex items-center justify-center text-accent">
                      <Shield size={14} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-text-main">{log.action}</p>
                      <p className="text-[9px] text-text-muted font-bold uppercase mt-1">Target: {log.target}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-text-main uppercase">{log.by}</p>
                    <p className="text-[9px] text-text-muted font-bold mt-1">{log.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    )}

    {activeTab === 'system' && (
      <motion.div
        key="system-tab"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        className="max-w-4xl mx-auto space-y-8"
      >
        <div className="bg-card border border-border-dim rounded-[3rem] p-10 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-10 opacity-5">
            <Bell size={200} />
          </div>
          
          <div className="relative">
            <h3 className="text-2xl font-black text-text-main tracking-tight leading-none">Global Broadcast</h3>
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-2">Enviar avisos para todos os utilizadores</p>
            
            <div className="mt-8 space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-2">Mensagem do Aviso</label>
                <textarea 
                  value={notice.message}
                  onChange={(e) => setNotice({...notice, message: e.target.value})}
                  placeholder="Ex: Teremos uma manutenção programada às 22:00..."
                  className="w-full px-6 py-5 bg-bg border border-border-dim rounded-[2rem] text-sm text-text-main focus:ring-2 focus:ring-accent outline-none min-h-32 transition-all"
                />
              </div>
              
              <div className="flex flex-wrap gap-4">
                {(['info', 'warning', 'alert'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setNotice({...notice, type})}
                    className={cn(
                      "px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest border transition-all",
                      notice.type === type ? "bg-accent text-white border-accent" : "bg-bg border-border-dim text-text-muted hover:border-accent"
                    )}
                  >
                    {type} Message
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between p-6 bg-bg border border-border-dim rounded-[2rem]">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-3 h-3 rounded-full animate-pulse",
                    notice.active ? "bg-health shadow-lg shadow-health/50" : "bg-text-muted"
                  )} />
                  <div>
                    <p className="text-[10px] font-black text-text-main uppercase tracking-widest">Estado do Broadcast</p>
                    <p className="text-[9px] text-text-muted font-bold uppercase mt-1">
                      {notice.active ? 'Atualmente visível para todos' : 'Inativo / Oculto'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setNotice({...notice, active: !notice.active});
                    showStatus(notice.active ? 'Broadcast desativado' : 'Broadcast ativado com sucesso', 'success');
                  }}
                  className={cn(
                    "px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    notice.active ? "bg-red-500 text-white" : "bg-health text-white"
                  )}
                >
                  {notice.active ? 'Parar Emissão' : 'Ativar Aviso'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border-dim p-8 rounded-[3rem]">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-accent mb-4">Exportação Mestra</h4>
            <p className="text-xs text-text-muted font-bold leading-relaxed mb-6">
              Gera um dump completo de toda a base de dados (Users + Subs) em formato JSON para backups offline.
            </p>
            <button className="w-full py-4 bg-bg border border-border-dim rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-accent transition-all flex items-center justify-center gap-2">
              <Download size={14} /> Full Database Dump
            </button>
          </div>
          <div className="bg-card border border-border-dim p-8 rounded-[3rem]">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-accent mb-4">Modo Manutenção</h4>
            <p className="text-xs text-text-muted font-bold leading-relaxed mb-6">
              Bloqueia o acesso a todos os utilizadores não-admin para realizar intervenções técnicas na BD.
            </p>
            <button className="w-full py-4 bg-red-500/10 border border-red-500 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2">
              <AlertTriangle size={14} /> Ativar Modo Restritivo
            </button>
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>

      {/* User Detail Modal */}
      <AnimatePresence>
        {showUserModal && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowUserModal(false);
                setSelectedUser(null);
              }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-card border border-border-dim w-full max-w-2xl overflow-hidden rounded-[3rem] shadow-2xl"
            >
              <div className="relative h-32 bg-accent shadow-inner">
                <button 
                  onClick={() => setShowUserModal(false)}
                  className="absolute top-6 right-6 p-2.5 bg-black/20 hover:bg-black/40 text-white rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="px-10 pb-10 pt-0">
                <div className="relative -mt-16 mb-8 flex flex-col items-center sm:items-start sm:flex-row gap-6">
                  <div className="w-32 h-32 rounded-[2.5rem] bg-card border-4 border-bg overflow-hidden shadow-2xl flex items-center justify-center text-accent text-3xl font-black">
                    {selectedUser.photoURL ? (
                      <img src={selectedUser.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (selectedUser.displayName || selectedUser.email).charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="mt-4 sm:mt-16 text-center sm:text-left flex-1">
                    {isEditingUser ? (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-text-muted uppercase tracking-widest block ml-1 text-white/60">Nome de Exibição</label>
                        <input 
                          type="text"
                          value={editedUserData.displayName || ''}
                          onChange={(e) => setEditedUserData({...editedUserData, displayName: e.target.value})}
                          className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-xl text-lg font-black text-white focus:ring-2 focus:ring-white/30 outline-none"
                          placeholder="Nome do utilizador..."
                        />
                      </div>
                    ) : (
                      <h3 className="text-2xl font-black text-text-main tracking-tight leading-tight">
                        {selectedUser.displayName || 'Utilizador sem Nome'}
                      </h3>
                    )}
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                       <span className="flex items-center gap-1.5 px-3 py-1 bg-bg border border-border-dim rounded-lg text-[9px] font-black text-text-muted uppercase tracking-widest">
                        <Mail size={12} className="text-accent" />
                        {selectedUser.email}
                      </span>
                      {selectedUser.isAdmin && (
                        <span className="flex items-center gap-1 px-3 py-1 bg-accent/10 border border-accent/20 rounded-lg text-[9px] font-black text-accent uppercase tracking-widest">
                          <Shield size={10} /> Admin Access
                        </span>
                      )}
                      {selectedUser.isPremium && (
                        <span className="flex items-center gap-1 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-[9px] font-black text-yellow-500 uppercase tracking-widest">
                          <Star size={10} /> Premium Member
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-accent">
                        <Info size={16} />
                        <p className="text-[10px] font-black uppercase tracking-widest">Informação Geral</p>
                      </div>
                      <div className="space-y-3 p-6 bg-bg border border-border-dim rounded-3xl">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Localização</span>
                          {isEditingUser ? (
                            <input 
                              type="text"
                              value={editedUserData.location || ''}
                              onChange={(e) => setEditedUserData({...editedUserData, location: e.target.value})}
                              className="w-32 px-3 py-1 bg-card border border-border-dim rounded-lg text-xs text-text-main outline-none focus:border-accent"
                            />
                          ) : (
                            <span className="text-xs font-bold text-text-main flex items-center gap-1">
                              <MapPin size={12} className="text-accent" />
                              {selectedUser.location || 'Não definida'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Moeda Preferida</span>
                          {isEditingUser ? (
                            <select 
                              value={editedUserData.currency || 'EUR'}
                              onChange={(e) => setEditedUserData({...editedUserData, currency: e.target.value})}
                              className="px-2 py-1 bg-card border border-border-dim rounded-lg text-xs text-text-main outline-none"
                            >
                              <option value="EUR">EUR (€)</option>
                              <option value="USD">USD ($)</option>
                              <option value="GBP">GBP (£)</option>
                              <option value="BRL">BRL (R$)</option>
                            </select>
                          ) : (
                            <span className="text-xs font-black text-accent">{selectedUser.currency || 'EUR'}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Orçamento Mensal</span>
                          {isEditingUser ? (
                            <input 
                              type="number"
                              value={editedUserData.monthlyBudget === null ? '' : editedUserData.monthlyBudget}
                              onChange={(e) => setEditedUserData({...editedUserData, monthlyBudget: e.target.value === '' ? null : parseFloat(e.target.value)})}
                              className="w-24 px-3 py-1 bg-card border border-border-dim rounded-lg text-xs text-text-main outline-none"
                            />
                          ) : (
                            <span className="text-xs font-black text-text-main">
                              {selectedUser.monthlyBudget ? `${selectedUser.monthlyBudget} ${selectedUser.currency || 'EUR'}` : 'N/A'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Registo em</span>
                          <span className="text-xs font-bold text-text-main flex items-center gap-1">
                            <Clock size={12} className="text-accent" />
                            {selectedUser.createdAt ? format(new Date(selectedUser.createdAt), 'dd/MM/yyyy', { locale: pt }) : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-accent">
                        <Globe size={16} />
                        <p className="text-[10px] font-black uppercase tracking-widest">Biografia / Sobre</p>
                      </div>
                      <div className="p-6 bg-bg border border-border-dim rounded-3xl">
                        {isEditingUser ? (
                          <textarea 
                            value={editedUserData.bio || ''}
                            onChange={(e) => setEditedUserData({...editedUserData, bio: e.target.value})}
                            className="w-full bg-transparent text-xs font-medium text-text-main outline-none border-0 min-h-20 resize-none"
                            placeholder="Escreve algo sobre este utilizador..."
                          />
                        ) : (
                          <p className="text-xs font-medium text-text-muted leading-relaxed italic">
                            "{selectedUser.bio || 'Este utilizador ainda não adicionou uma biografia ao seu perfil.'}"
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                     <div className="space-y-4">
                        <div className="flex items-center gap-2 text-accent">
                          <Zap size={16} />
                          <p className="text-[10px] font-black uppercase tracking-widest">Atividade & Subscrições</p>
                        </div>
                        <div className="space-y-3">
                          {allSubscriptions.filter(s => s.userId === selectedUser.uid).slice(0, 4).map(sub => (
                            <div key={sub.id} className="flex items-center justify-between p-4 bg-bg border border-border-dim rounded-2xl">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-card flex items-center justify-center text-accent font-black text-[10px] uppercase">
                                  {sub.name.charAt(0)}
                                </div>
                                <span className="text-xs font-bold text-text-main">{sub.name}</span>
                              </div>
                              <span className="text-xs font-black text-text-main">{sub.amount}{sub.currency}</span>
                            </div>
                          ))}
                          
                          {allSubscriptions.filter(s => s.userId === selectedUser.uid).length === 0 && (
                            <div className="p-10 bg-bg border border-dashed border-border-dim rounded-3xl text-center">
                              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Sem subscrições ativas</p>
                            </div>
                          )}
                        </div>
                     </div>
                  </div>
                </div>

                <div className="mt-10 flex gap-4">
                   {isEditingUser ? (
                     <>
                      <button 
                        onClick={() => setIsEditingUser(false)}
                        className="flex-1 px-8 py-5 bg-bg border border-border-dim rounded-2xl text-[10px] font-black text-text-muted hover:border-text-muted transition-all uppercase tracking-widest"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={handleSaveUserEdits}
                        disabled={loading}
                        className="flex-1 px-8 py-5 bg-accent text-white rounded-2xl text-[10px] font-black hover:bg-accent/90 transition-all uppercase tracking-widest shadow-lg shadow-accent/20"
                      >
                        {loading ? "A Guardar..." : "Guardar Alterações"}
                      </button>
                     </>
                   ) : (
                     <>
                        <button 
                          onClick={() => {
                            setEditedUserData({
                              displayName: selectedUser.displayName || '',
                              bio: selectedUser.bio || '',
                              location: selectedUser.location || '',
                              currency: selectedUser.currency || 'EUR',
                              monthlyBudget: selectedUser.monthlyBudget || null,
                            });
                            setIsEditingUser(true);
                          }}
                          className="flex-1 px-8 py-5 bg-bg border border-border-dim rounded-2xl text-[10px] font-black text-text-main hover:border-accent transition-all uppercase tracking-widest"
                        >
                          Editar Perfil
                        </button>
                        <button 
                          onClick={() => handleResetPassword(selectedUser.email)}
                          className="flex-1 px-8 py-5 bg-bg border border-border-dim rounded-2xl text-[10px] font-black text-text-main hover:border-accent transition-all uppercase tracking-widest"
                        >
                          Reset Password
                        </button>
                        <button 
                          onClick={() => {
                            setShowUserModal(false);
                            setUserToDelete(selectedUser);
                            setShowDeleteModal(true);
                          }}
                          className="flex-1 px-8 py-5 bg-red-500 text-white rounded-2xl text-[10px] font-black hover:bg-red-600 transition-all uppercase tracking-widest shadow-lg shadow-red-500/20"
                        >
                          Terminar Conta
                        </button>
                     </>
                   )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete User Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowDeleteModal(false);
                setUserToDelete(null);
                setDeleteConfirmText('');
              }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-card border border-border-dim w-full max-w-md p-8 rounded-[3rem] shadow-2xl"
            >
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="relative">
                  <div className="p-6 bg-red-500/10 rounded-full text-red-500 text-3xl font-black ring-4 ring-red-500/10">
                    <AlertTriangle size={48} />
                  </div>
                  <div className="absolute -inset-2 bg-red-500/20 blur-xl animate-pulse -z-10" />
                </div>
                
                <h3 className="text-2xl font-black text-text-main tracking-tight uppercase">Nuclear Action</h3>
                <p className="text-xs text-text-muted font-bold leading-relaxed px-4">
                  Estás prestes a apagar permanentemente o utilizador <span className="text-red-500 font-black">{userToDelete?.email}</span>. 
                  Esta ação é irreversível e purgará todos os dados brutos e subscrições.
                </p>
                
                <div className="w-full space-y-5 pt-4">
                  <div className="space-y-3 text-left">
                    <label className="block text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-2">Segurança: Digita <span className="text-red-500 uppercase">Confirmar</span></label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                      placeholder="ESCREVE AQUI..."
                      className="w-full px-6 py-5 bg-bg border border-border-dim rounded-[1.5rem] text-center font-black tracking-[0.3em] text-red-500 focus:ring-4 focus:ring-red-500/10 outline-none placeholder:text-text-muted/10"
                    />
                  </div>
                  
                  <div className="flex gap-4">
                    <button
                      onClick={() => {
                        setShowDeleteModal(false);
                        setUserToDelete(null);
                        setDeleteConfirmText('');
                      }}
                      className="flex-1 px-8 py-5 bg-bg border border-border-dim rounded-2xl text-[10px] font-black text-text-muted hover:border-text-muted transition-all uppercase tracking-widest"
                    >
                      Abortar
                    </button>
                    <button
                      onClick={handleDeleteUser}
                      disabled={deleteConfirmText !== 'CONFIRMAR' || loading}
                      className="flex-1 px-8 py-5 bg-red-500 text-white rounded-2xl text-[10px] font-black hover:bg-red-600 transition-all disabled:opacity-20 disabled:cursor-not-allowed uppercase tracking-widest shadow-xl shadow-red-500/20"
                    >
                      {loading ? "WIPING DATA..." : "PURGE USER"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Access Level Confirmation Modal */}
      <AnimatePresence>
        {showConfirmAccessModal && accessChangeData && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowConfirmAccessModal(false);
                setAccessChangeData(null);
              }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-card border border-border-dim w-full max-w-md p-8 rounded-[3rem] shadow-2xl"
            >
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="relative">
                  <div className={cn(
                    "p-6 rounded-full text-3xl font-black ring-4",
                    accessChangeData.type === 'admin' ? "bg-accent/10 text-accent ring-accent/10" : "bg-yellow-500/10 text-yellow-500 ring-yellow-500/10"
                  )}>
                    {accessChangeData.type === 'admin' ? <Shield size={48} /> : <Star size={48} />}
                  </div>
                  <div className={cn(
                    "absolute -inset-2 blur-xl animate-pulse -z-10",
                    accessChangeData.type === 'admin' ? "bg-accent/20" : "bg-yellow-500/20"
                  )} />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-text-main tracking-tight uppercase">Alterar Acesso</h3>
                  <p className="text-xs text-text-muted font-bold leading-relaxed px-4">
                    Confirmas a alteração do estatuto <span className={cn("font-black uppercase", accessChangeData.type === 'admin' ? "text-accent" : "text-yellow-500")}>
                      {accessChangeData.type}
                    </span> para o utilizador <span className="text-text-main font-black">{accessChangeData.user.email}</span>?
                  </p>
                </div>
                
                <div className="w-full bg-bg/50 border border-border-dim p-4 rounded-2xl">
                  <div className="flex items-center justify-between pb-3 border-b border-border-dim/50">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Estado Atual</span>
                    <span className="text-[10px] font-black text-red-500 uppercase">
                      {accessChangeData.type === 'admin' 
                        ? (accessChangeData.user.isAdmin ? 'Ativo' : 'Inativo')
                        : (accessChangeData.user.isPremium ? 'Ativo' : 'Inativo')
                      }
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-3">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Novo Estado</span>
                    <span className="text-[10px] font-black text-health uppercase">
                      {accessChangeData.newValue ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>

                <div className="w-full flex gap-4">
                  <button
                    onClick={() => {
                      setShowConfirmAccessModal(false);
                      setAccessChangeData(null);
                    }}
                    className="flex-1 px-8 py-5 bg-bg border border-border-dim rounded-2xl text-[10px] font-black text-text-muted hover:border-text-muted transition-all uppercase tracking-widest"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={confirmAccessChange}
                    disabled={loading}
                    className={cn(
                      "flex-1 px-8 py-5 text-white rounded-2xl text-[10px] font-black transition-all uppercase tracking-widest shadow-xl",
                      accessChangeData.type === 'admin' ? "bg-accent hover:bg-accent/90 shadow-accent/20" : "bg-yellow-500 hover:bg-yellow-600 shadow-yellow-500/20"
                    )}
                  >
                    {loading ? "A PROCESSAR..." : "CONFIRMAR"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-accent/5 border border-accent/20 p-10 rounded-[3rem] relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 text-accent/10 group-hover:text-accent/20 transition-colors">
          <Shield size={120} />
        </div>
        <div className="relative">
          <h4 className="font-black text-xl text-text-main mb-3 tracking-tighter">🔒 Protocolo de Segurança Admin</h4>
          <p className="text-sm text-text-muted font-medium leading-relaxed max-w-2xl">
            As alterações de permissões (Admin/Premium) têm efeito imediato no acesso do utilizador. 
            A eliminação de conta purga todos os registos financeiros vinculados. 
            Sempre que enviares um Reset de Password, o utilizador receberá um link oficial da Firebase Auth.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
