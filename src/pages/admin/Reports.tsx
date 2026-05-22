import { useCallback, useEffect, useState } from 'react';
import { Download, Eye, FileText, Search, Trash2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ReportAnalysisPanel } from '@/components/reports/ReportAnalysisPanel';
import { ReportImagePreview } from '@/components/reports/ReportImagePreview';
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
  patient?: {
    name: string;
    email?: string | null;
  };
  label: string;
}

export default function AdminReports() {
  const { user, userRole, isVerified } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedReportUrl, setSelectedReportUrl] = useState<string | null>(null);
  const [selectedReportLoading, setSelectedReportLoading] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    const { data, error } = await supabase
      .from('mri_reports')
      .select(`
        id,
        file_name,
        file_url,
        status,
        created_at,
        patient_id,
        diagnosis (
          id,
          risk_level,
          confidence,
          details
        )
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const patientIds = [...new Set(data.map((item) => item.patient_id).filter(Boolean))];
      const { data: profiles } = patientIds.length
        ? await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', patientIds)
        : { data: [] };
      const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
      const reportSequencesByPatient = new Map<string, Map<string, number>>();

      for (const patientId of patientIds) {
        reportSequencesByPatient.set(
          patientId,
          buildSequenceMap(data.filter((report) => report.patient_id === patientId)),
        );
      }

      const mappedReports: Report[] = data.map(item => {
        const patient = profileMap.get(item.patient_id);
        const label = formatReportLabel({
          patientName: patient?.full_name,
          patientEmail: patient?.email,
          reportNumber: reportSequencesByPatient.get(item.patient_id)?.get(item.id),
        });

        return {
          id: item.id,
          file_name: item.file_name,
          file_url: item.file_url,
          status: item.status || 'pending',
          created_at: item.created_at,
          patient_id: item.patient_id,
          label,
          patient: patient
            ? {
                name: patient.full_name || patient.email || 'Patient',
                email: patient.email,
              }
            : undefined,
          diagnosis: normalizeSingleRelation(
            item.diagnosis as BaseReportDiagnosis | BaseReportDiagnosis[] | null | undefined,
          ),
        };
      });
      setReports(mappedReports);
    }
    setLoading(false);
  }, []);

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
        patientId: report.patient_id,
        patientName: report.patient?.name,
        reportLabel: report.label,
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-success">Completed</Badge>;
      case 'processing':
        return <Badge variant="secondary">Processing</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const filteredReports = reports.filter(report =>
    report.label.toLowerCase().includes(search.toLowerCase()) ||
    report.file_name.toLowerCase().includes(search.toLowerCase()) ||
    report.patient?.name.toLowerCase().includes(search.toLowerCase()) ||
    report.patient?.email?.toLowerCase().includes(search.toLowerCase()) ||
    report.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout 
      title="All Reports" 
      subtitle="View and manage all MRI reports in the system"
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>MRI Reports</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search reports..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading reports...</p>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No reports found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReports.map((report) => {
                const canDownload = canRunReportAction(report, 'download');
                const canView = canRunReportAction(report, 'view');

                return (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate max-w-[170px] sm:max-w-[280px]" title={report.label}>{report.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {report.patient?.name || 'Unknown patient'}
                          {report.patient?.email ? ` • ${report.patient.email}` : ''}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          ID: {report.id.slice(0, 8)}... • {new Date(report.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(report.status)}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 w-9 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => void handleDeleteReport(report)}
                        disabled={deletingReportId === report.id}
                        title="Delete report"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void handleDownloadReport(report)} disabled={!canDownload}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void openSelectedReport(report)} disabled={!canView}>
                        <Eye className="h-4 w-4" />
                      </Button>
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
            <DialogTitle>{selectedReport?.label || 'Report Details'}</DialogTitle>
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
                <div className="rounded-xl border bg-card p-4 space-y-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Patient
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {selectedReport.patient?.name || 'Unknown patient'}
                    </p>
                    {selectedReport.patient?.email && (
                      <p className="mt-1 break-all text-xs text-muted-foreground">
                        {selectedReport.patient.email}
                      </p>
                    )}
                    <p className="mt-1 break-all text-xs text-muted-foreground">
                      ID: {selectedReport.patient_id}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Report
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {selectedReport.label}
                    </p>
                    <p className="mt-1 break-all text-xs text-muted-foreground">
                      Original file: {selectedReport.file_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Status
                    </p>
                    <div className="mt-2">{getStatusBadge(selectedReport.status)}</div>
                  </div>
                </div>
              }
              actionBar={
                <div className="flex items-center gap-2">
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
                </div>
              }
            />
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
