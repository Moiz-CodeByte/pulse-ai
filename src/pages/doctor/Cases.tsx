import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Eye, FileText, Mail, Users } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ReportAnalysisPanel } from '@/components/reports/ReportAnalysisPanel';
import { ReportImagePreview } from '@/components/reports/ReportImagePreview';
import type { BaseReportDiagnosis, BaseReportRecord } from '@/components/reports/types';
import { PrescriptionForm } from '@/components/doctor/PrescriptionForm';
import { CaseTimeline, type CaseTimelineItem } from '@/components/cases/CaseTimeline';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { createMRISignedUrl, downloadMRIReportPdf, normalizeSingleRelation } from '@/lib/mriReports';
import { canUseReportAction } from '@/lib/reportPermissions';
import { buildSequenceMap, formatCaseLabel, formatReportLabel } from '@/lib/caseLabels';

interface MRIReport extends BaseReportRecord {
  diagnosis?: BaseReportDiagnosis & { id: string };
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
  const { user, userRole, isVerified } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [selectedCaseUrl, setSelectedCaseUrl] = useState<string | null>(null);
  const [selectedCaseLoading, setSelectedCaseLoading] = useState(false);
  const [caseTimelines, setCaseTimelines] = useState<Record<string, CaseTimelineItem[]>>({});

  const assignedPatientIds = useMemo(
    () => [...new Set(cases.map((caseItem) => caseItem.patient_id))],
    [cases],
  );

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
              details,
              prescriptions (
                id,
                medicine,
                dosage,
                instructions,
                notes
              )
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
              report.diagnosis as BaseReportDiagnosis | BaseReportDiagnosis[] | null | undefined,
            ),
          } satisfies MRIReport,
        ]),
      );

      const profileMap = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
      // @ts-expect-error - consultation_requests table not yet in generated types
      const consultationQuery = supabase.from('consultation_requests');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: consultations } = await (consultationQuery as any)
        .select('id, patient_id, report_id, patient_message, doctor_notes, status, created_at')
        .eq('doctor_id', user.id)
        .eq('status', 'accepted')
        .in('report_id', reportIds);
      const consultationByReport = new Map(
        ((consultations ?? []) as Array<{
          id: string;
          patient_id: string;
          report_id: string;
          patient_message: string | null;
          doctor_notes: string | null;
          status: string;
          created_at: string;
        }>).map((consultation) => [consultation.report_id, consultation]),
      );

      const nextTimelines: Record<string, CaseTimelineItem[]> = {};
      const reportSequencesByPatient = new Map<string, Map<string, number>>();
      const caseSequencesByPatient = new Map<string, Map<string, number>>();

      for (const patientId of patientIds) {
        const patientAssignments = assignments.filter((assignment) => assignment.patient_id === patientId);
        const patientReportItems = patientAssignments.map((assignment) => {
          const report = reportMap.get(assignment.report_id);
          return {
            id: assignment.report_id,
            created_at: report?.created_at ?? assignment.assigned_at,
          };
        });
        const patientCaseItems = patientAssignments.map((assignment) => {
          const consultation = consultationByReport.get(assignment.report_id);
          return {
            id: assignment.id,
            created_at: consultation?.created_at ?? assignment.assigned_at,
          };
        });

        reportSequencesByPatient.set(patientId, buildSequenceMap(patientReportItems));
        caseSequencesByPatient.set(patientId, buildSequenceMap(patientCaseItems));
      }

      for (const assignment of assignments) {
        const report = reportMap.get(assignment.report_id);
        const consultation = consultationByReport.get(assignment.report_id);
        const profile = profileMap.get(assignment.patient_id);
        const reportLabel = formatReportLabel({
          patientName: profile?.full_name,
          patientEmail: profile?.email,
          reportNumber: reportSequencesByPatient.get(assignment.patient_id)?.get(assignment.report_id),
        });

        if (!nextTimelines[assignment.patient_id]) {
          nextTimelines[assignment.patient_id] = [];
        }

        nextTimelines[assignment.patient_id].push({
          id: assignment.id,
          reportId: assignment.report_id,
          reportName: reportLabel,
          caseName: formatCaseLabel({
            reportLabel,
            caseNumber: caseSequencesByPatient.get(assignment.patient_id)?.get(assignment.id),
          }),
          requestedAt: consultation?.created_at ?? assignment.assigned_at,
          status: report?.status,
          riskLevel: report?.diagnosis?.risk_level,
          patientMessage: consultation?.patient_message,
          doctorNotes: consultation?.doctor_notes,
          prescriptions: (report?.diagnosis as unknown as { prescriptions?: CaseTimelineItem['prescriptions'] })?.prescriptions ?? [],
        });
      }

      Object.values(nextTimelines).forEach((items) =>
        items.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()),
      );

      setCases(
        assignments.map((assignment) => ({
          ...assignment,
          mri_report: reportMap.get(assignment.report_id),
          patient_profile: profileMap.get(assignment.patient_id),
        })),
      );
      setCaseTimelines(nextTimelines);
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

  const canRunCaseReportAction = (caseItem: Case, action: 'view' | 'download') => {
    return canUseReportAction({
      action,
      role: userRole,
      isVerified,
      currentUserId: user?.id,
      reportPatientId: caseItem.patient_id,
      assignedPatientIds,
    });
  };

  const openSelectedCase = async (caseItem: Case) => {
    if (!canRunCaseReportAction(caseItem, 'view')) {
      return;
    }

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

  const handleDownloadCaseReport = async (caseItem: Case) => {
    if (!caseItem.mri_report || !canRunCaseReportAction(caseItem, 'download')) {
      return;
    }

    try {
      await downloadMRIReportPdf({
        reportId: caseItem.mri_report.id,
        fileName: caseItem.mri_report.file_name,
        fileReference: caseItem.mri_report.file_url,
        createdAt: caseItem.mri_report.created_at,
        status: caseItem.mri_report.status,
        patientId: caseItem.patient_id,
        patientName: caseItem.patient_profile?.full_name,
        riskLevel: caseItem.mri_report.diagnosis?.risk_level,
        confidence: caseItem.mri_report.diagnosis?.confidence,
        details: caseItem.mri_report.diagnosis?.details,
      });
    } catch (error) {
      console.error('Failed to download case report PDF', error);
    }
  };

  const findCaseByTimelineItem = useCallback(
    (item: CaseTimelineItem) => cases.find((caseItem) => caseItem.report_id === item.reportId),
    [cases],
  );

  const openTimelineCase = useCallback(
    async (item: CaseTimelineItem) => {
      const caseItem = findCaseByTimelineItem(item);

      if (caseItem) {
        await openSelectedCase(caseItem);
      }
    },
    [findCaseByTimelineItem, openSelectedCase],
  );

  const downloadTimelineCaseReport = useCallback(
    async (item: CaseTimelineItem) => {
      const caseItem = findCaseByTimelineItem(item);

      if (caseItem) {
        await handleDownloadCaseReport(caseItem);
      }
    },
    [findCaseByTimelineItem, handleDownloadCaseReport],
  );

  const groupedCases = useMemo(() => {
    const map = new Map<string, Case[]>();

    for (const caseItem of cases) {
      const current = map.get(caseItem.patient_id) ?? [];
      current.push(caseItem);
      map.set(caseItem.patient_id, current);
    }

    return [...map.entries()].map(([patientId, patientCases]) => ({
      patientId,
      patientProfile: patientCases[0]?.patient_profile,
      cases: patientCases,
    }));
  }, [cases]);

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
            <div className="space-y-6">
              {groupedCases.map((group) => {
                const latestCase = group.cases[0];
                const canDownload = latestCase ? canRunCaseReportAction(latestCase, 'download') : false;
                const canView = latestCase ? canRunCaseReportAction(latestCase, 'view') : false;

                return (
                <div
                  key={group.patientId}
                  className="rounded-lg border bg-card p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="p-3 rounded-lg bg-primary/10">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{group.patientProfile?.full_name || 'Patient'}</p>
                        <p className="text-sm text-muted-foreground">
                          {group.cases.length} report{group.cases.length === 1 ? '' : 's'} in this case history
                        </p>
                      </div>
                    </div>
                    {latestCase && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleDownloadCaseReport(latestCase)}
                          disabled={!latestCase.mri_report || !canDownload}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Latest PDF
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => void openSelectedCase(latestCase)} disabled={!canView}>
                          <Eye className="h-4 w-4 mr-2" />
                          Review Latest
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="mt-4">
                    <CaseTimeline
                      items={caseTimelines[group.patientId] ?? []}
                      onViewReport={(item) => void openTimelineCase(item)}
                      onDownloadReport={(item) => void downloadTimelineCaseReport(item)}
                    />
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedCase} onOpenChange={(open) => !open && closeSelectedCase()}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Case Details</DialogTitle>
          </DialogHeader>

          {selectedCase && (
            <div className="space-y-6 py-4">
              <ReportAnalysisPanel
                analysis={selectedCase.mri_report?.diagnosis}
                preview={
                  <ReportImagePreview
                    loading={selectedCaseLoading}
                    imageUrl={selectedCaseUrl}
                    alt={selectedCase.mri_report?.file_name || 'MRI Scan'}
                    fallbackText="The MRI image could not be loaded for this case."
                    containerClassName="mx-auto flex min-h-44 w-full max-w-[240px] items-center justify-center rounded-xl border bg-muted/40 p-3"
                  />
                }
                sidebarContent={
                  <div className="rounded-lg border bg-card p-4 space-y-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Patient
                      </p>
                      <p className="mt-2 text-sm text-foreground">
                        {selectedCase.patient_profile?.full_name || 'Patient'}
                      </p>
                    </div>
                    {selectedCase.patient_profile?.email && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <span>{selectedCase.patient_profile.email}</span>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Report Status
                      </p>
                      <p className="mt-2 text-sm capitalize text-foreground">
                        {selectedCase.mri_report?.status || 'pending'}
                      </p>
                    </div>
                  </div>
                }
                actionBar={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleDownloadCaseReport(selectedCase)}
                    disabled={
                      !selectedCase.mri_report ||
                      !canRunCaseReportAction(selectedCase, 'download')
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                }
                emptyMessage="Diagnosis details are not available for this case yet."
              />

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
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
