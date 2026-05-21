import { useEffect, useState } from 'react';
import { ExternalLink, FileText, Loader2, Pill, Star, Stethoscope } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ReportAnalysisPanel } from '@/components/reports/ReportAnalysisPanel';
import { ReportImagePreview } from '@/components/reports/ReportImagePreview';
import type { BaseReportDiagnosis } from '@/components/reports/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useStreamChat } from '@/hooks/useStreamChat';
import { useToast } from '@/hooks/use-toast';
import { getPrescriptionMedicineLines } from '@/lib/prescriptions';
import { createMRISignedUrl } from '@/lib/mriReports';
import { buildSequenceMap, formatCaseLabel, formatReportLabel } from '@/lib/caseLabels';

interface Prescription {
  id: string;
  medicine: string;
  dosage: string;
  instructions: string;
  notes: string;
  created_at: string;
  diagnosis_id: string;
  doctor_id: string;
  caseId?: string;
  report?: {
    id: string;
    fileName: string;
    fileUrl?: string | null;
    label: string;
    createdAt: string;
    status?: string | null;
    riskLevel?: string | null;
    confidence?: number | null;
    details?: string | null;
  };
  doctor?: {
    id: string;
    name: string;
  };
  caseName?: string;
  streamChannelId?: string | null;
}

interface DoctorReview {
  id: string;
  prescription_id: string;
  doctor_id: string;
  rating: number;
  comment: string | null;
}

export default function PatientPrescriptions() {
  const { user } = useAuth();
  const { client: streamClient, ready: streamReady } = useStreamChat();
  const { toast } = useToast();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [selectedReportUrl, setSelectedReportUrl] = useState<string | null>(null);
  const [selectedReportLoading, setSelectedReportLoading] = useState(false);
  const [reviewsByPrescription, setReviewsByPrescription] = useState<Record<string, DoctorReview>>({});
  const [reviewPrescription, setReviewPrescription] = useState<Prescription | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [savingReview, setSavingReview] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPrescriptions();
    }
  }, [user]);

  const fetchPrescriptions = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('prescriptions')
      .select(`
        id,
        diagnosis_id,
        medicine,
        dosage,
        instructions,
        notes,
        created_at,
        doctor_id
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const diagnosisIds = [...new Set(data.map((item) => item.diagnosis_id).filter(Boolean))];
      const { data: diagnoses } = diagnosisIds.length
        ? await supabase
            .from('diagnosis')
            .select('id, report_id, risk_level, confidence, details')
            .in('id', diagnosisIds)
        : { data: [] };

      const reportIds = [...new Set((diagnoses ?? []).map((item) => item.report_id).filter(Boolean))];
      const { data: reports } = reportIds.length
        ? await supabase
            .from('mri_reports')
            .select('id, file_name, file_url, created_at, patient_id, status')
            .in('id', reportIds)
        : { data: [] };

      const doctorIds = [...new Set(data.map((item) => item.doctor_id).filter(Boolean))];
      const { data: doctors } = doctorIds.length
        ? await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', doctorIds)
        : { data: [] };

      // @ts-expect-error - consultation_requests table not yet in generated types
      const consultationQuery = supabase.from('consultation_requests');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: consultations } = reportIds.length
        ? await (consultationQuery as any)
            .select('id, report_id, stream_channel_id')
            .eq('patient_id', user.id)
            .in('report_id', reportIds)
        : { data: [] };

      const diagnosisMap = new Map((diagnoses ?? []).map((item) => [item.id, item]));
      const reportMap = new Map((reports ?? []).map((item) => [item.id, item]));
      const doctorMap = new Map((doctors ?? []).map((item) => [item.id, item]));
      const consultationMap = new Map(
        ((consultations ?? []) as Array<{ id: string; report_id: string }>).map((item) => [item.report_id, item.id]),
      );
      const consultationChannelMap = new Map(
        ((consultations ?? []) as Array<{ report_id: string; stream_channel_id: string | null }>).map((item) => [
          item.report_id,
          item.stream_channel_id,
        ]),
      );
      const reportSequenceMap = buildSequenceMap(reports ?? []);
      const caseSequenceMap = buildSequenceMap(
        ((consultations ?? []) as Array<{ id: string; report_id: string }>).map((item) => {
          const report = reportMap.get(item.report_id);
          return { id: item.id, created_at: report?.created_at ?? '' };
        }),
      );

      const nextPrescriptions = data
        .map((prescription) => {
          const diagnosis = diagnosisMap.get(prescription.diagnosis_id);
          const report = diagnosis?.report_id ? reportMap.get(diagnosis.report_id) : undefined;

          if (!report || report.patient_id !== user.id) {
            return null;
          }

          const doctor = doctorMap.get(prescription.doctor_id);
          const reportLabel = formatReportLabel({
            patientName: user.user_metadata?.full_name,
            patientEmail: user.email,
            reportNumber: reportSequenceMap.get(report.id),
          });
          const caseId = consultationMap.get(report.id);

          return {
            ...prescription,
            caseId,
            caseName: caseId ? formatCaseLabel({
              reportLabel,
              caseNumber: caseSequenceMap.get(caseId),
            }) : undefined,
            streamChannelId: consultationChannelMap.get(report.id),
            report: {
              id: report.id,
              fileName: report.file_name,
              fileUrl: report.file_url,
              label: reportLabel,
              createdAt: report.created_at,
              status: report.status,
              riskLevel: diagnosis?.risk_level,
              confidence: diagnosis?.confidence,
              details: diagnosis?.details,
            },
            doctor: doctor
              ? {
                  id: doctor.id,
                  name: doctor.full_name || doctor.email || 'Doctor',
                }
              : undefined,
          };
        })
        .filter(Boolean) as Prescription[];

      setPrescriptions(nextPrescriptions);

      const prescriptionIds = nextPrescriptions.map((prescription) => prescription.id);
      if (prescriptionIds.length) {
        const reviewQuery = supabase.from('doctor_reviews' as never);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: reviews } = await (reviewQuery as any)
          .select('id, prescription_id, doctor_id, rating, comment')
          .eq('patient_id', user.id)
          .in('prescription_id', prescriptionIds);

        setReviewsByPrescription(
          ((reviews ?? []) as DoctorReview[]).reduce<Record<string, DoctorReview>>((acc, review) => {
            acc[review.prescription_id] = review;
            return acc;
          }, {}),
        );
      } else {
        setReviewsByPrescription({});
      }
    }
    setLoading(false);
  };

  const openDoctorReview = (prescription: Prescription) => {
    const existingReview = reviewsByPrescription[prescription.id];
    setReviewPrescription(prescription);
    setReviewRating(existingReview?.rating ?? 5);
    setReviewComment(existingReview?.comment ?? '');
  };

  const saveDoctorReview = async () => {
    if (!user || !reviewPrescription?.doctor?.id) {
      return;
    }

    setSavingReview(true);

    try {
      const reviewPayload = {
        patient_id: user.id,
        doctor_id: reviewPrescription.doctor.id,
        prescription_id: reviewPrescription.id,
        rating: reviewRating,
        comment: reviewComment.trim() || null,
      };
      const reviewQuery = supabase.from('doctor_reviews' as never);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: savedReview, error } = await (reviewQuery as any)
        .upsert(reviewPayload, { onConflict: 'patient_id,prescription_id' })
        .select('id, prescription_id, doctor_id, rating, comment')
        .single();

      if (error) {
        throw error;
      }

      setReviewsByPrescription((current) => ({
        ...current,
        [reviewPrescription.id]: savedReview as DoctorReview,
      }));
      if (streamReady && streamClient && reviewPrescription.streamChannelId) {
        const reviewMessage = [
          'Patient Review',
          `Doctor: ${reviewPrescription.doctor.name}`,
          reviewPrescription.report?.label ? `Report: ${reviewPrescription.report.label}` : '',
          reviewPrescription.caseName ? `Case: ${reviewPrescription.caseName}` : '',
          `Rating: ${reviewRating}.0 / 5`,
          reviewComment.trim() ? `Comment: ${reviewComment.trim()}` : '',
        ]
          .filter(Boolean)
          .join('\n');

        streamClient
          .channel('messaging', reviewPrescription.streamChannelId)
          .sendMessage({ text: reviewMessage })
          .catch(() => null);
      }
      toast({ title: 'Review saved', description: 'Thank you for reviewing your doctor.' });
      setReviewPrescription(null);
    } catch (error) {
      toast({
        title: 'Could not save review',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingReview(false);
    }
  };

  const openReportReview = async (prescription: Prescription) => {
    if (!prescription.report) {
      return;
    }

    setSelectedPrescription(prescription);
    setSelectedReportUrl(null);
    setSelectedReportLoading(true);

    try {
      setSelectedReportUrl(await createMRISignedUrl(prescription.report.fileUrl));
    } catch {
      setSelectedReportUrl(null);
    } finally {
      setSelectedReportLoading(false);
    }
  };

  return (
    <DashboardLayout 
      title="My Prescriptions" 
      subtitle="View prescriptions from your doctors"
    >
      <Card>
        <CardHeader>
          <CardTitle>All Prescriptions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading prescriptions...</p>
          ) : prescriptions.length === 0 ? (
            <div className="text-center py-12">
              <Pill className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No prescriptions yet</p>
              <p className="text-muted-foreground">
                Prescriptions will appear here once a doctor reviews your diagnosis.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {prescriptions.map((prescription) => {
                const medicineLines = getPrescriptionMedicineLines(prescription);
                const doctorReview = reviewsByPrescription[prescription.id];

                return (
                  <div
                    key={prescription.id}
                    className="p-6 rounded-xl border bg-card"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-primary/10">
                        <Pill className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">Prescription</h3>
                          <span className="text-sm text-muted-foreground">
                            {new Date(prescription.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-2">
                          <div className="flex min-w-0 gap-2">
                            <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <div className="min-w-0">
                              <p className="text-xs text-muted-foreground">Doctor</p>
                              <p className="font-medium truncate">{prescription.doctor?.name || 'Doctor'}</p>
                            </div>
                          </div>
                          <div className="flex min-w-0 gap-2">
                            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <div className="min-w-0">
                              <p className="text-xs text-muted-foreground">Case / Report</p>
                              <p className="font-medium truncate">{prescription.report?.label || 'MRI report'}</p>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {prescription.report?.riskLevel && (
                                  <Badge variant="outline">{prescription.report.riskLevel.toUpperCase()} Risk</Badge>
                                )}
                                {prescription.caseId && (
                                  <Badge variant="secondary">{prescription.caseName || `Case #${prescription.caseId.slice(0, 8)}`}</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {medicineLines.map((medicine, index) => (
                            <div key={`${medicine.name}-${index}`} className="rounded-lg border p-3">
                              <p className="font-medium">
                                {index + 1}. {medicine.name}
                                {medicine.dose ? <span className="text-muted-foreground"> - {medicine.dose}</span> : null}
                              </p>
                              {medicine.frequency && (
                                <p className="mt-1 text-sm text-muted-foreground">Frequency: {medicine.frequency}</p>
                              )}
                              {medicine.duration && (
                                <p className="text-sm text-muted-foreground">Duration: {medicine.duration}</p>
                              )}
                            </div>
                          ))}
                        </div>
                        {prescription.notes && (
                          <div className="p-3 rounded-lg bg-muted">
                            <span className="text-sm font-medium">Doctor's Notes:</span>
                            <p className="mt-1 text-sm text-muted-foreground">{prescription.notes}</p>
                          </div>
                        )}
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                          {prescription.report && (
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full sm:w-auto"
                              onClick={() => void openReportReview(prescription)}
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Review Report
                            </Button>
                          )}
                          {prescription.doctor && (
                            <Button
                              type="button"
                              variant={doctorReview ? 'secondary' : 'default'}
                              className="w-full sm:w-auto"
                              onClick={() => openDoctorReview(prescription)}
                            >
                              <Star className="mr-2 h-4 w-4" />
                              {doctorReview ? `Update Review (${doctorReview.rating}/5)` : 'Review Doctor'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedPrescription || selectedReportLoading} onOpenChange={(open) => {
        if (!open) {
          setSelectedPrescription(null);
          setSelectedReportUrl(null);
          setSelectedReportLoading(false);
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPrescription?.report?.label || 'Report Review'}
            </DialogTitle>
          </DialogHeader>
          {selectedPrescription?.report ? (
            <ReportAnalysisPanel
              analysis={{
                risk_level: selectedPrescription.report.riskLevel || '',
                confidence: selectedPrescription.report.confidence ?? 0,
                details: selectedPrescription.report.details ?? null,
              } as BaseReportDiagnosis}
              preview={
                <ReportImagePreview
                  loading={selectedReportLoading}
                  imageUrl={selectedReportUrl}
                  alt={selectedPrescription.report.fileName}
                  fallbackText="The MRI image could not be loaded for this report."
                />
              }
              sidebarContent={
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Prescription Context
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {selectedPrescription.doctor?.name || 'Doctor'}
                  </p>
                  {selectedPrescription.caseName && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedPrescription.caseName}
                    </p>
                  )}
                </div>
              }
            />
          ) : (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!reviewPrescription} onOpenChange={(open) => !open && setReviewPrescription(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Review {reviewPrescription?.doctor?.name || 'Doctor'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rating</Label>
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <Button
                    key={rating}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => setReviewRating(rating)}
                    aria-label={`${rating} star${rating === 1 ? '' : 's'}`}
                  >
                    <Star
                      className={
                        rating <= reviewRating
                          ? 'h-6 w-6 fill-primary text-primary'
                          : 'h-6 w-6 text-muted-foreground'
                      }
                    />
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="doctor-review-comment">Comment</Label>
              <Textarea
                id="doctor-review-comment"
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                placeholder="Share how helpful the prescription and consultation were..."
                className="mt-2"
                rows={4}
              />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setReviewPrescription(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void saveDoctorReview()} disabled={savingReview}>
                {savingReview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Star className="mr-2 h-4 w-4" />}
                Save Review
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
