# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Run from the repo root — the root `package.json` defines npm workspaces (`backend`, `frontend`).

- `npm install` — installs both workspaces in one shot.
- `npm run dev` — starts backend (`tsx watch`, port 3001) and Vite dev server (port 5173) concurrently. Open the Vite URL.
- `npm run build` — backend `tsc` → `backend/dist`, frontend `tsc -b && vite build` → `frontend/dist`.
- `npm run start` — runs the compiled backend only (production-style).
- Workspace-scoped: `npm run <script> -w backend` or `-w frontend`.

There is **no test suite, no lint config, and no formatter** wired up. Don't claim "lint passes" or "tests pass" — there's nothing to run.

## Stockfish dependency

The backend spawns the **external `stockfish` binary** as a child process; it is not bundled or installed via npm. The binary must be on `PATH` or its absolute path provided via `STOCKFISH_PATH`. Without it, the server starts but every analyze request emits an `error` event.

Backend env vars (see `backend/.env.example`): `PORT`, `STOCKFISH_PATH`, `STOCKFISH_THREADS`, `STOCKFISH_HASH_MB`, `DEFAULT_DEPTH`. Per-request depth is clamped to `[6, 24]` in `backend/src/index.ts`.

## Architecture

### Wire protocol — single Socket.io channel

The frontend and backend communicate **only over Socket.io**, using one server-to-client channel `analysis:event` and two client-to-server events `analyze` / `cancel`. The Vite dev server proxies `/socket.io` (and `/api`) to `localhost:3001` (`frontend/vite.config.ts`), so both ends connect to the same origin.

`AnalysisEvent` is a discriminated union (`type: 'start' | 'progress' | 'complete' | 'error'`) defined identically in `backend/src/types.ts` and `frontend/src/types.ts`. **The two type files are duplicates, not shared via a package** — when you change one, change the other in lockstep, or the wire contract drifts silently. `AnalysisProgressEvent` structurally extends `MoveAnalysis` with a `type` discriminator, which is why the frontend can store progress events directly as moves (`App.tsx` `case 'progress'`).

### Backend pipeline (`backend/src/`)

1. `index.ts` — Express + Socket.io bootstrap. Per-socket state holds `currentEngine` and a `cancelled` flag; `analyze` tears down any prior engine, `cancel`/`disconnect` kills it. One Stockfish process per analysis run, not pooled.
2. `engine.ts` — `StockfishEngine` wraps a `child_process.spawn` of the UCI binary. Line-buffered stdout via `EventEmitter`; helpers `waitFor` / `collectUntil` resolve on UCI sentinels (`uciok`, `readyok`, `bestmove`). `analyze(fen, depth, multiPv)` issues `setoption MultiPV`, `position fen`, `go depth`, then parses every `info` line and the terminal `bestmove`.
3. `analyzer.ts` — `analyzeGame` loads the PGN with `chess.js`, replays move-by-move, and for each ply runs **two engine analyses** (the "before" position with `multiPV=2` to detect only-moves, and the "after" position). The "after" result of ply N is **cached as the "before" of ply N+1** (when `multiPV` requirement is satisfied) to halve engine calls. Note the `getHeaders()` / `header()` shim around line 39 — `chess.js` is pinned to `1.0.0-beta.8` and the API renamed between betas, so both names are tried at runtime.
4. `classify.ts` — pure functions; no I/O. Converts UCI scores to White-POV centipawns (mate scores collapse to ±10000−mate), applies the **lichess win-probability formula** `WP(cp) = 50 + 50·(2/(1+e^(-0.00368208·cp))−1)`, and buckets WP loss into the nine `MoveClassification` labels. `looksLikeSacrifice` is a heuristic (no full SEE) that fires when the moved piece sits attacked by a strictly-lower-value enemy and net material is negative. `inferBook` is a fake opening book — it tags the first ~12 plies as `book` if the move was among Stockfish's top candidates and the position was roughly balanced. **Tweak the thresholds here, not in `analyzer.ts`.**

If you change classification thresholds, also update the table in `README.md` so the docs stay honest.

### Frontend (`frontend/src/`)

- `App.tsx` is the single stateful root. It owns the socket subscription (`useEffect`), the `moves[]` array indexed by ply, `currentPly` (-1 = starting position), and toggles like `showingBest` / `isPlaying`. Auto-advance to the latest streamed move only happens when the user is at the head of the stream — browsing earlier moves freezes the cursor.
- `socket.ts` connects to the current origin with `path: '/socket.io'` so it transparently rides the Vite proxy in dev and serves itself in production.
- `components/Board.tsx` wraps `react-chessboard` and overlays a classification badge using a manual `squareToPixel` calculation — the badge is positioned in CSS pixels relative to the board, so changing `boardSize` rescales it.
- `components/ClassificationIcon.tsx` is the **single source of truth for classification colors and glyphs** on the frontend. `tailwind.config.js` also has a `review.*` color palette — keep the two in sync.
- `utils/winProb.ts` duplicates `scoreToCp` / WP formula from the backend so the eval bar and chart can render without round-tripping. Keep the formulas identical.

### Per-ply data flow

`PGN string` → server `analyze` event → `analyzer.ts` emits `start` then one `progress` per ply with full `MoveAnalysis` (FEN before/after, both evals from White POV, best move UCI/SAN, second-best eval, classification, WP loss) → frontend stores by `ply` index → `App.tsx` derives the displayed FEN, eval bar value, square highlights, and arrows from `currentPly` + `showingBest`.
