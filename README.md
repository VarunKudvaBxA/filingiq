# FilingIQ

Ask questions about annual reports and filings and get answers that point to the exact page they came from. When the documents don't contain the answer, the app says so instead of guessing.

Built with the MERN stack (MongoDB, Express, React, Node) plus MongoDB Atlas Vector Search.

## What it does

- **Upload filings** (PDF or .txt). Text is extracted page by page, split into overlapping chunks, embedded and stored.
- **Ask questions** across one or more documents. Each answer carries numbered citations that open the source passage and page number.
- **Compare documents** side by side. Retrieval runs separately per document, so one company can't crowd out the other.
- **Says "not covered"** when retrieval finds nothing relevant, or when the model reports the sources don't contain the answer.
- **Evaluation page** that scores retrieval on your own test questions (hit rate and MRR) so you can tune chunk size and top-k with numbers.
- **Accounts and plans.** JWT access tokens, rotating refresh tokens in httpOnly cookies, plan-based limits (Free: 3 documents and 20 questions/hour; Pro: unlimited documents and 200 questions/hour).
- **Watchlist panel** streamed over Socket.io (live quotes with a Finnhub key, simulated otherwise).

## Architecture

```
React (Vite)  ──HTTP──►  Express API ──► MongoDB
     │                     │   ├─ users, documents
     │                     │   └─ chunks (text, page, embedding vector)
     └────Socket.io────────┘
                           │
        upload ──► extract pages ──► chunk ──► embed ──► store     (background)
        ask    ──► embed question ──► vector search (top k) ──► prompt with numbered sources ──► answer + citations
```

Three guardrails keep answers honest:
1. Nothing above `MIN_SCORE` is retrieved: the model is never called, the answer is "not covered".
2. The prompt forces the model to answer only from numbered sources, or reply `NOT_FOUND`.
3. Only the sources the answer actually cites are returned as citations.

## Folder structure

```
filingiq/
├── docker-compose.yml          MongoDB (Atlas local image) + server + client
├── server/
│   ├── .env.example
│   ├── eval/sample-testset.json
│   ├── tests/chunker.test.js
│   └── src/
│       ├── index.js            HTTP + Socket.io bootstrap
│       ├── app.js              Express setup, middleware, routes
│       ├── config/             env.js (validated settings), db.js
│       ├── models/             User, Document, Chunk
│       ├── middleware/         auth (JWT + roles), rateLimit, errorHandler
│       ├── routes/             auth, documents, chat, eval
│       ├── services/
│       │   ├── pdf.js          page-level text extraction
│       │   ├── chunker.js      overlapping word windows, keeps page numbers
│       │   ├── llm.js          embeddings + chat (OpenAI, Anthropic, or offline mock)
│       │   ├── retrieval.js    Atlas $vectorSearch or local cosine
│       │   ├── rag.js          retrieval + prompt + guardrails + citations
│       │   ├── evaluate.js     hit rate and MRR
│       │   └── ingest.js       background processing pipeline
│       ├── sockets/market.js   watchlist quotes over Socket.io
│       └── scripts/            ensureIndex.js, runEval.js
└── client/
    └── src/
        ├── api.js, auth.jsx    fetch wrapper with token refresh, auth context
        ├── pages/              Login, Documents, Ask, Evaluation
        └── components/         Layout, DocPicker, MarketPanel
```

## Run it locally

Requirements: Node 20+, Docker (for MongoDB).

```bash
# 1. Database (supports vector search)
docker compose up -d mongo

# 2. Server
cd server
cp .env.example .env       # set the two JWT secrets
npm install
npm run dev                # http://localhost:5000

# 3. Client (new terminal)
cd client
npm install
npm run dev                # http://localhost:5173
```

With the default `.env` the app runs **without any API keys** (`mock` providers: lexical embeddings and extractive answers). That is enough to see the full flow. For real answers set:

```
EMBED_PROVIDER=openai
CHAT_PROVIDER=anthropic        # or openai
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
MIN_SCORE=0.35
```

Embedding dimensions must match what you ingested with. If you switch embedding provider, delete and re-upload your documents.

### Use Atlas Vector Search

```bash
# in server/.env
VECTOR_MODE=atlas
# then, once:
npm run create-index
```

This creates a `vectorSearch` index on `chunks.embedding` with a filter on `documentId`. It works on the Docker image and on an Atlas cluster (use the Atlas connection string for `MONGO_URI`).

### Everything in Docker

```bash
cp server/.env.example server/.env
docker compose up --build      # client on http://localhost:8080
```

## Measure retrieval quality

1. Upload a document and note its id (the Documents API returns it, or copy it from MongoDB).
2. Write 15 to 30 questions with a phrase that must appear in the right passage (see `server/eval/sample-testset.json`). Include a few off-topic questions with `"expectNotFound": true`.
3. Run it in the UI (Evaluation page) or from the CLI:

```bash
cd server
npm run eval -- <documentId> eval/my-testset.json 5
```

4. Change one thing at a time (chunk size in `chunker.js`, `TOP_K`, `MIN_SCORE`, embedding model), re-run, and record the results. Those before/after numbers are what you quote in interviews.

## API

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register`, `/login` | Returns access token, sets refresh cookie |
| POST | `/api/auth/refresh` | Rotates the refresh token |
| POST | `/api/auth/logout` | Revokes the refresh token |
| POST | `/api/auth/upgrade` | Demo switch to Pro |
| GET/POST | `/api/documents` | List / upload (multipart). Upload returns 202 and processes in the background |
| DELETE | `/api/documents/:id` | Removes the document and its chunks |
| POST | `/api/chat` | `{ question, documentIds[], mode: "ask" \| "compare" }` returns `{ answer, grounded, citations[] }` |
| POST | `/api/eval/run` | `{ documentIds[], cases[], topK }` returns metrics and per-case results |

## Design decisions (good interview material)

- **Why store only a hash of the refresh token?** A database leak can't be replayed as a session. Rotation plus hash comparison detects reuse of an old token and revokes the session.
- **Why keep the access token in memory?** It isn't readable from storage by injected scripts, and it expires in 15 minutes. The refresh cookie is httpOnly and scoped to `/api/auth`.
- **Why chunk by words with overlap, per page?** Overlap stops answers being cut at a boundary, and per-page chunks keep page numbers exact for citations.
- **Why a relevance threshold before calling the model?** It is cheaper and removes the main source of invented answers: irrelevant context.
- **Why retrieve per document in compare mode?** A single top-k search can return only one company's passages.
- **Why evaluate retrieval separately from the answer?** Bad retrieval is the most common cause of bad answers, and it can be measured without a model call.
- **Why a provider abstraction?** Providers can be swapped by environment variable, and the offline mock lets tests and demos run without keys.

## Known limitations

- Ingestion runs in-process. For production use a job queue (for example BullMQ) so uploads survive restarts.
- Scanned PDFs have no text layer and need OCR first.
- Question rate limits use an in-memory store per server instance; use a shared store (Redis) when running multiple instances.
- Single-device sessions: one refresh token hash per user.
- The Pro upgrade button is a demo, not a payment flow.

## Deploy

Frontend on Vercel or Netlify, API on Render or Railway, database on MongoDB Atlas. On a split-domain deployment set `COOKIE_SAMESITE=none`, `CLIENT_URL` to the frontend URL, and set `VITE_API_URL` in the client build to the API's URL.
