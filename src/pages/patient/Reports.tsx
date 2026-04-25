import { useCallback, useEffect, useState } from 'react';
import { Download, Eye, FileText, Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { createMRISignedUrl, downloadMRIReportPdf, normalizeSingleRelation } from '@/lib/mriReports';

interface Diagnosis {
  risk_level: 'low' | 'medium' | 'high';
  confidence: number;
  details: string | null;
}

interface Report {
  id: string;
  file_name: string;
  file_url: string;
  status: string;
  created_at: string;
  diagnosis?: Diagnosis;
}

export default function PatientReports() {
  const { user } = useAuth();
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
        diagnosis: normalizeSingleRelation(r.diagnosis as Diagnosis | Diagnosis[] | null | undefined)
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

  const openSelectedReport = async (report: Report) => {
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
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{report.file_name}</p>
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
                    <Button variant="outline" size="sm" onClick={() => void handleDownloadReport(report)}>
                      <Download className="h-4 w-4" />
                      
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void openSelectedReport(report)}>
                      <Eye className="h-4 w-4" />
                      
                    </Button>
                  </div>
                </div>
              ))}
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
              <div className="mx-auto flex min-h-44 w-full max-w-[220px] items-center justify-center rounded-xl border bg-muted/40 p-3">
                {selectedReportLoading ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : selectedReportUrl ? (
                  <img
                    src={selectedReportUrl}
                    alt={selectedReport.file_name}
                    className="max-h-48 w-auto max-w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                    The MRI image could not be loaded for this report.
                  </div>
                )}
              </div>

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

                {selectedReport.diagnosis ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Risk Assessment</span>
                      <RiskBadge level={selectedReport.diagnosis.risk_level} size="lg" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Confidence Level</span>
                      <span className="text-lg font-semibold">{selectedReport.diagnosis.confidence}%</span>
                    </div>
                    {selectedReport.diagnosis.details && (
                      <div>
                        <span className="font-medium">Analysis Details</span>
                        <p className="mt-2 whitespace-pre-line text-muted-foreground">{selectedReport.diagnosis.details}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Diagnosis details are not available for this report yet.
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}