import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  sendPasswordResetEmail, 
  reauthenticateWithCredential, 
  EmailAuthProvider, 
  updatePassword 
} from 'firebase/auth';
import { UserProfile, NotificationPreferences, Category, PREDEFINED_CATEGORIES } from '../../types';
import { getUserProfile, updateUserProfile, createUserProfile, deleteUserProfile } from '../../services/userService';
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
  X,
  Trash2,
  Plus,
  Edit2,
  Check,
  FileJson,
  History,
  Palette,
  LayoutGrid,
  SlidersHorizontal,
  Tv,
  Box,
  Gamepad2,
  Music,
  Activity,
  MoreHorizontal,
  ShoppingBag,
  Utensils,
  Car,
  Home,
  Heart,
  Zap,
  Coffee,
  Smartphone,
  Laptop,
  Book,
  Camera,
  Search,
  Upload,
  ImageIcon,
  Calendar,
  RefreshCw,
  Link,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { exportUserDataToJSON } from '../../lib/exportUtils';
import { collection, getDocs, query, where, writeBatch, doc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { useUnifiedCategories } from '../../hooks/useUnifiedCategories';
import { updateCategory, deleteCategory, createCategory } from '../../services/categoryService';
import { IconRenderer } from '../ui/IconRenderer';
import DeleteConfirmationModal from '../ui/DeleteConfirmationModal';
import CategoryModal from './CategoryModal';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../../types';

interface SettingsProps {
  user: User;
  initialTab?: SettingsTab;
}

type SettingsTab = 'account' | 'preferences' | 'categories' | 'billing' | 'notifications' | 'security' | 'calendar';

const CURRENCIES = [
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'USD', symbol: '$', name: 'Dólar Americano' },
  { code: 'GBP', symbol: '£', name: 'Libra Esterlina' },
  { code: 'BRL', symbol: 'R$', name: 'Real Brasileiro' },
];

const DICEBEAR_STYLES = [
  { id: 'avataaars', label: 'Humanos' },
  { id: 'bottts', label: 'Robôs' },
  { id: 'lorelei', label: 'Artístico' },
  { id: 'personas', label: 'Personas' },
  { id: 'big-smile', label: 'Smiles' },
  { id: 'adventurer', label: 'Aventuras' }
];

const AVATARS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Midnight',
  'https://api.dicebear.com/7.x/personas/svg?seed=Nala',
  'https://api.dicebear.com/7.x/big-smile/svg?seed=Toby',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Oliver',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Shadow',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Jasper',
];

const Settings: React.FC<SettingsProps> = ({ user, initialTab }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || 'account');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const { categories: displayCategories, userCategories, loading: categoriesLoading } = useUnifiedCategories(user.uid);
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [monthlyBudget, setMonthlyBudget] = useState<number | null>(null);
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
  const [showSuccessDeleteModal, setShowSuccessDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  // Category Modal State
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<Category | null>(null);
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Category Deletion Modal State
  const [catToDelete, setCatToDelete] = useState<Category | null>(null);
  const [isDeletingCat, setIsDeletingCat] = useState(false);
  const [avatarSeed, setAvatarSeed] = useState('');
  const [avatarStyle, setAvatarStyle] = useState('avataaars');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Calendar Sync State
  const [showCalendarDisconnectModal, setShowCalendarDisconnectModal] = useState(false);
  const [calendarIntegration, setCalendarIntegration] = useState<{ status: string, lastSyncAt: string } | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Password Change State
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const p = await getUserProfile(user.uid);
        if (p) {
          setProfile(p);
          setDisplayName(p.displayName || '');
          setPhotoURL(p.photoURL || '');
          setBio(p.bio || '');
          setLocation(p.location || '');
          setCurrency(p.currency || 'EUR');
          setTheme(p.theme || 'dark');
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
    const fetchCalendarIntegration = async () => {
      try {
        const docSnap = await getDocs(query(collection(db, 'calendar_integrations'), where('userId', '==', user.uid)));
        if (!docSnap.empty) {
          const data = docSnap.docs[0].data();
          setCalendarIntegration({
            status: data.status,
            lastSyncAt: data.lastSyncAt?.toDate?.()?.toISOString() || data.lastSyncAt || ''
          });
        }
      } catch (error) {
        console.error('Error fetching calendar integration:', error);
      }
    };
    fetchCalendarIntegration();

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'CALENDAR_SYNC_SUCCESS') {
        fetchCalendarIntegration();
        handleSyncAll();
        setMessage({ type: 'success', text: 'Google Calendar ligado com sucesso!' });
        setTimeout(() => setMessage(null), 3000);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [user]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await updateUserProfile(user.uid, {
        displayName,
        photoURL,
        bio,
        location,
        currency,
        theme,
        monthlyBudget,
        notifications
      });
      setMessage({ type: 'success', text: 'Definições atualizadas com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      setMessage({ type: 'error', text: `Erro ao guardar: ${error.message || 'Tenta novamente.'}` });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'ELIMINAR') return;
    
    setSaving(true);
    try {
      // 1. Delete Firestore Data using the centralized service
      await deleteUserProfile(user.uid);
      
      // 2. Show Success Modal instead of immediate redirect
      setShowDeleteModal(false);
      setShowSuccessDeleteModal(true);
    } catch (error: any) {
      console.error('Error deleting account:', error);
      setMessage({ type: 'error', text: `Erro ao eliminar dados: ${error.message || 'Tenta novamente.'}` });
      setShowDeleteModal(false);
    } finally {
      setSaving(false);
    }
  };

  const finalizeAccountDeletion = async () => {
    setSaving(true);
    try {
      // 3. Finally delete the Auth User
      await user.delete();
      window.location.href = '/';
    } catch (error: any) {
      console.error('Error deleting auth user:', error);
      if (error.code === 'auth/requires-recent-login') {
        setMessage({ type: 'error', text: 'Esta acção requer que tenhas feito login recentemente. Por favor, faz login de novo para confirmar a eliminação total.' });
        // Even if auth delete fails, the data is gone. We should probably sign out anyway.
        await auth.signOut();
        window.location.href = '/';
      } else {
        await auth.signOut();
        window.location.href = '/';
      }
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

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'As novas palavras-passe não coincidem.' });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'A nova palavra-passe deve ter pelo menos 6 caracteres.' });
      return;
    }

    setPasswordLoading(true);
    try {
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email || '', oldPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await updatePassword(user, newPassword);
      
      setMessage({ type: 'success', text: 'Palavra-passe alterada com sucesso!' });
      setIsChangingPassword(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Error updating password:', error);
      let errorMsg = 'Erro ao alterar palavra-passe.';
      if (error.code === 'auth/wrong-password') {
        errorMsg = 'A palavra-passe antiga está incorreta.';
      } else if (error.code === 'auth/weak-password') {
        errorMsg = 'A nova palavra-passe é demasiado fraca.';
      }
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setPasswordLoading(false);
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

  const handleConnectCalendar = async () => {
    setCalendarLoading(true);
    try {
      const response = await fetch(`/api/auth/google/url?userId=${user.uid}`);
      if (!response.ok) throw new Error('Falha ao obter URL de autenticação');
      const { url } = await response.json();
      
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      window.open(
        url,
        'google_oauth_popup',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    } catch (error) {
      console.error('Error connecting calendar:', error);
      setMessage({ type: 'error', text: 'Erro ao ligar ao Google Calendar.' });
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    setCalendarLoading(true);
    try {
      const response = await fetch('/api/calendar/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid }),
      });
      
      if (!response.ok) throw new Error('Falha ao desligar o calendário');
      
      setCalendarIntegration(null);
      setMessage({ type: 'success', text: 'Google Calendar desligado com sucesso.' });
      setShowCalendarDisconnectModal(false);
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error disconnecting calendar:', error);
      setMessage({ type: 'error', text: 'Erro ao desligar o calendário.' });
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleSyncAll = async () => {
    setCalendarLoading(true);
    try {
      const response = await fetch('/api/calendar/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Falha ao sincronizar');
      }
      
      const { count } = await response.json();
      setMessage({ type: 'success', text: `${count} subscrições sincronizadas com sucesso!` });
      setTimeout(() => setMessage(null), 3000);
      
      // Refresh integration status
      const docSnap = await getDocs(query(collection(db, 'calendar_integrations'), where('userId', '==', user.uid)));
      if (!docSnap.empty) {
        const data = docSnap.docs[0].data();
        setCalendarIntegration({
          status: data.status,
          lastSyncAt: data.lastSyncAt?.toDate?.()?.toISOString() || data.lastSyncAt || ''
        });
      }
    } catch (error) {
      console.error('Error syncing all:', error);
      setMessage({ type: 'error', text: 'Erro ao sincronizar subscrições.' });
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleSaveCategory = async (catData: { name: string, color: string, icon: string }) => {
    setIsSavingCategory(true);
    try {
      if (categoryToEdit) {
        // Mode: Edit
        if (!categoryToEdit.userId) {
          // Predefined override
          await createCategory(user.uid, catData.name, catData.color, categoryToEdit.id, catData.icon);
        } else {
          // Update custom/override
          const oldName = categoryToEdit.name;
          await updateCategory(categoryToEdit.id, catData);

          if (oldName !== catData.name) {
            try {
              const subsRef = collection(db, 'subscriptions');
              const q = query(subsRef, where('userId', '==', user.uid), where('category', '==', oldName));
              const snapshot = await getDocs(q);
              if (!snapshot.empty) {
                const batch = writeBatch(db);
                snapshot.docs.forEach((doc) => batch.update(doc.ref, { category: catData.name }));
                await batch.commit();
              }
            } catch (subErr) {
              console.error('Error updating subscriptions:', subErr);
            }
          }
        }
        setMessage({ type: 'success', text: 'Categoria atualizada!' });
      } else {
        // Mode: Add
        await createCategory(user.uid, catData.name, catData.color, undefined, catData.icon);
        setMessage({ type: 'success', text: 'Categoria adicionada!' });
      }
      setIsCatModalOpen(false);
      setCategoryToEdit(null);
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving category:', error);
      setMessage({ type: 'error', text: 'Erro ao guardar categoria.' });
    } finally {
      setIsSavingCategory(false);
    }
  };

  const startEditingCat = (cat: Category) => {
    setCategoryToEdit(cat);
    setIsCatModalOpen(true);
  };

  const handleDeleteCategory = async () => {
    if (!catToDelete) return;
    
    setIsDeletingCat(true);
    try {
      await deleteCategory(catToDelete.id);
      setMessage({ type: 'success', text: 'Categoria removida!' });
      setCatToDelete(null);
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting category:', error);
      setMessage({ type: 'error', text: 'Erro ao remover categoria.' });
    } finally {
      setIsDeletingCat(false);
    }
  };

  const handleQuickColorUpdate = async (cat: Category, color: string) => {
    try {
      if (!cat.userId) {
        // Handle predefined category override
        await createCategory(user.uid, cat.name, color, cat.id, cat.icon);
      } else {
        // Handle existing custom/override category
        await updateCategory(cat.id, { color });
      }
      setMessage({ type: 'success', text: 'Cor atualizada!' });
      setTimeout(() => setMessage(null), 2000);
    } catch (error) {
      console.error('Error updating color:', error);
      setMessage({ type: 'error', text: 'Erro ao atualizar cor.' });
    }
  };

  if (loading || categoriesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs = [
    { id: 'account', label: 'Conta', icon: UserIcon },
    { id: 'calendar', label: 'Sincronização', icon: Calendar },
    { id: 'preferences', label: 'Preferências', icon: SettingsIcon },
    { id: 'categories', label: 'Categorias', icon: LayoutGrid },
    { id: 'billing', label: 'Faturação', icon: CreditCard },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'security', label: 'Segurança', icon: Shield },
  ] as const;

  const handleRandomizeAvatar = () => {
    const randomSeed = Math.random().toString(36).substring(7);
    const randomStyle = DICEBEAR_STYLES[Math.floor(Math.random() * DICEBEAR_STYLES.length)].id;
    setAvatarSeed(randomSeed);
    setAvatarStyle(randomStyle);
    setPhotoURL(`https://api.dicebear.com/7.x/${randomStyle}/svg?seed=${randomSeed}`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Por favor, seleciona um ficheiro de imagem válido.' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB limit for base64 storage
      setMessage({ type: 'error', text: 'A imagem é muito grande. Máximo 2MB para carregar diretamente.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setPhotoURL(dataUrl);
      setAvatarSeed('');
      setMessage({ type: 'success', text: 'Imagem carregada com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    };
    reader.readAsDataURL(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  };

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
              {activeTab === 'account' && (
                <section className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-2 pb-2 border-b border-border-dim">
                    <UserIcon size={18} className="text-accent" />
                    <h3 className="text-sm font-black text-text-main uppercase tracking-widest">Informação da Conta</h3>
                  </div>

                  {/* Avatar Selection Container */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 bg-bg/50 border border-border-dim rounded-[2.5rem]">
                    {/* Preview Area */}
                    <div className="lg:col-span-3 flex flex-col items-center justify-center space-y-4">
                      <div 
                        className={cn(
                          "relative group cursor-pointer transition-all",
                          isDragging && "scale-110"
                        )}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <div className={cn(
                          "w-28 h-28 rounded-[2.5rem] overflow-hidden border-2 shadow-2xl bg-card flex items-center justify-center transition-all",
                          isDragging ? "border-accent bg-accent/10" : "border-accent"
                        )}>
                          {photoURL ? (
                            <img src={photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <UserIcon size={44} className="text-text-muted" />
                          )}
                          {isDragging && (
                            <div className="absolute inset-0 bg-accent/20 backdrop-blur-sm flex items-center justify-center text-white">
                              <Upload size={32} />
                            </div>
                          )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 p-2.5 bg-accent text-white rounded-2xl shadow-xl ring-4 ring-bg group-hover:scale-110 transition-transform">
                          <Camera size={16} />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">O Teu Perfil</p>
                        {photoURL && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setPhotoURL('');
                            }}
                            className="text-[9px] font-black text-red-500 uppercase tracking-widest mt-2 hover:underline"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Controls Area */}
                    <div className="lg:col-span-9 space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Cria o Teu Próprio Avatar</label>
                          <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-1.5 text-[9px] font-black text-accent uppercase tracking-widest hover:underline"
                          >
                            <Upload size={12} />
                            Enviar Foto
                          </button>
                        </div>
                        
                        <input 
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          className="hidden"
                          accept="image/*"
                        />
                        
                        <div className="flex flex-wrap gap-2">
                          {DICEBEAR_STYLES.map((style) => (
                            <button
                              key={style.id}
                              type="button"
                              onClick={() => {
                                setAvatarStyle(style.id);
                                // Always update URL when style changes, using existing seed or a default one
                                const currentSeed = avatarSeed || user.uid.substring(0, 5);
                                if (!avatarSeed) setAvatarSeed(currentSeed);
                                setPhotoURL(`https://api.dicebear.com/7.x/${style.id}/svg?seed=${currentSeed}`);
                              }}
                              className={cn(
                                "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                                avatarStyle === style.id 
                                  ? "bg-accent text-white shadow-lg shadow-accent/20" 
                                  : "bg-bg border border-border-dim text-text-muted hover:border-accent hover:text-text-main"
                              )}
                            >
                              {style.label}
                            </button>
                          ))}
                        </div>
                        
                        <div className="flex gap-3">
                          <div className="relative flex-1">
                            <input
                              type="text"
                              value={avatarSeed}
                              onChange={(e) => {
                                const seed = e.target.value;
                                setAvatarSeed(seed);
                                if (seed) {
                                  setPhotoURL(`https://api.dicebear.com/7.x/${avatarStyle}/svg?seed=${seed}`);
                                }
                              }}
                              className="w-full px-6 py-4 bg-bg border border-border-dim rounded-2xl text-sm text-text-main font-bold focus:ring-2 focus:ring-accent outline-none transition-all placeholder:text-text-muted/30"
                              placeholder="Escreve o teu nome ou algo aleatório..."
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                               <button
                                type="button"
                                onClick={handleRandomizeAvatar}
                                className="p-2 bg-accent/10 text-accent hover:bg-accent hover:text-white rounded-xl transition-all"
                                title="Gerar Aleatório"
                              >
                                <Zap size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-border-dim/50 space-y-4">
                        <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Ou Escolhe um Link</label>
                        <div className="flex flex-wrap gap-2.5">
                          {AVATARS.map((url, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                setPhotoURL(url);
                                setAvatarSeed(''); // Clear seed when manual picking
                              }}
                              className={cn(
                                "w-11 h-11 rounded-2xl overflow-hidden border-2 transition-all hover:scale-110 shadow-sm",
                                photoURL === url ? "border-accent scale-110 shadow-lg shadow-accent/20" : "border-transparent opacity-60 hover:opacity-100"
                              )}
                            >
                              <img src={url} alt={`Avatar ${i}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={photoURL}
                          onChange={(e) => setPhotoURL(e.target.value)}
                          className="w-full px-5 py-3 bg-bg border border-border-dim rounded-2xl text-xs text-text-muted/70 focus:ring-2 focus:ring-accent outline-none transition-all"
                          placeholder="Link direto da imagem (URL)..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4">
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
                      <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 ml-1">Localização</label>
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full px-5 py-4 bg-bg border border-border-dim rounded-2xl text-sm text-text-main focus:ring-2 focus:ring-accent outline-none transition-all"
                        placeholder="Ex: Lisboa, Portugal"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 ml-1">Bio / Sobre Ti</label>
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        className="w-full px-5 py-4 bg-bg border border-border-dim rounded-2xl text-sm text-text-main focus:ring-2 focus:ring-accent outline-none transition-all resize-none h-24"
                        placeholder="Fala um pouco sobre ti..."
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
                      <p className="text-[10px] text-text-muted/50 mt-2 ml-1 italic">O email não pode ser alterado diretamente.</p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 ml-1">Moeda</label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="w-full px-5 py-4 bg-bg border border-border-dim rounded-2xl text-sm text-text-main font-bold focus:ring-2 focus:ring-accent outline-none transition-all appearance-none"
                      >
                        {CURRENCIES.map(curr => (
                          <option key={curr.code} value={curr.code}>{curr.code} ({curr.symbol})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 ml-1">Orçamento Mensal</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={monthlyBudget === null ? '' : monthlyBudget}
                          onChange={(e) => setMonthlyBudget(e.target.value === '' ? null : parseFloat(e.target.value))}
                          className="w-full px-5 py-4 bg-bg border border-border-dim rounded-2xl text-sm text-text-main font-bold focus:ring-2 focus:ring-accent outline-none transition-all"
                          placeholder="Ex: 100.00"
                        />
                        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-text-muted uppercase">{currency}</span>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {activeTab === 'calendar' && (
                <section className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-2 pb-2 border-b border-border-dim">
                    <Calendar size={18} className="text-accent" />
                    <h3 className="text-sm font-black text-text-main uppercase tracking-widest">CalendarSync</h3>
                  </div>

                  <div className="p-8 bg-bg border border-border-dim rounded-[2.5rem] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 text-accent/5 -rotate-12 group-hover:rotate-0 transition-all duration-500">
                      <Calendar size={120} />
                    </div>

                    <div className="relative z-10 space-y-6">
                      <div className="space-y-2">
                        <h4 className="text-xl font-black text-text-main tracking-tight">Sincroniza com Google Calendar</h4>
                        <p className="text-xs text-text-muted font-medium leading-relaxed max-w-md">
                          Adiciona automaticamente os teus pagamentos recorrentes ao teu calendário pessoal. 
                          Nunca mais te esqueças de uma renovação.
                        </p>
                      </div>

                      <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-4 p-4 bg-card border border-border-dim rounded-2xl">
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                            calendarIntegration?.status === 'connected' ? "bg-green-500/10 text-green-500" : "bg-accent/10 text-accent"
                          )}>
                             {calendarIntegration?.status === 'connected' ? <CheckCircle2 size={24} /> : <Link size={24} />}
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-black text-text-main uppercase tracking-widest">Estado da Ligação</p>
                            <p className={cn(
                              "text-[10px] font-bold uppercase tracking-wider",
                              calendarIntegration?.status === 'connected' ? "text-green-500" : "text-text-muted"
                            )}>
                              {calendarIntegration?.status === 'connected' ? 'Sincronizado com Google' : 'Não Ligado'}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={handleConnectCalendar}
                              disabled={calendarLoading}
                              className={cn(
                                "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                calendarIntegration?.status === 'connected' 
                                  ? "bg-bg border border-border-dim text-text-muted hover:border-accent hover:text-accent" 
                                  : "bg-accent text-white shadow-lg shadow-accent/20 hover:bg-accent/90"
                              )}
                            >
                              {calendarLoading ? (
                                <RefreshCw size={14} className="animate-spin" />
                              ) : (
                                calendarIntegration?.status === 'connected' ? 'Reconectar' : 'Ligar Agora'
                              )}
                            </button>
                            {calendarIntegration?.status === 'connected' && (
                              <button
                                onClick={() => setShowCalendarDisconnectModal(true)}
                                disabled={calendarLoading}
                                className="px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white"
                              >
                                {calendarLoading ? <RefreshCw size={14} className="animate-spin" /> : 'Desligar'}
                              </button>
                            )}
                          </div>
                        </div>

                        {calendarIntegration?.status === 'connected' && (
                          <div className="flex flex-col gap-4">
                            <div className="p-4 bg-accent/5 border border-accent/20 rounded-2xl flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-accent/10 text-accent rounded-lg">
                                  <RefreshCw size={16} className={calendarLoading ? "animate-spin" : ""} />
                                </div>
                                <div>
                                  <p className="text-[10px] font-black text-text-main uppercase tracking-widest">Sincronização Automática Ativa</p>
                                  <p className="text-[10px] text-text-muted font-bold">
                                    Última sincronização: {calendarIntegration.lastSyncAt ? new Date(calendarIntegration.lastSyncAt).toLocaleString() : 'Nunca'}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={handleSyncAll}
                                disabled={calendarLoading}
                                className="px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2"
                              >
                                {calendarLoading ? (
                                  <RefreshCw size={12} className="animate-spin" />
                                ) : (
                                  <>
                                    <RefreshCw size={12} />
                                    Sincronizar Agora
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                          <p className="text-[10px] text-text-muted font-medium">Os eventos são criados como lembretes de dia inteiro.</p>
                        </div>
                        <div className="flex gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                          <p className="text-[10px] text-text-muted font-medium">Atualiza automaticamente se alterares uma data.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {activeTab === 'preferences' && (
                <section className="space-y-6">
                  <div className="flex items-center gap-2 pb-2 border-b border-border-dim">
                    <Palette size={18} className="text-accent" />
                    <h3 className="text-sm font-black text-text-main uppercase tracking-widest">Interface e Aparência</h3>
                  </div>

                  <div className="p-6 bg-bg border border-border-dim rounded-2xl space-y-4">
                    <p className="text-xs font-black text-text-main uppercase tracking-widest">Tema da Aplicação</p>
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        type="button"
                        onClick={() => setTheme('light')}
                        className={cn(
                          "p-4 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all",
                          theme === 'light' ? "bg-card border-2 border-accent" : "bg-bg border border-border-dim opacity-50"
                        )}
                      >
                        <div className="w-4 h-4 rounded-full bg-white border border-border-dim" />
                        Claro
                      </button>
                      <button 
                        type="button"
                        onClick={() => setTheme('dark')}
                        className={cn(
                          "p-4 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all",
                          theme === 'dark' ? "bg-card border-2 border-accent" : "bg-bg border border-border-dim opacity-50"
                        )}
                      >
                        <div className="w-4 h-4 rounded-full bg-black border border-white/10" />
                        Escuro
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {activeTab === 'categories' && (
                <section className="space-y-8">
                  <div className="flex items-center justify-between pb-2 border-b border-border-dim">
                    <div className="flex items-center gap-2">
                       <LayoutGrid size={18} className="text-accent" />
                       <h3 className="text-sm font-black text-text-main uppercase tracking-widest">Gestão de Categorias</h3>
                    </div>
                    <button
                      onClick={() => {
                        setCategoryToEdit(null);
                        setIsCatModalOpen(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-accent/90 transition-all shadow-lg shadow-accent/20"
                    >
                      <Plus size={14} />
                      Nova Categoria
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                       <h4 className="text-[10px] font-black text-text-muted uppercase tracking-widest">Todas as Categorias</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3">
                      {/* Unified Categories List */}
                      {displayCategories.map((cat) => (
                        <div key={cat.id} className={cn(
                          "p-5 border rounded-[2rem] flex items-center justify-between group transition-all",
                          cat.userId ? "bg-card border-border-dim hover:border-accent/30" : "bg-bg/30 border-border-dim/50 opacity-80 border-dashed hover:border-accent hover:opacity-100"
                        )}>
                          <div className="flex items-center gap-4 flex-1">
                            <div 
                              className="w-12 h-12 rounded-2xl shadow-inner border border-white/10 flex items-center justify-center text-white"
                              style={{ backgroundColor: cat.color }}
                            >
                              <IconRenderer name={cat.icon || 'Tag'} size={20} />
                            </div>
                            <div>
                              <p className="text-sm font-black text-text-main tracking-tight">{cat.name}</p>
                              <p className="text-[9px] text-text-muted font-black uppercase tracking-widest">
                                {!cat.userId ? (
                                  <span className="text-accent">Sistema</span>
                                ) : (
                                  cat.predefinedId ? <span className="text-accent">Sistema (Editada)</span> : "Personalizada"
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 ml-4">
                            <div className="hidden group-hover:flex items-center gap-1.5 px-3 py-1.5 bg-bg/50 rounded-full border border-border-dim transition-all">
                              {CATEGORY_COLORS.slice(0, 8).map((color) => (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() => handleQuickColorUpdate(cat, color)}
                                  className={cn(
                                    "w-4 h-4 rounded-full border border-white/10 transition-all hover:scale-125",
                                    cat.color === color && "ring-2 ring-accent"
                                  )}
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => startEditingCat(cat)}
                              className={cn(
                                "p-2.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-xl transition-all"
                              )}
                              title="Editar"
                            >
                              <Edit2 size={16} />
                            </button>
                            {cat.userId && (
                              <button
                                type="button"
                                onClick={() => setCatToDelete(cat)}
                                className="p-2.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                title="Remover Categoria"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                            {!cat.userId && (
                              <div className="px-3 py-1 bg-bg border border-border-dim rounded-lg">
                                <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">Fixo</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {userCategories.length === 0 && (
                      <div className="p-6 border border-dashed border-border-dim rounded-[2rem] text-center bg-bg/10">
                        <p className="text-[10px] text-text-muted font-black uppercase tracking-widest">Não tens categorias personalizadas criadas.</p>
                      </div>
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
                    <div className="p-6 bg-bg border border-border-dim rounded-2xl">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-accent/10 rounded-xl text-accent">
                            <Key size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-text-main">Palavra-passe</p>
                            <p className="text-[10px] text-text-muted">Actualiza a tua password regularmente</p>
                          </div>
                        </div>
                        {!isChangingPassword && (
                          <button 
                            onClick={() => setIsChangingPassword(true)}
                            className="px-4 py-2 bg-accent text-white rounded-xl text-[10px] font-black hover:bg-accent/90 transition-all uppercase tracking-widest"
                          >
                            Alterar
                          </button>
                        )}
                      </div>

                      <AnimatePresence>
                        {isChangingPassword && (
                          <motion.form
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            onSubmit={handleUpdatePassword}
                            className="space-y-4 overflow-hidden pt-4 border-t border-border-dim/50"
                          >
                            <div className="grid grid-cols-1 gap-4">
                              <div>
                                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5 ml-1">Palavra-passe Atual</label>
                                <input
                                  type="password"
                                  required
                                  value={oldPassword}
                                  onChange={(e) => setOldPassword(e.target.value)}
                                  className="w-full px-5 py-3 bg-card border border-border-dim rounded-xl text-xs text-text-main focus:ring-2 focus:ring-accent outline-none"
                                  placeholder="••••••••"
                                />
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5 ml-1">Nova Palavra-passe</label>
                                  <input
                                    type="password"
                                    required
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-5 py-3 bg-card border border-border-dim rounded-xl text-xs text-text-main focus:ring-2 focus:ring-accent outline-none"
                                    placeholder="••••••••"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5 ml-1">Confirmar Nova Palavra-passe</label>
                                  <input
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-5 py-3 bg-card border border-border-dim rounded-xl text-xs text-text-main focus:ring-2 focus:ring-accent outline-none"
                                    placeholder="••••••••"
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsChangingPassword(false);
                                  setOldPassword('');
                                  setNewPassword('');
                                  setConfirmPassword('');
                                }}
                                className="px-6 py-2 bg-bg border border-border-dim text-text-muted rounded-xl text-[10px] font-black hover:border-text-muted transition-all uppercase tracking-widest"
                              >
                                Cancelar
                              </button>
                              <button
                                type="submit"
                                disabled={passwordLoading}
                                className="px-6 py-2 bg-accent text-white rounded-xl text-[10px] font-black hover:bg-accent/90 transition-all uppercase tracking-widest flex items-center gap-2"
                              >
                                {passwordLoading ? (
                                  <RefreshCw size={12} className="animate-spin" />
                                ) : (
                                  <Check size={12} />
                                )}
                                Confirmar Alteração
                              </button>
                            </div>
                          </motion.form>
                        )}
                      </AnimatePresence>
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

              {/* Success Delete Modal */}
              <AnimatePresence>
                {showSuccessDeleteModal && (
                  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-black/90 backdrop-blur-md"
                    />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 20 }}
                      className="relative bg-card border border-border-dim w-full max-w-md p-10 rounded-[3rem] shadow-2xl overflow-hidden"
                    >
                      {/* Decorative Background Elements */}
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-health via-accent to-health" />
                      
                      <div className="flex flex-col items-center text-center space-y-8">
                        <div className="relative">
                          <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", damping: 12, delay: 0.2 }}
                            className="p-6 bg-health/10 text-health rounded-full"
                          >
                            <CheckCircle2 size={56} strokeWidth={2.5} />
                          </motion.div>
                          
                          {/* Floating particles animation */}
                          {[...Array(6)].map((_, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, scale: 0 }}
                              animate={{ 
                                opacity: [0, 1, 0], 
                                scale: [0, 1, 0.5],
                                x: Math.cos(i * 60 * Math.PI / 180) * 80,
                                y: Math.sin(i * 60 * Math.PI / 180) * 80
                              }}
                              transition={{ 
                                duration: 2, 
                                repeat: Infinity, 
                                delay: i * 0.2,
                                ease: "easeOut"
                              }}
                              className="absolute top-1/2 left-1/2 w-2 h-2 bg-health/30 rounded-full"
                            />
                          ))}
                        </div>

                        <div className="space-y-3">
                          <h3 className="text-3xl font-black text-text-main tracking-tight uppercase italic">
                            Conta Eliminada!
                          </h3>
                          <p className="text-xs text-text-muted font-bold leading-relaxed px-4">
                            Todos os teus dados foram removidos dos nossos servidores com sucesso. 
                            Foi um prazer ter-te connosco!
                          </p>
                        </div>

                        <button
                          onClick={finalizeAccountDeletion}
                          disabled={saving}
                          className="group relative w-full overflow-hidden bg-accent text-white py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all hover:shadow-2xl hover:shadow-accent/40 active:scale-95 disabled:opacity-50"
                        >
                          <span className="relative z-10 flex items-center justify-center gap-2">
                            {saving ? "A REDIRECIONAR..." : "CONTINUAR PARA O INÍCIO"}
                            <Save size={14} className="group-hover:translate-x-1 transition-transform" />
                          </span>
                          <motion.div 
                            className="absolute inset-0 bg-white/20"
                            initial={{ x: "-100%" }}
                            whileHover={{ x: "100%" }}
                            transition={{ duration: 0.6 }}
                          />
                        </button>
                        
                        <p className="text-[9px] font-black text-text-muted/30 uppercase tracking-widest pt-2">
                          SUBMANAGER PRO • SISTEMA DE GESTÃO
                        </p>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Save Button (Only for relevant tabs) */}
              {(activeTab === 'account' || activeTab === 'preferences' || activeTab === 'notifications') && (
                <div className="pt-6 flex justify-end">
                  <button
                    type="button"
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
      <DeleteConfirmationModal
        isOpen={catToDelete !== null}
        onClose={() => setCatToDelete(null)}
        onConfirm={handleDeleteCategory}
        title="Eliminar Categoria"
        itemName={catToDelete?.name || ''}
        loading={isDeletingCat}
      />

      <DeleteConfirmationModal
        isOpen={showCalendarDisconnectModal}
        onClose={() => setShowCalendarDisconnectModal(false)}
        onConfirm={handleDisconnectCalendar}
        title="Desligar Google Calendar"
        itemName="a ligação ao Google Calendar"
        loading={calendarLoading}
      />

      <CategoryModal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        onSave={handleSaveCategory}
        editCategory={categoryToEdit}
        loading={isSavingCategory}
      />
    </div>
  );
};

export default Settings;
