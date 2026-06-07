import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { SYSTEM_PROMPT } from "./storeKnowledge";

export interface ChatTurn {
  sender: "user" | "ai";
  text: string;
}

/**
 * Thrown for any failure talking to the LLM (bad key, timeout, rate limit, etc).
 * Routes catch this and turn it into a clean, user-facing error message —
 * callers never see raw SDK errors.
 */
export class LlmServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "LlmServiceError";
  }
}

const MAX_HISTORY_TURNS = 12; // ~6 user/ai exchanges — keeps prompts small & cheap
const MAX_REPLY_TOKENS = 800;
const REQUEST_TIMEOUT_MS = 20_000;

let client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new LlmServiceError(
      "The AI agent isn't configured yet (missing GEMINI_API_KEY). Please contact support."
    );
  }
  if (!client) {
    client = new GoogleGenerativeAI(apiKey);
  }
  return client;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new LlmServiceError("The AI agent took too long to respond. Please try again.")), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

/**
 * Generates the agent's reply to `userMessage`, given prior conversation `history`.
 * Wraps the LLM provider so swapping providers (or adding tools/RAG later) only
 * touches this file — routes and persistence stay provider-agnostic.
 */
export async function generateReply(history: ChatTurn[], userMessage: string): Promise<string> {
  const recentHistory = history.slice(-MAX_HISTORY_TURNS);

  // Gemini requires the chat history to start with a "user" turn.
  const firstUserIndex = recentHistory.findIndex((turn) => turn.sender === "user");
  const trimmedHistory = firstUserIndex === -1 ? [] : recentHistory.slice(firstUserIndex);

  const contents: Content[] = trimmedHistory.map((turn) => ({
    role: turn.sender === "user" ? "user" : "model",
    parts: [{ text: turn.text }],
  }));

  try {
    // Gemini 2.5 models "think" before answering, and that thinking eats into the
    // output token budget — for short FAQ-style replies it can consume the entire
    // budget and leave the actual answer truncated/empty. We don't need chain-of-
    // thought for support answers, so disable it for fast, complete replies.
    // (thinkingConfig isn't in this SDK version's GenerationConfig type yet, hence the cast.)
    const generationConfig = {
      maxOutputTokens: MAX_REPLY_TOKENS,
      thinkingConfig: { thinkingBudget: 0 },
    } as Record<string, unknown>;

    const model = getClient().getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
      generationConfig,
    });

    const chat = model.startChat({ history: contents });
    const result = await withTimeout(chat.sendMessage(userMessage), REQUEST_TIMEOUT_MS);

    const text = result.response.text()?.trim();
    if (!text) {
      throw new LlmServiceError("The AI agent returned an empty response. Please try again.");
    }
    return text;
  } catch (err) {
    if (err instanceof LlmServiceError) throw err;
    throw new LlmServiceError(describeGeminiError(err), err);
  }
}

function describeGeminiError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number })?.status;

  if (status === 401 || status === 403 || /API key not valid|API_KEY_INVALID/i.test(message)) {
    return "The AI agent is misconfigured (invalid API key). Please contact support.";
  }
  if (status === 429 || /rate limit|quota/i.test(message)) {
    return "Our AI agent is a little busy right now — please try again in a moment.";
  }
  if ((status && status >= 500) || /internal|unavailable/i.test(message)) {
    return "Our AI agent's provider is having issues right now. Please try again shortly.";
  }
  return "Something went wrong while talking to the AI agent. Please try again shortly.";
}
