import { useState, useEffect, useRef, useCallback } from 'react';
import type { Channel as StreamChannel } from 'stream-chat';
import { MessageSquare, Send, Loader2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useStreamChat } from '@/hooks/useStreamChat';

/* ── Types ───────────────────────────────────────────────────── */
interface ChatMsg {
  id: string;
  text: string;
  userId: string;
  userName: string;
  createdAt: Date;
  isSystem: boolean;
}

interface ChannelItem {
  channel: StreamChannel;
  id: string;
  reportName: string;
  reportRisk: string;
  lastMessageText: string;
  lastMessageAt: Date | null;
  unread: number;
}

/* ── Channel List Item ───────────────────────────────────────── */
function ChannelListItem({
  item,
  active,
  onClick,
}: {
  item: ChannelItem;
  active: boolean;
  onClick: () => void;
}) {
  const riskColor: Record<string, string> = {
    high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 border-b border-border/50 hover:bg-accent/50 transition-colors',
        active && 'bg-accent',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate text-foreground">
            {item.reportName || 'Consultation'}
          </p>
          {item.reportRisk && (
            <span
              className={cn(
                'inline-block text-[11px] font-medium px-1.5 py-0.5 rounded mt-0.5',
                riskColor[item.reportRisk.toLowerCase()] ?? 'bg-muted text-muted-foreground',
              )}
            >
              {item.reportRisk.toUpperCase()} Risk
            </span>
          )}
          {item.lastMessageText && (
            <p className="text-xs text-muted-foreground mt-1 truncate">{item.lastMessageText}</p>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          {item.lastMessageAt && (
            <span className="text-[11px] text-muted-foreground">
              {format(item.lastMessageAt, 'HH:mm')}
            </span>
          )}
          {item.unread > 0 && (
            <span className="h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
              {item.unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/* ── Message Bubble ──────────────────────────────────────────── */
function MessageBubble({ msg, isOwn }: { msg: ChatMsg; isOwn: boolean }) {
  if (msg.isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-muted/60 text-muted-foreground text-xs px-4 py-2 rounded-full max-w-md text-center whitespace-pre-wrap">
          {msg.text}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex mb-3', isOwn ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[70%] flex flex-col', isOwn ? 'items-end' : 'items-start')}>
        {!isOwn && (
          <span className="text-xs text-muted-foreground mb-1 ml-1">{msg.userName}</span>
        )}
        <div
          className={cn(
            'px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words shadow-sm',
            isOwn
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-card border border-border text-card-foreground rounded-bl-sm',
          )}
        >
          {msg.text}
        </div>
        <span className="text-[11px] text-muted-foreground mt-1 mx-1">
          {format(msg.createdAt, 'HH:mm')}
        </span>
      </div>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toMsg(m: any, userId: string): ChatMsg {
  return {
    id: m.id,
    text: m.text ?? '',
    userId: m.user?.id ?? '',
    userName: m.user?.name ?? m.user?.id ?? 'Unknown',
    createdAt: m.created_at instanceof Date ? m.created_at : new Date(m.created_at as string),
    isSystem: m.type === 'system',
  };
}

function toChannelItem(ch: StreamChannel, userId: string): ChannelItem {
  const data = (ch.data ?? {}) as Record<string, unknown>;
  const msgs = ch.state.messages;
  const last = msgs[msgs.length - 1];
  return {
    channel: ch,
    id: ch.id ?? '',
    reportName: (data.report_name as string) || 'Consultation',
    reportRisk: (data.report_risk as string) || '',
    lastMessageText: last?.text ?? '',
    lastMessageAt: last?.created_at
      ? last.created_at instanceof Date
        ? last.created_at
        : new Date(last.created_at as string)
      : null,
    unread: ch.countUnread(),
  };
}

/* ── Main Page ───────────────────────────────────────────────── */
export default function PatientChat() {
  const { user } = useAuth();
  const { client, ready, error } = useStreamChat();

  const [channelItems, setChannelItems] = useState<ChannelItem[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [activeChannel, setActiveChannel] = useState<StreamChannel | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  /* Load channel list */
  useEffect(() => {
    if (!client || !user) return;
    let cancelled = false;

    setLoadingChannels(true);
    client
      .queryChannels(
        { type: 'messaging', members: { $in: [user.id] } },
        { last_message_at: -1 },
        { limit: 30, state: true, watch: true },
      )
      .then((chans) => {
        if (!cancelled) {
          setChannelItems(chans.map((c) => toChannelItem(c, user.id)));
          setLoadingChannels(false);
        }
      })
      .catch(() => { if (!cancelled) setLoadingChannels(false); });

    /* Re-sort on new messages */
    const resort = () => {
      if (!cancelled)
        setChannelItems((prev) =>
          [...prev].sort(
            (a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0),
          ),
        );
    };
    client.on('message.new', resort);

    return () => {
      cancelled = true;
      client.off('message.new', resort);
    };
  }, [client, user]);

  /* Load active channel messages */
  useEffect(() => {
    if (!activeChannel || !user) return;
    let cancelled = false;

    setLoadingMessages(true);
    setMessages([]);

    activeChannel
      .watch({ presence: false })
      .then(() => {
        if (cancelled) return;
        setMessages(activeChannel.state.messages.map((m) => toMsg(m, user.id)));
        setLoadingMessages(false);
        activeChannel.markRead().catch(() => null);
        // update unread count in list
        setChannelItems((prev) =>
          prev.map((it) =>
            it.id === activeChannel.id ? { ...it, unread: 0 } : it,
          ),
        );
      })
      .catch(() => { if (!cancelled) setLoadingMessages(false); });

    const onMsg = () => {
      if (!cancelled) {
        setMessages(activeChannel.state.messages.map((m) => toMsg(m, user.id)));
        // update list item too
        setChannelItems((prev) =>
          prev.map((it) =>
            it.id === activeChannel.id ? toChannelItem(activeChannel, user.id) : it,
          ),
        );
        activeChannel.markRead().catch(() => null);
      }
    };
    activeChannel.on('message.new', onMsg);
    activeChannel.on('message.updated', onMsg);

    return () => {
      cancelled = true;
      activeChannel.off('message.new', onMsg);
      activeChannel.off('message.updated', onMsg);
    };
  }, [activeChannel, user]);

  /* Auto-scroll */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!activeChannel || !text.trim()) return;
    setSending(true);
    const toSend = text.trim();
    setText('');
    try {
      await activeChannel.sendMessage({ text: toSend });
    } catch {
      setText(toSend);
    } finally {
      setSending(false);
    }
  }, [activeChannel, text]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* ── Render ── */
  if (error) {
    return (
      <DashboardLayout title="My Consultations">
        <div className="flex flex-col items-center justify-center h-full p-8 gap-4">
          <Alert variant="destructive" className="max-w-lg">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  if (!ready || !client) {
    return (
      <DashboardLayout title="My Consultations">
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const activeItem = channelItems.find((it) => it.id === activeChannel?.id);

  return (
    <DashboardLayout title="My Consultations">
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* ── Sidebar ── */}
        <div className="w-72 shrink-0 border-r border-border bg-card flex flex-col hidden sm:flex">
          <div className="px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-sm">My Consultations</h2>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingChannels ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : channelItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center gap-3">
                <MessageSquare className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  No consultations yet. Send a report to a doctor to start a chat.
                </p>
              </div>
            ) : (
              channelItems.map((item) => (
                <ChannelListItem
                  key={item.id}
                  item={item}
                  active={item.id === activeChannel?.id}
                  onClick={() => setActiveChannel(item.channel)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Chat Area ── */}
        <div className="flex-1 min-w-0 flex flex-col bg-background">
          {activeChannel && activeItem ? (
            <>
              {/* Header */}
              <div className="px-5 py-3 border-b border-border bg-card shrink-0 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{activeItem.reportName}</p>
                  {activeItem.reportRisk && (
                    <span className="text-xs text-muted-foreground">
                      Risk: {activeItem.reportRisk.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 px-4 py-4">
                {loadingMessages ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 py-16 text-center">
                    <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      isOwn={msg.userId === user?.id}
                    />
                  ))
                )}
                <div ref={bottomRef} />
              </ScrollArea>

              {/* Input */}
              <div className="px-4 py-3 border-t border-border bg-card shrink-0">
                <div className="flex gap-2 items-end">
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message… (Enter to send)"
                    className="resize-none min-h-[40px] max-h-32 flex-1 text-sm"
                    rows={1}
                  />
                  <Button
                    size="icon"
                    onClick={sendMessage}
                    disabled={!text.trim() || sending}
                    className="shrink-0 h-10 w-10 rounded-full"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-lg">Select a consultation</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose a chat from the sidebar to continue your consultation
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
