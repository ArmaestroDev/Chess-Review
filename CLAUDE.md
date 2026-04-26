# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Run from the repo root — the root `package.json` defines npm workspaces (`backend`, `frontend`).

- `npm install` — installs both workspaces in one shot.
- `npm run dev` — starts backend (`tsx watch`, port 3001) and Vite dev server (port 5173) concurrently. Open the Vite URL.
- `npm run build` — backend `tsc` → `backend/dist`, frontend `tsc -b && vite build` → `frontend/dist`.
- `npm run start` — runs the compiled backend only (production-style).
- Workspace-scoped: `npm run <script> -w backend` or `-w frontend`.
- `npm run build:catalog -w frontend` — one-shot rebuild of the bundled puzzles catalog from the Lichess DB. Requires the `zstd` CLI on PATH; downloads ~70MB into `frontend/.cache/` then writes per-tier JSONs into `frontend/src/features/puzzles/data/`.

There is **no test suite, no lint config, and no formatter** wired up. Don't claim "lint passes" or "tests pass" — there's nothing to run.

## Stockfish dependency

The backend spawns the **external `stockfish` binary** as a child process; it is not bundled or installed via npm. Locally the binary must be on `PATH` or its absolute path provided via `STOCKFISH_PATH`. Without it, the server starts but every analyze request emits an `error` event. The backend Dockerfile downloads the official `stockfish-ubuntu-x86-64-avx2` release at image-build time and points `STOCKFISH_PATH` at it — Cloud Run instances support AVX2.

Backend env vars (see `backend/.env.example`): `PORT`, `STOCKFISH_PATH`, `STOCKFISH_THREADS`, `STOCKFISH_HASH_MB`, `DEFAULT_DEPTH`, `IDLE_TIMEOUT_MS` (per-socket idle disconnect, default 600000 ms — see "Idle disconnect" below), `RAPIDAPI_KEY` (puzzles proxy; never expose to browser), `ALLOWED_ORIGINS` (comma-separated CORS allowlist; defaults to `http://localhost:5173` so dev still works). Per-request depth is clamped to `[6, 24]` in `backend/src/index.ts`.

## Architecture

### Wire protocol

Frontend ↔ backend communicate over Socket.io plus the `/api/*` HTTP endpoints. The Vite dev server proxies both `/socket.io` and `/api` to `localhost:3001` (`frontend/vite.config.ts`).

**Socket events:**
- Server → client: `analysis:event` is a discriminated union (`type: 'start' | 'progress' | 'complete' | 'error'`) for the streamed per-game run.
- Client → server: `analyze` (start a full game), `cancel`, and `analyzeMove` (single position; uses Socket.io's **ack callback** rather than `analysis:event`, returning `{ ok, move?, error? }`). `analyzeMove` is what the user triggers by dragging a piece on the board to explore a branch.

**Per-socket engine lifecycle (`backend/src/index.ts`):** one `StockfishEngine` is created lazily and kept alive across `analyze` + `analyzeMove` calls, with all engine work serialized through an `engineQueue` so concurrent calls don't race on stdin/stdout. A new `analyze` tears the engine down for a fresh hash; `cancel`/`disconnect` also tear it down. `AnalysisProgressEvent` structurally extends `MoveAnalysis` with a `type: 'progress'` discriminator, which is why the frontend can spread it into the move tree directly.

**Idle disconnect.** Each connected socket runs an `idleTimer` (reset on every `analyze` / `analyzeMove` / `cancel`). After `IDLE_TIMEOUT_MS` of silence the server calls `socket.disconnect()` so Cloud Run can scale the instance to zero. Server-initiated disconnect ('io server disconnect' on the client) **suppresses Socket.io's auto-reconnect** by design, so an abandoned tab cannot immediately rebill an instance. The client wraps every emit in `ensureConnected()` (in `shared/socket.ts`) which lazily calls `socket.connect()` if disconnected, so the next user action transparently reopens the socket.

**Type-file duplication:** `backend/src/types.ts` and `frontend/src/shared/types.ts` are duplicates, not shared via a package — when you change one, change the other in lockstep, or the wire contract drifts silently.

### Backend pipeline (`backend/src/`)

1. `index.ts` — Express + Socket.io bootstrap, CORS allowlist from `ALLOWED_ORIGINS`, `/api/health`, the persistent-engine + idle-timer logic above, and the `/api/puzzles/:id` proxy (24h in-memory cache capped at 1000 entries; validates id against `/^[A-Za-z0-9]{4,8}$/`; returns 503 if `RAPIDAPI_KEY` is unset).
2. `engine.ts` — `StockfishEngine` wraps `child_process.spawn` of the UCI binary. Line-buffered stdout via `EventEmitter`; helpers `waitFor` / `collectUntil` resolve on UCI sentinels (`uciok`, `readyok`, `bestmove`). `analyze(fen, depth, multiPv)` issues `setoption MultiPV`, `position fen`, `go depth`, then parses every `info` line and the terminal `bestmove`. The `bestmove` collector has a 120 s ceiling — generous for the default depth=14 multiPv=2, but worth knowing if you crank depth toward the 24 ceiling on slow hardware.
3. `analyzer.ts` — `analyzePosition(engine, fenBefore, uci, opts, ply, cachedBefore?)` is the unit: it analyzes both the before- and after-positions and returns a fully-classified `MoveAnalysis` plus the after-result (so the caller can pass it as the next ply's `cachedBefore` to halve engine calls). `analyzeGame` loops over the PGN ply-by-ply, threading `cachedBefore`. **Both the streaming run and `analyzeMove` go through `analyzePosition`** — keep that single path. Note the `getHeaders()` / `header()` shim — `chess.js` is pinned to `1.0.0-beta.8` and the API renamed between betas, so both names are tried at runtime.
4. `classify.ts` — pure functions; no I/O. Converts UCI scores to White-POV centipawns (mate scores collapse to ±10000−mate), applies the **lichess win-probability formula** `WP(cp) = 50 + 50·(2/(1+e^(-0.00368208·cp))−1)`, and buckets WP loss into the nine `MoveClassification` labels. `looksLikeSacrifice` is a heuristic (no full SEE) that fires when the moved piece sits attacked by a strictly-lower-value enemy and net material is negative. `inferBook` is a fake opening book — it tags moves with `ply < 12` and `|cp| ≤ 80` as `book` if the played UCI is among the engine's top MultiPV candidates. **Tweak the thresholds here, not in `analyzer.ts`.** If you change them, also update the table in `README.md`.

### Frontend layout (`frontend/src/`)

The frontend is split into four top-level directories. Don't reach across them with the wrong import depth — every page now sits two-or-three levels deep, which makes relative paths to `shared/` (and to `features/puzzles/`) longer than they used to be.

```
src/
  app/App.tsx           — BrowserRouter shell + global chrome (header, mobile topbar, settings modal, mobile bottom nav)
  hooks/useIsMobile.tsx — IsMobileProvider + useIsMobileContext (single matchMedia subscription for the whole tree)
  i18n/                 — i18next init + en.json/de.json bundles
  shared/               — cross-page code: components/, utils/, socket.ts, types.ts
  features/puzzles/     — self-contained puzzles feature (own README, styles.css, types, hooks, components, data)
  pages/
    review/
      ReviewPage.tsx    — picks desktop/mobile via useIsMobileContext, owns the shared review-state hook
      useReviewState.ts — the hook (move tree, socket sub, navigation, playback, branch creation)
      components/       — variant-agnostic review components (PgnLoader, MovesCard, GameMeta, AccuracyCard, AnalyzingCard, CommentBubble)
      desktop/ReviewDesktop.tsx + desktop/components/ (EvalBar, EvalChart, MoveList, PlayerStrip — desktop-only chrome)
      mobile/ReviewMobile.tsx
    puzzles/
      hub/PuzzleHubPage.tsx + hub/desktop/PuzzleHubDesktop.tsx + hub/mobile/PuzzleHubMobile.tsx
      solver/PuzzleSolverPage.tsx + solver/desktop/PuzzleSolverDesktop.tsx + solver/mobile/PuzzleSolverMobile.tsx
  main.tsx              — entry; imports './i18n' for side-effect init before <App/>, plus index.css + features/puzzles/styles.css
```

**Routing.** `app/App.tsx` is the BrowserRouter shell — wraps the tree in `IsMobileProvider`, mounts either the full `Header` (desktop) or the `cr-mobile-topbar` inline JSX (mobile), and renders the `MobileNav` bottom tab bar when `isMobile`. The three routes are:
- `/` → `pages/review/ReviewPage.tsx` (eagerly imported)
- `/puzzles` → `pages/puzzles/hub/PuzzleHubPage.tsx` (lazy)
- `/puzzles/:id` → `pages/puzzles/solver/PuzzleSolverPage.tsx` (lazy)

The puzzles bundle is code-split via `React.lazy` so review-only users never download the catalog JSONs.

**Viewport gate (`hooks/useIsMobile.tsx`).** A single `IsMobileProvider` (mounted in `App.tsx`) owns one `matchMedia('(max-width: 768px)')` subscription and broadcasts via context. Every consumer (AppLayout, ReviewPage, PuzzleHubPage, PuzzleSolverPage) reads through `useIsMobileContext` so the entire tree flips in the same render — using bare `useIsMobile()` in two places would briefly desync chrome and body at the breakpoint cross. Mobile variants are **lazy-loaded** (e.g. `ReviewMobile`, `PuzzleHubMobile`, `PuzzleSolverMobile`) so desktop users don't pay for them.

**Review state lives in `pages/review/useReviewState.ts`, hoisted above the desktop/mobile split.** `ReviewPage.tsx` calls `useReviewState({ orientation, setOrientation })` and threads the result (`ReviewState = ReturnType<typeof useReviewState>`) into whichever variant is mounted. This is **load-bearing**: if you let each variant own its own state, a desktop↔mobile breakpoint cross would tear down the move tree and the in-flight socket subscription. Only one variant is ever mounted at a time, so there's still exactly one socket listener. The hook also cancels the backend on unmount via a `statusRef` if a run was in-flight.

**Move tree, not flat array.** `shared/utils/tree.ts` defines an immutable `MoveTree` (`{ rootId, nodes: Record<NodeId, MoveNode> }`). Each node has `childrenIds[]`; index 0 is the mainline continuation, additional children are user-explored branches. `useReviewState` tracks `currentLine: NodeId[]` (root → ... → current) and `currentIdx`. Dragging a piece calls `addChild` with `pending: true`, emits `analyzeMove`, and replaces the placeholder via `updateMove` when the ack arrives. **During streaming the cursor does NOT auto-advance** — `currentLine` is only seeded to the full mainline when status flips to `'ready'`. Branch `analyzeMove` calls reuse the depth captured at analyze-time (the `analysisDepth` state), so changing the loader's depth slider after a game finishes does not affect branch evaluation depth.

**Socket connection (`shared/socket.ts`).** If `VITE_API_URL` is set at build time it's used as the origin (split deployment: Firebase Hosting frontend + Cloud Run backend). Otherwise the client connects to the current origin so the Vite proxy (`/socket.io` → `:3001`) covers dev. **Always call `ensureConnected()` before `socket.emit(...)`** — the backend's idle disconnect can put us into a server-disconnected state that won't auto-reconnect.

**Themes.** Four palettes (`wood`, `purple`, `ocean`, `lagoon`) × two modes (`light`, `dark`), applied as `theme-* mode-*` classes on `<html>`; all themable colors are CSS vars in `index.css`. Selection is persisted to `localStorage` under `chess-engine-settings` (separate from `chess-engine-muted` and the puzzle progress key — these are deliberately disjoint so one corrupt blob can't nuke another). `applyTheme` in `shared/utils/settings.ts` is the only writer of those classes.

**Mobile chrome.** The `cr-mobile-*` classes in `index.css` (topbar, bottom nav, page wrapper, eval chip, tabs, playback controls) are the mobile counterparts of the desktop `cr-*` classes. The mobile topbar is rendered inline in `app/App.tsx`; the bottom nav is `shared/components/MobileNav.tsx` (Review / Puzzles tabs + Settings button). Don't mix `cr-mobile-*` into desktop layouts — desktop never mounts the mobile tree.

**i18n.** `i18next` + `react-i18next`. Translation bundles live at `i18n/{en,de}.json` and ship with the JS bundle (`react: { useSuspense: false }` — no async loading). `main.tsx` imports `./i18n` for its side-effect init **before** any component renders, so `useTranslation` works on first paint. `Settings.language` is the single source of truth — `app/App.tsx` syncs `i18n.changeLanguage` to it; do not call `i18n.changeLanguage` elsewhere. The persisted default is `de`, with `detectBrowserLanguage()` (in `shared/utils/settings.ts`) as the fallback when no saved settings exist.

**Sounds.** `shared/utils/sounds.ts` synthesizes move/capture/check/checkmate/castle/error chirps with WebAudio — no audio files are bundled. Both the review page (only after a move is fully analyzed) and the puzzle solver (user moves, opponent replies, the punisher animation, reveal-step ticks, and a terminal check/buzzer) play them; the puzzle hub does not.

**Chess.com integration.** `shared/utils/chessCom.ts` calls `api.chess.com/pub/...` directly from the browser (CORS-enabled, no auth). The PgnLoader's "import from chess.com" flow uses it.

**`shared/components/Board.tsx`** wraps `react-chessboard` and overlays a classification badge using a manual `squareToPixel` calculation — the badge is positioned in CSS pixels relative to the board, so changing `boardSize` rescales it. `playableColor` locks drag to one side (used by the puzzle solver). `shared/components/ClassificationIcon.tsx` is the **single source of truth for classification colors and glyphs**; `tailwind.config.js`'s `review.*` palette must stay in sync.

**`shared/utils/winProb.ts`** duplicates `scoreToCp` / WP formula from the backend so the eval bar and chart can render without round-tripping. Keep the formulas identical.

### Puzzles feature (`frontend/src/features/puzzles/`)

Self-contained sub-feature with its own README at `frontend/src/features/puzzles/README.md` — that file is the source of truth for the feature's design (data pipeline, ELO formula, solver state machine, persistence schema). When working in this area, read that README first. Note: the README's directory diagram still refers to `pages/PuzzleHubPage.tsx` and `pages/PuzzleSolverPage.tsx`; the actual paths are now `pages/puzzles/hub/PuzzleHubPage.tsx` and `pages/puzzles/solver/PuzzleSolverPage.tsx` (each with `desktop/` + `mobile/` subdirectories).

Key shape notes that affect cross-feature work:
- **Bundled catalog.** `data/daily.json` + `data/themes.json` are imported eagerly by `api/catalog.ts` (inside the lazy puzzles chunk). The per-tier `data/catalog/{tier}.json` files are dynamic-imported via `loadTier(tier)` so each tier is its own chunk and the user only pays for the tiers they pick. Built by `scripts/build-catalog.ts` from the Lichess CSV (`SAMPLES_PER_TIER = 2000` → ~10K bundled puzzles total); do **not** hand-edit them. The build script also bakes `themeDifficulties` and `themeCountsByTier` into `themes.json` so `getThemeDifficulty`/`countByTheme` stay synchronous despite tier data being lazy.
- **Puzzle resolution order.** `fetchPuzzleById` checks the local catalog first; only IDs not in the catalog (daily picks, deep-link URLs) fall through to `/api/puzzles/:id` (which 503s without `RAPIDAPI_KEY`).
- **ELO is inverted on purpose.** Harder tiers reward more and punish less — see the multiplier tables in `features/puzzles/utils/elo.ts`. Worked-example fixtures are commented at the bottom of that file; if you change the constants, regenerate them.
- **Solver punisher.** When the user plays a wrong move, `usePuzzleSession` emits `analyzeMove` (depth 12 — lower than the mainline default; 8 s socket-ack timeout; 250 ms post-ack delay so the wrong-move piece settles before the punisher slides in) and the engine's best refutation animates on the board. This piggybacks on the same socket as the review page — there is no puzzle-specific channel. The fail-state board FEN is composed from `puzzle.fen` + replayed moves + `userWrongUci` + `punisherUci` (none of which live in `puzzle.moves`).
- **Hint levels.** `hintLevel: 0..3` (0 = none, 1 = from-square highlighted, 2 = from + to highlighted, 3 = no further visual). `hintUsed` is sticky across retry — using a hint forfeits the bonus for that puzzle permanently, even if the user later solves it cleanly.
- **ELO commit is one-shot per `puzzle.id`.** A `committedForRef` ref guards both StrictMode double-effects and retry-after-fail; same-id reload via `loadPuzzle` does NOT reset it. Daily puzzles also write into `dailyHistory[todayDateKey()]` so the calendar can render solved/failed cells.
- **Reveal cadence.** Remaining solution moves tick at `REVEAL_STEP_INTERVAL_MS` (1.2 s); each step plays its move sound.
- **Solver styling.** The solver and hub use semantic `.pz-*` classes defined in `features/puzzles/styles.css`, not Tailwind utilities. Don't move those styles into `index.css`. The mobile breakpoint overrides at the bottom of `styles.css` (`@media (max-width: 768px)`) collapse the daily card's two-column grid; the rest of the mobile chrome is built from generic `cr-mobile-*` classes in `index.css`.

### Per-ply data flow

`PGN string` → server `analyze` → `analyzer.ts` emits `start`, then one `progress` per ply (full `MoveAnalysis`: FENs before/after, both evals from White POV, best move UCI/SAN, second-best eval, classification, WP loss), then `complete` with accuracies → `useReviewState` appends each progress event into the move tree → desktop/mobile variants derive the displayed FEN, eval bar value, square highlights, arrows, and badge from the current node + `showingBest`. Branch moves take a parallel path: piece drag → `analyzeMove` ack → `updateMove` replaces the placeholder.

## Deployment

CI is wired through Cloud Build triggers on pushes to `main`:
- `backend/cloudbuild.yaml` — builds `backend/Dockerfile`, pushes to Artifact Registry, deploys to Cloud Run service `chess-engine-backend` (env vars and CPU/memory/concurrency are preserved across image-only updates; do **not** put secrets like `RAPIDAPI_KEY` in the Dockerfile — they live on the Cloud Run service config).
- `frontend/cloudbuild.yaml` — runs `npm run build` then `firebase deploy --only hosting` to site `chess-review-monte` (project `chess-engine-monte`, see `.firebaserc` / `firebase.json`). The Cloud Build service account already has `roles/firebasehosting.admin`.
- A `frontend/Dockerfile` + `nginx.conf` exist as an alternate Cloud Run path; the live deploy is Firebase Hosting.

In split prod, the frontend bundle needs `VITE_API_URL` baked in (Vite reads `frontend/.env.production` at build time) so `shared/socket.ts` connects to the Cloud Run backend.

The backend's idle-disconnect (`IDLE_TIMEOUT_MS`) is a Cloud Run cost-control measure — without it, an abandoned tab keeps a WebSocket open and pins an instance against the min-instances/concurrency settings. If you change the timeout or the disconnect mechanism, also revisit `ensureConnected()` on the client; the two are paired.

## Notes

- `ChessReview.html` at the repo root is a self-contained static **design mockup** that drove the 3-column redesign. It's not loaded by the app and not part of the build — treat it as a reference document, not source.
- `.mcp.json` is gitignored; if you see one locally with credentials, do not commit it.
