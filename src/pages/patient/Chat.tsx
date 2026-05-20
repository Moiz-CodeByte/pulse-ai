import { useState, useEffect, useRef, useCallback } from 'react';
import type { Channel as StreamChannel } from 'stream-chat';
import { MessageSquare, Send, Loader2, AlertCircle, FileText, Download, Pill, ExternalLink, PanelRightClose, PanelRightOpen, X } from 'lucide-react';
import { format } from 'date-fns';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { ReportAnalysisPanel } from '@/components/reports/ReportAnalysisPanel';
import { ReportImagePreview } from '@/components/reports/ReportImagePreview';
import type { BaseReportDiagnosis, BaseReportRecord } from '@/components/reports/types';
import { FormattedChatText } from '@/components/chat/FormattedChatText';
import { ChatChannelPreview } from '@/components/chat/ChatChannelPreview';
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble';
import { CaseTimeline, type CaseTimelineItem } from '@/components/cases/CaseTimeline';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useStreamChat } from '@/hooks/useStreamChat';
import { supabase } from '@/integrations/supabase/client';
import { getPrescriptionMedicineLines } from '@/lib/prescriptions';
import { createMRISignedUrl, downloadMRIReportPdf, normalizeSingleRelation } from '@/lib/mriReports';
import { buildSequenceMap, formatCaseLabel, formatReportLabel } from '@/lib/caseLabels';

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
  reportId: string;
  reportUrl: string;
  reportDownloadUrl: string;
  consultationId: string;
  doctorId: string;
  doctorName: string;
  lastMessageText: string;
  lastMessageAt: Date | null;
  unread: number;
}

interface Prescription {
  id: string;
  medicine: string;
  dosage: string | null;
  instructions: string | null;
  notes: string | null;
  created_at: string;
}

interface ChatReport extends BaseReportRecord {
  patient_id: string;
  diagnosis?: BaseReportDiagnosis;
}

function cleanMessageText(text: string): string {
  return text.replace(/Ã°Å¸â€œâ€¹\s*/g, '').replace(/Ã¢â‚¬â€/g, '-');
}

function renderFormattedText(text: string) {
  const urlParts = cleanMessageText(text).split(/(https?:\/\/[^\s]+)/g);

  return urlParts.map((part, partIndex) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={`${part}-${partIndex}`}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="font-medium underline underline-offset-2"
        >
          {part}
        </a>
      );
    }

    return part.split(/(\*\*[^*]+\*\*)/g).map((piece, pieceIndex) => {
      if (piece.startsWith('**') && piece.endsWith('**')) {
        return (
          <strong key={`${partIndex}-${pieceIndex}`} className="font-semibold">
            {piece.slice(2, -2)}
          </strong>
        );
      }

      return <span key={`${partIndex}-${pieceIndex}`}>{piece}</span>;
    });
  });
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
            {item.doctorName || 'Doctor'}
          </p>
          <p className="text-xs text-muted-foreground truncate">{item.reportName || 'Consultation'}</p>
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

/* ── Message Bubble ──────────────────────────────────────────── */
function MessageBubble({ msg, isOwn }: { msg: ChatMsg; isOwn: boolean }) {
  const renderText = (text: string) => {
    const cleanedText = text
      .replace(/ðŸ“‹\s*/g, '')
      .replace(/â€”/g, '-')
      .replace(/\*\*/g, '\u0000');
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
      ) : (
        <span key={`${part}-${index}`}>
          {part.replace(/\u0000/g, '**').split(/(\*\*[^*]+\*\*)/g).map((piece, pieceIndex) =>
            piece.startsWith('**') && piece.endsWith('**') ? (
              <strong key={`${index}-${pieceIndex}`} className="font-semibold">
                {piece.slice(2, -2)}
              </strong>
            ) : (
              <span key={`${index}-${pieceIndex}`}>{piece}</span>
            ),
          )}
        </span>
      ),
    );
  };

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
          <FormattedChatText text={msg.text} />
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
  const doctorId =
    Object.values(ch.state.members ?? {}).find((member) => member.user?.id !== userId)?.user?.id as string | undefined;
  return {
    channel: ch,
    id: ch.id ?? '',
    reportName: (data.report_name as string) || 'Consultation',
    reportRisk: (data.report_risk as string) || '',
    reportId: (data.report_id as string) || '',
    reportUrl: (data.report_url as string) || '',
    reportDownloadUrl: (data.report_download_url as string) || '',
    consultationId: (data.consultation_id as string) || '',
    doctorId: doctorId || '',
    doctorName:
      (data.doctor_name as string) ||
      (Object.values(ch.state.members ?? {}).find((member) => member.user?.id !== userId)?.user?.name as string) ||
      'Doctor',
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
  const consultationIds = [
    ...new Set(items.map(getConsultationIdFromChannel).filter(Boolean)),
  ];
  const doctorIdsFromChannels = [
    ...new Set(items.map((item) => item.doctorId).filter(Boolean)),
  ];

  if (!consultationIds.length && !doctorIdsFromChannels.length) {
    return items;
  }

  // @ts-expect-error - consultation_requests table not yet in generated types
  const consultationQuery = supabase.from('consultation_requests');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let request = (consultationQuery as any)
    .select('id, doctor_id, report_id, status, created_at, responded_at')
    .order('responded_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (doctorIdsFromChannels.length) {
    request = request.in('doctor_id', doctorIdsFromChannels).eq('status', 'accepted');
  } else {
    request = request.in('id', consultationIds);
  }

  const { data: consultations, error } = await request;

  if (error || !consultations?.length) {
    return items;
  }

  const consultationMap = new Map(
    (consultations as Array<{ id: string; doctor_id: string | null; report_id: string }>).map((consultation) => [
      consultation.id,
      consultation,
    ]),
  );
  const latestByDoctorMap = new Map<string, { id: string; doctor_id: string | null; report_id: string }>();

  for (const consultation of consultations as Array<{ id: string; doctor_id: string | null; report_id: string }>) {
    if (consultation.doctor_id && !latestByDoctorMap.has(consultation.doctor_id)) {
      latestByDoctorMap.set(consultation.doctor_id, consultation);
    }
  }
  const doctorIds = [
    ...new Set(
      (consultations as Array<{ doctor_id: string | null }>)
        .map((consultation) => consultation.doctor_id)
        .filter(Boolean),
    ),
  ] as string[];
  const reportIds = [
    ...new Set((consultations as Array<{ report_id: string }>).map((consultation) => consultation.report_id)),
  ];

  const [profilesResult, reportsResult] = await Promise.all([
    doctorIds.length
      ? supabase.from('profiles').select('id, full_name').in('id', doctorIds)
      : Promise.resolve({ data: [], error: null }),
    reportIds.length
      ? supabase.from('mri_reports').select('id, file_name').in('id', reportIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const doctorNameMap = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.full_name]));
  const reportNameMap = new Map((reportsResult.data ?? []).map((report) => [report.id, report.file_name]));

  return items.map((item) => {
    const consultationId = getConsultationIdFromChannel(item);
    const consultation = item.doctorId
      ? latestByDoctorMap.get(item.doctorId) ?? consultationMap.get(consultationId)
      : consultationMap.get(consultationId);

    if (!consultation) {
      return item;
    }

    return {
      ...item,
      consultationId: consultation.id,
      reportId: consultation.report_id || item.reportId,
      reportName:
        item.reportName === 'Consultation' || consultation.report_id !== item.reportId
          ? reportNameMap.get(consultation.report_id) ?? item.reportName
          : item.reportName,
      doctorName:
        consultation.doctor_id
          ? doctorNameMap.get(consultation.doctor_id) ?? item.doctorName
          : item.doctorName,
    };
  });
}

function dedupeDoctorChannels(items: ChannelItem[]): ChannelItem[] {
  const byDoctor = new Map<string, ChannelItem>();

  for (const item of items) {
    const key = item.doctorId || item.id;
    const current = byDoctor.get(key);

    if (!current || (item.lastMessageAt?.getTime() ?? 0) > (current.lastMessageAt?.getTime() ?? 0)) {
      byDoctor.set(key, item);
    }
  }

  return [...byDoctor.values()].sort(
    (a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0),
  );
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
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [caseTimeline, setCaseTimeline] = useState<CaseTimelineItem[]>([]);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ChatReport | null>(null);
  const [selectedReportUrl, setSelectedReportUrl] = useState<string | null>(null);
  const [selectedReportLoading, setSelectedReportLoading] = useState(false);
  const [patientName, setPatientName] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setPatientName(data?.full_name || user.email || null));
  }, [user]);

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
              setChannelItems(dedupeDoctorChannels(items));
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
        const channelItem = toChannelItem(activeChannel, user.id);
        // update list item too
        setChannelItems((prev) =>
          prev.map((it) =>
            it.id === activeChannel.id
              ? {
                  ...it,
                  ...channelItem,
                  reportId: channelItem.reportId || it.reportId,
                  reportName: channelItem.reportName === 'Consultation' ? it.reportName : channelItem.reportName,
                  doctorName: channelItem.doctorName === 'Doctor' ? it.doctorName : channelItem.doctorName,
                }
              : it,
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

  const activeItem = channelItems.find((it) => it.id === activeChannel?.id);

  const fetchPrescriptions = useCallback(async () => {
    if (!activeItem?.reportId) {
      setPrescriptions([]);
      return;
    }

    setLoadingPrescriptions(true);
    try {
      const { data: diagnosis, error: diagnosisError } = await supabase
        .from('diagnosis')
        .select('id')
        .eq('report_id', activeItem.reportId)
        .maybeSingle();

      if (diagnosisError || !diagnosis?.id) {
        setPrescriptions([]);
        return;
      }

      const { data: prescriptionRows, error: prescriptionsError } = await supabase
        .from('prescriptions')
        .select('id, medicine, dosage, instructions, notes, created_at')
        .eq('diagnosis_id', diagnosis.id)
        .order('created_at', { ascending: false });

      if (prescriptionsError) {
        setPrescriptions([]);
        return;
      }

      setPrescriptions((prescriptionRows ?? []) as Prescription[]);
    } finally {
      setLoadingPrescriptions(false);
    }
  }, [activeItem?.reportId]);

  useEffect(() => {
    void fetchPrescriptions();
  }, [fetchPrescriptions, messages.length]);

  const fetchCaseTimeline = useCallback(async () => {
    if (!activeItem?.doctorId || !user) {
      setCaseTimeline([]);
      return;
    }

    // @ts-expect-error - consultation_requests table not yet in generated types
    const consultationQuery = supabase.from('consultation_requests');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: consultations, error } = await (consultationQuery as any)
      .select('id, report_id, patient_message, doctor_notes, status, created_at, responded_at')
      .eq('doctor_id', activeItem.doctorId)
      .eq('patient_id', user.id)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false });

    if (error || !consultations?.length) {
      setCaseTimeline([]);
      return;
    }

    const reportIds = [...new Set((consultations as Array<{ report_id: string }>).map((item) => item.report_id))];
    const { data: reports } = await supabase
      .from('mri_reports')
      .select(`
        id,
        file_name,
        status,
        diagnosis (
          id,
          risk_level,
          prescriptions (
            id,
            medicine,
            dosage,
            instructions,
            notes
          )
        )
      `)
      .in('id', reportIds);

    const reportMap = new Map((reports ?? []).map((report) => {
      const diagnosis = normalizeSingleRelation(
        report.diagnosis as Array<{
          id: string;
          risk_level: string;
          prescriptions?: CaseTimelineItem['prescriptions'];
        }> | {
          id: string;
          risk_level: string;
          prescriptions?: CaseTimelineItem['prescriptions'];
        } | null | undefined,
      );

      return [report.id, { ...report, diagnosis }];
    }));
    const reportSequenceMap = buildSequenceMap(reports ?? []);
    const caseSequenceMap = buildSequenceMap(consultations as Array<{ id: string; created_at: string }>);

    setCaseTimeline(
      (consultations as Array<{
        id: string;
        report_id: string;
        patient_message: string | null;
        doctor_notes: string | null;
        status: string;
        created_at: string;
      }>).map((item) => {
        const report = reportMap.get(item.report_id);
        const reportLabel = formatReportLabel({
          patientName,
          patientEmail: user.email,
          reportNumber: reportSequenceMap.get(item.report_id),
        });

        return {
          id: item.id,
          reportId: item.report_id,
          reportName: reportLabel,
          caseName: formatCaseLabel({
            reportLabel,
            caseNumber: caseSequenceMap.get(item.id),
          }),
          requestedAt: item.created_at,
          status: item.status,
          riskLevel: report?.diagnosis?.risk_level,
          patientMessage: item.patient_message,
          doctorNotes: item.doctor_notes,
          prescriptions: report?.diagnosis?.prescriptions ?? [],
        };
      }),
    );
  }, [activeItem?.doctorId, patientName, user]);

  useEffect(() => {
    void fetchCaseTimeline();
  }, [fetchCaseTimeline, messages.length]);

  const fetchReportById = useCallback(async (reportId?: string | null): Promise<ChatReport | null> => {
    if (!reportId) {
      return null;
    }

    const { data, error } = await supabase
      .from('mri_reports')
      .select(`
        id,
        file_name,
        file_url,
        patient_id,
        status,
        created_at,
        diagnosis (
          risk_level,
          confidence,
          details
        )
      `)
      .eq('id', reportId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      ...data,
      diagnosis: normalizeSingleRelation(
        data.diagnosis as BaseReportDiagnosis | BaseReportDiagnosis[] | null | undefined,
      ),
    };
  }, []);

  const fetchActiveReport = useCallback(async (): Promise<ChatReport | null> => {
    return fetchReportById(activeItem?.reportId);
  }, [activeItem?.reportId, fetchReportById]);

  const downloadReportPdf = useCallback(async (report: ChatReport) => {
    await downloadMRIReportPdf({
      reportId: report.id,
      fileName: report.file_name,
      fileReference: report.file_url,
      createdAt: report.created_at,
      status: report.status,
      riskLevel: report.diagnosis?.risk_level,
      confidence: report.diagnosis?.confidence,
      details: report.diagnosis?.details,
    });
  }, []);

  const openTimelineReport = useCallback(async (item: CaseTimelineItem) => {
    setSelectedReportLoading(true);
    setSelectedReportUrl(null);
    const report = await fetchReportById(item.reportId);
    setSelectedReport(report);

    if (report) {
      try {
        setSelectedReportUrl(await createMRISignedUrl(report.file_url));
      } catch {
        setSelectedReportUrl(null);
      }
    }

    setSelectedReportLoading(false);
  }, [fetchReportById]);

  const downloadTimelineReport = useCallback(async (item: CaseTimelineItem) => {
    const report = await fetchReportById(item.reportId);

    if (!report) {
      return;
    }

    await downloadReportPdf(report);
  }, [downloadReportPdf, fetchReportById]);

  const openReportDetails = useCallback(async () => {
    setSelectedReportLoading(true);
    setSelectedReportUrl(null);
    const report = await fetchActiveReport();
    setSelectedReport(report);

    if (report) {
      try {
        setSelectedReportUrl(await createMRISignedUrl(report.file_url));
      } catch {
        setSelectedReportUrl(null);
      }
    }

    setSelectedReportLoading(false);
  }, [fetchActiveReport]);

  const downloadActiveReport = useCallback(async () => {
    const report = await fetchActiveReport();

    if (!report) {
      return;
    }

    await downloadReportPdf(report);
  }, [downloadReportPdf, fetchActiveReport]);

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

  return (
    <DashboardLayout title="My Consultations">
      <div className="flex h-[calc(100vh-4rem)] min-h-0 flex-col overflow-hidden border bg-background md:flex-row">
        {/* ── Sidebar ── */}
        <div className="flex h-56 shrink-0 flex-col border-b border-border bg-card md:h-auto md:w-72 md:border-b-0 md:border-r">
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
                <ChatChannelPreview
                  key={item.id}
                  title={item.doctorName || 'Doctor'}
                  subtitle={item.reportName || 'Consultation'}
                  risk={item.reportRisk}
                  lastMessageText={item.lastMessageText}
                  lastMessageAt={item.lastMessageAt}
                  unread={item.unread}
                  active={item.id === activeChannel?.id}
                  onClick={() => setActiveChannel(item.channel)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Chat Area ── */}
        <div className="flex-1 min-h-0 min-w-0 flex flex-col bg-background">
          {activeChannel && activeItem ? (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-border bg-card shrink-0 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{activeItem.doctorName || 'Doctor'}</p>
                  <p className="text-xs text-muted-foreground truncate">{activeItem.reportName}</p>
                  {activeItem.reportRisk && (
                    <span className="text-xs text-muted-foreground">
                      Risk: {activeItem.reportRisk.toUpperCase()}
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 shrink-0"
                  onClick={() => setDetailsOpen((current) => !current)}
                >
                  {detailsOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                  <span className="hidden sm:inline">{detailsOpen ? 'Hide Details' : 'Show Details'}</span>
                </Button>
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
                    <ChatMessageBubble
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

        {activeItem && detailsOpen && (
          <div className="flex max-h-[45vh] min-w-0 shrink-0 flex-col border-t border-border bg-card md:max-h-none md:w-96 md:border-l md:border-t-0 xl:w-[26rem]">
            <ScrollArea className="flex-1">
              <div className="min-w-0 space-y-4 p-3 sm:p-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      Case Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
                    <CaseTimeline
                      items={caseTimeline}
                      onViewReport={(item) => void openTimelineReport(item)}
                      onDownloadReport={(item) => void downloadTimelineReport(item)}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        Case Report
                      </CardTitle>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailsOpen(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm font-medium break-words">{activeItem.reportName}</p>
                      <p className="text-xs text-muted-foreground mt-1">{activeItem.doctorName}</p>
                    </div>
                    {activeItem.reportRisk && (
                      <Badge variant="outline">{activeItem.reportRisk.toUpperCase()} Risk</Badge>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => void openReportDetails()}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => void downloadActiveReport()}>
                        <Download className="mr-2 h-4 w-4" />
                        PDF
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Pill className="h-4 w-4 text-primary" />
                      Medicines
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {loadingPrescriptions ? (
                      <div className="flex justify-center py-3">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : prescriptions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No prescription added yet.</p>
                    ) : (
                      prescriptions.map((prescription) => {
                        const medicineLines = getPrescriptionMedicineLines(prescription);

                        return (
                          <div key={prescription.id} className="rounded-md border p-3 text-sm space-y-3">
                            {medicineLines.map((medicine, index) => (
                              <div key={`${medicine.name}-${index}`} className="space-y-1">
                                <p className="font-medium">
                                  {index + 1}. {medicine.name}
                                  {medicine.dose ? <span className="text-muted-foreground"> - {medicine.dose}</span> : null}
                                </p>
                                {medicine.frequency && (
                                  <p className="text-muted-foreground">Frequency: {medicine.frequency}</p>
                                )}
                                {medicine.duration && (
                                  <p className="text-muted-foreground">Duration: {medicine.duration}</p>
                                )}
                              </div>
                            ))}
                            {prescription.notes && <p className="text-muted-foreground">{prescription.notes}</p>}
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      <Dialog open={!!selectedReport || selectedReportLoading} onOpenChange={(open) => {
        if (!open) {
          setSelectedReport(null);
          setSelectedReportUrl(null);
          setSelectedReportLoading(false);
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Report Details</DialogTitle>
          </DialogHeader>
          {selectedReport ? (
            <ReportAnalysisPanel
              analysis={selectedReport.diagnosis}
              preview={
                <ReportImagePreview
                  loading={selectedReportLoading}
                  imageUrl={selectedReportUrl}
                  alt={selectedReport.file_name}
                  fallbackText="The MRI image could not be loaded for this report."
                />
              }
              sidebarContent={
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Report Status
                  </p>
                  <p className="mt-2 text-sm capitalize text-foreground">
                    {selectedReport.status}
                  </p>
                </div>
              }
              actionBar={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedReport && void downloadReportPdf(selectedReport)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              }
            />
          ) : (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
