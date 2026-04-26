import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Users, FileText, Activity, CheckCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/ui/StatCard';
import { RiskBadge } from '@/components/ui/RiskBadge';
import type { BaseReportDiagnosis, BaseReportRecord } from '@/components/reports/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { downloadMRIReportPdf, normalizeSingleRelation } from '@/lib/mriReports';
import { canUseReportAction } from '@/lib/reportPermissions';
import { Link } from 'react-router-dom';

interface AssignedCase {
  id: string;
  report_id: string;
  patient_id: string;
  assigned_at: string;
  mri_report?: BaseReportRecord & { diagnosis?: BaseReportDiagnosis };
  patient_profile?: {
    full_name: string;
    email: string;
  };
}

export default function DoctorDashboard() {
  const { user, userRole, isVerified } = useAuth();
  const [cases, setCases] = useState<AssignedCase[]>([]);
  const [loading, setLoading] = useState(true);

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
        .order('assigned_at', { ascending: false })
        .limit(10);

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
              report.diagnosis as BaseReportDiagnosis | BaseReportDiagnosis[] | null | undefined,
            ),
          },
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
      console.error('Failed to fetch doctor dashboard cases', error);
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchCases();
  }, [fetchCases]);

  const totalCases = cases.length;
  const pendingCases = cases.filter(c => !c.mri_report?.diagnosis).length;

  const canRunCaseReportAction = (caseItem: AssignedCase, action: 'download' | 'view') => {
    return canUseReportAction({
      action,
      role: userRole,
      isVerified,
      currentUserId: user?.id,
      reportPatientId: caseItem.patient_id,
      assignedPatientIds,
    });
  };

  const handleDownloadCaseReport = async (caseItem: AssignedCase) => {
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
      console.error('Failed to download report PDF', error);
    }
  };

  return (
    <DashboardLayout 
      title="Doctor Dashboard" 
      subtitle="Review patient cases and provide prescriptions"
    >
      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Assigned Cases"
          value={totalCases}
          icon={Users}
          variant="primary"
        />
        <StatCard
          title="Pending Review"
          value={pendingCases}
          icon={FileText}
          variant="warning"
        />
        <StatCard
          title="Completed Today"
          value={0}
          icon={CheckCircle}
          variant="success"
        />
        <StatCard
          title="Avg Response Time"
          value="2h"
          icon={Activity}
          variant="default"
        />
      </div>

      {/* Cases List */}
      <Card>
        <CardHeader className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Recent Cases</CardTitle>
          <Link to="/doctor/cases">
            <Button variant="outline" size="sm">View All Cases</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading cases...</p>
          ) : cases.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No cases assigned yet.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Cases will appear here when patients are assigned to you.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {cases.map((caseItem) => (
                <div
                  key={caseItem.id}
                  className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-full bg-primary/10">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {caseItem.patient_profile?.full_name || 'Patient'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(caseItem.assigned_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex w-full sm:w-auto flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-4">
                    {caseItem.mri_report?.diagnosis ? (
                      <RiskBadge level={caseItem.mri_report.diagnosis.risk_level} size="sm" />
                    ) : (
                      <span className="text-sm text-warning">Pending Analysis</span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleDownloadCaseReport(caseItem)}
                      disabled={!caseItem.mri_report || !canRunCaseReportAction(caseItem, 'download')}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      PDF
                    </Button>
                    <Link to="/doctor/cases">
                      <Button variant="outline" size="sm">Review</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}