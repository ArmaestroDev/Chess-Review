import { useLayoutEffect, useState, type CSSProperties } from 'react';

/**
 * Centralized layout + scaling system.
 *
 * THIS FILE IS THE SINGLE SOURCE OF TRUTH for every desktop sizing decision.
 * Any scaling question — "how wide is a sidebar?", "how big is the board?",
 * "how does the UI react to browser zoom?" — is answered here, nowhere else.
 *
 * ── The problem this solves ───────────────────────────────────────────────
 * The desktop UI is a fixed pixel design (fixed-width side columns + fixed-px
 * Tailwind typography). It only looked correct at one effective viewport size
 * (browser 100% on the author's display). Browser zoom changes the *effective*
 * CSS-pixel viewport, so:
 *   - low zoom  → huge viewport → tiny board stranded in empty background
 *   - 100% zoom → viewport ≈ reference design → everything fits
 *   - high zoom → small viewport → fixed columns overflow, layout breaks
 *
 * ── The fix: a uniform "design canvas" ────────────────────────────────────
 * Rather than make every component fluid (a huge, risky refactor), we keep the
 * pixel-perfect reference design and uniformly scale the whole desktop shell
 * with CSS `zoom` so it always fits the real viewport — preserving the
 * known-good 100% look at every zoom level / window size.
 *
 * `zoom` (not `transform: scale`) is deliberate: it participates in layout and
 * hit-testing, so sticky headers, internal scroll columns, and react-chessboard
 * drag math all keep working in scaled space with crisp text. Modals stay
 * OUTSIDE the zoomed wrapper (they use viewport-fixed positioning).
 *
 * Mobile is already fluid (single column, aspect-ratio board) and is NEVER
 * scaled — `computeUiScale` returns 1 on mobile and AppLayout skips the canvas.
 */

/** Mobile breakpoint, kept in sync with hooks/useIsMobile.tsx. */
export const MOBILE_MAX_WIDTH = 768;

/**
 * Fixed design-space dimensions. These are CSS px in the *unscaled* design
 * coordinate space — the canvas scales as a whole, so these never change with
 * the viewport. Tweak scaling behaviour by editing these numbers only.
 */
export const LAYOUT = {
  /** Content is centered and capped at this width (everything wider = gutter). */
  maxContentWidth: 1600,
  /** Left info column (chess.com / progress / activity). */
  leftCol: 320,
  /** Right info column (daily / recent / solver panels). */
  rightCol: 360,
  /** Gap between the three grid columns. */
  gridGap: 20,
  /** Horizontal page padding (px-7 → 28px each side). */
  horizPad: 28,
  /** Slim eval-bar column + its gap, present on the review board only. */
  evalGap: 32,
  /** Desktop header height (Header.tsx: py-3.5 + ~36px content). */
  headerHeight: 64,
  /** Player strips above/below the board + their gaps. */
  stripsReserve: 120,
  /** Grid vertical padding (py-5 → 20px top+bottom) plus slack. */
  vertPad: 40,
  /** Board floor — never shrink the board below this. */
  boardMin: 320,
  /** Board ceiling on the review page. */
  boardMaxReview: 720,
  /** Board ceiling on the puzzle hub (no eval bar → a touch larger). */
  boardMaxHub: 840,
} as const;

/**
 * Reference design size the canvas is fitted into. Derived from the
 * known-good 100%-zoom layout: ~1600 content + side gutters wide, and
 * header + padding + strips + ideal board tall. The UI scale is chosen so
 * this rectangle just fits the real viewport.
 */
export const REFERENCE = {
  width: 1664,
  height: 940,
} as const;

/**
 * UI-scale clamp. Below MIN the design would be unusably small; above MAX it
 * gets cartoonishly large. Widen this range to be more aggressive about
 * filling huge viewports / surviving extreme zoom.
 */
export const UI_SCALE_MIN = 0.5;
export const UI_SCALE_MAX = 1.6;

/**
 * The uniform scale factor for the desktop shell. `min(fitW, fitH)` keeps the
 * whole reference design visible (letterboxing the spare axis), clamped to a
 * sane range. Always 1 on mobile (and SSR), so callers can apply it
 * unconditionally.
 */
export function computeUiScale(
  viewportW: number,
  viewportH: number,
  isMobile: boolean,
): number {
  if (isMobile) return 1;
  const fit = Math.min(
    viewportW / REFERENCE.width,
    viewportH / REFERENCE.height,
  );
  return clamp(fit, UI_SCALE_MIN, UI_SCALE_MAX);
}

/**
 * Design-space canvas the scaled shell occupies. `zoom: scale` renders a
 * `width × height` design-px box at exactly `viewportW × viewportH` real px,
 * so the canvas always covers the viewport precisely (no rounding gaps).
 */
export interface UiCanvas {
  scale: number;
  /** Canvas width in design px (viewportW / scale). */
  width: number;
  /** Canvas height in design px (viewportH / scale). */
  height: number;
}

export function computeCanvas(
  viewportW: number,
  viewportH: number,
  isMobile: boolean,
): UiCanvas {
  const scale = computeUiScale(viewportW, viewportH, isMobile);
  return {
    scale,
    width: viewportW / scale,
    height: viewportH / scale,
  };
}

/**
 * The single board-sizing formula, shared by ReviewDesktop and
 * PuzzleHubDesktop. Operates entirely in design space (the canvas dims), so
 * the constants in LAYOUT stay meaningful regardless of browser zoom.
 *
 * Previously this exact formula was copy-pasted into both pages with magic
 * numbers that also had to be kept in sync with the CSS grid templates — the
 * drift hazard called out in CLAUDE.md. There is now one copy.
 */
export function computeBoardSize(
  canvasW: number,
  canvasH: number,
  opts: { hasEvalGap: boolean },
): number {
  const usableW = Math.min(canvasW, LAYOUT.maxContentWidth);
  const evalGap = opts.hasEvalGap ? LAYOUT.evalGap : 0;
  const availW =
    usableW -
    LAYOUT.leftCol -
    LAYOUT.rightCol -
    LAYOUT.gridGap * 2 -
    LAYOUT.horizPad * 2 -
    evalGap;
  const availH =
    canvasH - LAYOUT.headerHeight - LAYOUT.stripsReserve - LAYOUT.vertPad;
  const cap = opts.hasEvalGap ? LAYOUT.boardMaxReview : LAYOUT.boardMaxHub;
  return Math.floor(
    Math.max(LAYOUT.boardMin, Math.min(availW, availH, cap)),
  );
}

/**
 * Writes the layout constants as CSS custom properties on :root so CSS grid
 * templates / max-widths consume the SAME numbers the JS formula uses. Killing
 * the literal `320px … 360px` / `max-w-[1600px]` duplication is what removes
 * the drift hazard for good. Constants are design-space, so this runs once.
 */
export function applyLayoutCssVars(): void {
  if (typeof document === 'undefined') return;
  const s = document.documentElement.style;
  s.setProperty('--lyt-col-left', `${LAYOUT.leftCol}px`);
  s.setProperty('--lyt-col-right', `${LAYOUT.rightCol}px`);
  s.setProperty('--lyt-gap', `${LAYOUT.gridGap}px`);
  s.setProperty('--lyt-pad-x', `${LAYOUT.horizPad}px`);
  s.setProperty('--lyt-maxw', `${LAYOUT.maxContentWidth}px`);
}

// Publish the layout vars at module-evaluation time too. main.tsx evaluates
// App (→ this module) before it imports the CSS, so the vars are guaranteed
// present on :root before any grid-template / max-width rule first applies —
// no first-paint reflow, and no need to duplicate the numbers as CSS
// fallbacks (which would defeat the single-source-of-truth goal).
applyLayoutCssVars();

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function readViewport(): { w: number; h: number } {
  if (typeof window === 'undefined') {
    return { w: REFERENCE.width, h: REFERENCE.height };
  }
  return { w: window.innerWidth, h: window.innerHeight };
}

/**
 * Subscribes to viewport resize and returns the current design canvas. Also
 * publishes `--ui-scale` on :root (handy for any CSS that wants it) and, on
 * first run, the layout CSS vars. `isMobile` is threaded in (from the shared
 * IsMobile context) so we never scale the mobile layout.
 *
 * Used by AppLayout to drive the zoom wrapper.
 */
export function useUiCanvas(isMobile: boolean): UiCanvas {
  const [vp, setVp] = useState(readViewport);

  useLayoutEffect(() => {
    applyLayoutCssVars();
    function onResize() {
      setVp(readViewport());
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const canvas = computeCanvas(vp.w, vp.h, isMobile);

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.style.setProperty(
      '--ui-scale',
      String(canvas.scale),
    );
  }, [canvas.scale]);

  return canvas;
}

/**
 * Inline style for the desktop zoom wrapper. Renders the design-space canvas
 * at exactly the real viewport size. Returns `undefined` on mobile so the
 * wrapper is a no-op pass-through there.
 */
export function canvasStyle(
  canvas: UiCanvas,
  isMobile: boolean,
): CSSProperties | undefined {
  if (isMobile) return undefined;
  return {
    zoom: canvas.scale,
    width: `${canvas.width}px`,
    height: `${canvas.height}px`,
  } as CSSProperties;
}

/**
 * Board size (design px) for the desktop layouts. Self-contained: subscribes
 * to resize and computes via the shared formula. `hasEvalGap` = true for the
 * review board (slim eval bar to its left), false for the puzzle hub.
 *
 * Replaces the duplicated useEffect/window-listener blocks the two desktop
 * pages used to carry.
 */
export function useBoardSize(hasEvalGap: boolean): number {
  const [size, setSize] = useState(() => {
    const { w, h } = readViewport();
    // Desktop-only consumers, but compute defensively at scale 1.
    const canvas = computeCanvas(w, h, false);
    return computeBoardSize(canvas.width, canvas.height, { hasEvalGap });
  });

  useLayoutEffect(() => {
    function update() {
      const { w, h } = readViewport();
      const canvas = computeCanvas(w, h, false);
      setSize(computeBoardSize(canvas.width, canvas.height, { hasEvalGap }));
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [hasEvalGap]);

  return size;
}
