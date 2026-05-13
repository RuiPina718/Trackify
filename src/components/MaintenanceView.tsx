import React from 'react';
import { motion } from 'motion/react';
import { Hammer, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';

interface MaintenanceViewProps {
  message?: string;
  isAdmin?: boolean;
  onEnterAnyway?: () => void;
  onStaffLogin?: () => void;
}

export default function MaintenanceView({ 
  message = "Estamos a realizar algumas melhorias técnicas para te proporcionar uma melhor experiência.",
  isAdmin = false,
  onEnterAnyway,
  onStaffLogin
}: MaintenanceViewProps) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.05),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(244,63,94,0.05),transparent_40%)]">
      <div className="max-w-xl w-full text-center relative">
        {/* Animated Background Element */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-accent/10 blur-[100px] -z-10 rounded-full animate-pulse" />
        
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="relative"
        >
          <div className="flex justify-center mb-8">
            <div className="relative group">
              <div className="w-24 h-24 bg-card border border-border-dim rounded-[2rem] flex items-center justify-center text-accent shadow-2xl overflow-hidden">
                <Hammer size={40} className="animate-bounce" />
                <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-bg border border-border-dim rounded-xl flex items-center justify-center text-accent/50 shadow-sm">
                <Clock size={16} />
              </div>
            </div>
          </div>

          <h1 className="text-4xl font-black text-text-main tracking-tighter uppercase mb-4 leading-none">
            Modo de <br/>
            <span className="text-accent underline decoration-4 underline-offset-8">Manutenção</span>
          </h1>

          <div className="p-8 bg-card border border-border-dim rounded-[3rem] shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
              <Hammer size={120} />
            </div>
            
            <p className="text-sm font-bold text-text-muted leading-relaxed uppercase tracking-wider mb-8">
              {message}
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-bg rounded-2xl border border-border-dim">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-black text-text-main uppercase tracking-widest">Previsão</p>
                  <p className="text-[11px] font-bold text-text-muted uppercase">Voltamos dentro de instantes</p>
                </div>
              </div>
            </div>
          </div>

          {isAdmin && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-10 p-6 bg-accent/5 border border-accent/20 rounded-[2.5rem]"
            >
              <div className="flex items-center gap-4 mb-4">
                <ShieldCheck size={20} className="text-accent" />
                <p className="text-xs font-black text-accent uppercase tracking-widest">Acesso de Administrador</p>
              </div>
              <p className="text-[11px] text-text-muted font-bold uppercase tracking-widest leading-relaxed mb-4">
                Como és administrador, podes entrar na plataforma para testar as alterações mesmo em modo de manutenção.
              </p>
              <button 
                onClick={onEnterAnyway}
                className="w-full py-4 bg-accent text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-accent/20 hover:bg-accent/90 transition-all"
              >
                Entrar Agora
              </button>
            </motion.div>
          )}

          <p className="mt-10 text-[10px] font-black text-text-muted uppercase tracking-[0.3em] opacity-30">
            Trackify • © 2026
          </p>

          {!isAdmin && onStaffLogin && (
            <button 
              onClick={onStaffLogin}
              className="mt-6 text-[9px] font-bold text-text-muted/40 uppercase tracking-widest hover:text-accent transition-colors"
            >
              Área técnica
            </button>
          )}
        </motion.div>
      </div>
    </div>
  );
}
