import { Router, type Request, type Response } from "express";
import { generateReply, LlmServiceError } from "../services/llmService";
import { findConversation, getHistory, getOrCreateConversation, saveMessage } from "../services/conversationService";

export const chatRouter = Router();

const MAX_MESSAGE_LENGTH = 4000; // generous for a chat widget; keeps LLM cost/latency sane

/**
 * POST /chat/message
 * Body: { message: string, sessionId?: string }
 * Response: { reply: string, sessionId: string }
 */
chatRouter.post("/message", async (req: Request, res: Response) => {
  const { message, sessionId } = req.body ?? {};

  if (typeof message !== "string") {
    return res.status(400).json({ error: "`message` is required and must be a string." });
  }

  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return res.status(400).json({ error: "Message cannot be empty." });
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({
      error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters). Please shorten it and try again.`,
    });
  }
  if (sessionId !== undefined && typeof sessionId !== "string") {
    return res.status(400).json({ error: "`sessionId` must be a string when provided." });
  }

  try {
    const conversation = await getOrCreateConversation(sessionId);

    // Persist the user's message before calling the LLM so it's never lost,
    // even if the LLM call subsequently fails.
    await saveMessage(conversation.id, "user", trimmed);

    const history = await getHistory(conversation.id);
    // Exclude the message we just saved — generateReply takes it separately.
    const priorHistory = history.slice(0, -1);

    let reply: string;
    try {
      reply = await generateReply(priorHistory, trimmed);
    } catch (err) {
      const friendlyMessage = err instanceof LlmServiceError ? err.message : "Something went wrong. Please try again.";
      // Persist and return this like a normal agent reply (200, same shape) rather
      // than an HTTP error — from the conversation's point of view the agent *did*
      // respond, just apologetically. This keeps history/UI consistent and means
      // the client always learns the sessionId, even when the LLM call failed.
      await saveMessage(conversation.id, "ai", friendlyMessage);
      return res.json({ reply: friendlyMessage, sessionId: conversation.id });
    }

    await saveMessage(conversation.id, "ai", reply);
    return res.json({ reply, sessionId: conversation.id });
  } catch (err) {
    console.error("[POST /chat/message] unexpected error:", err);
    return res.status(500).json({ error: "Something went wrong on our end. Please try again." });
  }
});

/**
 * GET /chat/history/:sessionId
 * Response: { sessionId: string, messages: { sender: 'user'|'ai', text: string }[] }
 * Lets the frontend restore a conversation on page reload. Read-only — if the
 * sessionId is unknown (e.g. DB was reset since the client last saved it) we
 * return 404 so the frontend can discard its stale id and start fresh.
 */
chatRouter.get("/history/:sessionId", async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "A valid sessionId is required." });
  }

  try {
    const conversation = await findConversation(sessionId);
    if (!conversation) {
      return res.status(404).json({ error: "No conversation found for this session." });
    }
    const messages = await getHistory(conversation.id);
    return res.json({ sessionId: conversation.id, messages });
  } catch (err) {
    console.error("[GET /chat/history/:sessionId] unexpected error:", err);
    return res.status(500).json({ error: "Couldn't load conversation history. Please try again." });
  }
});
