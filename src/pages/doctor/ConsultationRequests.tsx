import { useCallback, useEffect, useState } from 'react';
import { Clock, CheckCircle, XCircle, User, Phone, Mail, AlertTriangle, FileText, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { createConsultationChannel } from '@/hooks/useStreamChat';

interface PatientDetails {
  phone?: string;
  email?: string;
  symptoms?: string;
  urgency?: 'routine' | 'urgent' | 'emergency';
  preferredContact?: string;
}

interface ConsultationRequest {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  report_id: string;
  patient_message: string | null;
  patient_details: PatientDetails;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  created_at: string;
  responded_at: string | null;
  doctor_notes: string | null;
  stream_channel_id: string | null;
  patient_name?: string;
  patient_email?: string;
  report_name?: string;
}

const urgencyConfig = {
  routine: { label: 'Routine', variant: 'secondary' as const, icon: Clock },
  urgent: { label: 'Urgent', variant: 'default' as const, icon: AlertTriangle },
  emergency: { label: 'Emergency', variant: 'destructive' as const, icon: AlertTriangle },
};

const statusConfig = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  accepted: { label: 'Accepted', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  completed: { label: 'Completed', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
};

export default function DoctorConsultationRequests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [requests, setRequests] = useState<ConsultationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ConsultationRequest | null>(null);
  const [respondDialogOpen, setRespondDialogOpen] = useState(false);
  const [respondAction, setRespondAction] = useState<'accept' | 'reject' | null>(null);
  const [doctorNotes, setDoctorNotes] = useState('');
  const [responding, setResponding] = useState(false);

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // @ts-expect-error - consultation_requests table not yet in generated types
      const query = supabase.from('consultation_requests');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (query as any)
        .select('*')
        .or(`doctor_id.eq.${user.id},doctor_id.is.null`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const requestList = data as ConsultationRequest[];

      if (!requestList?.length) {
        setRequests([]);
        return;
      }

      // Fetch patient profiles and report names
      const patientIds = [...new Set(requestList.map(r => r.patient_id))];
      const reportIds = [...new Set(requestList.map(r => r.report_id))];

      const [profilesResult, reportsResult] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email').in('id', patientIds),
        supabase.from('mri_reports').select('id, file_name').in('id', reportIds),
      ]);

      const profilesMap = new Map((profilesResult.data || []).map(p => [p.id, p]));
      const reportsMap = new Map((reportsResult.data || []).map(r => [r.id, r]));

      const enriched = requestList.map(req => ({
        ...req,
        patient_name: profilesMap.get(req.patient_id)?.full_name || 'Unknown Patient',
        patient_email: profilesMap.get(req.patient_id)?.email,
        report_name: reportsMap.get(req.report_id)?.file_name || 'Unknown Report',
      }));

      setRequests(enriched);
    } catch (error) {
      console.error('Error fetching consultation requests:', error);
      toast({ title: 'Error', description: 'Failed to load consultation requests.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const openRespondDialog = (request: ConsultationRequest, action: 'accept' | 'reject') => {
    setSelectedRequest(request);
    setRespondAction(action);
    setDoctorNotes('');
    setRespondDialogOpen(true);
  };

  const handleRespond = async () => {
    if (!selectedRequest || !respondAction || !user) return;
    setResponding(true);
    try {
      const newStatus = respondAction === 'accept' ? 'accepted' : 'rejected';

      // @ts-expect-error - consultation_requests table not yet in generated types
      const updateQuery = supabase.from('consultation_requests');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (updateQuery as any)
        .update({
          status: newStatus,
          doctor_id: user.id, // Claim the request if it was for "any doctor"
          doctor_notes: doctorNotes || null,
          responded_at: new Date().toISOString(),
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      // If accepted, create a doctor_assignment so doc can access the report
      if (respondAction === 'accept') {
        const { error: assignError } = await supabase
          .from('doctor_assignments')
          .upsert({
            doctor_id: user.id,
            patient_id: selectedRequest.patient_id,
            report_id: selectedRequest.report_id,
          }, { onConflict: 'doctor_id,report_id' });

        if (assignError) {
          console.error('Assignment error (non-fatal):', assignError);
        }

        // Create a Stream channel if not already present
        if (!selectedRequest.stream_channel_id) {
          try {
            const channelId = await createConsultationChannel({
              consultation_id: selectedRequest.id,
              patient_id: selectedRequest.patient_id,
              patient_name: selectedRequest.patient_name ?? selectedRequest.patient_email ?? selectedRequest.patient_id,
              doctor_id: user.id,
              doctor_name: user.email ?? user.id,
              report_info: {
                name: selectedRequest.report_name,
                urgency: selectedRequest.patient_details?.urgency,
                symptoms: selectedRequest.patient_details?.symptoms,
                report_id: selectedRequest.report_id,
              },
            });
            // @ts-expect-error - consultation_requests not in generated types
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('consultation_requests') as any)
              .update({ stream_channel_id: channelId })
              .eq('id', selectedRequest.id);
          } catch (streamErr) {
            console.warn('[ConsultationRequests] Stream channel creation failed:', streamErr);
          }
        }
      }

      toast({
        title: respondAction === 'accept' ? 'Request Accepted' : 'Request Rejected',
        description: respondAction === 'accept'
          ? 'The patient\'s report has been added to your cases.'
          : 'The consultation request has been rejected.',
      });

      setRespondDialogOpen(false);
      fetchRequests();
    } catch (error) {
      console.error('Error responding to request:', error);
      toast({ title: 'Error', description: 'Failed to respond to request.', variant: 'destructive' });
    } finally {
      setResponding(false);
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <DashboardLayout
      title="Consultation Requests"
      subtitle={pendingCount > 0 ? `${pendingCount} pending request${pendingCount > 1 ? 's' : ''} awaiting your response` : 'Manage patient consultation requests'}
    >
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader><div className="h-4 bg-muted rounded w-3/4" /></CardHeader>
              <CardContent><div className="space-y-2"><div className="h-3 bg-muted rounded" /><div className="h-3 bg-muted rounded w-2/3" /></div></CardContent>
            </Card>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Consultation Requests</h3>
            <p className="text-muted-foreground">You have no consultation requests from patients yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {requests.map(request => {
            const urgency = request.patient_details?.urgency || 'routine';
            const urgencyCfg = urgencyConfig[urgency];
            const statusCfg = statusConfig[request.status];

            return (
              <Card key={request.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      {request.patient_name}
                    </CardTitle>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${statusCfg.className}`}>
                      {statusCfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={urgencyCfg.variant} className="text-xs">
                      <urgencyCfg.icon className="h-3 w-3 mr-1" />
                      {urgencyCfg.label}
                    </Badge>
                    {request.doctor_id === null && (
                      <Badge variant="outline" className="text-xs">Open Request</Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex-1 space-y-3">
                  {/* Report */}
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground truncate">{request.report_name}</span>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-1">
                    {request.patient_details?.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>{request.patient_details.phone}</span>
                      </div>
                    )}
                    {request.patient_details?.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{request.patient_details.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Symptoms */}
                  {request.patient_details?.symptoms && (
                    <div className="rounded-md bg-muted/50 p-2 text-sm">
                      <p className="font-medium text-xs text-muted-foreground mb-1">Symptoms</p>
                      <p className="line-clamp-2">{request.patient_details.symptoms}</p>
                    </div>
                  )}

                  {/* Patient Message */}
                  {request.patient_message && (
                    <div className="rounded-md bg-muted/50 p-2 text-sm">
                      <p className="font-medium text-xs text-muted-foreground mb-1">Message</p>
                      <p className="line-clamp-2">{request.patient_message}</p>
                    </div>
                  )}

                  {/* Doctor Notes (if responded) */}
                  {request.doctor_notes && (
                    <div className="rounded-md bg-muted/50 p-2 text-sm">
                      <p className="font-medium text-xs text-muted-foreground mb-1">Your Notes</p>
                      <p className="line-clamp-2">{request.doctor_notes}</p>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Received {new Date(request.created_at).toLocaleDateString()}
                  </p>

                  {/* Actions */}
                  {request.status === 'pending' && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => openRespondDialog(request, 'accept')}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => openRespondDialog(request, 'reject')}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                  {request.status === 'accepted' && (
                    <Button
                      size="sm"
                      className="w-full gap-1.5 mt-1"
                      onClick={() => navigate('/doctor/chat')}
                    >
                      <MessageSquare className="h-4 w-4" />
                      Open Chat
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Respond Dialog */}
      <Dialog open={respondDialogOpen} onOpenChange={setRespondDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {respondAction === 'accept' ? 'Accept Consultation Request' : 'Reject Consultation Request'}
            </DialogTitle>
            <DialogDescription>
              {respondAction === 'accept'
                ? `Accept the consultation request from ${selectedRequest?.patient_name}? Their report will be added to your cases.`
                : `Reject the consultation request from ${selectedRequest?.patient_name}?`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label htmlFor="doctor-notes">Notes to Patient (Optional)</Label>
            <Textarea
              id="doctor-notes"
              placeholder={respondAction === 'accept'
                ? 'e.g., I will review your report and get back to you within 24 hours...'
                : 'e.g., Please consult a specialist in cardiology...'}
              value={doctorNotes}
              onChange={e => setDoctorNotes(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondDialogOpen(false)} disabled={responding}>
              Cancel
            </Button>
            <Button
              variant={respondAction === 'accept' ? 'default' : 'destructive'}
              onClick={handleRespond}
              disabled={responding}
            >
              {responding ? 'Saving...' : respondAction === 'accept' ? 'Accept' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
