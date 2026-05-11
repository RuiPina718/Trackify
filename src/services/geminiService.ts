import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { createSubscription, getUserSubscriptions } from "./subscriptionService";
import { Subscription } from "../types";

const ai = null; // Removido do cliente para segurança

export interface AIInsight {
  type: 'warning' | 'info' | 'suggestion';
  title: string;
  description: string;
  icon: string;
  score?: number;
}

export const getGeminiResponse = async (
  message: string, 
  history: { role: 'user' | 'model', parts: [{ text: string }] }[],
  userId: string
) => {
  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history, userId })
    });

    if (!response.ok) throw new Error('AI Server Error');
    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error("Gemini API Proxy Error:", error);
    return "Desculpa, estou com dificuldades técnicas de momento. Tenta novamente mais tarde.";
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

  try {
    const response = await fetch('/api/ai/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptions: subscriptionSummary, monthlyBudget })
    });

    if (!response.ok) throw new Error('AI Server Error');
    return await response.json();
  } catch (error) {
    console.error("Erro ao gerar insights com AI (Proxy):", error);
    return [];
  }
}
