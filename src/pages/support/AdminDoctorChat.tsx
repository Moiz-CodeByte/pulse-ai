import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Channel as StreamChannel } from 'stream-chat';
import { AlertCircle, CheckCircle2, Eye, Loader2, MessageSquare, Send, ShieldCheck, Stethoscope } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ChatChannelPreview } from '@/components/chat/ChatChannelPreview';
import { ChatMessageBubble, type SharedChatMessage } from '@/components/chat/ChatMessageBubble';
import { DoctorProfileReviewDialog } from '@/components/admin/DoctorProfileReviewDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { createDoctorAdminSupportChannel, ensureStreamUsers, useStreamChat } from '@/hooks/useStreamChat';
import { cn } from '@/lib/utils';

interface AdminProfile {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface SupportChannelItem {
  channel: StreamChannel;
  id: string;
  doctorId: string;
  doctorName: string;
  doctorEmail: string;
  assignedAdminId: string;
  assignedAdminName: string;
  lastMessageText: string;
  lastMessageAt: Date | null;
  unread: number;
}

interface StreamMessageLike {
  id?: string;
  text?: string;
  type?: string;
  created_at?: Date | string;
  user?: {
    id?: string;
    name?: string;
  };
}

interface ChannelEventLike {
  channel?: {
    type?: string;
    id?: string;
  };
}

function toMessage(message: StreamMessageLike): SharedChatMessage {
  return {
    id: message.id ?? '',
    text: message.text ?? '',
    userId: message.user?.id ?? '',
    userName: message.user?.name ?? message.user?.id ?? 'Unknown',
    createdAt: message.created_at instanceof Date ? message.created_at : new Date(message.created_at ?? Date.now()),
    isSystem: message.type === 'system',
  };
}

function toSupportChannelItem(channel: StreamChannel, myUserId: string): SupportChannelItem {
  const data = (channel.data ?? {}) as Record<string, unknown>;
  const messages = channel.state.messages;
  const last = messages[messages.length - 1];
  const memberIds = Object.keys(channel.state.members ?? {});
  const doctorId = (data.support_doctor_id as string) || memberIds.find((id) => id !== myUserId) || '';

  return {
    channel,
    id: channel.id ?? '',
    doctorId,
    doctorName: (data.support_doctor_name as string) || 'Doctor',
    doctorEmail: (data.support_doctor_email as string) || '',
    assignedAdminId: (data.assigned_admin_id as string) || '',
    assignedAdminName: (data.assigned_admin_name as string) || '',
    lastMessageText: last?.text ?? '',
    lastMessageAt: last?.created_at
      ? last.created_at instanceof Date
        ? last.created_at
        : new Date(last.created_at as string)
      : null,
    unread: channel.countUnread(),
  };
}

async function fetchAdminProfiles(): Promise<AdminProfile[]> {
  const { data: roles, error: roleError } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'admin');

  if (roleError) {
    throw roleError;
  }

  const adminIds = (roles ?? []).map((role) => role.user_id).filter(Boolean);
  if (!adminIds.length) {
    return [];
  }

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', adminIds);

  if (profileError) {
    throw profileError;
  }

  return profiles ?? [];
}

async function fetchOwnProfile(userId: string): Promise<AdminProfile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', userId)
    .maybeSingle();

  return data ?? null;
}

export default function AdminDoctorChat() {
  const { user, userRole, isVerified } = useAuth();
  const { client, ready, error } = useStreamChat();
  const [channels, setChannels] = useState<SupportChannelItem[]>([]);
  const [activeChannel, setActiveChannel] = useState<StreamChannel | null>(null);
  const [activeItem, setActiveItem] = useState<SupportChannelItem | null>(null);
  const [messages, setMessages] = useState<SharedChatMessage[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isAdmin = userRole === 'admin';
  const title = isAdmin ? 'Doctor Support Chat' : 'Verification Support';
  const subtitle = isAdmin
    ? 'Reply to unverified doctors and continue assigned verification conversations'
    : 'Chat with the admin team while your doctor account is under review';

  const visibleChannels = useMemo(() => {
    if (!isAdmin || !user) {
      return channels;
    }

    return channels.filter((item) => !item.assignedAdminId || item.assignedAdminId === user.id);
  }, [channels, isAdmin, user]);

  const refreshChannelItem = useCallback((channel: StreamChannel) => {
    if (!user) {
      return;
    }

    const item = toSupportChannelItem(channel, user.id);
    setChannels((current) => {
      const withoutCurrent = current.filter((entry) => entry.id !== item.id);
      return [item, ...withoutCurrent].sort(
        (a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0),
      );
    });

    setActiveItem((current) => (current?.id === item.id ? item : current));
  }, [user]);

  useEffect(() => {
    if (!client || !user || !ready) {
      return;
    }

    let cancelled = false;
    setLoadingChannels(true);
    setSetupError(null);

    async function loadDoctorChannel() {
      const admins = await fetchAdminProfiles();
      if (!admins.length) {
        throw new Error('No admin account is available for chat right now.');
      }

      const ownProfile = await fetchOwnProfile(user!.id);
      const doctorName = ownProfile?.full_name || user!.email || 'Doctor';
      const adminMembers = admins.map((admin) => ({
        id: admin.id,
        name: admin.full_name || admin.email || 'Admin',
        email: admin.email,
      }));
      const supportChannelData = {
        members: [user!.id, ...adminMembers.map((admin) => admin.id)],
        name: `${doctorName} verification support`,
        support_type: 'doctor_verification',
        support_doctor_id: user!.id,
        support_doctor_name: doctorName,
        support_doctor_email: ownProfile?.email || user!.email || '',
      };
      let channelId = `doctor-admin-support-${user!.id}`;
      let channel: StreamChannel;

      try {
        channelId = await createDoctorAdminSupportChannel({
          doctor_id: user!.id,
          doctor_name: doctorName,
          doctor_email: ownProfile?.email || user!.email || '',
          admins: adminMembers,
        });
        channel = client!.channel('messaging', channelId);
      } catch (supportEndpointError) {
        console.warn('[AdminDoctorChat] support endpoint unavailable, using Stream user upsert fallback:', supportEndpointError);
        await ensureStreamUsers([
          {
            id: user!.id,
            name: doctorName,
            role: 'doctor',
          },
          ...adminMembers.map((admin) => ({
            id: admin.id,
            name: admin.name,
            role: 'admin',
          })),
        ]);
        channel = client!.channel('messaging', channelId, supportChannelData);
      }

      await channel.watch({ presence: false });

      if (cancelled) {
        return;
      }

      const item = toSupportChannelItem(channel, user!.id);
      setChannels([item]);
      setActiveChannel(channel);
      setActiveItem(item);
    }

    async function loadAdminChannels() {
      const found = await client!.queryChannels(
        {
          type: 'messaging',
          members: { $in: [user!.id] },
          support_type: 'doctor_verification',
        },
        { last_message_at: -1 },
        { limit: 50, state: true, watch: true },
      );

      if (cancelled) {
        return;
      }

      setChannels(found.map((channel) => toSupportChannelItem(channel, user!.id)));
    }

    (isAdmin ? loadAdminChannels() : loadDoctorChannel())
      .catch((err) => {
        if (!cancelled) {
          setSetupError(err instanceof Error ? err.message : 'Failed to load support chat.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingChannels(false);
        }
      });

    const onNewMessage = (event: ChannelEventLike) => {
      const eventChannel = event.channel;
      const channel =
        eventChannel?.type && eventChannel.id ? client.channel(eventChannel.type, eventChannel.id) : null;
      if (channel) {
        refreshChannelItem(channel);
      }
    };

    client.on('message.new', onNewMessage);

    return () => {
      cancelled = true;
      client.off('message.new', onNewMessage);
    };
  }, [client, isAdmin, ready, refreshChannelItem, user]);

  useEffect(() => {
    if (!activeChannel || !user) {
      return;
    }

    let cancelled = false;
    setLoadingMessages(true);
    setMessages([]);

    activeChannel
      .watch({ presence: false })
      .then(() => {
        if (cancelled) {
          return;
        }

        setMessages(activeChannel.state.messages.map(toMessage));
        activeChannel.markRead().catch(() => null);
        setLoadingMessages(false);
        refreshChannelItem(activeChannel);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadingMessages(false);
        }
      });

    const onMessage = () => {
      if (!cancelled) {
        setMessages(activeChannel.state.messages.map(toMessage));
        activeChannel.markRead().catch(() => null);
        refreshChannelItem(activeChannel);
      }
    };

    activeChannel.on('message.new', onMessage);
    activeChannel.on('message.updated', onMessage);

    return () => {
      cancelled = true;
      activeChannel.off('message.new', onMessage);
      activeChannel.off('message.updated', onMessage);
    };
  }, [activeChannel, refreshChannelItem, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openChannel = (item: SupportChannelItem) => {
    setActiveChannel(item.channel);
    setActiveItem(item);
  };

  const sendMessage = async () => {
    const body = text.trim();
    if (!body || !activeChannel || !user || sending) {
      return;
    }

    const shouldAssignToCurrentAdmin = isAdmin && activeItem && !activeItem.assignedAdminId;

    setSending(true);
    try {
      await activeChannel.sendMessage({ text: body });
      setText('');

      if (shouldAssignToCurrentAdmin) {
        try {
          const profile = await fetchOwnProfile(user.id);
          const adminName = profile?.full_name || user.email || 'Admin';
          await activeChannel.updatePartial({
            set: {
              assigned_admin_id: user.id,
              assigned_admin_name: adminName,
            },
          });
        } catch (assignmentError) {
          console.warn('[AdminDoctorChat] message sent, but support chat assignment failed:', assignmentError);
        }
      }

      refreshChannelItem(activeChannel);
    } catch (sendError) {
      console.error('[AdminDoctorChat] failed to send support message:', sendError);
      setSetupError(sendError instanceof Error ? sendError.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const assignedToAnotherAdmin =
    isAdmin && activeItem?.assignedAdminId && activeItem.assignedAdminId !== user?.id;

  return (
    <DashboardLayout title={title} subtitle={subtitle}>
      <div className="grid min-h-[calc(100vh-12rem)] overflow-hidden rounded-lg border bg-card lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="border-b bg-muted/20 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            {isAdmin ? <ShieldCheck className="h-4 w-4 text-primary" /> : <Stethoscope className="h-4 w-4 text-primary" />}
            <h2 className="font-semibold">{isAdmin ? 'Doctor Requests' : 'Admin Team'}</h2>
          </div>

          {error || setupError ? (
            <Alert variant="destructive" className="m-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error || setupError}</AlertDescription>
            </Alert>
          ) : loadingChannels ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : visibleChannels.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No support chats yet.
            </div>
          ) : (
            <div className="max-h-[45vh] overflow-y-auto lg:max-h-[calc(100vh-16rem)]">
              {visibleChannels.map((item) => (
                <ChatChannelPreview
                  key={item.id}
                  title={isAdmin ? item.doctorName : item.assignedAdminName || 'Admin Support'}
                  subtitle={isAdmin ? item.doctorEmail : item.assignedAdminName ? `Assigned to ${item.assignedAdminName}` : 'Waiting for first admin reply'}
                  meta={item.assignedAdminName ? `Handled by ${item.assignedAdminName}` : 'Open request'}
                  lastMessageText={item.lastMessageText}
                  lastMessageAt={item.lastMessageAt}
                  unread={item.unread}
                  active={activeItem?.id === item.id}
                  onClick={() => openChannel(item)}
                />
              ))}
            </div>
          )}
        </aside>

        <section className="flex min-h-[620px] min-w-0 flex-col">
          {activeChannel && activeItem ? (
            <>
              <div className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">
                    {isAdmin ? activeItem.doctorName : activeItem.assignedAdminName || 'Admin Support'}
                  </h2>
                  <p className="truncate text-sm text-muted-foreground">
                    {isAdmin ? activeItem.doctorEmail || 'Doctor verification request' : 'Verification support chat'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isAdmin && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => setReviewOpen(true)}
                    >
                      <Eye className="h-4 w-4" />
                      Review Profile
                    </Button>
                  )}
                  <Badge variant={activeItem.assignedAdminName ? 'default' : 'outline'} className="w-fit">
                    {activeItem.assignedAdminName ? `Assigned to ${activeItem.assignedAdminName}` : 'Open request'}
                  </Badge>
                </div>
              </div>

              {!isAdmin && !isVerified && (
                <Alert className="m-4">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Your professional profile has been submitted. Send any credential notes or questions here; the first admin who replies will continue this chat with you.
                  </AlertDescription>
                </Alert>
              )}

              {assignedToAnotherAdmin && (
                <Alert className="m-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This request is already assigned to {activeItem.assignedAdminName || 'another admin'}.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex-1 overflow-y-auto bg-background/50 p-4">
                {loadingMessages ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : messages.length === 0 ? (
                  <Card className="mx-auto mt-12 max-w-md text-center">
                    <CardContent className="space-y-3 p-6">
                      <MessageSquare className="mx-auto h-10 w-10 text-primary" />
                      <p className="font-medium">
                        {isAdmin ? 'No messages yet' : 'Start a verification chat'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {isAdmin
                          ? 'When you reply first, this chat will be assigned to you.'
                          : 'Ask the admin team about your verification or share extra credential details.'}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  messages.map((message) => (
                    <ChatMessageBubble key={message.id} msg={message} isOwn={message.userId === user?.id} />
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              <div className="border-t bg-card p-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        sendMessage();
                      }
                    }}
                    disabled={!!assignedToAnotherAdmin}
                    placeholder={assignedToAnotherAdmin ? 'This chat is assigned to another admin' : 'Type a message...'}
                    className="min-h-12 flex-1 resize-none"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!text.trim() || sending || !!assignedToAnotherAdmin}
                    className={cn('gap-2 sm:self-end')}
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-muted-foreground">
              {isAdmin ? 'Choose a doctor support chat from the sidebar.' : 'Preparing your admin support chat...'}
            </div>
          )}
        </section>
      </div>
      <DoctorProfileReviewDialog
        doctor={
          activeItem
            ? {
                id: activeItem.doctorId,
                full_name: activeItem.doctorName,
                email: activeItem.doctorEmail,
              }
            : null
        }
        open={reviewOpen}
        onOpenChange={setReviewOpen}
      />
    </DashboardLayout>
  );
}
