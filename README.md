# Chess Engine Review

A chess.com-style Game Review app built with **React + TypeScript + Tailwind** on the
front end and **Node.js + Express + Socket.io + Stockfish** on the back end.

Paste a PGN, click **Analyze**, and the server walks every position with Stockfish,
streaming per-move evaluations back over Socket.io. Each move is classified as one
of: `brilliant`, `great`, `best`, `good`, `ok`, `book`, `inaccuracy`, `mistake`,
or `blunder`. The UI shows a live eval bar, the move list with annotation icons,
the classified comment bubble, an eval-over-time chart, and navigation buttons.

```
ChessEngine/
├── backend/      Node + Express + Socket.io + Stockfish
└── frontend/     Vite + React + TS + Tailwind
```

## Prerequisites

- **Node.js 20+** and **npm 10+**
- **Stockfish** installed and on your `PATH` (or its absolute path passed via the
  `STOCKFISH_PATH` env var):
  - Windows: `winget install Stockfish.Stockfish` or download the binary from
    <https://stockfishchess.org/download/> and add its folder to `PATH`.
  - macOS: `brew install stockfish`
  - Linux: `sudo apt install stockfish` (or build from source)

Verify with `stockfish` in a terminal — you should see `Stockfish ... by ...`. Type
`quit` to exit.

## Install

From the project root:

```bash
npm install
```

This installs both workspaces in one shot.

## Run (dev)

```bash
npm run dev
```

This boots:

- the backend on <http://localhost:3001>
- the Vite dev server on <http://localhost:5173>

Open the Vite URL, paste a PGN, click **Analyze**.

### Configuring the engine

Set environment variables before `npm run dev` (or place them in a `.env` file
inside `backend/`):

| Variable           | Default      | Description                                    |
| ------------------ | ------------ | ---------------------------------------------- |
| `PORT`             | `3001`       | Backend HTTP/WS port                           |
| `STOCKFISH_PATH`   | `stockfish`  | Path to the Stockfish binary                   |
| `STOCKFISH_THREADS`| `2`          | UCI Threads option                             |
| `STOCKFISH_HASH_MB`| `128`        | UCI Hash size in MB                            |
| `DEFAULT_DEPTH`    | `14`         | Search depth per position (override per-game)  |

## Build

```bash
npm run build
```

The backend compiles to `backend/dist`, the frontend to `frontend/dist`.

## How move classification works

For each ply we compute the position eval (from White's POV) before and after the
move, plus the engine's top two PVs. We convert centipawns to a 0–100 win
probability with the lichess formula `WP(cp) = 50 + 50·(2/(1+e^(-0.00368208·cp))−1)`,
take the WP delta from the moving side's POV, and bucket it:

| WP loss   | Class        |
| --------- | ------------ |
| <2%       | good         |
| <5%       | ok           |
| <10%      | inaccuracy   |
| <20%      | mistake      |
| ≥20%      | blunder      |

If the move equals the engine's #1 it gets `best`. If it's `best` and **only**
that move keeps the position (the second PV is much worse), it's `great`. If it's
`great` (or `best` with eval still favoring the mover) **and** the moved piece
lands on a square attacked by a less-valuable enemy piece, it's `brilliant`. The
first ~12 plies are tagged `book` if every move is among Stockfish's top-3 lines
with negligible WP loss.
