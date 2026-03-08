// LLM integration — Gemini Flash 2.5
// TODO: Implement in Issue #5

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

export async function invokeLLM(options: LLMOptions): Promise<LLMResponse> {
  throw new Error(
    "LLM not configured. Set GEMINI_API_KEY and implement Gemini integration (Issue #5)."
  );
}
