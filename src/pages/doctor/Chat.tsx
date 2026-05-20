import { useState, useEffect, useRef, useCallback } from 'react';
import type { Channel as StreamChannel } from 'stream-chat';
import {
  AlertCircle,
  ClipboardPlus,
  Download,
  ExternalLink,
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
import { FormattedChatText } from '@/components/chat/FormattedChatText';
import { ChatChannelPreview } from '@/components/chat/ChatChannelPreview';
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useStreamChat } from '@/hooks/useStreamChat';
import { useToast } from '@/hooks/use-toast';
import { buildSequenceMap, formatReportLabel } from '@/lib/caseLabels';

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
  reportUrl: string;
  reportDownloadUrl: string;
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

interface PrescribableReport {
  reportId: string;
  diagnosisId: string;
  fileName: string;
  label: string;
  createdAt: string;
  riskLevel?: string | null;
}

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
    (data.patient_name as string) ||
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
    reportUrl: (data.report_url as string) || '',
    reportDownloadUrl: (data.report_download_url as string) || '',
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

function getConsultationIdFromChannel(item: Pick<ChannelItem, 'id' | 'consultationId'>): string {
  if (item.consultationId) {
    return item.consultationId;
  }

  return item.id.startsWith('consultation-') ? item.id.replace(/^consultation-/, '') : '';
}

async function hydrateChannelItems(items: ChannelItem[]): Promise<ChannelItem[]> {
  const missingReportItems = items.filter((item) => !item.reportId && getConsultationIdFromChannel(item));

  if (!missingReportItems.length) {
    return items;
  }

  const consultationIds = [...new Set(missingReportItems.map(getConsultationIdFromChannel))];
  // @ts-expect-error - consultation_requests table not yet in generated types
  const consultationQuery = supabase.from('consultation_requests');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: consultations, error } = await (consultationQuery as any)
    .select('id, report_id')
    .in('id', consultationIds);

  if (error || !consultations?.length) {
    return items;
  }

  const consultationMap = new Map(
    (consultations as Array<{ id: string; report_id: string }>).map((consultation) => [
      consultation.id,
      consultation.report_id,
    ]),
  );
  const reportIds = [...new Set([...consultationMap.values()])];
  const { data: reports } = await supabase
    .from('mri_reports')
    .select('id, file_name')
    .in('id', reportIds);
  const reportNameMap = new Map((reports ?? []).map((report) => [report.id, report.file_name]));

  return items.map((item) => {
    if (item.reportId) {
      return item;
    }

    const consultationId = getConsultationIdFromChannel(item);
    const reportId = consultationMap.get(consultationId) ?? '';

    if (!reportId) {
      return item;
    }

    return {
      ...item,
      consultationId,
      reportId,
      reportName: item.reportName === 'Consultation' ? reportNameMap.get(reportId) ?? item.reportName : item.reportName,
    };
  });
}

function dedupePatientChannels(items: ChannelItem[]): ChannelItem[] {
  const byPatient = new Map<string, ChannelItem>();

  for (const item of items) {
    const key = item.patientId || item.id;
    const current = byPatient.get(key);

    if (!current || (item.lastMessageAt?.getTime() ?? 0) > (current.lastMessageAt?.getTime() ?? 0)) {
      byPatient.set(key, item);
    }
  }

  return [...byPatient.values()].sort(
    (a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0),
  );
}

function renderMessageText(text: string) {
  const cleanedText = text
    .replace(/ðŸ“‹\s*/g, '')
    .replace(/â€”/g, '-')
    .replace(/^Prescription$/m, 'Prescription');
  const parts = cleanedText.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={`${part}-${index}`}
        href={part}
        target="_blank"
        rel="noreferrer"
        className="font-medium underline underline-offset-2"
      >
        {part}
      </a>
    ) : part.split(/(\*\*[^*]+\*\*)/g).map((piece, pieceIndex) =>
      piece.startsWith('**') && piece.endsWith('**') ? (
        <strong key={`${index}-${pieceIndex}`} className="font-semibold">
          {piece.slice(2, -2)}
        </strong>
      ) : (
        <span key={`${index}-${pieceIndex}`}>{piece}</span>
      ),
    ),
  );
}

const riskColor: Record<string, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

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
            <p className="text-xs text-muted-foreground mt-1 truncate">
              <FormattedChatText text={item.lastMessageText} />
            </p>
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

function MessageBubble({ msg, isOwn }: { msg: ChatMsg; isOwn: boolean }) {
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

function PrescriptionDialog({
  open,
  onClose,
  channel,
  patientId,
  patientName,
  reportId,
  reportName,
}: {
  open: boolean;
  onClose: () => void;
  channel: StreamChannel | null;
  patientId: string;
  patientName: string;
  reportId: string;
  reportName: string;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const nextId = useRef(2);
  const [reportOptions, setReportOptions] = useState<PrescribableReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState(reportId);
  const [loadingReports, setLoadingReports] = useState(false);
  const [meds, setMeds] = useState<MedEntry[]>([
    { id: 1, name: '', dosage: '', frequency: '', duration: '' },
  ]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelectedReportId(reportId);
  }, [reportId]);

  useEffect(() => {
    if (!open || !user || !patientId) {
      setReportOptions([]);
      return;
    }

    let cancelled = false;
    setLoadingReports(true);

    async function loadReports() {
      // @ts-expect-error - consultation_requests table not yet in generated types
      const consultationQuery = supabase.from('consultation_requests');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: consultations, error: consultationError } = await (consultationQuery as any)
        .select('report_id, created_at')
        .eq('doctor_id', user.id)
        .eq('patient_id', patientId)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false });

      if (cancelled) return;

      if (consultationError || !consultations?.length) {
        setReportOptions([]);
        setLoadingReports(false);
        return;
      }

      const reportIds = [...new Set((consultations as Array<{ report_id: string }>).map((item) => item.report_id))];
      const { data: reports } = await supabase
        .from('mri_reports')
        .select(`
          id,
          file_name,
          created_at,
          diagnosis (
            id,
            risk_level
          )
        `)
        .in('id', reportIds);

      if (cancelled) return;

      const options = (reports ?? [])
        .map((report) => {
          const diagnosis = Array.isArray(report.diagnosis) ? report.diagnosis[0] : report.diagnosis;
          return diagnosis?.id
            ? {
                reportId: report.id,
                diagnosisId: diagnosis.id,
                fileName: report.file_name,
                label: formatReportLabel({
                  patientName,
                  reportNumber: buildSequenceMap(reports ?? []).get(report.id),
                }),
                createdAt: report.created_at,
                riskLevel: diagnosis.risk_level,
              }
            : null;
        })
        .filter(Boolean) as PrescribableReport[];

      options.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setReportOptions(options);
      setSelectedReportId((current) => current || options[0]?.reportId || '');
      setLoadingReports(false);
    }

    void loadReports();

    return () => {
      cancelled = true;
    };
  }, [open, patientId, patientName, user, reportId]);

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
    if (!selectedReportId) {
      toast({ title: 'No report linked to this consultation', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const selectedReport = reportOptions.find((option) => option.reportId === selectedReportId);
      let diagnosisId = selectedReport?.diagnosisId;

      if (!diagnosisId) {
        const { data: diagRow, error: diagErr } = await supabase
          .from('diagnosis')
          .select('id')
          .eq('report_id', selectedReportId)
          .maybeSingle();
        if (diagErr) throw diagErr;
        diagnosisId = diagRow?.id;
      }

      if (!diagnosisId) throw new Error('Diagnosis record not found for this report.');

      const { error: rxErr } = await supabase.from('prescriptions').insert({
        diagnosis_id: diagnosisId,
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
        const selectedReportLabel = selectedReport?.label || reportName || 'MRI report';
        const prescText = [
          `Prescription for ${selectedReportLabel}`,
          patientName ? `Patient: ${patientName}` : '',
          '',
          ...valid.map(
            (m, i) =>
              `${i + 1}. ${m.name}${m.dosage ? ` - ${m.dosage}` : ''}` +
              (m.frequency ? `\n   Frequency: ${m.frequency}` : '') +
              (m.duration ? `\n   Duration: ${m.duration}` : ''),
          ),
          notes ? `\nDoctor's Notes: ${notes}` : '',
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
          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <div>
              <Label className="text-xs">Patient</Label>
              <p className="mt-1 text-sm font-medium">{patientName || 'Patient'}</p>
            </div>
            <div>
              <Label className="text-xs">Report / Case *</Label>
              <Select value={selectedReportId} onValueChange={setSelectedReportId} disabled={loadingReports || saving}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={loadingReports ? 'Loading reports...' : 'Select report'} />
                </SelectTrigger>
                <SelectContent>
                  {reportOptions.map((option) => (
                    <SelectItem key={option.reportId} value={option.reportId}>
                      {option.label} - {new Date(option.createdAt).toLocaleDateString()}
                      {option.riskLevel ? ` - ${option.riskLevel.toUpperCase()} Risk` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!loadingReports && reportOptions.length === 0 && (
                <p className="mt-1 text-xs text-destructive">No diagnosed reports found for this patient.</p>
              )}
            </div>
          </div>

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
        if (cancelled) {
          return;
        }

        hydrateChannelItems(chans.map((c) => toChannelItem(c, user.id)))
          .then((items) => {
            if (!cancelled) {
              setChannelItems(dedupePatientChannels(items));
            }
          })
          .catch(() => {
            if (!cancelled) {
              setChannelItems(chans.map((c) => toChannelItem(c, user.id)));
            }
          })
          .finally(() => {
            if (!cancelled) {
              setLoadingChannels(false);
            }
          });
      })
      .catch(() => {
        if (!cancelled) {
          setLoadingChannels(false);
        }
      });

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

  useEffect(() => {
    if (!activeChannel) {
      return;
    }

    const updatedItem = channelItems.find((item) => item.id === activeChannel.id);
    if (updatedItem) {
      setActiveItem(updatedItem);
    }
  }, [activeChannel, channelItems]);

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
                <ChatChannelPreview
                  key={item.id}
                  title={item.patientName || 'Patient'}
                  subtitle={item.reportName}
                  risk={item.reportRisk}
                  lastMessageText={item.lastMessageText}
                  lastMessageAt={item.lastMessageAt}
                  unread={item.unread}
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
                  <Button size="sm" variant="outline" className="gap-1.5 shrink-0" asChild>
                    <a href={activeItem.reportUrl || '/doctor/cases'} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Report
                    </a>
                  </Button>
                  {activeItem.reportDownloadUrl && (
                    <Button size="sm" variant="outline" className="gap-1.5 shrink-0" asChild>
                      <a href={activeItem.reportDownloadUrl} target="_blank" rel="noreferrer">
                        <Download className="h-3.5 w-3.5" />
                        File
                      </a>
                    </Button>
                  )}
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
                    <ChatMessageBubble key={msg.id} msg={msg} isOwn={msg.userId === user?.id} />
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
        patientName={activeItem?.patientName ?? ''}
        reportId={activeItem?.reportId ?? ''}
        reportName={activeItem?.reportName ?? ''}
      />
    </DashboardLayout>
  );
}
