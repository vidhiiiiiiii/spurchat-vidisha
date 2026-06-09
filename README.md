# Mitti & More - AI Live Chat Support

A small web app with a live chat widget where an AI agent ("Aria") answers
customer questions for a fictional online store. You type a question like "what's
your return policy?" and the agent replies using a real LLM (Google Gemini).

I built this for the Spur founding-engineer take-home.

The agent is named **Vibha** — a blend of my name (Vidisha) and my mother's name (Bharti). She's always the first person I go to when I'm stuck on something, which felt like the right inspiration for a support agent whose whole job is to help people figure things out.

**Live demo:** https://spurchat-vidisha.vercel.app/

## Tech stack

- Backend: Node.js + TypeScript + Express
- Database: SQLite (via Prisma)
- Frontend: Svelte + Vite (TypeScript)
- LLM: Google Gemini (`gemini-2.5-flash`)

I picked SQLite + Prisma so there's no DB server to install - it just works on a
fresh machine. Moving to Postgres later is a one-line change in the Prisma schema.
I picked Gemini because it has a free tier with no credit card, so anyone reviewing
this can run it without paying for API calls.

## Folder layout

```
om-spur/
├── backend/
│   ├── prisma/schema.prisma   # database tables
│   └── src/
│       ├── routes/chat.ts     # the HTTP endpoints
│       ├── services/          # the actual logic (LLM, DB, FAQ)
│       ├── db/client.ts       # Prisma client
│       └── server.ts          # express setup
└── frontend/
    └── src/lib/
        ├── ChatWidget.svelte  # the chat UI
        └── api.ts             # talks to the backend
```

## How to run it locally

You need Node.js 18 or newer.

### Backend

```bash
cd backend
npm install
cp .env.example .env
```

Now open `.env` and put in your Gemini API key. You can get a free one from
https://aistudio.google.com/app/apikey (just sign in with Google, no card needed).
Paste it into the `GEMINI_API_KEY` line. The other values are fine as they are.

Set up the database and start the server:

```bash
npm run prisma:migrate   # creates the SQLite db + tables
npm run dev              # runs on http://localhost:4000
```

### Frontend

Open a second terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev              # runs on http://localhost:5173
```

Now open http://localhost:5173 and try chatting.

> Heads up: if you skip the API key, the app still works - the agent just replies
> with a polite "I'm not set up yet" message instead of crashing. Add a real key
> whenever you want actual AI answers.

Want to see what's saved in the DB? Run `npx prisma studio` inside `backend/`.

## Deploying

I deployed the backend on Render and the frontend on Vercel (both have free tiers).
The order matters a bit because each side needs to know the other's URL.

### 1. Backend on Render

- Push this repo to GitHub.
- On Render: New → Web Service → pick this repo.
- Settings:
  - Root Directory: `backend`
  - Build Command: `npm install --include=dev && npx prisma generate && npx prisma migrate deploy && npm run build`
  - Start Command: `npm start`
- Environment variables:
  - `GEMINI_API_KEY` = your key
  - `GEMINI_MODEL` = `gemini-2.5-flash`
  - `DATABASE_URL` = `file:./dev.db`
  - `CORS_ORIGIN` = leave blank for now, you'll fill it once the frontend is live
- Deploy. You'll get a URL like `https://spur-chat-backend.onrender.com`.

(There's also a `render.yaml` in the repo root if you'd rather use Render's Blueprint
flow instead of clicking through the dashboard.)

### 2. Frontend on Vercel

- On Vercel: New Project → pick the same repo.
- Settings:
  - Root Directory: `frontend`
  - Framework: Vite (auto-detected)
- Environment variable:
  - `VITE_API_URL` = your Render backend URL from step 1
- Deploy. You'll get a URL like `https://your-app.vercel.app`.

### 3. Connect them

Go back to Render, set `CORS_ORIGIN` to your Vercel URL, and redeploy the backend.
That's it.

Two things worth knowing about the free tiers:

- Render free services go to sleep after ~15 min idle, so the *first* message after
  a while can take ~30-50s while it wakes up (you'll see the typing dots the whole
  time). After that it's fast.
- The SQLite file lives on Render's disk, which resets on each redeploy. So chat
  history persists during normal use but gets wiped when the backend redeploys.
  Fine for a demo; a real deployment would use a managed Postgres (one-line change in
  the Prisma schema).

## Environment variables

backend/.env:

| Variable | What it's for |
|---|---|
| `DATABASE_URL` | where the SQLite file lives (`file:./dev.db`) |
| `GEMINI_API_KEY` | your Gemini key - needed for real replies |
| `GEMINI_MODEL` | which model to use (`gemini-2.5-flash`) |
| `PORT` | backend port (4000) |
| `CORS_ORIGIN` | which frontend URL is allowed to call the API |

frontend/.env:

| Variable | What it's for |
|---|---|
| `VITE_API_URL` | the backend URL |

Both `.env` files are gitignored so no keys end up on GitHub. The `.env.example`
files show the shape without any real values.

## How it's put together

### The backend

I kept it in layers so each part has one job:

- **routes/chat.ts** - just handles the HTTP side. Reads the request, checks it's
  valid, calls the right service, sends back a response. No real logic here.
- **services/** - this is where the actual work happens:
  - `llmService.ts` - everything about talking to Gemini lives here. The prompt,
    the history limit, the timeout, error handling. The rest of the app doesn't
    know or care that it's Gemini. If I wanted to switch to OpenAI, I'd only touch
    this one file.
  - `conversationService.ts` - all the database reads/writes (finding a
    conversation, saving messages, loading history). The routes never touch the DB
    directly.
  - `storeKnowledge.ts` - the store's FAQ text and the system prompt.
- **db/client.ts** - one shared Prisma client.

### The database

Two tables:

```
Conversation (id, createdAt)
   └── Message (id, conversationId, sender: "user" | "ai", text, createdAt)
```

The `sessionId` the frontend gets back is just the conversation's id. I kept that
mapping in one place so if I ever needed something fancier (like multiple chats per
user) I wouldn't have to change much.

### What happens when you send a message

1. Check the message isn't empty / too long.
2. Find the conversation (or make a new one).
3. **Save the user's message right away** - before calling the AI. So even if the
   AI call fails, the message isn't lost.
4. Load the recent history and ask Gemini for a reply.
5. Save the AI reply and send it back.
6. If Gemini fails, save a friendly apology as the AI's message and send that back
   normally. From the chat's point of view the agent still "replied", and the
   frontend still gets its sessionId.

### The frontend

`ChatWidget.svelte` holds all the chat state and draws the UI - message list,
input box, the typing dots, error banner. `api.ts` is the only file that knows the
backend URL; it turns both network failures and server errors into one friendly
message. The sessionId is saved in `localStorage`, so when you reload the page it
fetches your old messages and shows them again. If that session no longer exists
(say the DB was wiped), it just starts fresh.

### Adding more later

The brief mentions WhatsApp/Instagram etc. The LLM and DB layers don't care which
channel a message came from, so adding a channel would mostly be a new route that
maps incoming messages to a conversation. Adding tools or a smarter FAQ lookup
would only touch `llmService.ts`. That was the main thing I was trying to keep easy.

## LLM notes

- **Provider:** Google Gemini (`gemini-2.5-flash`), using the official
  `@google/generative-ai` SDK.
- **Prompt:** one system prompt (in `storeKnowledge.ts`) that gives the agent its
  personality ("Aria"), tells it to be warm and short, and includes the store's FAQ
  (shipping, returns, support hours, payments). I also told it NOT to make up things
  it doesn't know - like order status or tracking numbers - and to send people to
  email/human support for those instead.
- **History:** I send the last ~12 messages with each request. Enough for follow-up
  questions to make sense, but not so much that the prompt gets huge and expensive.
- **Keeping cost/abuse in check:** replies capped at 500 tokens, messages capped at
  4000 characters (checked on both ends), and a 20-second timeout so a slow call
  doesn't hang the user.
- **Errors:** every Gemini error gets caught and turned into a short, plain-English
  message (bad key, rate limit, server down, timeout). The user never sees a raw
  stack trace; the real error gets logged on the server.

## A note on robustness

I tried to make it hard to break:

- Empty or whitespace-only messages are rejected.
- Very long messages get a clear error instead of being silently cut or sent to the
  LLM.
- Bad JSON, unknown routes, or any unexpected crash are caught by Express - the
  server logs it and returns a clean error, it doesn't fall over.
- The user's message is saved before the AI call, so a failed call never loses it.
- The frontend tells "can't reach the server" apart from "server returned an error",
  and the rest of the UI stays usable either way.

## If I had more time

- **FAQ in the DB instead of hardcoded.** Right now the store info lives in
  `storeKnowledge.ts`. For a small fixed FAQ that's fine and fast, but a real store
  would want to edit it without redeploying, and eventually proper retrieval once it
  grows too big for one prompt.
- **Streaming replies.** Right now you wait for the full answer. Streaming it word
  by word would feel snappier. The typing dots are a simple stand-in for now.
- **Rate limiting.** A public version should limit requests per user/IP so the LLM
  bill stays sane and nobody can spam it. Easy to add as middleware.
- **Tests.** I tested everything by hand (including the failure paths) but didn't
  write an automated suite given the time. I'd add route tests with the LLM mocked,
  and unit tests for the prompt/history logic.
- **Real sessions.** Right now a session is just an id in localStorage, no login.
  Fine for this exercise; a real product would tie chats to actual accounts.

A small dev note: on a brand-new Google Cloud project the `gemini-2.0-flash` free
quota sometimes shows up as 0, so I'm defaulting to `gemini-2.5-flash` which worked
reliably on the free tier. You can change the model in `.env` if you want.
