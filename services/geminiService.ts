import { GoogleGenAI, Type } from "@google/genai";
import { AIGeneratedRule } from "../types";

const API_KEY = process.env.API_KEY || '';

/**
 * Generates a regex rule based on a log snippet and user description using Gemini.
 */
export const generateRuleFromLog = async (
  logSnippet: string,
  userDescription: string
): Promise<AIGeneratedRule> => {
  if (!API_KEY) {
    console.error("API_KEY is missing");
    throw new Error("API Key is missing via process.env.API_KEY");
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const prompt = `
    You are a Unity Build Log Expert and Regex Specialist.
    
    Task: Create a generic regular expression to catch specific Unity build errors based on the provided log snippet and user explanation.
    
    User Explanation: "${userDescription}"
    Log Snippet:
    ---
    ${logSnippet}
    ---
    
    Requirements:
    1. The Regex must be JavaScript compatible (RegExp). 
    2. **STRICT**: Do NOT use Python specific named groups like '(?P<name>...)'. Use standard groups '(...)' or JavaScript named groups '(?<name>...)'.
    3. **CRITICAL**: The analysis runs line-by-line by default. If the error spans multiple lines (contains \\n), the regex must handle it, but prefer matching the unique header line if possible.
    4. Extract relevant keywords that can be used for pre-filtering (e.g., "CS0001", "Shader", "Exception").
    5. Provide a brief explanation of what the regex does in **Simplified Chinese (简体中文)**.
    
    Return the response in JSON format.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            regex: { type: Type.STRING, description: "The JavaScript compatible regex string." },
            keywords: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "List of high-frequency keywords found in the error."
            },
            explanation: { type: Type.STRING, description: "Short explanation of the rule in Chinese." }
          },
          required: ["regex", "keywords", "explanation"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as AIGeneratedRule;
    }
    
    throw new Error("Empty response from AI model");

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};