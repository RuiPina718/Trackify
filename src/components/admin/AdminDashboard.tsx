import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { UserProfile, Subscription } from '../../types';
import { 
  Users, CreditCard, Activity, ShieldCheck, Mail, LogIn, 
  Download, Trash2, AlertTriangle, Search, Filter, Shield, 
  Star, Eye, MoreVertical, MapPin, Info, CheckCircle, X, ChevronRight,
  Zap, Clock, Globe, BarChart3, Bell, History, ArrowUpRight, Settings
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { pt } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { exportUsersToCSV } from '../../lib/exportUtils';
import { updateUserProfile, deleteUserProfile, subscribeToAllUsers } from '../../services/userService';
import { cn } from '../../lib/utils';
import { AuditLog, SystemNotice, AppConfig } from '../../types';
import { getAppConfig, updateAppConfig, subscribeToAppConfig } from '../../services/configService';
import { subscribeToLogs } from '../../services/auditService';

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'analytics' | 'system' | 'logs'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [logFilter, setLogFilter] = useState<'all' | 'create' | 'delete' | 'update' | 'system'>('all');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [allSubscriptions, setAllSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionStatus, setActionStatus] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  
  // Helper for CSV Export
  const exportLogsToCSV = (logs: AuditLog[]) => {
    const headers = ['Timestamp', 'Acao', 'Responsavel', 'ID Responsavel', 'Alvo', 'Detalhes'];
    const rows = logs.map(log => [
      log.timestamp,
      log.action,
      log.userId === 'system' ? 'Sistema' : log.userEmail,
      log.userId,
      `${log.targetType}/${log.targetId}`,
      log.details.replace(/,/g, ';')
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `audit_logs_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredLogs = auditLogs.filter(log => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      (log.userEmail || '').toLowerCase().includes(term) || 
      log.action.toLowerCase().includes(term) ||
      log.details.toLowerCase().includes(term) ||
      log.targetId.toLowerCase().includes(term);
    
    const actionLower = log.action.toLowerCase();
    const matchesFilter = logFilter === 'all' || 
                         (logFilter === 'create' && actionLower.includes('create')) ||
                         (logFilter === 'delete' && actionLower.includes('delete')) ||
                         (logFilter === 'update' && actionLower.includes('update')) ||
                         (logFilter === 'system' && (log.userId === 'system' || actionLower.includes('system')));
    
    return matchesSearch && matchesFilter;
  });
  
  // System State
  const [appConfig, setAppConfig] = useState<AppConfig>({
    maintenanceMode: false,
    maintenanceMessage: '',
    allowAdminsDuringMaintenance: true,
    updatedAt: new Date().toISOString()
  });
  const [notice, setNotice] = useState<SystemNotice>({
    id: 'global-notice',
    message: '',
    type: 'info',
    active: false,
    updatedAt: new Date().toISOString()
  });

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
  const [filterType, setFilterType] = useState<'all' | 'admin' | 'premium'>('all');
  
  // Modals State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [editedUserData, setEditedUserData] = useState<Partial<UserProfile>>({});
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showConfirmAccessModal, setShowConfirmAccessModal] = useState(false);
  const [showConfirmMaintenanceModal, setShowConfirmMaintenanceModal] = useState(false);
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
      // Use the centralized service that handles subscriptions, categories and profiles
      await deleteUserProfile(userToDelete.uid);
      
      showStatus(`Utilizador ${userToDelete.email} removido com sucesso.`, 'success');
      setShowDeleteModal(false);
      setUserToDelete(null);
      setDeleteConfirmText('');
    } catch (error: any) {
      showStatus(`Erro ao remover utilizador: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (email: string) => {
    try {
      await supabase.auth.resetPasswordForEmail(email);
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
    const unsubUsers = subscribeToAllUsers(
      (usersList) => {
        setUsers(usersList);
        setLoading(false);
      },
      (error) => {
        console.error('Critical error fetching users:', error);
        showStatus('Erro ao carregar lista de utilizadores. Verifica as permissões de admin.', 'error');
        setLoading(false);
      }
    );

    const fetchAllSubs = async () => {
      const { data } = await supabase.from('subscriptions').select('*');
      if (data) setAllSubscriptions(data.map(r => ({
        id: r.id, userId: r.user_id, name: r.name, icon: r.icon,
        amount: r.amount, currency: r.currency, billingCycle: r.billing_cycle,
        billingDay: r.billing_day, billingMonth: r.billing_month,
        category: r.category, status: r.status, startDate: r.start_date,
        createdAt: r.created_at, updatedAt: r.updated_at,
      } as Subscription)));
    };
    fetchAllSubs();
    const unsubSubs = () => {};

    const unsubConfig = subscribeToAppConfig((newConfig) => {
      setAppConfig(newConfig);
    });

    const unsubLogs = subscribeToLogs((newLogs) => {
      setAuditLogs(newLogs);
    });

    return () => {
      unsubUsers();
      unsubSubs();
      unsubConfig();
      unsubLogs();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="relative">
          <Activity className="animate-spin text-accent w-12 h-12" />
          <div className="absolute inset-0 bg-accent/20 blur-xl animate-pulse" />
        </div>
        <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.3em]">A carregar sistema central...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 px-1">
        <div className="text-center lg:text-left">
          <h2 className="text-3xl md:text-4xl font-bold text-text-main tracking-tighter leading-none">Management</h2>
          <p className="text-text-muted font-bold text-[9px] md:text-[10px] uppercase tracking-[0.3em] mt-3">Painel Administrativo v2.0</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button 
            onClick={handleExport}
            className="w-full sm:w-auto group flex items-center justify-center gap-2 px-5 py-3 bg-card border border-border-dim rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:border-accent transition-all"
          >
            <Download size={16} className="text-text-muted group-hover:text-accent transition-colors" />
            <span className="text-text-muted group-hover:text-text-main transition-colors">Exportar Dados</span>
          </button>
          
          <div className="w-full sm:w-auto bg-accent/10 border border-accent/20 px-5 py-3 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-accent/5">
            <ShieldCheck size={18} className="text-accent" />
            <span className="text-[10px] font-bold text-accent uppercase tracking-widest leading-none">Secure Admin Access</span>
          </div>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Utilizadores', value: stats.totalUsers, icon: Users, sub: `${stats.adminUsers} Admins` },
          { label: 'Volume Mensal', value: new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', notation: 'compact' }).format(stats.monthlyVolume), icon: Activity, sub: 'Estimativa Bruta' },
          { label: 'Premium', value: stats.premiumUsers, icon: Star, sub: `${Math.round(stats.totalUsers > 0 ? (stats.premiumUsers / stats.totalUsers) * 100 : 0)}% Conversão` },
          { label: 'Subscrições', value: stats.activeSubs, icon: CreditCard, sub: 'Ativas no Sistema' }
        ].map((stat, i) => (
          <div key={i} className="bg-card border border-border-dim p-6 rounded-2xl flex items-center gap-4 hover:border-accent group transition-all duration-300">
            <div className="p-3 bg-bg border border-border-dim rounded-xl group-hover:border-accent/40 group-hover:bg-accent/5 transition-all shrink-0">
              <stat.icon size={20} className="text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest truncate block mb-1">{stat.label}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-text-main leading-tight tracking-tight font-mono">{stat.value}</p>
              </div>
              <p className="text-[10px] text-accent font-semibold uppercase tracking-tight mt-1 truncate block opacity-70 italic">{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 bg-card p-1.5 border border-border-dim rounded-2xl w-full lg:w-fit mx-auto lg:mx-0 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('users')}
          className={cn(
            "flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap flex-1 lg:flex-none",
            activeTab === 'users' ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-text-muted hover:bg-bg border border-transparent hover:border-border-dim"
          )}
        >
          <Users size={16} />
          <span>Utilizadores</span>
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={cn(
            "flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap flex-1 lg:flex-none",
            activeTab === 'analytics' ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-text-muted hover:bg-bg border border-transparent hover:border-border-dim"
          )}
        >
          <BarChart3 size={16} />
          <span>Insights</span>
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={cn(
            "flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap flex-1 lg:flex-none",
            activeTab === 'logs' ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-text-muted hover:bg-bg border border-transparent hover:border-border-dim"
          )}
        >
          <History size={16} />
          <span>Logs</span>
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={cn(
            "flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap flex-1 lg:flex-none",
            activeTab === 'system' ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-text-muted hover:bg-bg border border-transparent hover:border-border-dim"
          )}
        >
          <Shield size={16} />
          <span>Sistema</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'users' && (
          <motion.div
            key="users-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-card border border-border-dim rounded-2xl overflow-hidden shadow-sm"
          >
            {/* Controls Bar */}
            <div className="p-6 border-b border-border-dim flex flex-col lg:flex-row justify-between gap-6 bg-slate-50/50 dark:bg-slate-900/10">
              <div className="flex-1 flex flex-col lg:flex-row items-stretch lg:items-center gap-4 min-w-0">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted/60" size={18} />
                  <input 
                    type="text"
                    placeholder="Filtrar por nome ou email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-bg border border-border-dim rounded-xl text-sm text-text-main focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition-all placeholder:text-text-muted/40"
                  />
                </div>
                
                <div className="flex items-center gap-1 bg-bg p-1 border border-border-dim rounded-xl shrink-0 overflow-x-auto no-scrollbar">
                  {(['all', 'admin', 'premium'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setFilterType(t)}
                      className={cn(
                        "px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all whitespace-nowrap",
                        filterType === t ? "bg-accent text-white shadow-md shadow-accent/20" : "text-text-muted hover:bg-card"
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
                      "flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-xl border",
                      actionStatus.type === 'success' ? "bg-health/5 border-health/20 text-health" : "bg-red-500/5 border-red-500/20 text-red-500"
                    )}
                  >
                    <CheckCircle size={14} />
                    {actionStatus.message}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* User List: Mobile Cards + Desktop Table */}
            <div className="md:hidden space-y-4 p-4 lg:p-8">
              {filteredUsers.length > 0 ? filteredUsers.map(user => {
                const userSubs = allSubscriptions.filter(s => s.userId === user.uid);
                return (
                  <div key={user.uid} className="bg-bg border border-border-dim rounded-3xl p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-card border border-border-dim overflow-hidden flex items-center justify-center text-accent text-sm font-bold shrink-0">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (user.displayName || user.email || 'U').charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-text-main truncate">{user.displayName || 'Utilizador Geral'}</p>
                        <p className="text-[10px] text-text-muted font-bold truncate">{user.email}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className={cn(
                        "px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest border",
                        user.isAdmin ? "bg-accent/10 border-accent text-accent" : "bg-card/50 border-border-dim text-text-muted"
                      )}>
                        {user.isAdmin ? 'Admin' : 'Membro'}
                      </span>
                      <span className={cn(
                        "px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest border",
                        user.isPremium ? "bg-yellow-500/10 border-yellow-500 text-yellow-500" : "bg-card/50 border-border-dim text-text-muted"
                      )}>
                        {user.isPremium ? 'Premium' : 'Free'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-border-dim/30">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-text-muted font-bold uppercase tracking-widest">Atividade</span>
                        <span className="text-xs font-bold text-text-main">{userSubs.length} Subs</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleEditClick(user)}
                          className="p-2.5 bg-card border border-border-dim text-text-muted rounded-xl"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={() => {
                            setUserToDelete(user);
                            setShowDeleteModal(true);
                          }}
                          className="p-2.5 bg-card border border-border-dim text-red-500 rounded-xl"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="text-center py-10 opacity-50">
                   <p className="text-[10px] font-bold uppercase tracking-widest">Nenhum utilizador</p>
                </div>
              )}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-bg/50 text-[10px] text-text-muted uppercase tracking-widest border-b border-border-dim">
                    <th className="px-8 py-4 font-bold">Investidor / Perfil</th>
                    <th className="px-8 py-4 font-bold">Privilégios</th>
                    <th className="px-8 py-4 font-bold">Atividade</th>
                    <th className="px-8 py-4 font-bold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-dim/60">
                  {filteredUsers.length > 0 ? filteredUsers.map(user => {
                    const userSubs = allSubscriptions.filter(s => s.userId === user.uid);
                    return (
                      <tr key={user.uid} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors group">
                        <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 rounded-xl bg-bg border border-border-dim overflow-hidden flex items-center justify-center text-accent text-sm font-bold transition-all duration-300 group-hover:border-accent/30 group-hover:shadow-sm">
                            {user.photoURL ? (
                              <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                            ) : (
                              (user.displayName || user.email || 'U').charAt(0).toUpperCase()
                            )}
                          </div>
                          {user.isAdmin && (
                            <div className="absolute -top-1.5 -right-1.5 p-1 bg-accent text-white rounded-lg shadow-lg">
                              <Shield size={10} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p 
                            className="text-sm font-semibold text-text-main cursor-pointer hover:text-accent transition-colors truncate"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowUserModal(true);
                            }}
                          >
                            {user.displayName || 'Sem Nome'}
                          </p>
                          <p className="flex items-center gap-1.5 text-[11px] text-text-muted font-medium mt-0.5 truncate">
                            <Mail size={12} className="opacity-40" />
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleToggleAdmin(user)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border transition-all flex items-center gap-1.5",
                            user.isAdmin ? "bg-accent/5 border-accent/20 text-accent" : "bg-bg border-border-dim text-text-muted hover:border-accent hover:text-accent"
                          )}
                        >
                          <Shield size={12} />
                          Admin
                        </button>
                        <button 
                          onClick={() => handleTogglePremium(user)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border transition-all flex items-center gap-1.5",
                            user.isPremium ? "bg-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-400" : "bg-bg border-border-dim text-text-muted hover:border-amber-500 hover:text-amber-500"
                          )}
                        >
                          <Star size={12} />
                          Premium
                        </button>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                          <Clock size={12} className="text-text-muted/40" />
                          {(() => {
                            try {
                              return user.createdAt && !isNaN(new Date(user.createdAt).getTime()) 
                                ? format(new Date(user.createdAt), 'dd MMM yyyy', { locale: pt }) 
                                : 'N/A';
                            } catch (e) {
                              return 'N/A';
                            }
                          })()}
                        </span>
                        <span className="text-[10px] text-text-muted uppercase font-bold tracking-tight mt-1 ml-4.5">
                          {userSubs.length} subscrições
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setSelectedUser(user);
                            setShowUserModal(true);
                          }}
                          className="p-2 bg-bg border border-border-dim text-text-muted hover:text-accent hover:border-accent rounded-lg transition-all"
                          title="Ver Perfil"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={() => handleResetPassword(user.email)}
                          className="p-2 bg-bg border border-border-dim text-text-muted hover:text-accent hover:border-accent rounded-lg transition-all"
                          title="Reset Password"
                        >
                          <LogIn size={16} />
                        </button>
                        <button 
                          onClick={() => {
                            setUserToDelete(user);
                            setShowDeleteModal(true);
                          }}
                          className="p-2 bg-bg border border-border-dim text-text-muted hover:text-red-500 hover:border-red-500 rounded-lg transition-all"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={4} className="px-8 py-24 text-center">
                    <div className="flex flex-col items-center opacity-40">
                      <div className="p-5 bg-bg border border-border-dim rounded-full text-text-muted mb-4">
                        <Users size={32} />
                      </div>
                      <p className="text-sm font-semibold text-text-muted uppercase tracking-widest">Nenhum utilizador encontrado</p>
                      <button 
                        onClick={() => {setSearchTerm(''); setFilterType('all');}}
                        className="text-[11px] font-bold text-accent uppercase tracking-widest mt-4 hover:underline"
                      >
                        Limpar todos os filtros
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
          <div className="bg-card border border-border-dim p-8 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-text-main tracking-tight leading-none">Revenue Growth</h3>
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

          <div className="bg-card border border-border-dim p-8 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-text-main tracking-tight leading-none">User Base</h3>
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
          <div className="lg:col-span-1 bg-accent p-8 rounded-2xl text-white">
            <h4 className="text-lg font-bold uppercase tracking-widest mb-4">Meta Status</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-end border-b border-white/20 pb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">LTV Médio Estimado</span>
                <span className="text-2xl font-bold">42,50€</span>
              </div>
              <div className="flex justify-between items-end border-b border-white/20 pb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">Churn Rate (30d)</span>
                <span className="text-2xl font-bold">2.4%</span>
              </div>
              <p className="text-[9px] font-bold uppercase tracking-widest opacity-50 mt-4 leading-normal">
                Dados baseados em projeções algorítmicas de subscrições ativas e histórico de pagamentos.
              </p>
            </div>
          </div>
          
          <div className="lg:col-span-2 bg-card border border-border-dim p-8 rounded-2xl">
            <h4 className="text-sm font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
              <History size={16} className="text-accent" />
              Live Audit Trail
            </h4>
            <div className="space-y-3">
              {auditLogs.slice(0, 5).map((log, i) => (
                <div key={log.id} className="flex items-center justify-between p-4 bg-bg rounded-2xl border border-border-dim/50 hover:border-accent/30 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-card flex items-center justify-center text-accent">
                      <Zap size={14} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-text-main">{log.action}</p>
                      <p className="text-[9px] text-text-muted font-bold uppercase mt-1">Target: {log.targetType}/{log.targetId}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-text-main uppercase truncate max-w-[120px]">
                      {log.userId === 'system' ? 'Sistema' : (log.userEmail?.split('@')[0] || 'Desconhecido')}
                    </p>
                    <p className="text-[9px] text-text-muted font-bold mt-1">
                      {format(new Date(log.timestamp), 'HH:mm', { locale: pt })}
                    </p>
                  </div>
                </div>
              ))}
              {auditLogs.length === 0 && (
                <div className="text-center py-10 opacity-30">
                  <History size={32} className="mx-auto mb-2" />
                  <p className="text-[10px] font-bold uppercase">Nenhum evento recente</p>
                </div>
              )}
            </div>
            {auditLogs.length > 0 && (
              <button 
                onClick={() => setActiveTab('logs')}
                className="w-full mt-4 py-3 text-[9px] font-bold uppercase tracking-widest text-accent hover:bg-accent/5 rounded-xl transition-all"
              >
                Ver Histórico Completo
              </button>
            )}
          </div>
        </div>
      </motion.div>
    )}

    {activeTab === 'logs' && (
      <motion.div
        key="logs-tab"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="bg-card border border-border-dim rounded-2xl overflow-hidden shadow-sm"
      >
        <div className="p-6 border-b border-border-dim flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/10">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold text-text-main tracking-tight leading-none uppercase">Auditoria</h3>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/5 border border-accent/20">
                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                <span className="text-[10px] font-bold uppercase text-accent tracking-widest">Tempo Real</span>
              </div>
            </div>
            <p className="text-[10px] text-text-muted font-semibold uppercase tracking-widest mt-2">Log de segurança e transações do sistema</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/60" />
              <input 
                type="text" 
                placeholder="Filtrar logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-bg border border-border-dim rounded-lg text-[11px] font-bold uppercase tracking-widest focus:border-accent outline-none w-44"
              />
            </div>
            <select 
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value as any)}
              className="px-3 py-2 bg-bg border border-border-dim rounded-lg text-[11px] font-bold uppercase tracking-widest focus:border-accent outline-none appearance-none cursor-pointer hover:border-accent transition-all"
            >
              <option value="all">Todas as Ações</option>
              <option value="create">Criações</option>
              <option value="delete">Eliminações</option>
              <option value="update">Updates</option>
              <option value="system">Sistema</option>
            </select>
            <button 
              onClick={() => exportLogsToCSV(filteredLogs)}
              className="p-2 bg-bg text-text-muted border border-border-dim rounded-lg hover:border-accent hover:text-accent transition-all group relative"
              title="Exportar para CSV"
            >
              <Download size={18} />
            </button>
          </div>
        </div>

        {/* Audit Logs: Mobile Cards + Desktop Table */}
        <div className="md:hidden space-y-3 p-4">
          {filteredLogs.length > 0 ? filteredLogs.map(log => (
            <div 
              key={log.id} 
              onClick={() => { setSelectedLog(log); setShowLogModal(true); }}
              className="bg-bg border border-border-dim rounded-2xl p-4 space-y-3 cursor-pointer hover:border-accent/40 active:scale-[0.98] transition-all"
            >
              <div className="flex items-center justify-between">
                <span className={cn(
                  "px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-tighter border",
                  log.action.toLowerCase().includes('delete') ? "bg-red-500/10 border-red-500/20 text-red-500" :
                  log.action.toLowerCase().includes('create') ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                  "bg-accent/10 border-accent/20 text-accent"
                )}>
                  {log.action}
                </span>
                <span className="text-[9px] text-text-muted font-bold">
                  {format(new Date(log.timestamp), 'dd/MM HH:mm', { locale: pt })}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-card border border-border-dim flex items-center justify-center text-[8px] font-bold text-accent shrink-0">
                  {log.userId === 'system' ? <Settings size={10} /> : (log.userEmail?.charAt(0) || '?')}
                </div>
                <p className="text-[10px] font-bold text-text-main truncate">
                  {log.userId === 'system' ? 'SISTEMA' : log.userEmail}
                </p>
              </div>

              <p className="text-[10px] text-text-muted font-medium bg-card/30 p-3 rounded-xl border border-border-dim/20 leading-relaxed">
                {log.details}
              </p>
            </div>
          )) : (
            <div className="text-center py-20 opacity-30">
               <History size={48} className="mx-auto mb-4" />
               <p className="text-[10px] font-bold uppercase">Sem registos</p>
            </div>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto min-h-[400px]">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-bg/50 text-[10px] text-text-muted uppercase tracking-widest border-b border-border-dim font-bold">
                <th className="px-8 py-4 w-px">Timestamp</th>
                <th className="px-8 py-4 w-px">Operação</th>
                <th className="px-8 py-4 w-px">Agente</th>
                <th className="px-8 py-4">Detalhes do Evento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-dim/50">
              {filteredLogs.length > 0 ? filteredLogs.map(log => (
                <tr 
                  key={log.id} 
                  onClick={() => { setSelectedLog(log); setShowLogModal(true); }}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors group cursor-pointer"
                >
                  <td className="px-8 py-5 whitespace-nowrap">
                    <div className="flex flex-col font-mono">
                      <span className="text-xs font-bold text-text-main">
                        {format(new Date(log.timestamp), 'dd MMM HH:mm:ss', { locale: pt })}
                      </span>
                      <span className="text-[9px] text-text-muted opacity-60 tracking-tight">{log.timestamp.split('T')[1].split('.')[0]}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap">
                    <span className={cn(
                      "px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider border inline-block",
                      log.action.toLowerCase().includes('delete') ? "bg-red-500/5 border-red-500/20 text-red-600 dark:text-red-400 shadow-sm shadow-red-500/5" :
                      log.action.toLowerCase().includes('create') ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
                      "bg-accent/5 border-accent/20 text-accent"
                    )}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg border flex items-center justify-center text-[10px] font-bold uppercase shrink-0",
                        log.userId === 'system' ? "bg-slate-100 dark:bg-slate-800 border-border-dim text-text-muted" : "bg-accent/5 border-accent/10 text-accent font-mono"
                      )}>
                        {log.userId === 'system' ? <Settings size={12} /> : (log.userEmail?.charAt(0) || '?')}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-text-main truncate max-w-[140px]">
                          {log.userId === 'system' ? 'SISTEMA' : log.userEmail?.split('@')[0]}
                        </p>
                        {log.userId !== 'system' && (
                          <p className="text-[9px] text-text-muted font-mono opacity-60">ID: {log.userId.slice(0, 8)}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-medium text-text-muted leading-relaxed max-w-2xl">
                        {log.details}
                      </p>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div className="flex gap-2 items-center">
                          {log.metadata.fields?.map((f: string) => (
                            <span key={f} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-[9px] font-mono text-text-muted rounded border border-border-dim/50">
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-8 py-32 text-center">
                    <div className="flex flex-col items-center opacity-30">
                      <History size={48} className="text-text-muted mb-4" />
                      <p className="text-sm font-semibold text-text-muted uppercase tracking-widest">Nenhum evento registado</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
        <div className="bg-card border border-border-dim rounded-2xl p-10 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
            <Bell size={200} />
          </div>
          
          <div className="relative">
            <h3 className="text-2xl font-bold text-text-main tracking-tight leading-none uppercase">Broadcast Global</h3>
            <p className="text-[10px] text-text-muted font-semibold uppercase tracking-widest mt-2">Comunicados instantâneos para todos os terminais</p>
            
            <div className="mt-8 space-y-6">
              <div className="space-y-2.5">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Mensagem do Comunicado</label>
                <textarea 
                  value={notice.message}
                  onChange={(e) => setNotice({...notice, message: e.target.value})}
                  placeholder="Ex: Manutenção programada para as 22h00 de hoje..."
                  className="w-full px-5 py-4 bg-bg border border-border-dim rounded-xl text-sm text-text-main focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none min-h-24 transition-all"
                />
              </div>
              
              <div className="flex flex-wrap gap-2">
                {(['info', 'warning', 'alert'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setNotice({...notice, type})}
                    className={cn(
                      "px-5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-all",
                      notice.type === type ? "bg-accent text-white border-accent shadow-sm" : "bg-bg border-border-dim text-text-muted hover:border-accent"
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-900/20 border border-border-dim rounded-xl">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    notice.active ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)] animate-pulse" : "bg-slate-300 dark:bg-slate-700"
                  )} />
                  <div>
                    <p className="text-[10px] font-bold text-text-main uppercase tracking-widest leading-none">Estado do Broadcast</p>
                    <p className="text-[9px] text-text-muted font-semibold uppercase mt-1 tracking-tight">
                      {notice.active ? 'Canal aberto / Visível' : 'Canal fechado / Inativo'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setNotice({...notice, active: !notice.active});
                    showStatus(notice.active ? 'Broadcast desativado' : 'Broadcast ativado com sucesso', 'success');
                  }}
                  className={cn(
                    "px-6 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                    notice.active ? "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400" : "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                  )}
                >
                  {notice.active ? 'Suspender' : 'Publicar agora'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border-dim p-8 rounded-2xl">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-accent mb-3">Backup de Dados</h4>
            <p className="text-xs text-text-muted font-medium leading-relaxed mb-6">
              Exportação integral da base de dados em formato JSON para arquivo offline.
            </p>
            <button className="w-full py-3.5 bg-bg border border-border-dim rounded-xl text-[10px] font-bold uppercase tracking-widest hover:border-accent transition-all flex items-center justify-center gap-2">
              <Download size={14} /> Full System Dump
            </button>
          </div>
          <div className="bg-card border border-border-dim p-8 rounded-2xl">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-3">Protocolo de Emergência</h4>
            <p className="text-xs text-text-muted font-medium leading-relaxed mb-6">
              Restringe o acesso à plataforma apenas para administradores.
            </p>
            <button 
              onClick={() => setShowConfirmMaintenanceModal(true)}
              className={cn(
                "w-full py-3.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                appConfig.maintenanceMode 
                  ? "bg-emerald-600 text-white" 
                  : "bg-red-500/5 border border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white"
              )}
            >
              <AlertTriangle size={14} /> 
              {appConfig.maintenanceMode ? 'Levantar Restrição' : 'Ativar Modo Manutenção'}
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
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-card border border-border-dim w-full max-w-2xl overflow-hidden rounded-2xl shadow-2xl"
            >
              <div className="relative h-24 bg-accent flex items-center justify-between px-8">
                <h3 className="text-xl font-bold text-white tracking-tight uppercase leading-none">Perfil do Investidor</h3>
                <button 
                  onClick={() => setShowUserModal(false)}
                  className="absolute top-6 right-6 p-2.5 bg-black/20 hover:bg-black/40 text-white rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>
              
            <div className="px-4 sm:px-10 pb-10 pt-0">
              <div className="relative -mt-10 mb-8 flex flex-col items-center sm:items-start sm:flex-row gap-6">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-card border-4 border-bg overflow-hidden shadow-2xl flex items-center justify-center text-accent text-3xl font-bold">
                  {selectedUser.photoURL ? (
                    <img src={selectedUser.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (selectedUser.displayName || selectedUser.email).charAt(0).toUpperCase()
                  )}
                </div>
                <div className="mt-4 sm:mt-16 text-center sm:text-left flex-1 min-w-0">
                  {isEditingUser ? (
                    <div className="space-y-2 w-full">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest block ml-1">Nome de Exibição</label>
                      <input 
                        type="text"
                        value={editedUserData.displayName || ''}
                        onChange={(e) => setEditedUserData({...editedUserData, displayName: e.target.value})}
                        className="w-full px-4 py-2 bg-bg border border-border-dim rounded-xl text-lg font-bold text-text-main focus:ring-2 focus:ring-accent outline-none"
                        placeholder="Nome do utilizador..."
                      />
                    </div>
                  ) : (
                    <h3 className="text-xl sm:text-2xl font-bold text-text-main tracking-tight leading-tight truncate">
                      {selectedUser.displayName || 'Utilizador sem Nome'}
                    </h3>
                  )}
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                     <span className="flex items-center gap-1.5 px-3 py-1 bg-bg border border-border-dim rounded-lg text-[9px] font-bold text-text-muted uppercase tracking-widest truncate max-w-[200px]">
                      <Mail size={12} className="text-accent shrink-0" />
                      {selectedUser.email}
                    </span>
                    <div className="flex gap-2">
                      {selectedUser.isAdmin && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-accent/10 border border-accent/20 rounded-lg text-[8px] font-bold text-accent uppercase tracking-widest leading-none">
                          <Shield size={10} /> Admin
                        </span>
                      )}
                      {selectedUser.isPremium && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-[8px] font-bold text-yellow-500 uppercase tracking-widest leading-none">
                          <Star size={10} /> Premium
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-accent">
                        <Info size={16} />
                        <p className="text-[10px] font-bold uppercase tracking-widest">Informação Geral</p>
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
                            <span className="text-xs font-bold text-accent">{selectedUser.currency || 'EUR'}</span>
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
                            <span className="text-xs font-bold text-text-main">
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
                        <p className="text-[10px] font-bold uppercase tracking-widest">Biografia / Sobre</p>
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
                          <p className="text-[10px] font-bold uppercase tracking-widest">Atividade & Subscrições</p>
                        </div>
                        <div className="space-y-3">
                          {allSubscriptions.filter(s => s.userId === selectedUser.uid).slice(0, 4).map(sub => (
                            <div key={sub.id} className="flex items-center justify-between p-4 bg-bg border border-border-dim rounded-2xl">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-card flex items-center justify-center text-accent font-bold text-[10px] uppercase">
                                  {sub.name.charAt(0)}
                                </div>
                                <span className="text-xs font-bold text-text-main">{sub.name}</span>
                              </div>
                              <span className="text-xs font-bold text-text-main">{sub.amount}{sub.currency}</span>
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

                <div className="mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4">
                   {isEditingUser ? (
                     <>
                      <button 
                        onClick={() => setIsEditingUser(false)}
                        className="w-full sm:flex-1 px-6 sm:px-8 py-4 sm:py-5 bg-bg border border-border-dim rounded-2xl text-[10px] font-bold text-text-muted hover:border-text-muted transition-all uppercase tracking-widest"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={handleSaveUserEdits}
                        disabled={loading}
                        className="w-full sm:flex-1 px-6 sm:px-8 py-4 sm:py-5 bg-accent text-white rounded-2xl text-[10px] font-bold hover:bg-accent/90 transition-all uppercase tracking-widest shadow-lg shadow-accent/20"
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
                          className="w-full sm:flex-1 px-6 sm:px-8 py-4 sm:py-5 bg-bg border border-border-dim rounded-2xl text-[10px] font-bold text-text-main hover:border-accent transition-all uppercase tracking-widest"
                        >
                          Editar Perfil
                        </button>
                        <button 
                          onClick={() => handleResetPassword(selectedUser.email)}
                          className="w-full sm:flex-1 px-6 sm:px-8 py-4 sm:py-5 bg-bg border border-border-dim rounded-2xl text-[10px] font-bold text-text-main hover:border-accent transition-all uppercase tracking-widest"
                        >
                          Reset Pass
                        </button>
                        <button 
                          onClick={() => {
                            setShowUserModal(false);
                            setUserToDelete(selectedUser);
                            setShowDeleteModal(true);
                          }}
                          className="w-full sm:flex-1 px-6 sm:px-8 py-4 sm:py-5 bg-red-500 text-white rounded-2xl text-[10px] font-bold hover:bg-red-600 transition-all uppercase tracking-widest shadow-lg shadow-red-500/20"
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
              className="relative bg-card border border-border-dim w-full max-w-md p-8 rounded-2xl shadow-2xl"
            >
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="relative">
                  <div className="p-6 bg-red-500/10 rounded-full text-red-500 text-3xl font-bold ring-4 ring-red-500/10">
                    <AlertTriangle size={48} />
                  </div>
                  <div className="absolute -inset-2 bg-red-500/20 blur-xl animate-pulse -z-10" />
                </div>
                
                <h3 className="text-2xl font-bold text-text-main tracking-tight uppercase">Nuclear Action</h3>
                <p className="text-xs text-text-muted font-bold leading-relaxed px-4">
                  Estás prestes a apagar permanentemente o utilizador <span className="text-red-500 font-bold">{userToDelete?.email}</span>. 
                  Esta ação é irreversível e purgará todos os dados brutos e subscrições.
                </p>
                
                <div className="w-full space-y-5 pt-4">
                  <div className="space-y-3 text-left">
                    <label className="block text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] ml-2">Segurança: Digita <span className="text-red-500 uppercase">Confirmar</span></label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                      placeholder="ESCREVE AQUI..."
                      className="w-full px-6 py-5 bg-bg border border-border-dim rounded-2xl text-center font-bold tracking-[0.3em] text-red-500 focus:ring-4 focus:ring-red-500/10 outline-none placeholder:text-text-muted/10"
                    />
                  </div>
                  
                  <div className="flex gap-4">
                    <button
                      onClick={() => {
                        setShowDeleteModal(false);
                        setUserToDelete(null);
                        setDeleteConfirmText('');
                      }}
                      className="flex-1 px-8 py-5 bg-bg border border-border-dim rounded-2xl text-[10px] font-bold text-text-muted hover:border-text-muted transition-all uppercase tracking-widest"
                    >
                      Abortar
                    </button>
                    <button
                      onClick={handleDeleteUser}
                      disabled={deleteConfirmText !== 'CONFIRMAR' || loading}
                      className="flex-1 px-8 py-5 bg-red-500 text-white rounded-2xl text-[10px] font-bold hover:bg-red-600 transition-all disabled:opacity-20 disabled:cursor-not-allowed uppercase tracking-widest shadow-xl shadow-red-500/20"
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
              className="relative bg-card border border-border-dim w-full max-w-md p-8 rounded-2xl shadow-2xl"
            >
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="relative">
                  <div className={cn(
                    "p-6 rounded-full text-3xl font-bold ring-4",
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
                  <h3 className="text-2xl font-bold text-text-main tracking-tight uppercase">Alterar Acesso</h3>
                  <p className="text-xs text-text-muted font-bold leading-relaxed px-4">
                    Confirmas a alteração do estatuto <span className={cn("font-bold uppercase", accessChangeData.type === 'admin' ? "text-accent" : "text-yellow-500")}>
                      {accessChangeData.type}
                    </span> para o utilizador <span className="text-text-main font-bold">{accessChangeData.user.email}</span>?
                  </p>
                </div>
                
                <div className="w-full bg-bg/50 border border-border-dim p-4 rounded-2xl">
                  <div className="flex items-center justify-between pb-3 border-b border-border-dim/50">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Estado Atual</span>
                    <span className="text-[10px] font-bold text-red-500 uppercase">
                      {accessChangeData.type === 'admin' 
                        ? (accessChangeData.user.isAdmin ? 'Ativo' : 'Inativo')
                        : (accessChangeData.user.isPremium ? 'Ativo' : 'Inativo')
                      }
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-3">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Novo Estado</span>
                    <span className="text-[10px] font-bold text-health uppercase">
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
                    className="flex-1 px-8 py-5 bg-bg border border-border-dim rounded-2xl text-[10px] font-bold text-text-muted hover:border-text-muted transition-all uppercase tracking-widest"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={confirmAccessChange}
                    disabled={loading}
                    className={cn(
                      "flex-1 px-8 py-5 text-white rounded-2xl text-[10px] font-bold transition-all uppercase tracking-widest shadow-xl",
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

      {/* Maintenance Confirmation Modal */}
      <AnimatePresence>
        {showConfirmMaintenanceModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirmMaintenanceModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-card border border-border-dim w-full max-w-md p-8 rounded-2xl shadow-2xl"
            >
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="relative">
                  <div className={cn(
                    "p-6 rounded-full text-3xl font-bold ring-4",
                    appConfig.maintenanceMode ? "bg-health/10 text-health ring-health/10" : "bg-red-500/10 text-red-500 ring-red-500/10"
                  )}>
                    <AlertTriangle size={48} />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-text-main tracking-tight uppercase">
                    {appConfig.maintenanceMode ? 'Desativar Manutenção' : 'Ativar Manutenção'}
                  </h3>
                  <p className="text-xs text-text-muted font-bold leading-relaxed px-4">
                    {appConfig.maintenanceMode 
                      ? "Tens a certeza que desejas restaurar o acesso público à plataforma?"
                      : "Isto irá bloquear o acesso a todos os utilizadores comuns e exibir o ecrã de manutenção. Desejas continuar?"}
                  </p>
                </div>

                <div className="w-full flex gap-4 pr-0">
                  <button
                    onClick={() => setShowConfirmMaintenanceModal(false)}
                    className="flex-1 px-8 py-5 bg-bg border border-border-dim rounded-2xl text-[10px] font-bold text-text-muted hover:border-text-muted transition-all uppercase tracking-widest"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      setLoading(true);
                      try {
                        await updateAppConfig({ maintenanceMode: !appConfig.maintenanceMode });
                        showStatus(appConfig.maintenanceMode ? 'Público restaurado' : 'Modo manutenção ativado', 'success');
                        setShowConfirmMaintenanceModal(false);
                      } catch (error: any) {
                        showStatus(`Erro: ${error.message}`, 'error');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    className={cn(
                      "flex-1 px-8 py-5 text-white rounded-2xl text-[10px] font-bold transition-all uppercase tracking-widest shadow-xl",
                      appConfig.maintenanceMode ? "bg-health shadow-health/20" : "bg-red-500 shadow-red-500/20"
                    )}
                  >
                    {loading ? "..." : "CONFIRMAR"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Log Detail Modal */}
      <AnimatePresence>
        {showLogModal && selectedLog && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowLogModal(false);
                setSelectedLog(null);
              }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-card border border-border-dim w-full max-w-xl overflow-hidden rounded-3xl shadow-2xl"
            >
              <div className="relative h-20 bg-accent flex items-center justify-between px-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
                    <History size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-tight uppercase leading-none">Detalhes do Evento</h3>
                </div>
                <button 
                  onClick={() => setShowLogModal(false)}
                  className="p-2 hover:bg-black/20 text-white rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-bg border border-border-dim rounded-2xl">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Ação</p>
                    <span className={cn(
                      "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border inline-block",
                      selectedLog.action.toLowerCase().includes('delete') ? "bg-red-500/5 border-red-500/20 text-red-600" :
                      selectedLog.action.toLowerCase().includes('create') ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600" :
                      "bg-accent/5 border-accent/20 text-accent"
                    )}>
                      {selectedLog.action}
                    </span>
                  </div>
                  <div className="p-4 bg-bg border border-border-dim rounded-2xl">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Data/Hora</p>
                    <p className="text-xs font-bold text-text-main">
                      {format(new Date(selectedLog.timestamp), 'dd MMM yyyy HH:mm:ss', { locale: pt })}
                    </p>
                  </div>
                </div>

                <div className="p-5 bg-bg border border-border-dim rounded-2xl space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-card border border-border-dim flex items-center justify-center text-accent text-xl font-bold">
                      {selectedLog.userId === 'system' ? <Settings size={24} /> : (selectedLog.userEmail?.charAt(0).toUpperCase() || '?')}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Agente</p>
                      <p className="text-sm font-bold text-text-main">
                        {selectedLog.userId === 'system' ? 'SISTEMA' : selectedLog.userEmail}
                      </p>
                      {selectedLog.userId !== 'system' && (
                        <p className="text-[9px] text-text-muted font-mono mt-0.5">ID: {selectedLog.userId}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-5 bg-bg border border-border-dim rounded-2xl">
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Descrição</p>
                  <p className="text-xs font-medium text-text-main leading-relaxed">
                    {selectedLog.details}
                  </p>
                </div>

                {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                  <div className="p-5 bg-bg border border-border-dim rounded-2xl">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3">Dados Técnicos / Metadados</p>
                    <div className="bg-card rounded-xl p-4 border border-border-dim/50 overflow-auto max-h-40 scrollbar-thin">
                      <pre className="text-[9px] font-mono text-text-main whitespace-pre-wrap">
                        {JSON.stringify(selectedLog.metadata, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  <div className="flex-1 p-4 bg-bg border border-border-dim rounded-2xl text-center">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Target Type</p>
                    <p className="text-xs font-bold text-text-main uppercase">{selectedLog.targetType}</p>
                  </div>
                  <div className="flex-1 p-4 bg-bg border border-border-dim rounded-2xl text-center">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Target ID</p>
                    <p className="text-xs font-mono text-text-main truncate">{selectedLog.targetId}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-border-dim flex justify-end">
                <button 
                  onClick={() => setShowLogModal(false)}
                  className="px-8 py-3 bg-bg border border-border-dim rounded-xl text-[10px] font-bold uppercase tracking-widest text-text-main hover:bg-card transition-all"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-accent/5 border border-accent/20 p-10 rounded-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 text-accent/10 group-hover:text-accent/20 transition-colors">
          <Shield size={120} />
        </div>
        <div className="relative">
          <h4 className="font-bold text-xl text-text-main mb-3 tracking-tighter">🔒 Protocolo de Segurança Admin</h4>
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
