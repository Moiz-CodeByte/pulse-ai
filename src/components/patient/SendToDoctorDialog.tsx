import { useState, useEffect } from 'react';
import { Send, User, Phone, Mail, MessageSquare, AlertCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { createConsultationChannel } from '@/hooks/useStreamChat';

interface Doctor {
  id: string;
  full_name: string;
  specialization?: string;
  years_of_experience?: number;
}

interface SendToDoctorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string;
  reportName: string;
}

export function SendToDoctorDialog({ open, onOpenChange, reportId, reportName }: SendToDoctorDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [sending, setSending] = useState(false);
  
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('any');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [message, setMessage] = useState('');
  const [urgency, setUrgency] = useState<'routine' | 'urgent' | 'emergency'>('routine');

  useEffect(() => {
    if (open) {
      fetchVerifiedDoctors();
      // Pre-fill email from user profile
      if (user?.email) {
        setContactEmail(user.email);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  const fetchVerifiedDoctors = async () => {
    setLoadingDoctors(true);
    try {
      // Get all users with doctor role
      const { data: doctorRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'doctor');

      if (rolesError) throw rolesError;

      const doctorIds = doctorRoles?.map(r => r.user_id) || [];
      console.log('[SendToDoctor] Doctor IDs from user_roles:', doctorIds);

      if (doctorIds.length === 0) {
        console.log('[SendToDoctor] No doctors found in user_roles');
        setDoctors([]);
        setLoadingDoctors(false);
        return;
      }

      // Get doctor profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', doctorIds);

      if (profilesError) throw profilesError;
      console.log('[SendToDoctor] Profiles fetched:', profiles);

      // Try to get doctor specialization info (optional - table may not exist yet)
      let doctorInfoMap = new Map<string, { specialization?: string; years_of_experience?: number }>();
      try {
        // @ts-expect-error - doctor_information table not yet in generated types
        const query = supabase.from('doctor_information');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: doctorInfo } = await (query as any)
          .select('user_id, specialization, years_of_experience')
          .in('user_id', doctorIds);

        if (doctorInfo) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          doctorInfoMap = new Map((doctorInfo as any[]).map(info => [info.user_id, info]));
        }
      } catch {
        // doctor_information table may not exist yet, proceed without it
      }

      const doctorList: Doctor[] = (profiles || [])
        .map(profile => {
          const info = doctorInfoMap.get(profile.id);
          return {
            id: profile.id,
            full_name: profile.full_name || 'Dr. (No Name)',
            specialization: info?.specialization,
            years_of_experience: info?.years_of_experience,
          };
        });

      console.log('[SendToDoctor] Final doctor list:', doctorList);
      setDoctors(doctorList);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      toast({
        title: 'Error',
        description: 'Failed to load available doctors. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingDoctors(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    // Validation
    if (!contactPhone && !contactEmail) {
      toast({
        title: 'Contact Required',
        description: 'Please provide at least one contact method.',
        variant: 'destructive',
      });
      return;
    }

    setSending(true);

    try {
      const patientDetails = {
        phone: contactPhone,
        email: contactEmail,
        symptoms: symptoms,
        urgency: urgency,
        preferredContact: contactEmail ? 'email' : 'phone',
      };

      // @ts-expect-error - consultation_requests table not yet in generated types
      const consultationQuery = supabase.from('consultation_requests');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inserted, error } = await (consultationQuery as any)
        .insert({
          patient_id: user.id,
          doctor_id: selectedDoctorId === 'any' ? null : selectedDoctorId,
          report_id: reportId,
          patient_message: message || null,
          patient_details: patientDetails,
          status: 'pending',
        })
        .select('id')
        .single();

      if (error) throw error;

      // Create Stream channel for this consultation
      const consultationId = (inserted as { id: string })?.id;
      if (consultationId) {
        try {
          const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);
          const channelId = await createConsultationChannel({
            consultation_id: consultationId,
            patient_id: user.id,
            patient_name: user.email ?? user.id,
            doctor_id: selectedDoctorId === 'any' ? null : selectedDoctorId,
            doctor_name: selectedDoctor?.full_name,
            report_info: {
              name: reportName,
              urgency,
              symptoms,
              patient_message: message,
              report_id: reportId,
            },
          });
          // Save channel_id back to the consultation request
          // @ts-expect-error - consultation_requests not in generated types
          const streamUpdateQ = supabase.from('consultation_requests');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (streamUpdateQ as any)
            .update({ stream_channel_id: channelId })
            .eq('id', consultationId);
        } catch (streamErr) {
          // Non-fatal: chat channel creation failed but request was saved
          console.warn('[SendToDoctor] Stream channel creation failed:', streamErr);
        }
      }

      toast({
        title: 'Consultation Request Sent',
        description: selectedDoctorId === 'any'
          ? 'Your report has been sent to available doctors. You can chat once a doctor accepts.'
          : 'Your request has been sent. Check My Chats to talk with your doctor.',
      });

      // Reset form and close
      resetForm();
      onOpenChange(false);
    } catch (error: unknown) {
      console.error('Error sending consultation request:', error);
      
      // Handle duplicate request error
      if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === '23505') {
        toast({
          title: 'Request Already Exists',
          description: 'You have already sent this report to this doctor.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to send consultation request. Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setSending(false);
    }
  };

  const resetForm = () => {
    setSelectedDoctorId('any');
    setContactPhone('');
    setContactEmail(user?.email || '');
    setSymptoms('');
    setMessage('');
    setUrgency('routine');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Report to Doctor</DialogTitle>
          <DialogDescription>
            Send "{reportName}" to a cardiologist for professional consultation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            {/* Doctor Selection */}
            <div className="space-y-2">
              <Label htmlFor="doctor">Select Doctor</Label>
              {loadingDoctors ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading doctors...
                </div>
              ) : (
                <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                  <SelectTrigger id="doctor">
                    <SelectValue placeholder="Select a doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>Any Available Doctor</span>
                      </div>
                    </SelectItem>
                    {doctors.map((doctor) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{doctor.full_name}</span>
                          {doctor.specialization && (
                            <span className="text-xs text-muted-foreground">
                              {doctor.specialization}
                              {doctor.years_of_experience && ` • ${doctor.years_of_experience} years exp.`}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">
                Choose a specific doctor or let any available cardiologist review your report.
              </p>
            </div>

            {/* Urgency Level */}
            <div className="space-y-2">
              <Label htmlFor="urgency">Urgency Level</Label>
              <Select value={urgency} onValueChange={(value: 'routine' | 'urgent' | 'emergency') => setUrgency(value)}>
                <SelectTrigger id="urgency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">Routine - Normal consultation</SelectItem>
                  <SelectItem value="urgent">Urgent - Need response within 24-48 hours</SelectItem>
                  <SelectItem value="emergency">Emergency - Immediate attention needed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {urgency === 'emergency' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  If you are experiencing a medical emergency, please call emergency services immediately or visit your nearest emergency room.
                </AlertDescription>
              </Alert>
            )}

            {/* Contact Information */}
            <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
              <h4 className="font-medium text-sm">Your Contact Information</h4>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Provide at least one contact method so the doctor can reach you.
              </p>
            </div>

            {/* Symptoms */}
            <div className="space-y-2">
              <Label htmlFor="symptoms">Current Symptoms (Optional)</Label>
              <Textarea
                id="symptoms"
                placeholder="Describe any symptoms you're experiencing (e.g., chest pain, shortness of breath, fatigue)..."
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                rows={3}
              />
            </div>

            {/* Message to Doctor */}
            <div className="space-y-2">
              <Label htmlFor="message">Message to Doctor (Optional)</Label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  id="message"
                  placeholder="Any additional information you'd like to share with the doctor..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={sending || loadingDoctors}>
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Request
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
