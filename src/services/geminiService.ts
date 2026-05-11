import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { createSubscription, getUserSubscriptions } from "./subscriptionService";
import { Subscription } from "../types";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

export interface AIInsight {
  type: 'warning' | 'info' | 'suggestion';
  title: string;
  description: string;
  icon: string;
  score?: number;
}

const addSubscriptionTool: FunctionDeclaration = {
  name: "addSubscription",
  description: "Adiciona uma nova subscrição para o utilizador.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: {
        type: Type.STRING,
        description: "O nome do serviço da subscrição (ex: Netflix, Spotify).",
      },
      amount: {
        type: Type.NUMBER,
        description: "O valor da subscrição.",
      },
      currency: {
        type: Type.STRING,
        description: "A moeda (ex: EUR, USD).",
      },
      billingCycle: {
        type: Type.STRING,
        description: "O ciclo de faturação ('mensal', 'anual').",
      },
      category: {
        type: Type.STRING,
        description: "A categoria da subscrição (ex: Streaming, Software).",
      },
      billingDay: {
        type: Type.NUMBER,
        description: "O dia do mês em que a subscrição é cobrada.",
      },
      billingMonth: {
        type: Type.NUMBER,
        description: "O mês em que a subscrição anual é cobrada (1-12). Apenas necessário para subscrições anuais.",
      },
    },
    required: ["name", "amount", "currency", "billingCycle", "category", "billingDay"],
  },
};

const listSubscriptionsTool: FunctionDeclaration = {
  name: "listSubscriptions",
  description: "Lista as subscrições atuais do utilizador para contexto.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

export const getGeminiResponse = async (
  message: string, 
  history: { role: 'user' | 'model', parts: [{ text: string }] }[],
  userId: string
) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...history,
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: `És o Trackify AI, um assistente financeiro inteligente e amigável.
O teu objetivo é ajudar os utilizadores a gerir as suas subscrições e finanças.
Dá conselhos práticos, explica termos financeiros de forma simples e ajuda a identificar onde podem poupar.

Podes adicionar subscrições para o utilizador se ele pedir. Quando o fizeres, certifica-te de extrair:
- Nome do serviço
- Valor (apenas o número)
- Moeda (EUR, USD, etc)
- Ciclo (mensal ou anual)
- Categoria (ex: Saúde, Streaming, Lazer, etc)
- Dia da cobrança

Podes também listar as subscrições atuais do utilizador para dar conselhos mais precisos.
Mantém as tuas respostas curtas, profissionais e úteis. Usa português de Portugal (PT-PT).`,
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        tools: [{ functionDeclarations: [addSubscriptionTool, listSubscriptionsTool] }],
      },
    });

    const functionCalls = response.functionCalls;
    if (functionCalls && functionCalls.length > 0) {
      for (const call of functionCalls) {
        if (call.name === "addSubscription") {
          const args = call.args as any;
          console.log("Gemini calling addSubscription with args:", args);
          
          // Ensure types are correct for Firestore rules
          const amount = typeof args.amount === 'string' ? parseFloat(args.amount.replace(',', '.')) : Number(args.amount);
          const billingDay = Math.floor(typeof args.billingDay === 'string' ? parseInt(args.billingDay) : Number(args.billingDay)) || 1;
          const billingMonth = args.billingMonth ? Math.floor(Number(args.billingMonth)) : undefined;

          await createSubscription({
            userId,
            name: String(args.name),
            amount: isNaN(amount) ? 0 : amount,
            currency: String(args.currency || 'EUR').substring(0, 3).toUpperCase(),
            billingCycle: (args.billingCycle === 'anual' || args.billingCycle === 'yearly' || args.billingCycle === 'annual') ? 'yearly' : 'monthly',
            category: String(args.category || 'Outros'),
            billingDay: billingDay,
            billingMonth: (args.billingCycle === 'anual' || args.billingCycle === 'yearly' || args.billingCycle === 'annual') ? (billingMonth || (new Date().getMonth() + 1)) : null,
            status: 'active',
            startDate: new Date().toISOString().split('T')[0]
          });

          return `Acabei de adicionar a tua subscrição ao **${args.name}** de **${amount} ${args.currency || 'EUR'}**. Já podes vê-la na tua lista!`;
        }

        if (call.name === "listSubscriptions") {
          const subs = await getUserSubscriptions(userId);
          const subNames = subs.map(s => `${s.name} (${s.amount}${s.currency})`).join(', ');
          
          // Re-generate content with context
          const followUpResponse = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [
              ...history,
              { role: 'user', parts: [{ text: message }] },
              { role: 'model', parts: [{ text: `O utilizador tem as seguintes subscrições: ${subNames || 'nenhuma'}.` }] }
            ],
            config: {
              systemInstruction: `És o Trackify AI, um assistente financeiro inteligente e amigável.
O teu objetivo é ajudar os utilizadores a gerir as suas subscrições e finanças.
Dá conselhos práticos, explica termos financeiros de forma simples e ajuda a identificar onde podem poupar.
Podes adicionar subscrições para o utilizador se ele pedir.
Podes também listar as subscrições atuais do utilizador para dar conselhos mais precisos.
Mantém as tuas respostas curtas, profissionais e úteis. Usa português de Portugal (PT-PT).

IMPORTANTE: Formata as tuas respostas usando Markdown para melhor legibilidade:
- Usa listas com marcadores para múltiplos itens ou dicas.
- Usa negrito para destacar valores, nomes de serviços ou termos importantes.
- Usa parágrafos curtos e espaçados.`,
              tools: [{ functionDeclarations: [addSubscriptionTool, listSubscriptionsTool] }],
            },
          });
          return followUpResponse.text;
        }
      }
    }

    return response.text;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    // Check for billing/spend cap exceeded error
    const errorString = JSON.stringify(error);
    if (errorString.includes("exceeded its monthly spending cap") || errorString.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("O limite de gastos mensal da API Gemini foi atingido. Por favor, verifica o teu limite em AI Studio (https://ai.studio/spend).");
    }
    
    throw error;
  }
};

export async function generateAIInsights(subscriptions: Subscription[], monthlyBudget?: number): Promise<AIInsight[]> {
  if (subscriptions.length === 0) return [];

  const subscriptionSummary = subscriptions.map(s => ({
    name: s.name,
    amount: s.amount,
    currency: s.currency || 'EUR',
    billingCycle: s.billingCycle,
    category: s.category,
    status: s.status
  }));

  const prompt = `
    Analisa as subscrições do utilizador e gera 3 insights estratégicos únicos em Português de Portugal (PT-PT).
    As subscrições são: ${JSON.stringify(subscriptionSummary)}
    O orçamento mensal é: ${monthlyBudget || 'não definido'}
    
    Observa:
    1. Duplicação ou redundância de serviços.
    2. Oportunidades de poupança ao mudar para planos anuais.
    3. Alertas de gastos desproporcionais por categoria.
    4. Sugestões de otimização de orçamento.

    Retorna um array de objetos JSON que respeite o seguinte esquema:
    - title: Título curto (max 25 caracteres)
    - description: Dica prática (max 100 caracteres)
    - type: 'warning', 'info', ou 'suggestion'
    - icon: Emote/Emoji relevante
    - score: 0-100 (importância)

    O tom deve ser profissional e focado em poupança.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              type: { type: Type.STRING, enum: ['warning', 'info', 'suggestion'] },
              icon: { type: Type.STRING },
              score: { type: Type.NUMBER }
            },
            required: ['title', 'description', 'type', 'icon']
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Erro ao gerar insights com AI:", error);
    
    // Check for billing/spend cap exceeded error
    const errorString = JSON.stringify(error);
    if (errorString.includes("exceeded its monthly spending cap") || errorString.includes("RESOURCE_EXHAUSTED")) {
      return [{
        title: "Limite de IA Atingido",
        description: "O teu plano do Gemini atingiu o limite de gastos. Verifica as tuas definições no AI Studio.",
        type: "warning",
        icon: "⚠️",
        score: 100
      }];
    }
    
    return [];
  }
}
