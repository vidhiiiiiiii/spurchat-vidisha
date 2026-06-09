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
    <div class="avatar" aria-hidden="true">A</div>
    <div>
      <h1>Vibha · Support</h1>
      <p class="status">{sending ? "Agent is typing…" : "Usually replies in a few seconds"}</p>
    </div>
  </header>

  <div class="messages" bind:this={scrollEl}>
    {#if loadingHistory}
      <p class="hint">Loading conversation…</p>
    {:else if messages.length === 0}
      <div class="empty-state">
        <p>👋 Hi! I'm Vibha, your support agent.</p>
        <p>Ask me about shipping, returns, support hours, or anything else about your order.</p>
      </div>
    {/if}

    {#each messages as message (message.id)}
      <div class="message-row {message.sender}">
        <div class="bubble {message.sender}">{message.text}</div>
      </div>
    {/each}

    {#if sending}
      <div class="message-row ai">
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
    border-radius: 20px;
    box-shadow: 0 20px 50px rgba(109, 40, 217, 0.15), 0 0 0 1px rgba(109, 40, 217, 0.05);
    overflow: hidden;
  }

  .chat-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 18px 20px;
    background: linear-gradient(135deg, #6d28d9 0%, #9333ea 100%);
    color: white;
    box-shadow: 0 4px 15px rgba(0,0,0,0.05);
    z-index: 10;
  }
  .chat-header h1 {
    font-size: 1.05rem;
    margin: 0;
    font-weight: 600;
  }
  .chat-header .status {
    margin: 2px 0 0;
    font-size: 0.8rem;
    opacity: 0.85;
  }
  .avatar {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    flex-shrink: 0;
  }

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: var(--bg);
  }

  .hint {
    text-align: center;
    color: var(--muted);
    font-size: 0.9rem;
  }

  .empty-state {
    margin: auto;
    text-align: center;
    color: var(--muted);
    max-width: 280px;
    line-height: 1.5;
  }
  .empty-state p {
    margin: 4px 0;
  }

  .message-row {
    display: flex;
  }
  .message-row.user {
    justify-content: flex-end;
  }
  .message-row.ai {
    justify-content: flex-start;
  }

  .bubble {
    max-width: 78%;
    padding: 10px 14px;
    border-radius: 16px;
    line-height: 1.45;
    font-size: 0.92rem;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .bubble.user {
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    color: white;
    border-bottom-right-radius: 4px;
    box-shadow: 0 4px 12px rgba(109, 40, 217, 0.2);
  }
  .bubble.ai {
    background: #ffffff;
    color: var(--text);
    border: 1px solid #f1f1f4;
    border-bottom-left-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
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
    background: var(--muted);
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
    padding: 10px 14px;
    background: #fef2f2;
    color: #b91c1c;
    border-top: 1px solid #fecaca;
    font-size: 0.85rem;
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
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 10px 12px;
    font: inherit;
    font-size: 0.92rem;
    max-height: 120px;
    background: var(--bg);
    color: var(--text);
  }
  .composer textarea:focus {
    outline: 2px solid var(--brand);
    outline-offset: 1px;
  }
  .composer textarea:disabled {
    opacity: 0.6;
  }
  .composer button[type="submit"] {
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    color: white;
    border: none;
    border-radius: 12px;
    padding: 10px 18px;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(109, 40, 217, 0.25);
  }
  .composer button[type="submit"]:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(109, 40, 217, 0.35);
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
    font-size: 0.75rem;
    color: var(--muted);
    padding: 8px 12px 12px;
    background: var(--surface);
    opacity: 0.8;
  }
  .watermark strong {
    color: var(--brand);
    font-weight: 600;
  }
  .counter {
    align-self: center;
    font-size: 0.75rem;
    color: var(--muted);
  }
  .counter.over {
    color: #b91c1c;
  }
</style>
