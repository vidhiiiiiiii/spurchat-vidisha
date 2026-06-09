<script lang="ts">
  import ChatWidget from "./lib/ChatWidget.svelte";
</script>

<main>
  <div class="page-copy">
    <div class="brand">
      <span class="pot-icon">🏺</span>
      <h1>Mitti & More</h1>
    </div>
    <div class="divider"></div>
    <p>Need help with an order, shipping, or returns? Chat with Vibha, our AI support agent — available right here, right now.</p>
    <div class="tag-row">
      <span class="tag">🌿 Handcrafted goods</span>
      <span class="tag">↩️ Easy returns</span>
    </div>
  </div>
  <ChatWidget />
</main>

<style>
  main {
    min-height: 100vh;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 48px;
    padding: 32px;
  }
  .page-copy {
    max-width: 380px;
    font-family: "Caveat", "Segoe Script", cursive;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 16px;
  }
  .pot-icon {
    font-size: 3.2rem;
    line-height: 1;
    filter: drop-shadow(0 2px 6px rgba(168, 107, 60, 0.35));
  }
  .page-copy h1 {
    font-size: 3rem;
    font-weight: 700;
    margin: 0;
    color: var(--espresso);
    line-height: 1.05;
    letter-spacing: -0.5px;
  }
  .divider {
    width: 56px;
    height: 3px;
    background: linear-gradient(90deg, var(--gold), var(--clay));
    border-radius: 4px;
    margin-bottom: 14px;
  }
  .page-copy p {
    font-size: 1.3rem;
    color: var(--text);
    line-height: 1.55;
    margin: 0 0 20px;
    font-weight: 500;
  }
  .tag-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .tag {
    font-size: 1.1rem;
    color: var(--muted);
    font-weight: 500;
  }
</style>
