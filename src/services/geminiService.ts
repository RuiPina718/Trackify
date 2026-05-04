import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { createSubscription, getUserSubscriptions } from "./subscriptionService";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

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
Podes adicionar subscrições para o utilizador se ele pedir.
Podes também listar as subscrições atuais do utilizador para dar conselhos mais precisos.
Mantém as tuas respostas curtas, profissionais e úteis. Use português de Portugal (PT-PT).`,
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
          
          await createSubscription({
            userId,
            name: args.name,
            amount: args.amount,
            currency: args.currency || 'EUR',
            billingCycle: (args.billingCycle === 'anual' || args.billingCycle === 'yearly') ? 'yearly' : 'monthly',
            category: args.category || 'Outros',
            billingDay: args.billingDay || 1,
            billingMonth: (args.billingCycle === 'anual' || args.billingCycle === 'yearly') ? (args.billingMonth || (new Date().getMonth() + 1)) : undefined,
            status: 'active',
            startDate: new Date().toISOString().split('T')[0]
          });

          return `Acabei de adicionar a tua subscrição ao ${args.name} de ${args.amount}${args.currency}. Já podes vê-la na tua lista!`;
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
Mantém as tuas respostas curtas, profissionais e úteis. Use português de Portugal (PT-PT).`,
              tools: [{ functionDeclarations: [addSubscriptionTool, listSubscriptionsTool] }],
            },
          });
          return followUpResponse.text;
        }
      }
    }

    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
