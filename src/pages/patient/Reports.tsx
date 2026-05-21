import { useCallback, useEffect, useState } from 'react';
import { Download, Eye, FileText, Send, Trash2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ReportAnalysisPanel } from '@/components/reports/ReportAnalysisPanel';
import { ReportImagePreview } from '@/components/reports/ReportImagePreview';
import { SendToDoctorDialog } from '@/components/patient/SendToDoctorDialog';
import type { BaseReportDiagnosis, BaseReportRecord } from '@/components/reports/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  createMRISignedUrl,
  deleteMRIReport,
  downloadMRIReportPdf,
  normalizeSingleRelation,
} from '@/lib/mriReports';
import { canUseReportAction } from '@/lib/reportPermissions';
import { buildSequenceMap, formatReportLabel } from '@/lib/caseLabels';

interface Report extends BaseReportRecord {
  patient_id: string;
  diagnosis?: BaseReportDiagnosis;
}

export default function PatientReports() {
  const { user, userRole, isVerified } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedReportUrl, setSelectedReportUrl] = useState<string | null>(null);
  const [selectedReportLoading, setSelectedReportLoading] = useState(false);
  const [sendToDoctorReport, setSendToDoctorReport] = useState<Report | null>(null);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle();

    setPatientName(profile?.full_name || user.email || null);
    
    const { data, error } = await supabase
      .from('mri_reports')
      .select(`
        id,
        file_name,
        file_url,
        patient_id,
        status,
        created_at,
        diagnosis (
          risk_level,
          confidence,
          details
        )
      `)
      .eq('patient_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setReports(data.map(r => ({
        ...r,
        diagnosis: normalizeSingleRelation(
          r.diagnosis as BaseReportDiagnosis | BaseReportDiagnosis[] | null | undefined,
        )
      })));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  const closeSelectedReport = () => {
    setSelectedReport(null);
    setSelectedReportUrl(null);
    setSelectedReportLoading(false);
  };

  const canRunReportAction = (report: Report, action: 'view' | 'download') => {
    return canUseReportAction({
      action,
      role: userRole,
      isVerified,
      currentUserId: user?.id,
      reportPatientId: report.patient_id,
    });
  };

  const openSelectedReport = async (report: Report) => {
    if (!canRunReportAction(report, 'view')) {
      return;
    }

    setSelectedReport(report);
    setSelectedReportUrl(null);
    setSelectedReportLoading(true);

    try {
      const signedUrl = await createMRISignedUrl(report.file_url);
      setSelectedReportUrl(signedUrl);
    } catch {
      setSelectedReportUrl(null);
    } finally {
      setSelectedReportLoading(false);
    }
  };

  const handleDownloadReport = async (report: Report) => {
    if (!canRunReportAction(report, 'download')) {
      return;
    }

    try {
      await downloadMRIReportPdf({
        reportId: report.id,
        fileName: report.file_name,
        fileReference: report.file_url,
        createdAt: report.created_at,
        status: report.status,
        patientName,
        reportLabel: formatReportLabel({
          patientName,
          patientEmail: user?.email,
          reportNumber: buildSequenceMap(reports).get(report.id),
        }),
        riskLevel: report.diagnosis?.risk_level,
        confidence: report.diagnosis?.confidence,
        details: report.diagnosis?.details,
      });
    } catch (error) {
      console.error('Failed to download report PDF', error);
    }
  };

  const handleDeleteReport = async (report: Report) => {
    if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingReportId(report.id);
      await deleteMRIReport({
        reportId: report.id,
        fileReference: report.file_url,
      });

      setReports((currentReports) =>
        currentReports.filter((currentReport) => currentReport.id !== report.id),
      );

      toast({
        title: 'Report deleted',
        description: 'The report has been successfully deleted.',
      });
      
      if (selectedReport?.id === report.id) {
        closeSelectedReport();
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to delete the report. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeletingReportId(null);
    }
  };

  return (
    <DashboardLayout 
      title="My Reports" 
      subtitle="View all your MRI scan reports and diagnosis results"
    >
      <Card>
        <CardHeader>
          <CardTitle>All Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading reports...</p>
          ) : reports.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No reports yet</p>
              <p className="text-muted-foreground">Upload your first MRI scan to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => {
                const canDownload = canRunReportAction(report, 'download');
                const canView = canRunReportAction(report, 'view');
                const reportLabel = formatReportLabel({
                  patientName,
                  patientEmail: user?.email,
                  reportNumber: buildSequenceMap(reports).get(report.id),
                });

                return (
                <div
                  key={report.id}
                  className="flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate max-w-[170px] sm:max-w-[280px]" title={report.file_name}>
                        {reportLabel}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Uploaded on {new Date(report.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-4">
                    {report.diagnosis ? (
                      <>
                        <RiskBadge level={report.diagnosis.risk_level} />
                        {/* <span className="text-sm text-muted-foreground">
                          {report.diagnosis.confidence}% confidence
                        </span> */}
                      </>
                    ) : (
                      <span className="text-sm text-warning font-medium capitalize">
                        {report.status}
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-2 sm:ml-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5"
                      aria-label="Send to doctor"
                      title="Send to doctor for consultation"
                      onClick={() => setSendToDoctorReport(report)}
                    >
                      <Send className="h-4 w-4" />
                      <span className="hidden sm:inline">Send to Doctor</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0"
                      aria-label="Download report PDF"
                      title="Download report PDF"
                      onClick={() => void handleDownloadReport(report)}
                      disabled={!canDownload}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Delete report"
                      title="Delete report"
                      onClick={() => void handleDeleteReport(report)}
                      disabled={deletingReportId === report.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0"
                      aria-label="View report details"
                      title="View report details"
                      onClick={() => void openSelectedReport(report)}
                      disabled={!canView}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && closeSelectedReport()}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Report Details</DialogTitle>
          </DialogHeader>

          {selectedReport && (
            <ReportAnalysisPanel
              analysis={selectedReport.diagnosis}
              preview={
                <ReportImagePreview
                  loading={selectedReportLoading}
                  imageUrl={selectedReportUrl}
                  alt={selectedReport.file_name}
                  fallbackText="The MRI image could not be loaded for this report."
                />
              }
              sidebarContent={
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Report Status
                  </p>
                  <p className="mt-2 text-sm capitalize text-foreground">
                    {selectedReport.status}
                  </p>
                </div>
              }
              actionBar={
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSendToDoctorReport(selectedReport)}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send to Doctor
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => void handleDeleteReport(selectedReport)}
                    disabled={deletingReportId === selectedReport.id}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Report
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleDownloadReport(selectedReport)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                </>
              }
            />
          )}
        </DialogContent>
      </Dialog>

      <SendToDoctorDialog
        open={!!sendToDoctorReport}
        onOpenChange={(open) => !open && setSendToDoctorReport(null)}
        reportId={sendToDoctorReport?.id || ''}
        reportName={sendToDoctorReport
          ? formatReportLabel({
              patientName,
              patientEmail: user?.email,
              reportNumber: buildSequenceMap(reports).get(sendToDoctorReport.id),
            })
          : ''}
      />
    </DashboardLayout>
  );
}
