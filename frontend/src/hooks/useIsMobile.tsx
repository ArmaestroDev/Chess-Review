import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

const MOBILE_BREAKPOINT = '(max-width: 768px)';

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(MOBILE_BREAKPOINT).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(MOBILE_BREAKPOINT);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}

// Single source of truth for the mobile breakpoint across the app. Consumers
// must read from this context (via useIsMobileContext) rather than calling
// useIsMobile() directly — otherwise multiple matchMedia subscriptions can
// briefly disagree at the breakpoint cross, leaving the chrome in one state
// and the page body in another for a frame.
const IsMobileContext = createContext<boolean | null>(null);

export function IsMobileProvider({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  return (
    <IsMobileContext.Provider value={isMobile}>
      {children}
    </IsMobileContext.Provider>
  );
}

export function useIsMobileContext(): boolean {
  const v = useContext(IsMobileContext);
  if (v === null) {
    throw new Error('useIsMobileContext must be used inside IsMobileProvider');
  }
  return v;
}
