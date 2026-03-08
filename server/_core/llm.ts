// LLM integration — Google Gemini Flash 2.5
import { ENV } from "./env";

interface LLMMessage {
  role: "system" | "user";
  content: string;
}

interface LLMOptions {
  messages: LLMMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  response_format?: {
    type: string;
    json_schema?: Record<string, unknown>;
  };
}

interface LLMResponse {
  choices: { message: { content: string } }[];
}

/**
 * Invoke Gemini Flash 2.5 via the REST API.
 * Maintains the same OpenAI-style interface used by routers.ts
 * so the caller doesn't need to change.
 */
export async function invokeLLM(options: LLMOptions): Promise<LLMResponse> {
  const apiKey = ENV.geminiApiKey;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  // Build Gemini request from OpenAI-style messages
  const systemInstruction = options.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  const userContent = options.messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n\n");

  const requestBody: Record<string, unknown> = {
    contents: [
      {
        role: "user",
        parts: [{ text: userContent }],
      },
    ],
    generationConfig: {
      temperature: options.temperature ?? 0.1,
      topP: options.top_p ?? 0.9,
      maxOutputTokens: options.max_tokens ?? 2500,
      responseMimeType: "application/json",
    },
  };

  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  // If a JSON schema is provided, pass it to Gemini for structured output
  if (options.response_format?.json_schema) {
    const schema = options.response_format.json_schema;
    const responseSchema = (schema as Record<string, unknown>).schema || schema;
    (requestBody.generationConfig as Record<string, unknown>).responseSchema = responseSchema;
  }

  const model = "gemini-2.5-flash-preview-05-20";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[LLM] Gemini API error:", response.status, errorText);
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Extract text from Gemini response and wrap in OpenAI-style format
  const text =
    data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  return {
    choices: [{ message: { content: text } }],
  };
}
