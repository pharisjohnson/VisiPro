"use node";
import { v } from "convex/values";
import { GoogleGenAI } from "@google/genai";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * The Gemini key stays in the Convex environment (GEMINI_API_KEY) and never
 * reaches the browser. Context is assembled server-side from the caller's own
 * org (aiContext is admin-only and org-pinned), not supplied by the client.
 */
export const ask = action({
  args: { question: v.string(), dayStart: v.number(), dayEnd: v.number() },
  handler: async (ctx, args): Promise<string> => {
    const question = args.question.trim().slice(0, 1000);
    if (!question) return "Please ask a question.";
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return "The AI assistant isn't configured yet. Ask your administrator to set GEMINI_API_KEY.";

    // Throws if the caller isn't a signed-in admin of an organization.
    const data = await ctx.runQuery(api.aiContext.get, {
      dayStart: args.dayStart,
      dayEnd: args.dayEnd,
    });

    const prompt = `You are an assistant for a visitor management system. Answer using only the data below.
Current time: ${new Date().toISOString()}

VISITORS CURRENTLY ON PREMISES:
${data.onPremise.map((x) => `- ${x.name}${x.company ? ` from ${x.company}` : ""}, visiting ${x.hostName}. Purpose: ${x.purpose}. Arrived: ${new Date(x.checkInTime).toISOString()}`).join("\n") || "None"}

TODAY'S APPOINTMENTS:
${data.appointments.map((x) => `- ${x.visitorName}${x.visitorCompany ? ` from ${x.visitorCompany}` : ""}, visiting ${x.hostName} at ${new Date(x.scheduledTime).toISOString()} (${x.status})`).join("\n") || "None"}

QUESTION: ${question}`;

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      return response.text ?? "No response.";
    } catch (error) {
      console.error("Gemini request failed", error);
      return "Sorry, the assistant ran into an error. Please try again.";
    }
  },
});
