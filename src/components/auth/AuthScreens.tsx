import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, UserPlus, Chrome, AlertCircle, Mail } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function AuthScreens() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccess('Conta criada! Verifica o teu email para confirmar o registo.');
      }
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
        setError('Credenciais inválidas ou conta inexistente.');
      } else {
        setError(msg || 'Ocorreu um erro. Tenta novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err?.message || 'Erro ao iniciar sessão com Google.');
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) { setError('Por favor, introduza o seu email primeiro.'); return; }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) throw error;
      setSuccess('Email de recuperação enviado! Verifique a sua caixa de entrada.');
    } catch (err: any) {
      setError(err?.message || 'Erro ao enviar email de recuperação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row overflow-hidden">
      {/* Left Side: Brand & Hero */}
      <div className="hidden md:flex md:w-[60%] bg-bg relative p-16 flex-col justify-between border-r border-border-dim">
        <div className="relative z-10">
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => setIsLogin(true)}
            className="flex items-center gap-2 mb-12 hover:opacity-80 transition-opacity active:scale-95 group focus:outline-none"
          >
            <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-lg border border-border-dim group-hover:scale-105 transition-transform">
              <img src="/logo.png?v=1.3" alt="Trackify Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-text-main font-display lowercase">trackify.</h1>
          </motion.button>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="max-w-2xl">
            <h2 className="text-[140px] font-bold text-text-main tracking-[-0.04em] leading-[0.8] mb-12 font-display uppercase">
              DOMINA <br />
              CUSTOS <br />
              <span className="text-accent italic font-serif lowercase tracking-tight">recorrentes.</span>
            </h2>
            <p className="text-xl text-text-muted font-medium leading-relaxed mb-16 max-w-lg">
              Centraliza os teus gastos, elimina o ruído e descobre onde podes poupar dinheiro todos os meses.
            </p>
            <div className="grid grid-cols-2 gap-8">
              <div className="group">
                <p className="micro-label mb-3">01 / Inteligência</p>
                <h4 className="text-lg font-bold text-text-main mb-2">Alertas Preditivos</h4>
                <p className="text-sm text-text-muted leading-relaxed font-medium">Sabe exatamente quando e quanto vais pagar antes de acontecer.</p>
              </div>
              <div className="group">
                <p className="micro-label mb-3">02 / Estratégia</p>
                <h4 className="text-lg font-bold text-text-main mb-2">Poupança Ativa</h4>
                <p className="text-sm text-text-muted leading-relaxed font-medium">Identifica serviços redundantes e otimiza o teu orçamento.</p>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="absolute top-[20%] right-[-10%] w-[500px] h-[500px] bg-accent/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[10%] w-[400px] h-[400px] bg-accent/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 flex items-center gap-4">
          <div className="flex -space-x-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="w-10 h-10 rounded-full border-2 border-bg bg-card flex items-center justify-center shadow-lg">
                <img referrerPolicy="no-referrer" src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 10}`} alt="User avatar" />
              </div>
            ))}
          </div>
          <p className="text-xs font-bold text-text-muted uppercase tracking-widest">+1.200 utilizadores otimizaram os seus custos hoje.</p>
        </div>
      </div>

      {/* Right Side: Auth Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative">
        <button
          onClick={() => setIsLogin(true)}
          className="md:hidden mb-12 flex flex-col items-center hover:opacity-80 transition-opacity active:scale-95 group focus:outline-none"
        >
          <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg shadow-accent/20 mb-4 border border-border-dim group-hover:scale-105 transition-transform">
            <img src="/logo.png?v=1.3" alt="Trackify Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <h1 className="text-3xl font-bold tracking-tighter text-text-main font-display lowercase">trackify.</h1>
        </button>

        <motion.div layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-sm bg-card p-10 rounded-[3rem] shadow-2xl border border-border-dim relative z-10">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-text-main tracking-tight mb-2">Bem-vindo.</h2>
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-[0.2em]">O teu dashboard financeiro aguarda-te</p>
          </div>

          <div className="flex mb-8 bg-bg p-1.5 rounded-2xl border border-border-dim">
            <button onClick={() => setIsLogin(true)} className={cn("flex-1 py-3 text-[10px] uppercase tracking-widest font-bold rounded-xl transition-all", isLogin ? "bg-accent text-white shadow-lg" : "text-text-muted hover:text-text-main")}>
              Entrar
            </button>
            <button onClick={() => setIsLogin(false)} className={cn("flex-1 py-3 text-[10px] uppercase tracking-widest font-bold rounded-xl transition-all", !isLogin ? "bg-accent text-white shadow-lg" : "text-text-muted hover:text-text-main")}>
              Registar
            </button>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2.5 ml-1">Email</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted/50 group-focus-within:text-accent transition-colors" size={18} />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-12 pr-6 py-4 bg-bg border border-border-dim rounded-2xl text-sm font-bold text-text-main focus:ring-2 focus:ring-accent outline-none transition-all placeholder:text-text-muted/20" placeholder="exemplo@visto.pt" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2.5 ml-1">Palavra-passe</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full px-6 py-4 bg-bg border border-border-dim rounded-2xl text-sm font-bold text-text-main focus:ring-2 focus:ring-accent outline-none transition-all placeholder:text-text-muted/20" placeholder="••••••••" />
              {isLogin && (
                <div className="flex justify-end mt-3">
                  <button type="button" onClick={handleResetPassword} disabled={loading} className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline disabled:opacity-50">
                    Recuperar acesso
                  </button>
                </div>
              )}
            </div>

            <AnimatePresence>
              {(error || success) && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className={cn("p-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-3 border", error ? "bg-red-500/5 text-red-500 border-red-500/10" : "bg-green-500/5 text-green-500 border-green-500/10")}>
                  {error ? <AlertCircle size={16} /> : <Mail size={16} />}
                  <span>{error || success}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button type="submit" disabled={loading} className="w-full py-5 bg-accent text-white rounded-[2rem] text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-accent/90 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl shadow-accent/20 active:scale-[0.98]">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>{isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}{isLogin ? 'Entrar Agora' : 'Criar Perfil'}</>}
            </button>
          </form>

          <div className="relative my-10">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border-dim" /></div>
            <div className="relative flex justify-center text-[9px] items-center uppercase tracking-[0.3em]">
              <span className="bg-card px-4 text-text-muted font-bold">Em alternativa</span>
            </div>
          </div>

          <button onClick={handleGoogleAuth} disabled={loading} className="w-full py-5 bg-bg border border-border-dim text-text-main rounded-2xl text-[11px] font-bold uppercase tracking-[0.2em] hover:border-accent transition-all flex items-center justify-center gap-3 group">
            <Chrome size={18} className="text-red-500 group-hover:scale-110 transition-transform" />
            Entrar com Google
          </button>
        </motion.div>

        <p className="mt-12 text-center text-[9px] text-text-muted font-bold uppercase tracking-[0.2em] px-10 leading-relaxed max-w-xs opacity-50">
          Privacidade primeiro. Os teus dados de subscrição são encriptados e nunca partilhados.
        </p>
      </div>
    </div>
  );
}
