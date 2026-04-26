import { useCallback, useEffect, useState } from 'react';
import { Download, Eye, FileText } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ReportDiagnosisDetails } from '@/components/reports/ReportDiagnosisDetails';
import { ReportImagePreview } from '@/components/reports/ReportImagePreview';
import type { BaseReportDiagnosis, BaseReportRecord } from '@/components/reports/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { createMRISignedUrl, downloadMRIReportPdf, normalizeSingleRelation } from '@/lib/mriReports';
import { canUseReportAction } from '@/lib/reportPermissions';

interface Report extends BaseReportRecord {
  patient_id: string;
  diagnosis?: BaseReportDiagnosis;
}

export default function PatientReports() {
  const { user, userRole, isVerified } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedReportUrl, setSelectedReportUrl] = useState<string | null>(null);
  const [selectedReportLoading, setSelectedReportLoading] = useState(false);

  const fetchReports = useCallback(async () => {
    if (!user) return;
    
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
        riskLevel: report.diagnosis?.risk_level,
        confidence: report.diagnosis?.confidence,
        details: report.diagnosis?.details,
      });
    } catch (error) {
      console.error('Failed to download report PDF', error);
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

                return (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate max-w-[170px] sm:max-w-[280px]" title={report.file_name}>{report.file_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Uploaded on {new Date(report.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Report Details</DialogTitle>
          </DialogHeader>

          {selectedReport && (
            <div className="grid gap-6 py-4 sm:grid-cols-[220px,1fr] sm:items-start">
              <ReportImagePreview
                loading={selectedReportLoading}
                imageUrl={selectedReportUrl}
                alt={selectedReport.file_name}
                fallbackText="The MRI image could not be loaded for this report."
              />

              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => void handleDownloadReport(selectedReport)}>
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Status</span>
                  <span className="text-sm capitalize text-muted-foreground">{selectedReport.status}</span>
                </div>

                <ReportDiagnosisDetails diagnosis={selectedReport.diagnosis} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}