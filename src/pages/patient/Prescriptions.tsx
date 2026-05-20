import { useEffect, useState } from 'react';
import { FileText, Pill, Stethoscope } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getPrescriptionMedicineLines } from '@/lib/prescriptions';
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
    label: string;
    createdAt: string;
    riskLevel?: string | null;
  };
  doctor?: {
    id: string;
    name: string;
  };
  caseName?: string;
}

export default function PatientPrescriptions() {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);

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
            .select('id, report_id, risk_level')
            .in('id', diagnosisIds)
        : { data: [] };

      const reportIds = [...new Set((diagnoses ?? []).map((item) => item.report_id).filter(Boolean))];
      const { data: reports } = reportIds.length
        ? await supabase
            .from('mri_reports')
            .select('id, file_name, created_at, patient_id')
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
            .select('id, report_id')
            .eq('patient_id', user.id)
            .in('report_id', reportIds)
        : { data: [] };

      const diagnosisMap = new Map((diagnoses ?? []).map((item) => [item.id, item]));
      const reportMap = new Map((reports ?? []).map((item) => [item.id, item]));
      const doctorMap = new Map((doctors ?? []).map((item) => [item.id, item]));
      const consultationMap = new Map(
        ((consultations ?? []) as Array<{ id: string; report_id: string }>).map((item) => [item.report_id, item.id]),
      );
      const reportSequenceMap = buildSequenceMap(reports ?? []);
      const caseSequenceMap = buildSequenceMap(
        ((consultations ?? []) as Array<{ id: string; report_id: string }>).map((item) => {
          const report = reportMap.get(item.report_id);
          return { id: item.id, created_at: report?.created_at ?? '' };
        }),
      );

      setPrescriptions(data
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
            report: {
              id: report.id,
              fileName: report.file_name,
              label: reportLabel,
              createdAt: report.created_at,
              riskLevel: diagnosis?.risk_level,
            },
            doctor: doctor
              ? {
                  id: doctor.id,
                  name: doctor.full_name || doctor.email || 'Doctor',
                }
              : undefined,
          };
        })
        .filter(Boolean) as Prescription[]);
    }
    setLoading(false);
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
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
