import { useEffect, useState } from 'react';
import { FileText, Eye } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Report {
  id: string;
  file_name: string;
  file_url: string;
  status: string;
  created_at: string;
  diagnosis?: {
    risk_level: 'low' | 'medium' | 'high';
    confidence: number;
    details: string;
  };
}

export default function PatientReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  useEffect(() => {
    if (user) {
      fetchReports();
    }
  }, [user]);

  const fetchReports = async () => {
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
        diagnosis: r.diagnosis?.[0] || undefined
      })));
    }
    setLoading(false);
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
                        <span className="text-sm text-muted-foreground">
                          {report.diagnosis.confidence}% confidence
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-warning font-medium capitalize">
                        {report.status}
                      </span>
                    )}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setSelectedReport(report)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Report Details</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6 py-4">
                          <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                            <img 
                              src={report.file_url} 
                              alt="MRI Scan" 
                              className="w-full h-full object-contain"
                            />
                          </div>
                          {report.diagnosis && (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">Risk Assessment</span>
                                <RiskBadge level={report.diagnosis.risk_level} size="lg" />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="font-medium">Confidence Level</span>
                                <span className="text-lg font-semibold">{report.diagnosis.confidence}%</span>
                              </div>
                              {report.diagnosis.details && (
                                <div>
                                  <span className="font-medium">Analysis Details</span>
                                  <p className="mt-2 text-muted-foreground">{report.diagnosis.details}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
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