import React, { useState, useEffect } from 'react';
import { User, sendPasswordResetEmail } from 'firebase/auth';
import { UserProfile, NotificationPreferences, Category } from '../../types';
import { getUserProfile, updateUserProfile, createUserProfile } from '../../services/userService';
import { 
  Settings as SettingsIcon, 
  User as UserIcon, 
  Globe, 
  CreditCard, 
  Bell, 
  Shield, 
  Save, 
  CheckCircle2, 
  AlertCircle,
  Key,
  Trash2,
  FileJson,
  History,
  Palette,
  LayoutGrid,
  SlidersHorizontal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { exportUserDataToJSON } from '../../lib/exportUtils';
import { collection, getDocs, query, where, writeBatch, doc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { subscribeToUserCategories, updateCategory, deleteCategory } from '../../services/categoryService';

interface SettingsProps {
  user: User;
}

type SettingsTab = 'account' | 'preferences' | 'categories' | 'billing' | 'notifications' | 'security';

const Settings: React.FC<SettingsProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userCategories, setUserCategories] = useState<Category[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [monthlyBudget, setMonthlyBudget] = useState<number | undefined>(undefined);
  const [notifications, setNotifications] = useState<NotificationPreferences>({
    billingReminders: true,
    reminderDays: 3,
    usageAlerts: false,
    spendingLimit: 100
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const p = await getUserProfile(user.uid);
        if (p) {
          setProfile(p);
          setDisplayName(p.displayName || '');
          setCurrency(p.currency || 'EUR');
          setMonthlyBudget(p.monthlyBudget);
          if (p.notifications) {
            setNotifications(p.notifications);
          }
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  useEffect(() => {
    if (!user.uid) return;
    const unsub = subscribeToUserCategories(user.uid, (cats) => {
      setUserCategories(cats);
    });
    return () => unsub();
  }, [user.uid]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await updateUserProfile(user.uid, {
        displayName,
        currency,
        monthlyBudget,
        notifications
      });
      setMessage({ type: 'success', text: 'Definições actualizadas com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
      setMessage({ type: 'error', text: 'Erro ao guardar definições. Tenta novamente.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'ELIMINAR') return;
    
    setSaving(true);
    try {
      // 1. Delete Firestore Data First
      const q = query(collection(db, 'subscriptions'), where('userId', '==', user.uid));
      const subsSnapshot = await getDocs(q);
      const batch = writeBatch(db);
      subsSnapshot.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(doc(db, 'users', user.uid));
      await batch.commit();

      // 2. Delete Auth User
      await user.delete();
      window.location.href = '/';
    } catch (error: any) {
      console.error('Error deleting account:', error);
      if (error.code === 'auth/requires-recent-login') {
        setMessage({ type: 'error', text: 'Esta acção requer que tenhas feito login recentemente. Por favor, faz login de novo e tenta outra vez.' });
      } else {
        setMessage({ type: 'error', text: 'Erro ao eliminar conta. Tenta mais tarde.' });
      }
      setShowDeleteModal(false);
    } finally {
      setSaving(false);
    }
  };

  const handleExportJSON = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const q = query(collection(db, 'subscriptions'), where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const subscriptions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      exportUserDataToJSON(profile, subscriptions);
      setMessage({ type: 'success', text: 'Dados exportados com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error exporting JSON:', error);
      setMessage({ type: 'error', text: 'Erro ao exportar dados.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    try {
      await sendPasswordResetEmail(auth, user.email || '');
      setMessage({ type: 'success', text: 'Email de recuperação enviado!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao enviar email de recuperação.' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currencies = [
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'USD', symbol: '$', name: 'Dólar Americano' },
    { code: 'GBP', symbol: '£', name: 'Libra Esterlina' },
    { code: 'BRL', symbol: 'R$', name: 'Real Brasileiro' },
  ];

  const tabs = [
    { id: 'account', label: 'Conta', icon: UserIcon },
    { id: 'preferences', label: 'Preferências', icon: SettingsIcon },
    { id: 'categories', label: 'Categorias', icon: LayoutGrid },
    { id: 'billing', label: 'Faturação', icon: CreditCard },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'security', label: 'Segurança', icon: Shield },
  ] as const;

  const CATEGORY_COLORS = [
    '#6366f1', '#10b981', '#f43f5e', '#06b6d4', '#eab308', 
    '#8b5cf6', '#f97316', '#ec4899', '#71717a', '#000000'
  ];

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="mb-10">
        <h2 className="text-4xl font-black text-text-main tracking-tighter">Definições</h2>
        <p className="text-text-muted font-bold text-xs uppercase tracking-[0.2em] mt-2">Personaliza a tua experiência no Trackify</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Sidebar Nav */}
        <div className="md:col-span-1 space-y-2">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-left",
                activeTab === item.id 
                  ? "bg-accent text-white shadow-lg shadow-accent/20" 
                  : "text-text-muted hover:text-text-main hover:bg-card"
              )}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="md:col-span-3">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-card border border-border-dim rounded-[2.5rem] p-8 md:p-10 shadow-sm"
          >
            <div className="space-y-8">
              {/* Conditional Content based on activeTab */}
              
              {activeTab === 'account' && (
                <section className="space-y-6">
                  <div className="flex items-center gap-2 pb-2 border-b border-border-dim">
                    <UserIcon size={18} className="text-accent" />
                    <h3 className="text-sm font-black text-text-main uppercase tracking-widest">Informação da Conta</h3>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 ml-1">Nome de Exibição</label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full px-5 py-4 bg-bg border border-border-dim rounded-2xl text-sm text-text-main focus:ring-2 focus:ring-accent outline-none transition-all"
                        placeholder="O teu nome"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 ml-1">Email</label>
                      <input
                        type="email"
                        value={user.email || ''}
                        disabled
                        className="w-full px-5 py-4 bg-bg border border-border-dim rounded-2xl text-sm text-text-muted cursor-not-allowed outline-none opacity-70"
                      />
                      <p className="text-[10px] text-text-muted/50 mt-2 ml-1 italic">O email não pode ser alterado diretamente por questões de segurança.</p>
                    </div>
                  </div>
                </section>
              )}

              {activeTab === 'preferences' && (
                <section className="space-y-6">
                  <div className="flex items-center gap-2 pb-2 border-b border-border-dim">
                    <SettingsIcon size={18} className="text-accent" />
                    <h3 className="text-sm font-black text-text-main uppercase tracking-widest">Preferências Globais</h3>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-4 ml-1">Moeda Principal para Relatórios</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {currencies.map((curr) => (
                        <button
                          key={curr.code}
                          type="button"
                          onClick={() => setCurrency(curr.code)}
                          className={cn(
                            "p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 basis-1",
                            currency === curr.code 
                              ? "bg-accent/10 border-accent text-accent ring-1 ring-accent/50" 
                              : "bg-bg border-border-dim text-text-muted hover:border-text-muted/50"
                          )}
                        >
                          <span className="text-2xl font-black">{curr.symbol}</span>
                          <span className="text-[10px] font-bold uppercase tracking-tighter">{curr.code}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-text-muted mt-4 italic">Esta moeda será usada como base em todos os dashboards e gráficos anuais.</p>
                  </div>

                  <div className="pt-6 border-t border-border-dim">
                    <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-4 ml-1">Meta de Orçamento Mensal</label>
                    <div className="relative max-w-xs">
                      <input
                        type="number"
                        value={monthlyBudget || ''}
                        onChange={(e) => setMonthlyBudget(parseFloat(e.target.value) || 0)}
                        className="w-full px-5 py-4 bg-bg border border-border-dim rounded-2xl text-sm text-text-main font-bold focus:ring-2 focus:ring-accent outline-none transition-all"
                        placeholder="Ex: 100.00"
                      />
                      <span className="absolute right-6 top-1/2 -translate-y-1/2 text-xs font-black text-text-muted">{currency}</span>
                    </div>
                    <p className="text-[10px] text-text-muted mt-4 italic">Define um limite para monitorizar o teu progresso no Dashboard.</p>
                  </div>
                </section>
              )}

              {activeTab === 'categories' && (
                <section className="space-y-6">
                  <div className="flex items-center gap-2 pb-2 border-b border-border-dim">
                    <LayoutGrid size={18} className="text-accent" />
                    <h3 className="text-sm font-black text-text-main uppercase tracking-widest">Gestão de Categorias</h3>
                  </div>

                  <p className="text-[10px] text-text-muted italic">Personaliza as cores das categorias que criaste para uma melhor visualização no dashboard.</p>

                  <div className="space-y-4">
                    {userCategories.length === 0 ? (
                      <div className="p-10 border border-dashed border-border-dim rounded-3xl text-center">
                        <p className="text-xs text-text-muted font-bold">Ainda não criaste categorias personalizadas.</p>
                      </div>
                    ) : (
                      userCategories.map((cat) => (
                        <div key={cat.id} className="p-6 bg-bg border border-border-dim rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                          <div className="flex items-center gap-4">
                            <div 
                              className="w-10 h-10 rounded-xl shadow-inner border border-white/10"
                              style={{ backgroundColor: cat.color }}
                            />
                            <div>
                              <p className="text-sm font-black text-text-main tracking-tight">{cat.name}</p>
                              <p className="text-[10px] text-text-muted uppercase tracking-widest">Categoria Personalizada</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {CATEGORY_COLORS.map((color) => (
                              <button
                                key={color}
                                onClick={() => updateCategory(cat.id, { color })}
                                className={cn(
                                  "w-6 h-6 rounded-full border-2 transition-all active:scale-90",
                                  cat.color === color ? "border-white scale-110 shadow-lg" : "border-transparent opacity-50 hover:opacity-100"
                                )}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                            <button
                              onClick={() => deleteCategory(cat.id)}
                              className="ml-2 p-2 text-text-muted hover:text-red-500 transition-colors"
                              title="Remover Categoria"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )}

              {activeTab === 'billing' && (
                <section className="space-y-6">
                  <div className="flex items-center gap-2 pb-2 border-b border-border-dim">
                    <CreditCard size={18} className="text-accent" />
                    <h3 className="text-sm font-black text-text-main uppercase tracking-widest">Resumo de Faturação</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-6 bg-bg border border-border-dim rounded-2xl">
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Plano Atual</p>
                      <p className="text-lg font-black text-text-main">Gratuito (Beta)</p>
                    </div>
                    <div className="p-6 bg-bg border border-border-dim rounded-2xl">
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Backup Automático</p>
                      <p className="text-lg font-black text-green-500 flex items-center gap-1">
                        <CheckCircle2 size={16} /> Ativo
                      </p>
                    </div>
                  </div>

                  <div className="p-6 bg-accent/5 border border-accent/20 rounded-2xl space-y-4">
                    <div className="flex items-center gap-3">
                      <History size={18} className="text-accent" />
                      <p className="text-sm font-bold text-text-main">Exportação de Dados</p>
                    </div>
                    <p className="text-xs text-text-muted">Descarrega todos os teus dados em formato JSON para portabilidade ou backup externo.</p>
                    <button 
                      onClick={handleExportJSON}
                      disabled={saving}
                      className="flex items-center gap-2 px-6 py-2 bg-accent text-white rounded-xl text-[10px] font-black hover:bg-accent/90 transition-all uppercase tracking-widest disabled:opacity-50"
                    >
                      {saving ? (
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <FileJson size={14} />
                      )}
                      Descarregar JSON
                    </button>
                  </div>
                </section>
              )}

              {activeTab === 'notifications' && (
                <section className="space-y-6">
                  <div className="flex items-center gap-2 pb-2 border-b border-border-dim">
                    <Bell size={18} className="text-accent" />
                    <h3 className="text-sm font-black text-text-main uppercase tracking-widest">Notificações e Alertas</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-bg border border-border-dim rounded-2xl">
                      <div>
                        <p className="text-xs font-bold text-text-main">Lembretes de Faturação</p>
                        <p className="text-[10px] text-text-muted">Recebe avisos antes de uma subscrição ser cobrada</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNotifications({ ...notifications, billingReminders: !notifications.billingReminders })}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative",
                          notifications.billingReminders ? "bg-accent" : "bg-border-dim"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                          notifications.billingReminders ? "right-1" : "left-1"
                        )} />
                      </button>
                    </div>

                    {notifications.billingReminders && (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="ml-4 pl-4 border-l-2 border-accent/20"
                      >
                        <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Avisar com quantos dias de antecedência?</label>
                        <div className="flex gap-2">
                          {[1, 2, 3, 5, 7].map(days => (
                            <button
                              key={days}
                              type="button"
                              onClick={() => setNotifications({ ...notifications, reminderDays: days })}
                              className={cn(
                                "px-4 py-2 rounded-xl text-[10px] font-black transition-all",
                                notifications.reminderDays === days 
                                  ? "bg-accent text-white" 
                                  : "bg-bg border border-border-dim text-text-muted hover:border-text-muted"
                              )}
                            >
                              {days} {days === 1 ? 'DIA' : 'DIAS'}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    <div className="flex items-center justify-between p-4 bg-bg border border-border-dim rounded-2xl">
                      <div>
                        <p className="text-xs font-bold text-text-main">Alerta de Limite de Gastos</p>
                        <p className="text-[10px] text-text-muted">Avisa-me se o total mensal exceder um valor</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNotifications({ ...notifications, usageAlerts: !notifications.usageAlerts })}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative",
                          notifications.usageAlerts ? "bg-accent" : "bg-border-dim"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                          notifications.usageAlerts ? "right-1" : "left-1"
                        )} />
                      </button>
                    </div>

                    {notifications.usageAlerts && (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="ml-4 pl-4 border-l-2 border-accent/20 space-y-2"
                      >
                        <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Limite mensal ({currency})</label>
                        <input
                          type="number"
                          value={notifications.spendingLimit}
                          onChange={(e) => setNotifications({ ...notifications, spendingLimit: parseFloat(e.target.value) || 0 })}
                          className="w-32 px-4 py-3 bg-bg border border-border-dim rounded-xl text-xs text-text-main focus:ring-2 focus:ring-accent outline-none"
                        />
                      </motion.div>
                    )}
                  </div>
                </section>
              )}

              {activeTab === 'security' && (
                <section className="space-y-6">
                  <div className="flex items-center gap-2 pb-2 border-b border-border-dim">
                    <Shield size={18} className="text-accent" />
                    <h3 className="text-sm font-black text-text-main uppercase tracking-widest">Segurança da Conta</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="p-6 bg-bg border border-border-dim rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-accent/10 rounded-xl text-accent">
                          <Key size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-text-main">Palavra-passe</p>
                          <p className="text-[10px] text-text-muted">Actualiza a tua password regularmente</p>
                        </div>
                      </div>
                      <button 
                        onClick={handlePasswordReset}
                        className="px-4 py-2 bg-accent text-white rounded-xl text-[10px] font-black hover:bg-accent/90 transition-all uppercase tracking-widest"
                      >
                        Alterar
                      </button>
                    </div>

                    <div className="pt-10 border-t border-border-dim">
                      <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-4">Zona de Perigo</h4>
                      <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-2xl flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-text-main">Eliminar Conta</p>
                          <p className="text-[10px] text-text-muted">Aviso: Esta acção é permanente e apaga todos os teus dados.</p>
                        </div>
                        <button 
                          onClick={() => setShowDeleteModal(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-[10px] font-black hover:bg-red-600 transition-all uppercase tracking-widest"
                        >
                          <Trash2 size={14} /> Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* Status Messages */}
              <AnimatePresence>
                {message && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-2xl border text-sm font-bold mt-6",
                      message.type === 'success' 
                        ? "bg-green-500/10 border-green-500 text-green-500" 
                        : "bg-red-500/10 border-red-500 text-red-500"
                    )}
                  >
                    {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    {message.text}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Delete Modal */}
              <AnimatePresence>
                {showDeleteModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowDeleteModal(false)}
                      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 20 }}
                      className="relative bg-card border border-border-dim w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl"
                    >
                      <div className="flex flex-col items-center text-center space-y-4">
                        <div className="p-4 bg-red-500/10 rounded-full text-red-500">
                          <AlertCircle size={40} />
                        </div>
                        <h3 className="text-xl font-black text-text-main tracking-tight">Acção Irreversível</h3>
                        <p className="text-xs text-text-muted font-bold">
                          Estás prestes a apagar a tua conta e todas as tuas subscrições. Isto não pode ser desfeito.
                        </p>
                        
                        <div className="w-full space-y-4 pt-4">
                          <div className="space-y-2">
                            <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest">Escreve ELIMINAR para confirmar</label>
                            <input
                              type="text"
                              value={deleteConfirmText}
                              onChange={(e) => setDeleteConfirmText(e.target.value)}
                              placeholder="ELIMINAR"
                              className="w-full px-5 py-4 bg-bg border border-border-dim rounded-2xl text-center font-black tracking-widest text-red-500 focus:ring-2 focus:ring-red-500 outline-none"
                            />
                          </div>
                          
                          <div className="flex gap-3 pt-2">
                            <button
                              onClick={() => setShowDeleteModal(false)}
                              className="flex-1 px-6 py-4 bg-bg border border-border-dim rounded-2xl text-xs font-black text-text-muted hover:border-text-muted transition-all"
                            >
                              CANCELAR
                            </button>
                            <button
                              onClick={handleDeleteAccount}
                              disabled={deleteConfirmText !== 'ELIMINAR' || saving}
                              className="flex-1 px-6 py-4 bg-red-500 text-white rounded-2xl text-xs font-black hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {saving ? "A ELIMINAR..." : "ELIMINAR CONTA"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Save Button (Only for relevant tabs) */}
              {(activeTab === 'account' || activeTab === 'preferences' || activeTab === 'notifications') && (
                <div className="pt-6 flex justify-end">
                  <button
                    onClick={() => handleSave()}
                    disabled={saving}
                    className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white px-8 py-4 rounded-2xl text-xs font-black transition-all shadow-xl shadow-accent/20 disabled:opacity-50"
                  >
                    {saving ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Save size={16} />
                        GUARDAR ALTERAÇÕES
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
