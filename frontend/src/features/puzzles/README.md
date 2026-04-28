# Chess Puzzles feature

## Architecture

```
frontend/
  scripts/
    build-catalog.ts            # one-shot Lichess CSV → per-tier JSON
  src/
    pages/
      PuzzleHubPage.tsx
      PuzzleSolverPage.tsx
    features/puzzles/
      README.md                 # this file
      types.ts                  # Puzzle, PuzzleAttempt, EloState, ...
      styles.css                # .pz-* classes used by hub + solver
      api/
        fetchPuzzle.ts          # GET /api/puzzles/:id
        catalog.ts              # picks an ID by tier/theme
      hooks/
        usePuzzleSession.ts     # solver state machine
        useElo.ts               # localStorage-backed rating
        useDailyPuzzle.ts       # date-seeded daily pick
      utils/
        elo.ts                  # pure rating math
        validateSolution.ts     # pure UCI/mate matcher
        difficulty.ts           # tier ↔ rating range
        puzzleProgress.ts       # localStorage history + stats blob
        i18nHelpers.ts          # tier/theme label translation hooks
      components/
        hub/                    # PuzzleHubPage child components
        solver/                 # PuzzleSolverPage child components
      data/                     # ⬇ produced by build-catalog
        themes.json             # canonical theme list + per-tier counts
        daily.json              # ~365 hand-picked daily puzzle IDs
        catalog/
          beginner.json
          easy.json
          medium.json
          hard.json
          expert.json
```

## Data source

The catalog is pre-processed at build time from the public Lichess puzzle
database, which Lichess publishes monthly under CC0:

  https://database.lichess.org/lichess_db_puzzle.csv.zst

Schema (10 columns):

  PuzzleId, FEN, Moves, Rating, RatingDeviation, Popularity, NbPlays,
  Themes, GameUrl, OpeningTags

`FEN` is the position **before** the opponent's setup move. `Moves` is a
space-separated UCI sequence; index 0 is the opponent's setup, then
alternating user/opponent. The user solves from the position **after**
`Moves[0]` is applied.

## Difficulty tiers

| Tier      | Rating range |
|-----------|--------------|
| Beginner  | ≤ 1000       |
| Easy      | 1000–1399    |
| Medium    | 1400–1799    |
| Hard      | 1800–2199    |
| Expert    | ≥ 2200       |

## ELO formula (inverted)

Starting rating: **600**. Floor: 100. Ceiling: 3000.

```
delta_solve = round( BASE_GAIN × T_solve(tier) × G_solve(R_puz - R_user) )
delta_loss  = round( BASE_LOSS × T_loss(tier)  × G_loss(R_puz - R_user)  )

BASE_GAIN = 20    BASE_LOSS = 15
G_solve(gap) = clamp(1 + gap/400, 0.5, 2.0)
G_loss(gap)  = clamp(1 - gap/400, 0.4, 1.6)
```

| Tier      | T_solve | T_loss |
|-----------|---------|--------|
| Beginner  | 0.50    | 1.50   |
| Easy      | 0.75    | 1.25   |
| Medium    | 1.00    | 1.00   |
| Hard      | 1.40    | 0.65   |
| Expert    | 1.80    | 0.40   |

The inversion lives in the multiplier table: harder tiers reward more on
solve and punish less on fail. Hint reveal forfeits gain and halves the
loss; full solution reveal counts as a fail with full loss.

## Solver state machine

```
idle
  └─ start(id)             → loading
loading
  ├─ loaded                → awaiting-user-move (after auto-playing Moves[0])
  └─ error                 → idle
awaiting-user-move
  ├─ user-move (correct)   → animating-opponent-reply | completed-success
  ├─ user-move (wrong)     → completed-fail
  ├─ hint                  → awaiting-user-move (hintUsed = true)
  ├─ reveal                → completed-revealed
  └─ abandon (>= 1 attempt)→ completed-fail
animating-opponent-reply (~400ms)
  └─                       → awaiting-user-move
completed-{success,fail,revealed}
  ├─ next                  → loading (new puzzle)
  ├─ retry                 → awaiting-user-move (no further ELO impact)
  └─ abandon               → idle
```

A move is correct iff its UCI matches the expected UCI **or** it delivers
checkmate (Lichess convention: any mate-in-1 counts).

## Persistence

localStorage key: `chess-engine-puzzles` (separate from `chess-engine-settings`
so a corrupt settings blob doesn't nuke puzzle progress).

```
{
  schemaVersion: 1,
  elo: 600,
  history: PuzzleAttempt[]    // capped at 500, FIFO
  stats: {
    solved: number, failed: number,
    byTier: { beginner: { solved, failed }, ... }
  },
  dailyHistory: { [yyyy-mm-dd]: PuzzleAttempt },
  lastSeenPuzzleIds: string[],
  scoredPuzzleIds: string[]   // ids that already counted toward ELO
}
```

### No-rescore rule

`scoredPuzzleIds` tracks every puzzle id whose attempt has already moved the
user's ELO. A second attempt of the same id commits with `delta = 0` (still
recorded in `history`; ELO unchanged). Once the list reaches
`SCORED_CYCLE_LIMIT = 2000` distinct ids, the next new attempt clears it back
to `[id]` so the user can re-earn points on previously seen puzzles. The
delta=0 decision lives in `usePuzzleSession`'s commit-elo effect; the cycle
reset lives in `appendAttempt` (`utils/puzzleProgress.ts`).

## Backend proxy

The RapidAPI key is server-side only. The backend exposes:

  GET /api/puzzles/:id

which proxies to `chess-puzzles.p.rapidapi.com/?id=<id>` using the
`RAPIDAPI_KEY` env var. The frontend never sees the key. See
`backend/src/index.ts` (Phase 1).

## Refreshing the catalog

The catalog refreshes monthly to track new Lichess puzzles. Requires `zstd`
CLI on PATH (preinstalled on macOS via `brew install zstd`, on Windows via
`winget install zstd`, on Debian/Ubuntu via `apt install zstd`).

```
npm run build:catalog -w frontend
```

Quality gates applied during build:
- `Popularity ≥ 80` (community-vetted)
- `NbPlays ≥ 1000` (statistically settled rating)
- ~2000 puzzles sampled per tier via reservoir sampling for variety (~10K total)

The script downloads `lichess_db_puzzle.csv.zst` (~70MB) into
`frontend/.cache/`, decompresses via streaming `zstd -d -c`, and writes
the per-tier JSON files into `frontend/src/features/puzzles/data/`.
Re-runs use the cached download if present.

## Open questions tracked here

- API field-name casing — confirm against a live RapidAPI response when
  the upstream recovers from its current 522. Fields are assumed to mirror
  the CSV column names.
- Multi-line tolerance — single-line + any-mate-correct only for v1.
