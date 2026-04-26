import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useIsMobileContext } from '../../../hooks/useIsMobile';
import { PuzzleHubDesktop } from './desktop/PuzzleHubDesktop';
import type { Settings } from '../../../shared/utils/settings';

const PuzzleHubMobile = lazy(() =>
  import('./mobile/PuzzleHubMobile').then((m) => ({
    default: m.PuzzleHubMobile,
  })),
);
const PuzzleSolverMobile = lazy(() =>
  import('../solver/mobile/PuzzleSolverMobile').then((m) => ({
    default: m.PuzzleSolverMobile,
  })),
);

interface Props {
  settings: Settings;
  orientation: 'white' | 'black';
  setOrientation: (o: 'white' | 'black') => void;
}

// Single landing for both /puzzles and /puzzles/:id. Desktop uses one component
// for both modes so the centerpiece board doesn't unmount when transitioning
// between hub and solver views — only the side panels swap.
export function PuzzleHubPage(props: Props) {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const isMobile = useIsMobileContext();
  const fallback = (
    <main className="px-4 py-10 w-full">
      <div className="flex items-center justify-center gap-2 text-ink-3 text-[13px]">
        <Loader2 size={16} className="animate-spin" />
        {t(id ? 'loading.puzzle' : 'loading.puzzles')}
      </div>
    </main>
  );

  if (!isMobile) return <PuzzleHubDesktop {...props} />;
  const { orientation, setOrientation } = props;
  return (
    <Suspense fallback={fallback}>
      {id ? (
        <PuzzleSolverMobile
          orientation={orientation}
          setOrientation={setOrientation}
        />
      ) : (
        <PuzzleHubMobile />
      )}
    </Suspense>
  );
}
