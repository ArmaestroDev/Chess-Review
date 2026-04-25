import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { EventEmitter } from 'events';
import { AnalysisResult, PvInfo, UciScore } from './types';

/**
 * Spawns a Stockfish UCI engine subprocess and exposes a small async API.
 * The caller is responsible for awaiting init() before issuing analyze() calls,
 * and calling quit() when done.
 */
export class StockfishEngine extends EventEmitter {
  private proc: ChildProcessWithoutNullStreams;
  private buffer = '';
  private dead = false;

  constructor(stockfishPath: string) {
    super();
    this.proc = spawn(stockfishPath, [], { stdio: ['pipe', 'pipe', 'pipe'] });

    this.proc.stdout.setEncoding('utf8');
    this.proc.stdout.on('data', (chunk: string) => {
      this.buffer += chunk;
      const lines = this.buffer.split(/\r?\n/);
      this.buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) this.emit('line', trimmed);
      }
    });

    this.proc.stderr.on('data', (chunk: Buffer) => {
      // Stockfish does not normally write to stderr; surface anything for debugging
      process.stderr.write(`[stockfish:stderr] ${chunk.toString('utf8')}`);
    });

    this.proc.on('error', (err) => {
      this.dead = true;
      this.emit('error', err);
    });

    this.proc.on('exit', (code) => {
      this.dead = true;
      this.emit('exit', code);
    });
  }

  send(cmd: string): void {
    if (this.dead) throw new Error('Engine is no longer running');
    this.proc.stdin.write(cmd + '\n');
  }

  private waitFor(predicate: (line: string) => boolean, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off('line', handler);
        reject(new Error(`Engine timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      const handler = (line: string) => {
        if (predicate(line)) {
          clearTimeout(timer);
          this.off('line', handler);
          resolve(line);
        }
      };
      this.on('line', handler);
    });
  }

  private collectUntil(
    stopPredicate: (line: string) => boolean,
    timeoutMs: number,
  ): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const collected: string[] = [];
      const timer = setTimeout(() => {
        this.off('line', handler);
        reject(new Error(`Engine timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      const handler = (line: string) => {
        collected.push(line);
        if (stopPredicate(line)) {
          clearTimeout(timer);
          this.off('line', handler);
          resolve(collected);
        }
      };
      this.on('line', handler);
    });
  }

  async init(threads = 2, hashMb = 128): Promise<void> {
    this.send('uci');
    await this.waitFor((l) => l === 'uciok', 10_000);
    this.send(`setoption name Threads value ${threads}`);
    this.send(`setoption name Hash value ${hashMb}`);
    this.send('isready');
    await this.waitFor((l) => l === 'readyok', 10_000);
  }

  async newGame(): Promise<void> {
    this.send('ucinewgame');
    this.send('isready');
    await this.waitFor((l) => l === 'readyok', 10_000);
  }

  async setMultiPv(value: number): Promise<void> {
    this.send(`setoption name MultiPV value ${value}`);
    this.send('isready');
    await this.waitFor((l) => l === 'readyok', 10_000);
  }

  async analyze(fen: string, depth: number, multiPv = 1): Promise<AnalysisResult> {
    await this.setMultiPv(multiPv);
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}`);
    const lines = await this.collectUntil(
      (l) => l.startsWith('bestmove'),
      // depth 14 with multiPv 2 is usually well under 5s; give a generous ceiling
      120_000,
    );
    return parseAnalysis(lines);
  }

  quit(): void {
    if (this.dead) return;
    try {
      this.send('quit');
    } catch {
      // ignore
    }
    this.proc.kill();
    this.dead = true;
  }
}

function parseAnalysis(lines: string[]): AnalysisResult {
  let bestMove: string | null = null;
  let ponder: string | null = null;
  const pvByIndex = new Map<number, PvInfo>();

  for (const line of lines) {
    if (line.startsWith('bestmove')) {
      const parts = line.split(/\s+/);
      bestMove = parts[1] && parts[1] !== '(none)' ? parts[1] : null;
      const pIdx = parts.indexOf('ponder');
      if (pIdx !== -1) ponder = parts[pIdx + 1] ?? null;
      continue;
    }
    if (!line.startsWith('info ')) continue;

    const tokens = line.split(/\s+/);
    let multipv = 1;
    let depth = 0;
    let cp: number | undefined;
    let mate: number | undefined;
    let pv: string[] = [];

    for (let i = 1; i < tokens.length; i++) {
      const t = tokens[i];
      if (t === 'multipv') multipv = parseInt(tokens[++i], 10);
      else if (t === 'depth') depth = parseInt(tokens[++i], 10);
      else if (t === 'score') {
        const stype = tokens[++i];
        const v = parseInt(tokens[++i], 10);
        if (stype === 'cp') cp = v;
        else if (stype === 'mate') mate = v;
      } else if (t === 'pv') {
        pv = tokens.slice(i + 1);
        break;
      }
    }

    if (pv.length === 0) continue;
    const score: UciScore = {};
    if (cp !== undefined) score.cp = cp;
    if (mate !== undefined) score.mate = mate;

    const existing = pvByIndex.get(multipv);
    if (!existing || existing.depth <= depth) {
      pvByIndex.set(multipv, { multipv, depth, score, pv });
    }
  }

  return {
    bestMove,
    ponder,
    pvs: Array.from(pvByIndex.values()).sort((a, b) => a.multipv - b.multipv),
  };
}
