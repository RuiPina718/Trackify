# 💳 Trackify

O **Trackify** é uma solução premium para a gestão inteligente de subscrições e gastos recorrentes. Construído com uma arquitetura moderna e focado na experiência do utilizador, a plataforma transforma a forma como interage com as suas finanças digitais, oferecendo clareza, previsibilidade e poupança real.

![Preview](https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=1200)

## 🚀 Funcionalidades Principais

### 📊 Análise Preditiva e Inteligente
- **Projeção a 12 Meses**: Visualize o custo total das suas subscrições ao longo do próximo ano.
- **Otimização Pró**: A nossa IA identifica quanto pode poupar ao converter planos mensais para anuais.
- **Insights de IA**: Detecção automática de duplicados e fadiga de subscrições por categoria.
- **Health Score**: Um indicador visual da sua saúde financeira com base no volume de encargos recorrentes.

### 📅 Calendário Interativo
- Grelha mensal com marcação automática de datas de pagamento.
- **Painel de Resumo Diário**: Clique em qualquer dia para ver instantaneamente a lista de débitos e o total acumulado para essa data.

### 🔔 Gestão de Alertas
- Central de notificações (Sino) no cabeçalho para acesso rápido.
- Lembretes inteligentes de pagamentos próximos para evitar cobranças inesperadas.

### 👤 Personalização Total
- **Avatar Flexível**: Upload direto de fotos (com suporte a Drag & Drop) ou geração dinâmica via IA.
- **Categorias Custom**: Crie as suas próprias categorias com ícones e cores personalizadas.

### 🛡️ Painel Administrativo
- Controlo total sobre utilizadores e níveis de acesso (Admin/Premium).
- Segurança reforçada com validações de confirmação para alterações críticas.

## 🛠️ Stack Tecnológica

- **Frontend**: [React 18](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Estilização**: [Tailwind CSS](https://tailwindcss.com/)
- **Animações**: [Motion (Framer Motion)](https://www.framer.com/motion/)
- **Backend / Database**: [Firebase Firestore](https://firebase.google.com/docs/firestore)
- **Autenticação**: [Firebase Auth](https://firebase.google.com/docs/auth)
- **IA**: [Gemini API](https://ai.google.dev/)
- **Icons**: [Lucide React](https://lucide.dev/)

## 📦 Estrutura do Projeto

```text
src/
├── components/          # Componentes modulares (Layout, Dashboard, Analytics, etc.)
├── services/            # Integração com Firebase e APIs externas
├── hooks/               # Lógica reutilizável e estados complexos
├── lib/                 # Utilitários e configurações (Firebase, Tailwind)
├── types/               # Definições de tipos TypeScript
└── constants/           # Configurações globais e dados estáticos
```

## 🏁 Como Começar

1. **Instalar Dependências**:
   ```bash
   npm install
   ```

2. **Configuração de Ambiente**:
   Crie um ficheiro `.env` baseado no `.env.example` com as suas credenciais do Firebase e Gemini API.

3. **Iniciar em Desenvolvimento**:
   ```bash
   npm run dev
   ```

4. **Build para Produção**:
   ```bash
   npm run build
   ```

## 📄 Documentação Adicional

Para detalhes mais profundos sobre a visão do produto e a sua evolução técnica, consulte:
- [Documento de Requisitos do Produto (PRD)](/PRD.md)
- [Guia de Evolução Técnica](/EVOLUTION_GUIDE.md)

---
Desenvolvido com foco em transparência financeira e design moderno.
