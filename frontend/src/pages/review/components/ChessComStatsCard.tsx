import { ExternalLink, Loader2, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  ChessComBucketStats,
  ChessComProfile,
  ChessComStats,
} from '../../../shared/utils/chessCom';
import type { ChessComProfileState } from '../useChessComProfile';
import type { ChessComActivity } from '../utils/chessComActivity';

interface Props {
  state: ChessComProfileState;
}

const TIME_CLASS_KEYS = ['chess_bullet', 'chess_blitz', 'chess_rapid'] as const;
type TimeClassKey = (typeof TIME_CLASS_KEYS)[number];

const TIME_CLASS_LABEL: Record<TimeClassKey, string> = {
  chess_bullet: 'review.chessComStats.timeClass.bullet',
  chess_blitz: 'review.chessComStats.timeClass.blitz',
  chess_rapid: 'review.chessComStats.timeClass.rapid',
};

const WIN_COLOR = 'rgba(80, 130, 30, 0.95)';
const LOSS_COLOR = 'rgba(190, 60, 50, 0.95)';
const DRAW_COLOR = 'rgba(140, 130, 110, 0.85)';

export function ChessComStatsCard({ state }: Props) {
  const { t, i18n } = useTranslation();
  const { committedUsername, profile, stats, activity, loading, error } = state;

  const isEmpty = !committedUsername;
  const isNotFound = error === 'not_found';
  const isFailed = error === 'failed';

  return (
    <div className="cr-card flex flex-col">
      <div className="cr-card-hd">
        <div className="cr-card-title">{t('review.chessComStats.title')}</div>
      </div>

      <div className="flex flex-col">
        {isEmpty ? (
          <EmptyState />
        ) : loading && !profile ? (
          <Skeleton />
        ) : isNotFound ? (
          <ErrorBox
            title={t('review.chessComStats.notFound', { username: committedUsername })}
          />
        ) : isFailed ? (
          <ErrorBox title={t('review.chessComStats.error')} />
        ) : (
          <Content
            profile={profile}
            stats={stats}
            activity={activity}
            username={committedUsername}
            lang={i18n.language}
          />
        )}
      </div>
    </div>
  );
}

function Content({
  profile,
  stats,
  activity,
  username,
  lang,
}: {
  profile: ChessComProfile | null;
  stats: ChessComStats | null;
  activity: ChessComActivity | null;
  username: string;
  lang: string;
}) {
  const displayName = profile?.name?.trim() || profile?.username || username;
  const handle = profile?.username || username;

  return (
    <>
      <ProfileHeader displayName={displayName} handle={handle} title={profile?.title} />
      {stats && (
        <div className="border-t border-line">
          {TIME_CLASS_KEYS.map((key) => (
            <RatingBlock
              key={key}
              labelKey={TIME_CLASS_LABEL[key]}
              bucket={stats[key]}
              lang={lang}
            />
          ))}
        </div>
      )}
      {activity && activity.total > 0 && (
        <ActivitySection activity={activity} lang={lang} />
      )}
    </>
  );
}

function ProfileHeader({
  displayName,
  handle,
  title,
}: {
  displayName: string;
  handle: string;
  title?: string;
}) {
  return (
    <div className="px-4 pt-1 pb-3 flex items-center gap-2 min-w-0">
      {title && <TitleBadge title={title} />}
      <div className="min-w-0 leading-tight">
        <div className="text-[14px] font-semibold text-ink truncate">{displayName}</div>
        <div className="text-[11px] text-ink-3 truncate">@{handle}</div>
      </div>
    </div>
  );
}

function TitleBadge({ title }: { title: string }) {
  return (
    <span
      className="shrink-0 inline-flex items-center justify-center px-1.5 h-[20px] rounded text-[10px] font-bold tracking-wider text-white"
      style={{ background: 'rgb(190, 60, 50)' }}
      aria-label={title}
    >
      {title.toUpperCase()}
    </span>
  );
}

function RatingBlock({
  labelKey,
  bucket,
  lang,
}: {
  labelKey: string;
  bucket: ChessComBucketStats | undefined;
  lang: string;
}) {
  const { t } = useTranslation();
  const last = bucket?.last;
  const best = bucket?.best;
  const record = bucket?.record;
  const fmt = new Intl.NumberFormat(lang);

  return (
    <div className="px-4 py-2.5 border-b border-line last:border-b-0">
      {/* Top row: label · rating */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-3">
          {t(labelKey)}
        </span>
        {last ? (
          <span className="font-mono text-[20px] leading-none font-bold text-ink tabular-nums">
            {fmt.format(last.rating)}
            {typeof last.rd === 'number' && (
              <span className="text-[10px] text-ink-4 font-normal ml-1.5 align-middle">
                ±{last.rd}
              </span>
            )}
          </span>
        ) : (
          <span className="text-[11px] text-ink-4">
            {t('review.chessComStats.unrated')}
          </span>
        )}
      </div>

      {/* W/L/D bar + counts */}
      {record && (record.win + record.loss + record.draw) > 0 && (
        <div className="mt-1.5">
          <WLDBar wins={record.win} losses={record.loss} draws={record.draw} />
          <div className="mt-1 text-[10.5px] font-mono tabular-nums flex items-center gap-1.5 text-ink-3">
            <RecordChip value={record.win} tone="win" fmt={fmt} label="W" />
            <RecordChip value={record.loss} tone="loss" fmt={fmt} label="L" />
            <RecordChip value={record.draw} tone="draw" fmt={fmt} label="D" />
          </div>
        </div>
      )}

      {/* Peak — secondary, single subtle line */}
      {best && (
        <div className="mt-1 text-[10.5px] text-ink-4 flex items-center gap-1 min-w-0">
          <TrendingUp size={11} className="shrink-0" />
          {best.game ? (
            <a
              href={best.game}
              target="_blank"
              rel="noreferrer noopener"
              className="font-mono tabular-nums hover:text-accent-ink inline-flex items-center gap-0.5"
              title={t('review.chessComStats.peak')}
            >
              {fmt.format(best.rating)}
              <ExternalLink size={9} className="opacity-70" />
            </a>
          ) : (
            <span className="font-mono tabular-nums">{fmt.format(best.rating)}</span>
          )}
          <span>·</span>
          <span className="truncate">{formatPeakDate(best.date, lang)}</span>
        </div>
      )}
    </div>
  );
}

function WLDBar({
  wins,
  losses,
  draws,
}: {
  wins: number;
  losses: number;
  draws: number;
}) {
  const total = wins + losses + draws;
  if (total === 0) return null;
  const w = (wins / total) * 100;
  const l = (losses / total) * 100;
  const d = (draws / total) * 100;
  return (
    <div
      className="w-full h-[5px] rounded-full overflow-hidden flex bg-line"
      role="img"
      aria-label={`${wins} wins, ${losses} losses, ${draws} draws`}
    >
      {w > 0 && <div style={{ width: `${w}%`, background: WIN_COLOR }} />}
      {l > 0 && <div style={{ width: `${l}%`, background: LOSS_COLOR }} />}
      {d > 0 && <div style={{ width: `${d}%`, background: DRAW_COLOR }} />}
    </div>
  );
}

function RecordChip({
  value,
  tone,
  fmt,
  label,
}: {
  value: number;
  tone: 'win' | 'loss' | 'draw';
  fmt: Intl.NumberFormat;
  label: string;
}) {
  const color = tone === 'win' ? WIN_COLOR : tone === 'loss' ? LOSS_COLOR : DRAW_COLOR;
  return (
    <span style={{ color }} className="inline-flex items-baseline gap-0.5">
      <span className="font-semibold">{fmt.format(value)}</span>
      <span className="opacity-65 text-[9.5px]">{label}</span>
    </span>
  );
}

function ActivitySection({
  activity,
  lang,
}: {
  activity: ChessComActivity;
  lang: string;
}) {
  const { t } = useTranslation();
  const fmt = new Intl.NumberFormat(lang);

  return (
    <div className="border-t border-line px-4 py-3 flex flex-col gap-2">
      {/* Headline: count + win rate big */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10.5px] uppercase tracking-[0.06em] text-ink-3 font-semibold">
          {t('review.chessComStats.activity.title', { count: activity.total })}
        </span>
        <span className="font-mono tabular-nums text-[15px] font-bold text-ink leading-none">
          {activity.winRate}
          <span className="text-[10px] text-ink-3 font-medium ml-0.5">%</span>
          <span className="text-[10px] text-ink-3 font-medium ml-1">
            {t('review.chessComStats.activity.winRateLabel')}
          </span>
        </span>
      </div>

      <WLDBar wins={activity.wins} losses={activity.losses} draws={activity.draws} />

      <div className="text-[11px] font-mono tabular-nums flex items-center gap-2 text-ink-3 -mt-0.5">
        <RecordChip value={activity.wins} tone="win" fmt={fmt} label="W" />
        <RecordChip value={activity.losses} tone="loss" fmt={fmt} label="L" />
        <RecordChip value={activity.draws} tone="draw" fmt={fmt} label="D" />
      </div>

      <div className="flex flex-col gap-0.5 pt-1">
        {activity.avgOppRating !== null && (
          <ActivityRow
            label={t('review.chessComStats.activity.avgOpp')}
            value={fmt.format(activity.avgOppRating)}
          />
        )}
        {activity.avgAccuracy !== null && (
          <ActivityRow
            label={t('review.chessComStats.activity.avgAcc')}
            value={`${activity.avgAccuracy.toFixed(1)}%`}
          />
        )}
        {activity.topOpening && (
          <ActivityRow
            label={t('review.chessComStats.activity.topOpening')}
            value={
              <a
                href={activity.topOpening.url}
                target="_blank"
                rel="noreferrer noopener"
                className="hover:text-accent-ink block text-right line-clamp-2"
                title={activity.topOpening.name}
              >
                {activity.topOpening.name}{' '}
                <span className="text-ink-4 whitespace-nowrap">×{activity.topOpening.count}</span>
              </a>
            }
            wrap
          />
        )}
      </div>
    </div>
  );
}

function ActivityRow({
  label,
  value,
  wrap,
}: {
  label: string;
  value: React.ReactNode;
  wrap?: boolean;
}) {
  return (
    <div
      className={
        'flex justify-between gap-3 text-[11px] min-w-0 ' +
        (wrap ? 'items-start' : 'items-center')
      }
    >
      <span className="text-ink-4 shrink-0">{label}</span>
      <span
        className={
          'text-ink-2 font-medium min-w-0 text-right ' + (wrap ? '' : 'truncate')
        }
      >
        {value}
      </span>
    </div>
  );
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <div className="px-4 pt-1 pb-4 text-[12px] text-ink-3 leading-relaxed">
      {t('review.chessComStats.empty')}
    </div>
  );
}

function ErrorBox({ title }: { title: string }) {
  return (
    <div className="px-4 pt-1 pb-4 text-[12px] text-review-blunder leading-relaxed">
      {title}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="px-4 pb-4 pt-1 flex flex-col gap-3 text-ink-4 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-[20px] w-7 rounded bg-line" />
        <div className="h-3.5 w-32 rounded bg-line" />
      </div>
      <div className="h-px bg-line" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="h-3 w-14 rounded bg-line" />
            <div className="h-4 w-16 rounded bg-line" />
          </div>
          <div className="h-1.5 w-full rounded-full bg-line" />
        </div>
      ))}
      <div className="flex items-center justify-center pt-1">
        <Loader2 size={14} className="animate-spin opacity-60" />
      </div>
    </div>
  );
}

function formatPeakDate(unixSeconds: number, lang: string): string {
  try {
    return new Date(unixSeconds * 1000).toLocaleDateString(lang, {
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}
