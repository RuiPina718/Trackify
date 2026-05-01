import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

export const getGeminiResponse = async (message: string, history: { role: 'user' | 'model', parts: [{ text: string }] }[]) => {
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
Mantém as tuas respostas curtas, profissionais e úteis. Use português de Portugal (PT-PT).`,
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
      },
    });

    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
