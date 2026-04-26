import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export type ReportAction = 'view' | 'download' | 'prescribe';

interface ReportActionAccessInput {
  action: ReportAction;
  role: AppRole | null;
  isVerified: boolean;
  currentUserId?: string | null;
  reportPatientId?: string | null;
  assignedPatientIds?: string[];
}

export function canUseReportAction({
  role,
  isVerified,
  currentUserId,
  reportPatientId,
  assignedPatientIds,
}: ReportActionAccessInput): boolean {
  if (!role) {
    return false;
  }

  if (role === 'admin') {
    return true;
  }

  if (role === 'patient') {
    if (currentUserId && reportPatientId) {
      return currentUserId === reportPatientId;
    }

    return true;
  }

  if (role === 'doctor') {
    if (!isVerified || !reportPatientId) {
      return false;
    }

    return (assignedPatientIds ?? []).includes(reportPatientId);
  }

  return false;
}