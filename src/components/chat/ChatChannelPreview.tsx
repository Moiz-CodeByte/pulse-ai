import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { FormattedChatText } from '@/components/chat/FormattedChatText';

const riskColor: Record<string, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

export function ChatChannelPreview({
  title,
  subtitle,
  meta,
  risk,
  lastMessageText,
  lastMessageAt,
  unread,
  active,
  onClick,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  risk?: string;
  lastMessageText?: string;
  lastMessageAt?: Date | null;
  unread?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 border-b border-border/50 hover:bg-accent/50 transition-colors',
        active && 'bg-primary hover:bg-primary/95',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-semibold truncate text-foreground', active && 'text-primary-foreground')}>
            {title}
          </p>
          {subtitle && (
            <p className={cn('text-xs text-muted-foreground truncate', active && 'text-primary-foreground/80')}>
              {subtitle}
            </p>
          )}
          {meta && (
            <p className={cn('text-xs text-muted-foreground truncate', active && 'text-primary-foreground/80')}>
              {meta}
            </p>
          )}
          {risk && (
            <span
              className={cn(
                'inline-block text-[11px] font-medium px-1.5 py-0.5 rounded mt-1',
                riskColor[risk.toLowerCase()] ?? 'bg-muted text-muted-foreground',
                active && 'bg-primary-foreground/15 text-primary-foreground',
              )}
            >
              {risk.toUpperCase()} Risk
            </span>
          )}
          {lastMessageText && (
            <p className={cn('text-xs text-muted-foreground mt-1 truncate', active && 'text-primary-foreground/85')}>
              <FormattedChatText text={lastMessageText} />
            </p>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          {lastMessageAt && (
            <span className={cn('text-[11px] text-muted-foreground', active && 'text-primary-foreground/80')}>
              {format(lastMessageAt, 'HH:mm')}
            </span>
          )}
          {!!unread && unread > 0 && (
            <span className="h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
              {unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
