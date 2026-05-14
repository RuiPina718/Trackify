# Guia de Evolução: PRD Inicial vs. Versão Atual

Este guia detalha a transformação do **Trackify** desde a sua conceção inicial até à versão atual, destacando os principais upgrades de funcionalidade e experiência de utilizador (UX).

| Área | Conceito Inicial (v1) | Versão Atual (Upgraded) | Impacto / Melhoria |
| :--- | :--- | :--- | :--- |
| **Alertas de Pagamento** | Banner estático na página inicial indicando "Pagamentos em Breve". | Sistema de Notificações dinâmico no cabeçalho (Sino) com contagem em tempo real. | Redução de ruído visual no dashboard e acesso global em qualquer página. |
| **Análise Financeira** | Gráficos simples de histórico e distribuição por categoria. | **Análise Preditiva**: Inclui projeção a 12 meses, "Otimização Pró" e Calculadora de Poupança. | Transforma a app de um simples rastreador num conselheiro financeiro ativo. |
| **Calendário** | Visualização de ícones nos dias de pagamento; clique abria detalhes individuais. | **Calendário Interativo**: Seleção de dia exibe resumo completo e total do dia abaixo da grelha. | Melhora significativamente a rapidez na consulta de dias com múltiplos pagamentos. |
| **IA & Insights** | Chatbot básico para conversação genérica. | **IA Integrada**: Análise de densidade de categorias e alertas de fadiga de subscrições. | Utilização real da IA para detetar desperdícios financeiros. |
| **Personalização** | Geração de avatares apenas via IA (DiceBear). | **Gestão de Média Híbrida**: Upload manual de imagens, funcionalidade drag-and-drop e remoção. | Dá total autonomia ao utilizador sobre a sua identidade digital. |
| **Acessos & Admin** | Botões de toggle direto para Admin/Premium na lista de utilizadores. | **Segurança de Acesso**: Modal de confirmação com validação de estado antes da alteração. | Previne erros acidentais em alterações críticas de permissões de utilizador. |
| **Experiência Mobile** | Layout responsivo padrão baseado em grelhas simples. | **Mobile-First Core**: Navegação inferior nativa, Drawer de definições e botões de ação simplificados. | Usabilidade profissional em smartphones, eliminando a fricção de uso em movimento. |
| **Identidade de Marca** | Nome genérico (SubManager) e ícones básicos de biblioteca. | **Trackify**: Branding completo, ícone de marca exclusivo e design system coeso. | Transmite maior confiança e profissionalismo ao utilizador final. |
| **UX & UI** | Layout fixo com visualizações isoladas. | **Bento Grid & Context Aware**: Dashboard adaptável e seleção de períodos (Mensal/Anual) em toda a análise. | Maior densidade de informação sem sacrificar a legibilidade (Clean Design). |
| **Robustez de Dados** | Gravação direta de objetos no Firestore. | **Data Cleaning**: Sanitização de dados (remoção de `undefined`) antes de persistir no DB. | Aumenta a estabilidade e previne erros de sincronização com o Firebase. |

## Resumo da Evolução
A aplicação evoluiu de um utilitário de registo passivo para uma plataforma proativa de gestão de património digital. O foco mudou de "mostrar o que tenho" para "ajudar-me a poupar e a decidir melhor".

## Checkpoint de Maturidade (Maio 2026)
Neste momento, o projeto encontra-se na fase de **Polimento e Estabilidade**:
- [x] **Core Features**: Gestão de subscrições, categorias e analytics 100% funcionais.
- [x] **Mobile Experience**: Totalmente otimizado para pequenos ecrãs com interface estilo "app nativa".
- [x] **Segurança**: Regras de Firestore apertadas e isolamento de PII.
- [x] **Escalabilidade**: Estrutura de dados preparada para múltiplos tipos de moedas e ciclos.
- [!] **Próximo Desbloqueio**: Expansão da integração Google Calendar (atualmente em modo Sandbox/Owner).
