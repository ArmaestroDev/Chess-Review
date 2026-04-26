import type { ReactNode } from 'react';

interface Props {
  onClick?: () => void;
  title?: string;
  ariaLabel?: string;
  size?: 'sm' | 'md';
  children: ReactNode;
}

export function IconBtn({
  onClick,
  title,
  ariaLabel,
  size = 'sm',
  children,
}: Props) {
  const sizeClass = size === 'md' ? 'w-9 h-9' : 'w-8 h-8';
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel ?? title}
      className={`${sizeClass} rounded-lg border border-line bg-wood-card text-ink-2 inline-flex items-center justify-center hover:bg-wood-hover hover:text-ink transition-colors`}
    >
      {children}
    </button>
  );
}
