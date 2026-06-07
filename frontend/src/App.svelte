<script lang="ts">
  import ChatWidget from "./lib/ChatWidget.svelte";
</script>

<main>
  <div class="page-copy">
    <h1>Lumora Home Goods</h1>
    <p>Need help with an order, shipping, or returns? Chat with Aria, our AI support agent — available right here, right now.</p>
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
  }
  .page-copy h1 {
    font-size: 1.8rem;
    margin-bottom: 12px;
  }
  .page-copy p {
    color: var(--muted);
    line-height: 1.6;
  }
</style>
