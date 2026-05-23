import { useEffect, useRef, useState } from 'react';
import { StreamChat, type OwnUserResponse } from 'stream-chat';
import { useAuth } from '@/hooks/useAuth';
import { buildApiUrl, createNetworkError, getApiBaseUrl } from '@/lib/apiBase';

const FLASK_BASE = getApiBaseUrl(import.meta.env.VITE_MRI_ANALYSIS_API_URL);
const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY ?? '';

export interface StreamChatState {
  client: StreamChat | null;
  ready: boolean;
  error: string | null;
}

export function useStreamChat(): StreamChatState {
  const { user, userRole } = useAuth();
  const clientRef = useRef<StreamChat | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !STREAM_API_KEY || STREAM_API_KEY === 'YOUR_STREAM_API_KEY') {
      setError(
        !STREAM_API_KEY || STREAM_API_KEY === 'YOUR_STREAM_API_KEY'
          ? 'Stream API key not configured. Add VITE_STREAM_API_KEY to your .env file.'
          : null,
      );
      return;
    }

    let cancelled = false;

    async function connect() {
      try {
        // Disconnect any previous client
        if (clientRef.current) {
          await clientRef.current.disconnectUser();
          clientRef.current = null;
        }

        const endpoint = buildApiUrl('/stream/token', FLASK_BASE);
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user!.id,
            user_name: user!.email ?? user!.id,
            user_role: userRole ?? 'patient',
          }),
        }).catch((fetchError) => {
          throw createNetworkError(endpoint, fetchError);
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? 'Failed to get Stream token');
        }

        const { token } = await res.json();

        if (cancelled) return;

        const chatClient = StreamChat.getInstance(STREAM_API_KEY);
        await chatClient.connectUser(
          {
            id: user!.id,
            name: user!.email ?? user!.id,
          } as OwnUserResponse,
          token,
        );

        if (cancelled) {
          await chatClient.disconnectUser();
          return;
        }

        clientRef.current = chatClient;
        setReady(true);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to connect to chat');
          setReady(false);
        }
      }
    }

    connect();

    return () => {
      cancelled = true;
      clientRef.current?.disconnectUser().catch(() => null);
      clientRef.current = null;
      setReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, userRole]);

  return { client: clientRef.current, ready, error };
}

/**
 * Call the Flask backend to create a Stream channel for a consultation.
 * Returns the channel_id on success.
 */
export async function createConsultationChannel(params: {
  consultation_id: string;
  patient_id: string;
  patient_name: string;
  doctor_id?: string | null;
  doctor_name?: string;
  doctor_notes?: string | null;
  report_info?: {
    name?: string;
    risk_level?: string;
    diagnosis?: string;
    urgency?: string;
    symptoms?: string;
    patient_message?: string;
    report_id?: string;
    report_url?: string | null;
    report_download_url?: string | null;
  };
}): Promise<string> {
  const endpoint = buildApiUrl('/stream/create-channel', FLASK_BASE);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }).catch((fetchError) => {
    throw createNetworkError(endpoint, fetchError);
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Failed to create Stream channel');
  }

  const { channel_id } = await res.json();
  return channel_id as string;
}

export async function createDoctorAdminSupportChannel(params: {
  doctor_id: string;
  doctor_name: string;
  doctor_email?: string | null;
  admins: Array<{
    id: string;
    name?: string | null;
    email?: string | null;
  }>;
}): Promise<string> {
  const endpoint = buildApiUrl('/stream/create-support-channel', FLASK_BASE);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }).catch((fetchError) => {
    throw createNetworkError(endpoint, fetchError);
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Failed to create Stream support channel');
  }

  const { channel_id } = await res.json();
  return channel_id as string;
}

export async function ensureStreamUsers(users: Array<{
  id: string;
  name?: string | null;
  role?: string | null;
}>): Promise<void> {
  await Promise.all(
    users
      .filter((user) => user.id)
      .map(async (user) => {
        const res = await fetch(`${FLASK_BASE}/stream/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            user_name: user.name || user.id,
            user_role: user.role || 'user',
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed to create Stream user ${user.id}`);
        }
      }),
  );
}
