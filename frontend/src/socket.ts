import { io, Socket } from 'socket.io-client';
import type { AnalysisEvent, MoveAnalysis } from './types';

export interface AnalyzeMoveAck {
  ok: boolean;
  move?: MoveAnalysis;
  error?: string;
}

export interface ServerToClientEvents {
  'analysis:event': (event: AnalysisEvent) => void;
}

export interface ClientToServerEvents {
  analyze: (payload: { pgn: string; depth?: number }) => void;
  analyzeMove: (
    payload: { fenBefore: string; uci: string; depth?: number; ply: number },
    ack: (result: AnalyzeMoveAck) => void,
  ) => void;
  cancel: () => void;
}

// Dev: VITE_API_URL is unset — connect to current origin so the Vite proxy
// at /socket.io forwards to the backend on :3001.
// Prod (split deployment, e.g. Cloud Run): VITE_API_URL is the backend's
// public https URL, baked in at `vite build` time.
const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = apiUrl
  ? io(apiUrl, {
      path: '/socket.io',
      autoConnect: true,
      transports: ['websocket', 'polling'],
    })
  : io({
      path: '/socket.io',
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });
