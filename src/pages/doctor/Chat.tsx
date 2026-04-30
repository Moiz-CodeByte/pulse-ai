import { useState, useEffect, useRef, useCallback } from 'react';
import type { Channel as StreamChannel } from 'stream-chat';
import {
  AlertCircle,
  ClipboardPlus,
  FileText,
  Loader2,
  MessageSquare,
  PillBottle,
  Send,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useStreamChat } from '@/hooks/useStreamChat';
import { useToast } from '@/hooks/use-toast';

/* â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
  reportId: string;
  consultationId: string;
  patientId: string;
  patientName: string;
  lastMessageText: string;
  lastMessageAt: Date | null;
  unread: number;
}

interface MedEntry {
  id: number;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

/* â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toMsg(m: any): ChatMsg {
  return {
    id: m.id,
    text: m.text ?? '',
    userId: m.user?.id ?? '',
    userName: m.user?.name ?? m.user?.id ?? 'Unknown',
    createdAt: m.created_at instanceof Date ? m.created_at : new Date(m.created_at as string),
    isSystem: m.type === 'system',
  };
}

function toChannelItem(ch: StreamChannel, myUserId: string): ChannelItem {
  const data = (ch.data ?? {}) as Record<string, unknown>;
  const msgs = ch.state.messages;
  const last = msgs[msgs.length - 1];
  const memberIds = Object.keys(ch.state.members ?? {});
  const patientId = memberIds.find((id) => id !== myUserId) ?? '';
  const patientMember = ch.state.members?.[patientId];
  const patientName =
    (patientMember?.user?.name as string) ||
    (patientMember?.user?.id as string) ||
    patientId ||
    'Patient';
  return {
    channel: ch,
    id: ch.id ?? '',
    reportName: (data.report_name as string) || 'Consultation',
    reportRisk: (data.report_risk as string) || '',
    reportId: (data.report_id as string) || '',
    consultationId: (data.consultation_id as string) || '',
    patientId,
    patientName,
    lastMessageText: last?.text ?? '',
    lastMessageAt: last?.created_at
      ? last.created_at instanceof Date
        ? last.created_at
        : new Date(last.created_at as string)
      : null,
    unread: ch.countUnread(),
  };
}

const riskColor: Record<string, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

/* â”€â”€ Channel List Item â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function ChannelListItem({
  item,
  active,
  onClick,
}: {
  item: ChannelItem;
  active: boolean;
  onClick: () => void;
}) {
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
          <p className="text-sm font-semibold truncate text-foreground">{item.patientName}</p>
          <p className="text-xs text-muted-foreground truncate">{item.reportName}</p>
          {item.reportRisk && (
            <span
              className={cn(
                'inline-block text-[11px] font-medium px-1.5 py-0.5 rounded mt-1',
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

/* â”€â”€ Message Bubble â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
        {!isOwn && <span className="text-xs text-muted-foreground mb-1 ml-1">{msg.userName}</span>}
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

/* â”€â”€ Prescription Dialog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function PrescriptionDialog({
  open,
  onClose,
  channel,
  reportId,
}: {
  open: boolean;
  onClose: () => void;
  channel: StreamChannel | null;
  patientId: string;
  reportId: string;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const nextId = useRef(2);
  const [meds, setMeds] = useState<MedEntry[]>([
    { id: 1, name: '', dosage: '', frequency: '', duration: '' },
  ]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  function addMed() {
    setMeds((p) => [...p, { id: nextId.current++, name: '', dosage: '', frequency: '', duration: '' }]);
  }
  function removeMed(id: number) {
    setMeds((p) => p.filter((m) => m.id !== id));
  }
  function updateMed(id: number, field: keyof Omit<MedEntry, 'id'>, value: string) {
    setMeds((p) => p.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  }

  async function handleSend() {
    const valid = meds.filter((m) => m.name.trim());
    if (valid.length === 0) {
      toast({ title: 'Add at least one medicine', variant: 'destructive' });
      return;
    }
    if (!reportId) {
      toast({ title: 'No report linked to this consultation', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { data: diagRow, error: diagErr } = await supabase
        .from('diagnosis')
        .select('id')
        .eq('report_id', reportId)
        .maybeSingle();
      if (diagErr) throw diagErr;
      if (!diagRow) throw new Error('Diagnosis record not found for this report.');

      const { error: rxErr } = await supabase.from('prescriptions').insert({
        diagnosis_id: diagRow.id,
        doctor_id: user!.id,
        medicine: valid.map((m) => `${m.name}${m.dosage ? ` (${m.dosage})` : ''}`).join(', '),
        dosage: valid.map((m) => m.frequency).filter(Boolean).join('; ') || undefined,
        instructions:
          [valid.map((m) => m.duration).filter(Boolean).join('; '), notes]
            .filter(Boolean)
            .join(' | ') || undefined,
        notes: notes || undefined,
      });
      if (rxErr) throw rxErr;

      if (channel) {
        const prescText = [
          'ðŸ“‹ **Prescription**',
          '',
          ...valid.map(
            (m, i) =>
              `${i + 1}. **${m.name}**${m.dosage ? ` â€” ${m.dosage}` : ''}` +
              (m.frequency ? `\n   Frequency: ${m.frequency}` : '') +
              (m.duration ? `\n   Duration: ${m.duration}` : ''),
          ),
          notes ? `\n**Doctor's Notes:** ${notes}` : '',
        ]
          .filter(Boolean)
          .join('\n');
        await channel.sendMessage({ text: prescText });
      }

      toast({ title: 'Prescription sent', description: 'Patient can view it in their Prescriptions page.' });
      setMeds([{ id: 1, name: '', dosage: '', frequency: '', duration: '' }]);
      setNotes('');
      onClose();
    } catch (err) {
      toast({
        title: 'Failed to send prescription',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPlus className="h-5 w-5 text-primary" />
            Write Prescription
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {meds.map((med, idx) => (
            <Card key={med.id} className="relative">
              <CardHeader className="p-3 pb-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Medicine {idx + 1}
                  </CardTitle>
                  {meds.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeMed(med.id)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-3 grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">Medicine Name *</Label>
                  <Input placeholder="e.g. Metoprolol" value={med.name} onChange={(e) => updateMed(med.id, 'name', e.target.value)} className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Dosage</Label>
                  <Input placeholder="e.g. 50mg" value={med.dosage} onChange={(e) => updateMed(med.id, 'dosage', e.target.value)} className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Frequency</Label>
                  <Input placeholder="e.g. Once daily" value={med.frequency} onChange={(e) => updateMed(med.id, 'frequency', e.target.value)} className="mt-1 h-8 text-sm" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Duration</Label>
                  <Input placeholder="e.g. 30 days" value={med.duration} onChange={(e) => updateMed(med.id, 'duration', e.target.value)} className="mt-1 h-8 text-sm" />
                </div>
              </CardContent>
            </Card>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addMed} className="w-full gap-1">
            <ClipboardPlus className="h-4 w-4" />
            Add Another Medicine
          </Button>
          <div>
            <Label className="text-xs">Doctor's Notes (optional)</Label>
            <Textarea
              placeholder="Additional instructions, dietary advice, follow-up notesâ€¦"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 text-sm resize-none"
              rows={3}
            />
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="button" onClick={handleSend} disabled={saving} className="flex-1 gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send Prescription
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* â”€â”€ Doctor Chat Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
export default function DoctorChat() {
  const { user } = useAuth();
  const { client, ready, error } = useStreamChat();
  const [channelItems, setChannelItems] = useState<ChannelItem[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [activeChannel, setActiveChannel] = useState<StreamChannel | null>(null);
  const [activeItem, setActiveItem] = useState<ChannelItem | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [prescribeOpen, setPrescribeOpen] = useState(false);
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

    const resort = () => {
      if (!cancelled)
        setChannelItems((prev) =>
          [...prev].sort((a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0)),
        );
    };
    client.on('message.new', resort);
    return () => { cancelled = true; client.off('message.new', resort); };
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
        setMessages(activeChannel.state.messages.map(toMsg));
        setLoadingMessages(false);
        activeChannel.markRead().catch(() => null);
        setChannelItems((prev) =>
          prev.map((it) => (it.id === activeChannel.id ? { ...it, unread: 0 } : it)),
        );
      })
      .catch(() => { if (!cancelled) setLoadingMessages(false); });

    const onMsg = () => {
      if (!cancelled) {
        setMessages(activeChannel.state.messages.map(toMsg));
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
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const openChannel = useCallback((item: ChannelItem) => {
    setActiveChannel(item.channel);
    setActiveItem(item);
    setPrescribeOpen(false);
  }, []);

  const sendMessage = useCallback(async () => {
    if (!activeChannel || !text.trim()) return;
    setSending(true);
    const toSend = text.trim();
    setText('');
    try { await activeChannel.sendMessage({ text: toSend }); } catch { setText(toSend); } finally { setSending(false); }
  }, [activeChannel, text]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (error) {
    return (
      <DashboardLayout title="Patient Consultations">
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
      <DashboardLayout title="Patient Consultations">
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Patient Consultations">
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Sidebar */}
        <div className="w-72 shrink-0 border-r border-border bg-card flex-col hidden sm:flex">
          <div className="px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-sm">Patients</h2>
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
                  No patient chats yet. Accept a consultation request to start.
                </p>
              </div>
            ) : (
              channelItems.map((item) => (
                <ChannelListItem
                  key={item.id}
                  item={item}
                  active={item.id === activeChannel?.id}
                  onClick={() => openChannel(item)}
                />
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 min-w-0 flex flex-col bg-background">
          {activeChannel && activeItem ? (
            <>
              {/* Header */}
              <div className="px-5 py-3 border-b border-border bg-card shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <MessageSquare className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm">{activeItem.patientName}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      {activeItem.reportName && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <FileText className="h-3 w-3" />
                          {activeItem.reportName}
                        </span>
                      )}
                      {activeItem.reportRisk && (
                        <Badge
                          className={cn(
                            'text-[11px] px-1.5 py-0',
                            riskColor[activeItem.reportRisk.toLowerCase()] ?? 'bg-muted text-muted-foreground',
                          )}
                        >
                          {activeItem.reportRisk.toUpperCase()} Risk
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => setPrescribeOpen(true)} className="gap-1.5 shrink-0">
                    <PillBottle className="h-3.5 w-3.5" />
                    Prescribe
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 px-4 py-4">
                {loadingMessages ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                    <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <MessageBubble key={msg.id} msg={msg} isOwn={msg.userId === user?.id} />
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
                    placeholder="Type a messageâ€¦ (Enter to send)"
                    className="resize-none min-h-[40px] max-h-32 flex-1 text-sm"
                    rows={1}
                  />
                  <Button
                    size="icon"
                    onClick={sendMessage}
                    disabled={!text.trim() || sending}
                    className="shrink-0 h-10 w-10 rounded-full"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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
                <p className="font-semibold text-lg">Select a patient</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose a consultation from the sidebar to chat and prescribe
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <PrescriptionDialog
        open={prescribeOpen}
        onClose={() => setPrescribeOpen(false)}
        channel={activeChannel}
        patientId={activeItem?.patientId ?? ''}
        reportId={activeItem?.reportId ?? ''}
      />
    </DashboardLayout>
  );
}
