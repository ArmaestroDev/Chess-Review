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
}

interface WriterValue {
  setActions: (actions: { flipBoard: Action; clearBoard: Action }) => void;
}

const ReaderContext = createContext<ReaderValue | null>(null);
const WriterContext = createContext<WriterValue | null>(null);

export function MobileTopBarProvider({ children }: { children: ReactNode }) {
  const flipRef = useRef<Action>(null);
  const clearRef = useRef<Action>(null);
  const [flipAvailable, setFlipAvailable] = useState(false);
  const [clearAvailable, setClearAvailable] = useState(false);

  const setActions = useCallback(
    ({ flipBoard, clearBoard }: { flipBoard: Action; clearBoard: Action }) => {
      flipRef.current = flipBoard;
      clearRef.current = clearBoard;
      setFlipAvailable(flipBoard !== null);
      setClearAvailable(clearBoard !== null);
    },
    [],
  );

  const invokeFlip = useCallback(() => {
    flipRef.current?.();
  }, []);
  const invokeClear = useCallback(() => {
    clearRef.current?.();
  }, []);

  const reader = useMemo<ReaderValue>(
    () => ({ flipAvailable, clearAvailable, invokeFlip, invokeClear }),
    [flipAvailable, clearAvailable, invokeFlip, invokeClear],
  );
  const writer = useMemo<WriterValue>(() => ({ setActions }), [setActions]);

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
