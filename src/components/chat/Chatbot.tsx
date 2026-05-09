import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Bot, User, Loader2, Minimize2, Maximize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../../lib/utils';
import { getGeminiResponse } from '../../services/geminiService';

interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

interface ChatbotProps {
  userId: string;
}

export default function Chatbot({ userId }: ChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: 'Olá! Sou o assistente do Trackify. Como posso ajudar-te com as tuas subscrições hoje?',
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const newUserMsg: Message = {
      role: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newUserMsg]);
    setIsLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const response = await getGeminiResponse(text.trim(), history as any, userId);
      
      if (response) {
        setMessages(prev => [...prev, {
          role: 'model',
          text: response,
          timestamp: new Date(),
        }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'model',
        text: 'Desculpa, ocorreu um erro ao processar a tua mensagem. Tenta novamente.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput('');
    handleSendMessage(userMessage);
  };

  const QUICK_ACTIONS = [
    { text: 'Quanto gastei este mês?', label: '💸 Gastos' },
    { text: 'Como posso poupar mais?', label: '💡 Dicas' },
    { text: 'Listar subscrições anuais', label: '📅 Anuais' },
  ];

  return (
    <div className="fixed bottom-8 right-8 z-[100] flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95, transformOrigin: 'bottom right' }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              height: isMinimized ? '80px' : '600px'
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={cn(
              "mb-4 w-[400px] bg-card border border-border-dim rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden transition-all duration-300",
              isMinimized ? "h-20" : "h-[600px]"
            )}
          >
            {/* Header */}
            <div className="p-6 border-b border-border-dim flex items-center justify-between bg-bg/50 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-accent rounded-2xl flex items-center justify-center text-white shadow-lg shadow-accent/20">
                  <Bot size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-text-main tracking-tight">Assistente Trackify</h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-1.5 h-1.5 bg-health rounded-full animate-pulse" />
                    <span className="text-[10px] font-black text-health uppercase tracking-widest">Online</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-2 text-text-muted hover:text-accent transition-colors"
                >
                  {isMinimized ? <Maximize2 size={18} /> : <Minimize2 size={18} />}
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-text-muted hover:text-red-500 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Messages */}
                <div 
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-bg/20"
                >
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className={cn(
                        "flex gap-3 max-w-[85%]",
                        msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-xs font-black border",
                        msg.role === 'user' 
                          ? "bg-bg border-border-dim text-text-main" 
                          : "bg-accent/10 border-accent/20 text-accent"
                      )}>
                        {msg.role === 'user' ? 'TU' : <Bot size={16} />}
                      </div>
                      <div className={cn(
                        "p-4 rounded-[1.5rem] text-xs font-bold leading-relaxed shadow-sm prose prose-invert prose-p:my-0 prose-ul:my-2 prose-li:my-0.5",
                        msg.role === 'user'
                          ? "bg-accent text-white rounded-tr-none"
                          : "bg-card border border-border-dim text-text-main rounded-tl-none"
                      )}>
                        {msg.role === 'model' ? (
                          <div className="markdown-content">
                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                          </div>
                        ) : (
                          msg.text
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {isLoading && (
                    <div className="flex gap-3 max-w-[80%]">
                      <div className="w-8 h-8 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                        <Bot size={16} />
                      </div>
                      <div className="bg-card border border-border-dim p-4 rounded-[1.5rem] rounded-tl-none shadow-sm">
                        <Loader2 size={16} className="animate-spin text-accent" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                {!isLoading && (
                  <div className="px-6 py-3 bg-bg/50 border-t border-border-dim flex gap-2 overflow-x-auto no-scrollbar">
                    {QUICK_ACTIONS.map((action, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(action.text)}
                        className="whitespace-nowrap px-4 py-2 bg-card border border-border-dim rounded-xl text-[10px] font-black uppercase tracking-widest text-text-muted hover:border-accent hover:text-accent transition-all active:scale-95 shadow-sm"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Input */}
                <form 
                  onSubmit={handleSend}
                  className="p-6 bg-card border-t border-border-dim"
                >
                  <div className="relative group">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Escreve a tua mensagem..."
                      className="w-full bg-bg border border-border-dim rounded-2xl pl-6 pr-14 py-4 text-xs font-bold text-text-main focus:ring-2 focus:ring-accent outline-none transition-all placeholder:text-text-muted/30 group-focus-within:border-accent"
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || isLoading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-accent text-white rounded-xl flex items-center justify-center hover:bg-accent/90 disabled:opacity-50 transition-all shadow-lg shadow-accent/20 active:scale-95"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </form>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-16 h-16 rounded-[2rem] flex items-center justify-center shadow-2xl transition-all relative overflow-hidden group",
          isOpen ? "bg-card border border-border-dim text-accent" : "bg-accent text-white"
        )}
      >
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        {isOpen ? <X size={28} /> : <MessageSquare size={28} />}
        {!isOpen && (
          <div className="absolute top-4 right-4 w-3 h-3 bg-health rounded-full border-2 border-accent animate-bounce" />
        )}
      </motion.button>
    </div>
  );
}
