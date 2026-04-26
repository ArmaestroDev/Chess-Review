import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Settings as AppSettings } from '../../shared/utils/settings';
import { useIsMobileContext } from '../../hooks/useIsMobile';
import { ReviewDesktop } from './desktop/ReviewDesktop';
import { useReviewState } from './useReviewState';

// Lazy-load the mobile variant so desktop users never download the
// mobile-only chunk. Mobile and desktop never both mount at once
// (gated by useIsMobile), so the shared review state hook only ever
// has one socket subscription.
const ReviewMobile = lazy(() =>
  import('./mobile/ReviewMobile').then((m) => ({ default: m.ReviewMobile })),
);

interface Props {
  settings: AppSettings;
  orientation: 'white' | 'black';
  setOrientation: (o: 'white' | 'black') => void;
}

export function ReviewPage(props: Props) {
  const { t } = useTranslation();
  const isMobile = useIsMobileContext();
  // Own the review-state hook here so a breakpoint cross (mobile <-> desktop)
  // doesn't tear down the move tree, in-flight socket subscription, or the
  // backend engine. The selected variant just renders from this state.
  const review = useReviewState({
    orientation: props.orientation,
    setOrientation: props.setOrientation,
  });
  if (!isMobile) return <ReviewDesktop {...props} review={review} />;
  return (
    <Suspense
      fallback={
        <main className="px-4 py-10 w-full">
          <div className="flex items-center justify-center gap-2 text-ink-3 text-[13px]">
            <Loader2 size={16} className="animate-spin" />
            {t('loading.review')}
          </div>
        </main>
      }
    >
      <ReviewMobile {...props} review={review} />
    </Suspense>
  );
}
