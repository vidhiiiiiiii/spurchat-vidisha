import type { ChatMessage } from "./types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

export class ApiError extends Error {}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.error === "string") return body.error;
    if (typeof body?.reply === "string") return body.reply;
  } catch {
    // response wasn't JSON — fall through to the generic message
  }
  return fallback;
}

export interface SendMessageResult {
  reply: string;
  sessionId: string;
}

/** Sends a user message to the backend and returns the agent's reply + session id. */
export async function sendMessage(message: string, sessionId: string | null): Promise<SendMessageResult> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sessionId: sessionId ?? undefined }),
    });
  } catch {
    throw new ApiError("Couldn't reach the server. Please check your connection and try again.");
  }

  if (!res.ok) {
    throw new ApiError(await parseErrorMessage(res, "Something went wrong. Please try again."));
  }

  const data = await res.json();
  return { reply: data.reply as string, sessionId: data.sessionId as string };
}

export interface HistoryResult {
  sessionId: string;
  messages: ChatMessage[];
}

/** Fetches prior messages for a session so the chat can be restored after a reload. */
export async function fetchHistory(sessionId: string): Promise<HistoryResult | null> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/chat/history/${encodeURIComponent(sessionId)}`);
  } catch {
    throw new ApiError("Couldn't reach the server. Please check your connection and try again.");
  }

  if (res.status === 404) return null; // unknown/stale session — caller should start fresh
  if (!res.ok) {
    throw new ApiError(await parseErrorMessage(res, "Couldn't load your conversation history."));
  }

  const data = await res.json();
  const messages: ChatMessage[] = (data.messages as { sender: "user" | "ai"; text: string }[]).map((m, i) => ({
    id: `${data.sessionId}-${i}`,
    sender: m.sender,
    text: m.text,
  }));
  return { sessionId: data.sessionId as string, messages };
}
