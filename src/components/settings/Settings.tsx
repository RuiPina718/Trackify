import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { UserProfile } from '../../types';
import { getUserProfile, updateUserProfile, createUserProfile } from '../../services/userService';
import { Settings as SettingsIcon, User as UserIcon, Globe, CreditCard, Bell, Shield, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface SettingsProps {
  user: User;
}

const Settings: React.FC<SettingsProps> = ({ user }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        let p = await getUserProfile(user.uid);
        if (!p) {
          // Create default profile if not exists
          p = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || '',
            currency: 'EUR',
            createdAt: new Date().toISOString()
          };
          await createUserProfile(p);
        }
        setProfile(p);
        setDisplayName(p.displayName || '');
        setCurrency(p.currency || 'EUR');
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await updateUserProfile(user.uid, {
        displayName,
        currency
      });
      setMessage({ type: 'success', text: 'Definições actualizadas com sucesso!' });
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
      setMessage({ type: 'error', text: 'Erro ao guardar definições. Tenta novamente.' });
    } finally {
      setSaving(false);
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

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="mb-10">
        <h2 className="text-4xl font-black text-text-main tracking-tighter">Definições</h2>
        <p className="text-text-muted font-bold text-xs uppercase tracking-[0.2em] mt-2">Personaliza a tua experiência no Trackify</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Sidebar Nav */}
        <div className="md:col-span-1 space-y-2">
          {[
            { id: 'account', label: 'Conta', icon: UserIcon },
            { id: 'preferences', label: 'Preferências', icon: Globe },
            { id: 'billing', label: 'Faturação', icon: CreditCard },
            { id: 'notifications', label: 'Notificações', icon: Bell },
            { id: 'security', label: 'Segurança', icon: Shield },
          ].map((item) => (
            <button
              key={item.id}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-left",
                item.id === 'account' ? "bg-accent text-white" : "text-text-muted hover:text-text-main hover:bg-card"
              )}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="md:col-span-3 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border-dim rounded-[2.5rem] p-10"
          >
            <form onSubmit={handleSave} className="space-y-8">
              {/* Account Info */}
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
                      className="w-full px-5 py-4 bg-bg border border-border-dim rounded-2xl text-sm text-text-muted cursor-not-allowed outline-none"
                    />
                    <p className="text-[10px] text-text-muted/50 mt-2 ml-1 italic">O email não pode ser alterado directamente.</p>
                  </div>
                </div>
              </section>

              {/* Preferences */}
              <section className="space-y-6 pt-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border-dim">
                  <Globe size={18} className="text-accent" />
                  <h3 className="text-sm font-black text-text-main uppercase tracking-widest">Preferências Globais</h3>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-4 ml-1">Moeda de Visualização</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {currencies.map((curr) => (
                      <button
                        key={curr.code}
                        type="button"
                        onClick={() => setCurrency(curr.code)}
                        className={cn(
                          "p-4 rounded-2xl border transition-all flex flex-col items-center gap-2",
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
                </div>
              </section>

              {/* Status Messages */}
              <AnimatePresence>
                {message && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-2xl border text-sm font-bold",
                      message.type === 'success' 
                        ? "bg-health/10 border-health text-health" 
                        : "bg-red-500/10 border-red-500 text-red-500"
                    )}
                  >
                    {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    {message.text}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Buttons */}
              <div className="pt-6 flex justify-end">
                <button
                  type="submit"
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
            </form>
          </motion.div>

          <div className="p-8 bg-card border border-border-dim rounded-[2.5rem] flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Backup de Dados</p>
              <h4 className="text-sm font-black text-text-main">Exportar ficheiro de segurança</h4>
            </div>
            <button className="px-6 py-3 bg-bg border border-border-dim rounded-xl text-[10px] font-bold text-text-main hover:bg-border-dim transition-all">
              EXPORTAR JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
