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
    cancelled = true;
    teardownEngine();
  });

  socket.on('disconnect', () => {
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
