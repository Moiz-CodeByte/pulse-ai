import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { FormattedChatText } from '@/components/chat/FormattedChatText';

export interface SharedChatMessage {
  id: string;
  text: string;
  userId: string;
  userName: string;
  createdAt: Date;
  isSystem: boolean;
}

export function ChatMessageBubble({
  msg,
  isOwn,
}: {
  msg: SharedChatMessage;
  isOwn: boolean;
}) {
  if (msg.isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-muted/60 text-muted-foreground text-xs px-4 py-2 rounded-full max-w-md text-center whitespace-pre-wrap break-words">
          <FormattedChatText text={msg.text} />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex mb-3', isOwn ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[70%] flex flex-col', isOwn ? 'items-end' : 'items-start')}>
        {!isOwn && <span className="text-xs text-muted-foreground mb-1 ml-1">{msg.userName}</span>}
        <div
          className={cn(
            'px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words shadow-sm',
            isOwn
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-card border border-border text-card-foreground rounded-bl-sm',
          )}
        >
          <FormattedChatText text={msg.text} />
        </div>
        <span className="text-[11px] text-muted-foreground mt-1 mx-1">
          {format(msg.createdAt, 'HH:mm')}
        </span>
      </div>
    </div>
  );
}
