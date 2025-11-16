
import { GoogleGenAI } from "@google/genai";
import type { Visitor, Appointment } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getAIAssistance(
  userInput: string,
  visitors: Visitor[],
  appointments: Appointment[]
): Promise<string> {
  try {
    const context = `
      You are an AI assistant for a visitor management system.
      Current Date/Time: ${new Date().toLocaleString()}
      
      CURRENT VISITORS ON-PREMISE:
      ${visitors
        .filter(v => v.status === 'Checked In')
        .map(v => `- ${v.name} from ${v.company}, visiting ${v.host}. Purpose: ${v.purpose}. Arrived at: ${v.checkInTime.toLocaleTimeString()}`)
        .join('\n') || 'None'}
      
      TODAY'S APPOINTMENTS:
      ${appointments
        .filter(a => new Date(a.scheduledTime).toDateString() === new Date().toDateString())
        .map(a => `- ${a.visitorName} from ${a.visitorCompany}, visiting ${a.host} at ${new Date(a.scheduledTime).toLocaleTimeString()}`)
        .join('\n') || 'None'}
    `;

    const fullPrompt = `${context}\n\nUSER QUERY: "${userInput}"\n\nASSISTANT RESPONSE:`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
    });
    
    return response.text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return "Sorry, I encountered an error while processing your request. Please check the console for details.";
  }
}
