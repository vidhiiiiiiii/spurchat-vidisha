<script lang="ts">
  import { onMount, tick } from "svelte";
  import { sendMessage, fetchHistory, ApiError } from "./api";
  import type { ChatMessage } from "./types";

  const SESSION_STORAGE_KEY = "spur-chat-session-id";
  const MAX_MESSAGE_LENGTH = 4000;

  let messages: ChatMessage[] = [];
  let draft = "";
  let sessionId: string | null = null;
  let sending = false;
  let loadingHistory = true;
  let errorBanner: string | null = null;
  let scrollEl: HTMLDivElement;
  let nextLocalId = 0;

  function addMessage(sender: "user" | "ai", text: string) {
    messages = [...messages, { id: `local-${nextLocalId++}`, sender, text }];
  }

  async function scrollToBottom() {
    await tick();
    scrollEl?.scrollTo({ top: scrollEl.scrollHeight, behavior: "smooth" });
  }

  onMount(async () => {
    const savedSessionId = localStorage.getItem(SESSION_STORAGE_KEY);
    if (savedSessionId) {
      try {
        const history = await fetchHistory(savedSessionId);
        if (history) {
          sessionId = history.sessionId;
          messages = history.messages;
        } else {
          localStorage.removeItem(SESSION_STORAGE_KEY);
        }
      } catch (err) {
        // Non-fatal — chat still works without restored history.
        errorBanner = err instanceof ApiError ? err.message : "Couldn't load your previous conversation.";
      }
    }
    loadingHistory = false;
    scrollToBottom();
  });

  function persistSessionId(id: string) {
    sessionId = id;
    localStorage.setItem(SESSION_STORAGE_KEY, id);
  }

  /**
   * Starts a fresh conversation: clears the local thread and forgets the saved
   * session so the next message creates a new conversation on the backend.
   * The old conversation stays persisted in the DB — we just stop pointing at it.
   */
  function startNewChat() {
    if (sending) return;
    messages = [];
    sessionId = null;
    errorBanner = null;
    draft = "";
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;

    if (text.length > MAX_MESSAGE_LENGTH) {
      errorBanner = `Your message is too long (max ${MAX_MESSAGE_LENGTH} characters). Please shorten it.`;
      return;
    }

    errorBanner = null;
    addMessage("user", text);
    draft = "";
    sending = true;
    scrollToBottom();

    try {
      const result = await sendMessage(text, sessionId);
      persistSessionId(result.sessionId);
      addMessage("ai", result.reply);
    } catch (err) {
      errorBanner = err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
    } finally {
      sending = false;
      scrollToBottom();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  $: remaining = MAX_MESSAGE_LENGTH - draft.length;
  $: showCounter = remaining < 200;
</script>

<div class="chat-widget">
  <header class="chat-header">
    <div class="avatar" aria-hidden="true">V</div>
    <div class="header-text">
      <h1>Vibha · Support</h1>
      <p class="status">{sending ? "Agent is typing…" : "Usually replies in a few seconds"}</p>
    </div>
    <button
      type="button"
      class="new-chat"
      on:click={startNewChat}
      disabled={sending || messages.length === 0}
      title="Start a new conversation"
    >
      New chat
    </button>
  </header>

  <div class="messages" bind:this={scrollEl}>
    {#if loadingHistory}
      <p class="hint">Loading conversation…</p>
    {:else if messages.length === 0}
      <div class="empty-state">
        <div class="message-row ai">
          <div class="msg-avatar" aria-hidden="true">V</div>
          <div class="bubble ai">Namaste! 🙏 I'm Vibha. How can I help you today?</div>
        </div>
        <div class="chips">
          {#each ["What's your return policy?", "Do you ship to USA?", "What are your support hours?", "What payment methods do you accept?"] as chip}
            <button type="button" class="chip" disabled={sending} on:click={() => { draft = chip; handleSend(); }}>
              {chip}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#each messages as message (message.id)}
      <div class="message-row {message.sender}">
        {#if message.sender === "ai"}
          <div class="msg-avatar" aria-hidden="true">V</div>
        {/if}
        <div class="bubble {message.sender}">{message.text}</div>
      </div>
    {/each}

    {#if sending}
      <div class="message-row ai">
        <div class="msg-avatar" aria-hidden="true">V</div>
        <div class="bubble ai typing" aria-live="polite" aria-label="Agent is typing">
          <span></span><span></span><span></span>
        </div>
      </div>
    {/if}
  </div>

  {#if errorBanner}
    <div class="error-banner" role="alert">
      {errorBanner}
      <button type="button" on:click={() => (errorBanner = null)} aria-label="Dismiss error">×</button>
    </div>
  {/if}

  <p class="free-tier-note">ℹ️ Running on a free LLM tier — replies may occasionally be slow or briefly rate-limited.</p>

  <form class="composer" on:submit|preventDefault={handleSend}>
    <textarea
      bind:value={draft}
      on:keydown={handleKeydown}
      placeholder="Type your message…"
      rows="1"
      maxlength={MAX_MESSAGE_LENGTH + 200}
      disabled={sending}
      aria-label="Message"
    ></textarea>
    {#if showCounter}
      <span class="counter" class:over={remaining < 0}>{remaining}</span>
    {/if}
    <button type="submit" disabled={sending || !draft.trim()}>
      {sending ? "Sending…" : "Send"}
    </button>
  </form>
  <div class="watermark">
    ✨ Designed & Developed by <strong>Vidisha</strong>
  </div>
</div>

<style>
  .chat-widget {
    display: flex;
    flex-direction: column;
    width: min(420px, 100vw);
    height: min(640px, 100vh);
    background: var(--surface);
    border-radius: 22px;
    border: 1px solid var(--border);
    box-shadow: 0 24px 60px rgba(60, 36, 25, 0.22), 0 0 0 1px rgba(60, 36, 25, 0.04);
    overflow: hidden;
    font-family: "Caveat", "Segoe Script", cursive;
  }

  .chat-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 18px 20px;
    background: linear-gradient(135deg, #3d2415 0%, #2d2012 100%);
    color: #f5dfa0;
    border-bottom: 2px solid var(--gold);
    z-index: 10;
  }
  .header-text {
    flex: 1;
    min-width: 0;
  }
  .chat-header h1 {
    font-size: 1.45rem;
    margin: 0;
    font-weight: 700;
    color: #f5dfa0;
    line-height: 1.1;
  }
  .new-chat {
    flex-shrink: 0;
    background: rgba(212, 160, 74, 0.12);
    color: #f5dfa0;
    border: 1px solid rgba(212, 160, 74, 0.6);
    border-radius: 8px;
    padding: 4px 12px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
    font-family: inherit;
  }
  .new-chat:hover:not(:disabled) {
    background: rgba(212, 160, 74, 0.25);
  }
  .new-chat:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .chat-header .status {
    margin: 2px 0 0;
    font-size: 0.95rem;
    color: rgba(255, 255, 255, 0.55);
  }
  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--clay);
    border: 2px solid var(--gold);
    color: #3d2415;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 1.3rem;
    flex-shrink: 0;
  }

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 14px 14px 6px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: var(--bg);
  }

  .hint {
    text-align: center;
    color: var(--muted);
    font-size: 0.9rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding-left: 42px;
  }
  .chip {
    background: transparent;
    border: 1px solid #d4a04a;
    color: #7a5820;
    border-radius: 5px;
    padding: 3px 10px;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
  }
  .chip:hover:not(:disabled) {
    background: #d4a04a;
    border-color: #d4a04a;
    color: #fdf6ec;
  }
  .chip:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .free-tier-note {
    margin: 0;
    padding: 5px 14px 5px;
    font-size: 0.88rem;
    line-height: 1.4;
    color: var(--muted);
    background: var(--surface);
    border-top: 1px solid var(--border);
    font-family: inherit;
  }

  .message-row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }
  .message-row.user {
    justify-content: flex-end;
  }
  .message-row.ai {
    justify-content: flex-start;
  }
  .msg-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--clay);
    border: 1.5px solid var(--gold);
    color: #3d2415;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 1.05rem;
    flex-shrink: 0;
  }

  .bubble {
    max-width: 74%;
    padding: 9px 13px;
    border-radius: 14px;
    line-height: 1.4;
    font-size: 1.1rem;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .bubble.user {
    background: #3d2415;
    color: #f5dfa0;
    border: 1px solid #2d2012;
    box-shadow: 0 4px 12px rgba(60, 36, 25, 0.25);
  }
  .bubble.ai {
    background: #ffffff;
    color: #2d2012;
    border: 1px solid #d6cabd;
    box-shadow: 0 4px 12px rgba(60, 36, 25, 0.05);
  }

  .bubble.typing {
    display: flex;
    gap: 4px;
    align-items: center;
    padding: 14px 16px;
  }
  .bubble.typing span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--brand);
    animation: bounce 1.2s infinite ease-in-out;
  }
  .bubble.typing span:nth-child(2) { animation-delay: 0.15s; }
  .bubble.typing span:nth-child(3) { animation-delay: 0.3s; }
  @keyframes bounce {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
    40% { transform: translateY(-4px); opacity: 1; }
  }

  .error-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin: 0 12px 6px;
    padding: 7px 10px;
    background: #fdecea;
    color: #b71c1c;
    border: 1px solid #f5cfcb;
    border-radius: 8px;
    font-size: 1rem;
  }
  .error-banner button {
    background: none;
    border: none;
    color: inherit;
    font-size: 1.1rem;
    cursor: pointer;
    line-height: 1;
    padding: 0 4px;
  }

  .composer {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 12px;
    border-top: 1px solid var(--border);
    background: var(--surface);
  }
  .composer textarea {
    flex: 1;
    resize: none;
    border: 1px solid #d4a04a;
    border-radius: 14px;
    padding: 10px 14px;
    font: inherit;
    font-size: 1.1rem;
    max-height: 120px;
    background: #ffffff;
    color: #2d2012;
  }
  .composer textarea::placeholder {
    color: #b09a86;
  }
  .composer textarea:focus {
    outline: 2px solid var(--brand);
    outline-offset: 1px;
  }
  .composer textarea:disabled {
    opacity: 0.6;
  }
  .composer button[type="submit"] {
    background: #3d2415;
    color: #f5dfa0;
    border: none;
    border-radius: 14px;
    padding: 10px 22px;
    font-weight: 700;
    font-size: 1.1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(60, 36, 25, 0.25);
  }
  .composer button[type="submit"]:hover:not(:disabled) {
    transform: translateY(-1px);
    background: #4a2f23;
    box-shadow: 0 4px 12px rgba(60, 36, 25, 0.35);
  }
  .composer button[type="submit"]:active:not(:disabled) {
    transform: translateY(0);
  }
  .composer button[type="submit"]:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }

  .watermark {
    text-align: center;
    font-size: 0.95rem;
    color: var(--muted);
    padding: 6px 12px 10px;
    background: var(--surface);
  }
  .watermark strong {
    color: var(--brand);
    font-weight: 700;
  }
  .counter {
    align-self: center;
    font-size: 0.95rem;
    color: var(--muted);
  }
  .counter.over {
    color: #9a3b2f;
  }
</style>
