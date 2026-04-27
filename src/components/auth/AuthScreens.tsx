import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../../lib/firebase';
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
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError("Por favor, introduza o seu email primeiro.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess("Email de recuperação enviado! Verifique a sua caixa de entrada.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold tracking-tighter text-accent mb-2">TRACKIFY</h1>
          <p className="text-sm text-text-muted uppercase tracking-widest font-semibold">Manage your subscriptions seamlessly</p>
        </div>

        <motion.div 
          layout
          className="bg-card p-8 rounded-3xl shadow-2xl border border-border-dim"
        >
          <div className="flex mb-8 bg-bg p-1 rounded-2xl border border-border-dim">
            <button
              onClick={() => setIsLogin(true)}
              className={cn(
                "flex-1 py-3 text-sm font-bold rounded-xl transition-all",
                isLogin ? "bg-accent text-white shadow-lg" : "text-text-muted hover:text-text-main"
              )}
            >
              Entrar
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={cn(
                "flex-1 py-3 text-sm font-bold rounded-xl transition-all",
                !isLogin ? "bg-accent text-white shadow-lg" : "text-text-muted hover:text-text-main"
              )}
            >
              Registar
            </button>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 ml-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-bg border border-border-dim rounded-2xl text-sm text-text-main focus:ring-2 focus:ring-accent outline-none transition-all placeholder:text-text-muted/30"
                placeholder="exemplo@email.com"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 ml-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-bg border border-border-dim rounded-2xl text-sm text-text-main focus:ring-2 focus:ring-accent outline-none transition-all placeholder:text-text-muted/30"
                placeholder="••••••••"
              />
              {isLogin && (
                <div className="flex justify-end mt-2">
                  <button
                    type="button"
                    onClick={handleResetPassword}
                    disabled={loading}
                    className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline disabled:opacity-50"
                  >
                    Esqueci-me da password
                  </button>
                </div>
              )}
            </div>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-red-500/10 text-red-500 p-3 rounded-xl text-xs flex items-center gap-2 border border-red-500/20"
                >
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </motion.div>
              )}
              {success && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-green-500/10 text-green-500 p-3 rounded-xl text-xs flex items-center gap-2 border border-green-500/20"
                >
                  <Mail size={14} />
                  <span>{success}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-accent text-white rounded-2xl text-sm font-bold hover:bg-accent/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-accent/20"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
                  {isLogin ? 'Entrar na Conta' : 'Criar Conta'}
                </>
              )}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-dim"></div>
            </div>
            <div className="relative flex justify-center text-[10px] items-center uppercase tracking-[0.2em]">
              <span className="bg-card px-4 text-text-muted font-bold">ou continuar com</span>
            </div>
          </div>

          <button
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full py-4 border border-border-dim text-text-main rounded-2xl text-sm font-bold hover:bg-bg transition-all flex items-center justify-center gap-2"
          >
            <Chrome size={18} className="text-red-500" />
            Google
          </button>
        </motion.div>
        
        <p className="mt-8 text-center text-[10px] text-text-muted font-bold uppercase tracking-widest px-8 leading-relaxed">
          Ao continuar, aceitas os nossos Termos de Serviço e Política de Privacidade.
        </p>
      </div>
    </div>
  );
}
