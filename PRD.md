# Documento de Requisitos do Produto (PRD) - SubManager Pro

## 1. Visão Geral
O **SubManager Pro** é uma aplicação centralizada para gestão de subscrições, focada em fornecer transparência financeira, previsibilidade de gastos e otimização de custos através de IA e análises avançadas.

## 2. Objetivos Principais
- Fornecer uma visão clara de todos os gastos recorrentes.
- Alertar o utilizador sobre pagamentos próximos.
- Identificar oportunidades de poupança (ex: passar de mensal para anual).
- Centralizar a gestão de subscrições através de uma interface moderna e intuitiva.

## 3. Funcionalidades Principais (Estado Atual)

### 3.1. Dashboard (Visão Geral)
- **Sumário Financeiro**: Exibição de custos mensais, diários e anuais.
- **Gráficos de Tendência**: Visualização da evolução dos gastos nos últimos meses.
- **Lista de Subscrições**: Gestão rápida (adicionar/editar) de serviços ativos.
- **Chatbot IA**: Assistente integrado para responder a dúvidas sobre finanças e ajudar a adicionar subscrições.

### 3.2. Análise Avançada (Analytics)
- **Projeção de 12 Meses**: Gráfico de área mostrando o custo acumulado no próximo ano.
- **Otimização Pró**: Calculadora de poupança potencial ao converter subscrições mensais para anuais.
- **Score de Saúde**: Indicador visual da "saúde" financeira baseado na quantidade de subscrições.
- **Insights de IA**: Deteção automática de categorias com alta densidade de subscrições para evitar duplicados.
- **Toggle Mensal/Anual**: Alternância completa de perspetiva em todos os gráficos e métricas.

### 3.3. Calendário Interativo
- **Vista Mensal**: Visualização de pagamentos agendados por dia.
- **Resumo Diário**: Ao clicar num dia, exibe-se um painel com o detalhe de todas as subscrições que vencem nessa data e o total acumulado do dia.

### 3.4. Sistema de Notificações
- **Central de Alertas**: Ícone de sino no cabeçalho centralizando notificações de cobrança.
- **Lembretes Antecipados**: Notificações automáticas para subscrições que vencem nos próximos "X" dias (configurável).

### 3.5. Gestão de Perfil e Definições
- **Avatar Customizado**: Opção de gerar avatares com IA (DiceBear) ou carregar fotos manuais.
- **Categorias Personalizadas**: Criação e gestão de categorias com cores e ícones específicos.
- **Configuração de Moeda**: Suporte base para EUR (ajustável).

### 3.6. Painel Admin
- **Gestão de Utilizadores**: Listagem, edição e eliminação de perfis.
- **Controlo de Acesso**: Atribuição de estatuto Admin e Premium.
- **Segurança**: Modal de confirmação obrigatório para qualquer alteração de nível de acesso.

## 4. Stack Tecnológica
- **Frontend**: React 18, Vite, Tailwind CSS.
- **Backend/DB**: Firebase Firestore, Firebase Auth.
- **IA**: Gemini API para o assistente e insights.
- **Animações**: Motion (Framer Motion).
- **Icons**: Lucide React.
