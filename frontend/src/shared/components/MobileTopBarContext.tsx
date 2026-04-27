import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type Action = (() => void) | null;

interface ReaderValue {
  flipAvailable: boolean;
  clearAvailable: boolean;
  invokeFlip: () => void;
  invokeClear: () => void;
  // Pages can request that the bottom MobileNav be hidden (e.g. the mobile
  // review's analyze mode wants the page to feel immersive). App reads this
  // flag and unmounts MobileNav when true. The flag is the OR of all active
  // hide-requests so multiple consumers compose safely (ref-counted).
  hideBottomNav: boolean;
}

interface WriterValue {
  setActions: (actions: { flipBoard: Action; clearBoard: Action }) => void;
  // Each consumer that wants the nav hidden calls requestHide() in a mount
  // effect and releaseHide() in cleanup. Counter sums all live requests so
  // an unmounting consumer can't yank the nav back while another still wants
  // it hidden, and a remount race can't leave a stale "hide" stuck on.
  requestHide: () => void;
  releaseHide: () => void;
}

const ReaderContext = createContext<ReaderValue | null>(null);
const WriterContext = createContext<WriterValue | null>(null);

export function MobileTopBarProvider({ children }: { children: ReactNode }) {
  const flipRef = useRef<Action>(null);
  const clearRef = useRef<Action>(null);
  const [flipAvailable, setFlipAvailable] = useState(false);
  const [clearAvailable, setClearAvailable] = useState(false);
  const [hideCount, setHideCount] = useState(0);

  const setActions = useCallback(
    ({ flipBoard, clearBoard }: { flipBoard: Action; clearBoard: Action }) => {
      flipRef.current = flipBoard;
      clearRef.current = clearBoard;
      setFlipAvailable(flipBoard !== null);
      setClearAvailable(clearBoard !== null);
    },
    [],
  );

  const requestHide = useCallback(() => {
    setHideCount((n) => n + 1);
  }, []);
  const releaseHide = useCallback(() => {
    // Math.max guards against an extra release during a buggy double-cleanup;
    // the counter never goes negative.
    setHideCount((n) => Math.max(0, n - 1));
  }, []);

  const invokeFlip = useCallback(() => {
    flipRef.current?.();
  }, []);
  const invokeClear = useCallback(() => {
    clearRef.current?.();
  }, []);

  const hideBottomNav = hideCount > 0;
  const reader = useMemo<ReaderValue>(
    () => ({
      flipAvailable,
      clearAvailable,
      invokeFlip,
      invokeClear,
      hideBottomNav,
    }),
    [flipAvailable, clearAvailable, invokeFlip, invokeClear, hideBottomNav],
  );
  const writer = useMemo<WriterValue>(
    () => ({ setActions, requestHide, releaseHide }),
    [setActions, requestHide, releaseHide],
  );

  return (
    <ReaderContext.Provider value={reader}>
      <WriterContext.Provider value={writer}>{children}</WriterContext.Provider>
    </ReaderContext.Provider>
  );
}

export function useMobileTopBar(): ReaderValue {
  const ctx = useContext(ReaderContext);
  if (!ctx) {
    throw new Error('useMobileTopBar must be used inside MobileTopBarProvider');
  }
  return ctx;
}

// Per-render publish: every mount overwrites whatever the previous mount left
// behind, so we don't need an unmount cleanup. Pages that don't want any
// button (e.g. the hub) call this with both nulls.
export function usePublishMobileTopBarActions(actions: {
  flipBoard?: Action;
  clearBoard?: Action;
}) {
  const writer = useContext(WriterContext);
  if (!writer) {
    throw new Error(
      'usePublishMobileTopBarActions must be used inside MobileTopBarProvider',
    );
  }
  const flipBoard = actions.flipBoard ?? null;
  const clearBoard = actions.clearBoard ?? null;
  useEffect(() => {
    writer.setActions({ flipBoard, clearBoard });
  });
}

// Ref-counted hide request for the bottom MobileNav. Default is "show" —
// callers pass `true` only while their page wants the nav hidden (e.g. the
// mobile review's analyze mode). The provider sums all live requests so two
// consumers, or a quick remount race, can't yank the nav back while one
// still wants it hidden. The effect only registers a request when `hide` is
// truthy; flipping `hide` from true→false runs the previous effect's
// cleanup (release), then the new effect (no-op).
export function useHideMobileBottomNav(hide: boolean) {
  const writer = useContext(WriterContext);
  if (!writer) {
    throw new Error(
      'useHideMobileBottomNav must be used inside MobileTopBarProvider',
    );
  }
  useEffect(() => {
    if (!hide) return;
    writer.requestHide();
    return () => writer.releaseHide();
  }, [hide, writer]);
}
