import { prisma } from "../db/client";
import type { ChatTurn } from "./llmService";

/**
 * Returns the conversation for `sessionId` if it exists, or creates a fresh one.
 * We treat sessionId === conversationId — one chat session is one conversation.
 * Keeping that 1:1 mapping explicit here means we can later split them
 * (e.g. multiple conversations per browser session) without touching callers.
 *
 * Note: if a client sends an unknown sessionId (e.g. DB was reset), we silently
 * start a new conversation with a fresh id rather than erroring — the response
 * always carries the authoritative sessionId for the client to store.
 */
export async function getOrCreateConversation(sessionId: string | undefined) {
  if (sessionId) {
    const existing = await prisma.conversation.findUnique({ where: { id: sessionId } });
    if (existing) return existing;
  }
  return prisma.conversation.create({ data: {} });
}

/** Read-only lookup — used by the history endpoint so GET requests stay side-effect free. */
export async function findConversation(conversationId: string) {
  return prisma.conversation.findUnique({ where: { id: conversationId } });
}

export async function getHistory(conversationId: string): Promise<ChatTurn[]> {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });
  return messages.map((m) => ({ sender: m.sender as "user" | "ai", text: m.text }));
}

export async function saveMessage(conversationId: string, sender: "user" | "ai", text: string) {
  return prisma.message.create({
    data: { conversationId, sender, text },
  });
}
