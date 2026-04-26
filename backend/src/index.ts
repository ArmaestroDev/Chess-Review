// CI smoke test — verifies the deploy-backend trigger fires on push.
import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server, Socket } from 'socket.io';
import { StockfishEngine } from './engine';
import { analyzeGame, analyzePosition } from './analyzer';
import { AnalysisEvent, MoveAnalysis } from './types';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const STOCKFISH_PATH = process.env.STOCKFISH_PATH ?? 'stockfish';
const THREADS = parseInt(process.env.STOCKFISH_THREADS ?? '2', 10);
const HASH_MB = parseInt(process.env.STOCKFISH_HASH_MB ?? '128', 10);
const DEFAULT_DEPTH = parseInt(process.env.DEFAULT_DEPTH ?? '14', 10);
const IDLE_TIMEOUT_MS = parseInt(process.env.IDLE_TIMEOUT_MS ?? '600000', 10);

// Comma-separated list. In dev (no env var) we fall back to the Vite dev-server
// origin so `npm run dev` still works. In prod, set this to the deployed
// frontend URL via the Cloud Run --update-env-vars flag.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const app = express();
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, stockfishPath: STOCKFISH_PATH });
});

// ---- Chess puzzles proxy ----------------------------------------------
// Forwards GET /api/puzzles/:id to chess-puzzles.p.rapidapi.com, attaching
// the RapidAPI key server-side so it never reaches the browser. A small
// in-memory cache (24h TTL, capped at 1000 entries) absorbs repeat hits.

const RAPIDAPI_HOST = 'chess-puzzles.p.rapidapi.com';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const PUZZLE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PUZZLE_CACHE_MAX = 1000;
const puzzleCache = new Map<string, { data: unknown; expires: number }>();

function prunePuzzleCache(): void {
  if (puzzleCache.size <= PUZZLE_CACHE_MAX) return;
  const overflow = puzzleCache.size - PUZZLE_CACHE_MAX;
  let dropped = 0;
  for (const k of puzzleCache.keys()) {
    puzzleCache.delete(k);
    if (++dropped >= overflow) break;
  }
}

app.get('/api/puzzles/:id', async (req, res) => {
  const id = req.params.id;
  if (!/^[A-Za-z0-9]{4,8}$/.test(id)) {
    res.status(400).json({ error: 'Invalid puzzle id format' });
    return;
  }
  if (!RAPIDAPI_KEY) {
    res.status(503).json({ error: 'RAPIDAPI_KEY not configured on server' });
    return;
  }

  const cached = puzzleCache.get(id);
  if (cached && cached.expires > Date.now()) {
    res.json(cached.data);
    return;
  }

  try {
    const upstream = await fetch(
      `https://${RAPIDAPI_HOST}/?id=${encodeURIComponent(id)}`,
      {
        headers: {
          'x-rapidapi-host': RAPIDAPI_HOST,
          'x-rapidapi-key': RAPIDAPI_KEY,
        },
      },
    );
    if (!upstream.ok) {
      res.status(upstream.status).json({
        error: `Upstream returned ${upstream.status}`,
      });
      return;
    }
    const data = await upstream.json();
    puzzleCache.set(id, { data, expires: Date.now() + PUZZLE_CACHE_TTL_MS });
    prunePuzzleCache();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS },
  maxHttpBufferSize: 5 * 1024 * 1024,
});

interface AnalyzeMoveAck {
  ok: boolean;
  move?: MoveAnalysis;
  error?: string;
}

io.on('connection', (socket: Socket) => {
  console.log(`[ws] client ${socket.id} connected`);

  // Engine is created lazily and kept alive across analyze + analyzeMove
  // calls on this socket. It's only torn down on cancel or disconnect so
  // the user can drag pieces and get instant branch evaluations after the
  // main analysis completes.
  let engine: StockfishEngine | null = null;
  let engineQueue: Promise<void> = Promise.resolve();
  let cancelled = false;

  // Close abandoned WebSockets so Cloud Run can scale the instance to zero.
  // socket.disconnect() (no transport close) yields reason 'io server disconnect'
  // on the client, which suppresses Socket.io's auto-reconnect — a stale tab
  // does not immediately rebound and rebill. The client must explicitly call
  // socket.connect() to come back, which it does lazily on next user action.
  let idleTimer: NodeJS.Timeout | null = null;
  function resetIdleTimer(): void {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      console.log(`[ws] client ${socket.id} idle ${IDLE_TIMEOUT_MS}ms — disconnecting`);
      socket.disconnect();
    }, IDLE_TIMEOUT_MS);
  }
  resetIdleTimer();

  async function ensureEngine(): Promise<StockfishEngine> {
    if (engine) return engine;
    const e = new StockfishEngine(STOCKFISH_PATH);
    e.on('error', (err: Error) => {
      socket.emit('analysis:event', {
        type: 'error',
        message:
          `Stockfish failed at "${STOCKFISH_PATH}": ${err.message}. ` +
          `Install Stockfish or set STOCKFISH_PATH.`,
      } satisfies AnalysisEvent);
    });
    await e.init(THREADS, HASH_MB);
    engine = e;
    return e;
  }

  function teardownEngine() {
    engine?.quit();
    engine = null;
  }

  socket.on(
    'analyze',
    async (payload: { pgn?: string; depth?: number }) => {
      resetIdleTimer();
      if (!payload?.pgn || typeof payload.pgn !== 'string') {
        socket.emit('analysis:event', {
          type: 'error',
          message: 'Missing or invalid PGN',
        } satisfies AnalysisEvent);
        return;
      }

      // Tear down any previous engine; main-line analysis wants a fresh one
      // to clear hash and start clean.
      teardownEngine();
      cancelled = false;

      const depth = clampInt(payload.depth ?? DEFAULT_DEPTH, 6, 24);

      try {
        const e = await ensureEngine();
        // Serialize work behind the engineQueue so analyzeMove calls don't
        // race the main analysis loop on stdin/stdout.
        const job = engineQueue.then(() =>
          analyzeGame(payload.pgn!, e, { depth, multiPv: 2 }, (event) => {
            if (cancelled) return;
            socket.emit('analysis:event', event);
          }),
        );
        engineQueue = job.catch(() => undefined);
        await job;
      } catch (err) {
        socket.emit('analysis:event', {
          type: 'error',
          message: (err as Error).message,
        } satisfies AnalysisEvent);
      }
    },
  );

  socket.on(
    'analyzeMove',
    async (
      payload: { fenBefore?: string; uci?: string; depth?: number; ply?: number },
      ack: (result: AnalyzeMoveAck) => void,
    ) => {
      resetIdleTimer();
      if (typeof ack !== 'function') return;
      try {
        if (!payload?.fenBefore || !payload?.uci) {
          ack({ ok: false, error: 'Missing fenBefore or uci' });
          return;
        }
        const depth = clampInt(payload.depth ?? DEFAULT_DEPTH, 6, 24);
        const ply = Math.max(0, payload.ply ?? 0);
        const e = await ensureEngine();
        const job = engineQueue.then(() =>
          analyzePosition(e, payload.fenBefore!, payload.uci!, { depth, multiPv: 2 }, ply),
        );
        engineQueue = job.then(
          () => undefined,
          () => undefined,
        );
        const { move } = await job;
        ack({ ok: true, move });
      } catch (err) {
        ack({ ok: false, error: (err as Error).message });
      }
    },
  );

  socket.on('cancel', () => {
    resetIdleTimer();
    cancelled = true;
    teardownEngine();
  });

  socket.on('disconnect', () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    cancelled = true;
    teardownEngine();
    console.log(`[ws] client ${socket.id} disconnected`);
  });
});

server.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(`[server] using Stockfish at: ${STOCKFISH_PATH}`);
});

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}
