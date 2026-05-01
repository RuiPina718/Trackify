import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, where, writeBatch, doc, onSnapshot } from 'firebase/firestore';
import { db, auth as firebaseAuth } from '../../lib/firebase';
import { UserProfile, Subscription } from '../../types';
import { Users, CreditCard, Activity, ShieldCheck, Mail, LogIn, ExternalLink, CheckCircle, Download, Trash2, AlertTriangle, X } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { exportUsersToCSV } from '../../lib/exportUtils';

const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [allSubscriptions, setAllSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleDeleteUser = async () => {
    if (!userToDelete || deleteConfirmText !== 'CONFIRMAR') return;
    
    setLoading(true);
    try {
      const q = query(collection(db, 'subscriptions'), where('userId', '==', userToDelete.uid));
      const subsSnapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      
      subsSnapshot.docs.forEach((d) => {
        batch.delete(d.ref);
      });
      
      batch.delete(doc(db, 'users', userToDelete.uid));
      
      await batch.commit();
      
      setUsers(users.filter(u => u.uid !== userToDelete.uid));
      setActionStatus(`Utilizador ${userToDelete.email} removido com sucesso.`);
      setShowDeleteModal(false);
      setUserToDelete(null);
      setDeleteConfirmText('');
    } catch (error: any) {
      console.error('Error deleting user:', error);
      setActionStatus(`Erro ao remover utilizeador: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(firebaseAuth, email);
      setActionStatus(`Email de recuperação enviado para ${email}`);
      setTimeout(() => setActionStatus(null), 5000);
    } catch (error: any) {
      console.error('Error sending reset email:', error);
      setActionStatus(`Erro: ${error.message}`);
      setTimeout(() => setActionStatus(null), 5000);
    }
  };

  const handleExport = () => {
    exportUsersToCSV(users, allSubscriptions);
    setActionStatus('Exportação concluída');
    setTimeout(() => setActionStatus(null), 3000);
  };

  useEffect(() => {
    setLoading(true);
    
    // Subscribe to all users
    const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
      const usersList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          uid: doc.id,
          email: data.email || '',
          displayName: data.displayName || '',
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || '',
          currency: data.currency || 'EUR'
        } as UserProfile;
      });
      setUsers(usersList);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching admin users:', error);
      setLoading(false);
    });

    // Subscribe to all subscriptions for meta overview
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
      <div className="flex items-center justify-center h-64">
        <Activity className="animate-spin text-accent w-8 h-8" />
      </div>
    );
  }

  const totalMonthlyVolume = allSubscriptions
    .filter(s => s.status === 'active')
    .reduce((acc, s) => acc + (s.billingCycle === 'monthly' ? s.amount : s.amount / 12), 0);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-text-main tracking-tighter">Painel de Controlo Admin</h2>
          <p className="text-text-muted font-bold text-[10px] uppercase tracking-widest mt-1">Gestão Centralizada de Utilizadores e Dados</p>
        </div>
        <div className="bg-accent/10 border border-accent/20 px-4 py-2 rounded-2xl flex items-center gap-2">
          <ShieldCheck size={16} className="text-accent" />
          <span className="text-xs font-black text-accent uppercase tracking-widest">Admin Access Granted</span>
        </div>
      </div>

      {/* Meta Stats Row */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-card border border-border-dim p-8 rounded-[2.5rem] flex flex-col items-center text-center">
          <Users size={32} className="text-accent mb-4" />
          <p className="text-sm font-black text-text-main">{users.length}</p>
          <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Utilizadores Totais</p>
        </div>
        <div className="bg-card border border-border-dim p-8 rounded-[2.5rem] flex flex-col items-center text-center">
          <CreditCard size={32} className="text-accent mb-4" />
          <p className="text-sm font-black text-text-main">{allSubscriptions.length}</p>
          <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Subscrições Registadas</p>
        </div>
        <div className="bg-card border border-border-dim p-8 rounded-[2.5rem] flex flex-col items-center text-center">
          <Activity size={32} className="text-accent mb-4" />
          <p className="text-sm font-black text-text-main">
            {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(totalMonthlyVolume)}
          </p>
          <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Volume Mensal Estimado</p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-card border border-border-dim rounded-[3rem] overflow-hidden">
        <div className="p-8 border-b border-border-dim flex justify-between items-center">
          <h3 className="text-lg font-black text-text-main tracking-tight">Utilizadores da Plataforma</h3>
          {actionStatus && (
            <div className="flex items-center gap-2 text-[10px] font-bold text-health bg-health/10 px-4 py-2 rounded-xl animate-in fade-in slide-in-from-top-1">
              <CheckCircle size={14} />
              {actionStatus}
            </div>
          )}
          <button 
            onClick={handleExport}
            className="text-[10px] font-black uppercase tracking-widest px-4 py-2 bg-accent text-white rounded-xl hover:bg-accent/90 transition-all flex items-center gap-2"
          >
            <Download size={14} />
            Exportar CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-bg font-black text-[10px] text-text-muted uppercase tracking-widest">
                <th className="px-8 py-4">Utilizador</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4">Data Registo</th>
                <th className="px-8 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-dim">
              {users.map(user => {
                const userSubs = allSubscriptions.filter(s => s.userId === user.uid);
                return (
                  <tr key={user.uid} className="hover:bg-bg/50 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-accent/10 flex items-center justify-center font-black text-accent text-xs">
                          {(user.email || user.displayName || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-text-main">{user.displayName || 'Sem nome'}</p>
                          <div className="flex items-center gap-1.5 text-[10px] text-text-muted font-bold">
                            <Mail size={12} />
                            <div className="flex items-center gap-2">
                              {user.email}
                              {users.filter(u => u.email === user.email).length > 1 && (
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/10 text-red-500 text-[8px] font-black rounded-full border border-red-500/20 uppercase tracking-widest">
                                  <AlertTriangle size={8} /> Duplicado
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-text-main">{userSubs.length} Subscrições</span>
                        <div className="w-24 h-1 bg-border-dim rounded-full overflow-hidden">
                          <div className="h-full bg-accent" style={{ width: `${Math.min(userSubs.length * 10, 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-sm text-text-muted font-medium">
                      {user.createdAt ? format(new Date(user.createdAt), 'dd MMM yyyy', { locale: pt }) : 'N/A'}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleResetPassword(user.email)}
                          title="Reset Password Email"
                          className="p-2 text-text-muted hover:text-accent transition-colors"
                        >
                          <LogIn size={18} />
                        </button>
                        <button 
                          onClick={() => {
                            setUserToDelete(user);
                            setShowDeleteModal(true);
                          }}
                          title="Remover Utilizador"
                          className="p-2 text-text-muted hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete User Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowDeleteModal(false);
                setUserToDelete(null);
                setDeleteConfirmText('');
              }}
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
                  <AlertTriangle size={40} />
                </div>
                <h3 className="text-xl font-black text-text-main tracking-tight">Remover Utilizador</h3>
                <p className="text-xs text-text-muted font-bold leading-relaxed px-4">
                  Estás prestes a apagar permanentemente o utilizador <span className="text-text-main">{userToDelete?.email}</span> e todas as suas subscrições da base de dados.
                </p>
                
                <div className="w-full space-y-4 pt-4">
                  <div className="space-y-2 text-left">
                    <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Escreve <span className="text-red-500">CONFIRMAR</span> para proceder</label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                      placeholder="CONFIRMAR"
                      className="w-full px-5 py-4 bg-bg border border-border-dim rounded-2xl text-center font-black tracking-widest text-red-500 focus:ring-2 focus:ring-red-500 outline-none"
                    />
                  </div>
                  
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        setShowDeleteModal(false);
                        setUserToDelete(null);
                        setDeleteConfirmText('');
                      }}
                      className="flex-1 px-6 py-4 bg-bg border border-border-dim rounded-2xl text-[10px] font-black text-text-muted hover:border-text-muted transition-all uppercase tracking-widest"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleDeleteUser}
                      disabled={deleteConfirmText !== 'CONFIRMAR' || loading}
                      className="flex-1 px-6 py-4 bg-red-500 text-white rounded-2xl text-[10px] font-black hover:bg-red-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed uppercase tracking-widest"
                    >
                      {loading ? "A PROCESSAR..." : "ELIMINAR"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-accent/5 border border-accent/20 p-8 rounded-[2.5rem]">
        <h4 className="font-black text-lg text-text-main mb-2 tracking-tighter">🔒 Nota de Segurança</h4>
        <p className="text-sm text-text-muted font-medium leading-relaxed">
          Como administrador, tens acesso a dados sensíveis de faturação. Todas as ações realizadas neste painel são auditadas. 
          A recuperação de password deve ser realizada via email padrão da Firebase para garantir o Zero-Trust.
        </p>
      </div>
    </div>
  );
};

export default AdminDashboard;
