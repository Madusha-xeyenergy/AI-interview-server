# AI Interview – Backend (Express + TypeScript)

Backend for the AI voice interview POC. The Next.js frontend lives in `../ai-interview`.

Built with Express to match the HR system's backend, so the `modules/` folders
can later be moved into the HR backend with minimal changes.

## Structure

```
src/
  server.ts              # starts the HTTP server
  app.ts                 # creates the Express app: middleware, routes, error handling
  config/env.ts          # loads + validates .env with zod
  routes/index.ts        # mounts every module under /api
  modules/               # one folder per feature (routes, controller, service, schema)
    health/
  middleware/            # 404 + central error handler
  utils/http-error.ts    # throw new HttpError(404, "...") from anywhere
```

## Setup

Requires Node.js 20 or newer.

```powershell
cd ai-interview-server
npm install
copy .env.example .env      # macOS/Linux: cp .env.example .env
npm run dev
```

## Check it works

- Health: http://localhost:4000/api/health

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Runs with auto-reload (tsx watch) |
| `npm run typecheck` | Type-checks without building |
| `npm run build` | Compiles to `dist/` |
| `npm start` | Runs the compiled build |
