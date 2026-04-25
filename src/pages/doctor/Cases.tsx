import { useCallback, useEffect, useState } from 'react';
import { Eye, FileText, Loader2, Mail, Users } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PrescriptionForm } from '@/components/doctor/PrescriptionForm';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { createMRISignedUrl, normalizeSingleRelation } from '@/lib/mriReports';

interface Diagnosis {
  id: string;
  risk_level: 'low' | 'medium' | 'high';
  confidence: number;
  details: string | null;
}

interface MRIReport {
  id: string;
  file_name: string;
  file_url: string;
  status: string;
  created_at: string;
  diagnosis?: Diagnosis;
}

interface PatientProfile {
  id: string;
  full_name: string;
  email: string;
}

interface Case {
  id: string;
  report_id: string;
  patient_id: string;
  assigned_at: string;
  mri_report?: MRIReport;
  patient_profile?: PatientProfile;
}

export default function DoctorCases() {
  const { user } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [selectedCaseUrl, setSelectedCaseUrl] = useState<string | null>(null);
  const [selectedCaseLoading, setSelectedCaseLoading] = useState(false);

  const fetchCases = useCallback(async () => {
    if (!user) return;

    try {
      const { data: assignments, error: assignmentsError } = await supabase
        .from('doctor_assignments')
        .select('*')
        .eq('doctor_id', user.id)
        .order('assigned_at', { ascending: false });

      if (assignmentsError) {
        throw assignmentsError;
      }

      if (!assignments?.length) {
        setCases([]);
        return;
      }

      const reportIds = [...new Set(assignments.map((assignment) => assignment.report_id))];
      const patientIds = [...new Set(assignments.map((assignment) => assignment.patient_id))];

      const [reportsResult, profilesResult] = await Promise.all([
        supabase
          .from('mri_reports')
          .select(`
            id,
            file_name,
            file_url,
            status,
            created_at,
            diagnosis (
              id,
              risk_level,
              confidence,
              details
            )
          `)
          .in('id', reportIds),
        supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', patientIds),
      ]);

      if (reportsResult.error) {
        throw reportsResult.error;
      }

      if (profilesResult.error) {
        throw profilesResult.error;
      }

      const reportMap = new Map(
        (reportsResult.data ?? []).map((report) => [
          report.id,
          {
            ...report,
            diagnosis: normalizeSingleRelation(
              report.diagnosis as Diagnosis | Diagnosis[] | null | undefined,
            ),
          } satisfies MRIReport,
        ]),
      );

      const profileMap = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));

      setCases(
        assignments.map((assignment) => ({
          ...assignment,
          mri_report: reportMap.get(assignment.report_id),
          patient_profile: profileMap.get(assignment.patient_id),
        })),
      );
    } catch (error) {
      console.error('Failed to fetch doctor cases', error);
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchCases();
  }, [fetchCases]);

  const closeSelectedCase = () => {
    setSelectedCase(null);
    setSelectedCaseUrl(null);
    setSelectedCaseLoading(false);
  };

  const openSelectedCase = async (caseItem: Case) => {
    setSelectedCase(caseItem);
    setSelectedCaseUrl(null);
    setSelectedCaseLoading(true);

    try {
      const signedUrl = await createMRISignedUrl(caseItem.mri_report?.file_url);
      setSelectedCaseUrl(signedUrl);
    } catch {
      setSelectedCaseUrl(null);
    } finally {
      setSelectedCaseLoading(false);
    }
  };

  return (
    <DashboardLayout 
      title="Patient Cases" 
      subtitle="Review and manage assigned patient cases"
    >
      <Card>
        <CardHeader>
          <CardTitle>All Assigned Cases</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading cases...</p>
          ) : cases.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No cases assigned</p>
              <p className="text-muted-foreground">
                Patient cases will appear here when assigned by an admin.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {cases.map((caseItem) => (
                <div
                  key={caseItem.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Case #{caseItem.id.slice(0, 8)}</p>
                      <p className="text-sm text-muted-foreground">
                        Assigned on {new Date(caseItem.assigned_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void openSelectedCase(caseItem)}>
                      <Eye className="h-4 w-4 mr-2" />
                      Review
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedCase} onOpenChange={(open) => !open && closeSelectedCase()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Case Details</DialogTitle>
          </DialogHeader>

          {selectedCase && (
            <div className="space-y-6 py-4">
              <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
                <div className="space-y-4">
                  <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                    {selectedCaseLoading ? (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : selectedCaseUrl ? (
                      <img
                        src={selectedCaseUrl}
                        alt={selectedCase.mri_report?.file_name || 'MRI Scan'}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                        The MRI image could not be loaded for this case.
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border bg-card p-4 space-y-3">
                    <div>
                      <p className="text-sm font-medium">Patient</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedCase.patient_profile?.full_name || 'Patient'}
                      </p>
                    </div>
                    {selectedCase.patient_profile?.email && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <span>{selectedCase.patient_profile.email}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Report status</span>
                      <span className="capitalize text-muted-foreground">
                        {selectedCase.mri_report?.status || 'pending'}
                      </span>
                    </div>
                    {selectedCase.mri_report?.diagnosis && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Risk Assessment</span>
                          <RiskBadge level={selectedCase.mri_report.diagnosis.risk_level} size="sm" />
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">Confidence</span>
                          <span>{selectedCase.mri_report.diagnosis.confidence}%</span>
                        </div>
                      </>
                    )}
                    {selectedCase.mri_report?.diagnosis?.details && (
                      <div>
                        <p className="text-sm font-medium">Analysis Details</p>
                        <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                          {selectedCase.mri_report.diagnosis.details}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    Review the MRI scan and provide your prescription below.
                  </p>

                  {selectedCase.mri_report?.diagnosis ? (
                    <PrescriptionForm
                      diagnosisId={selectedCase.mri_report.diagnosis.id}
                      onSuccess={() => {
                        closeSelectedCase();
                        void fetchCases();
                      }}
                    />
                  ) : (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      A diagnosis must exist before a prescription can be submitted for this case.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}