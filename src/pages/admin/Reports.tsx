import { useEffect, useState } from 'react';
import { FileText, Search } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface Report {
  id: string;
  file_name: string;
  status: string;
  created_at: string;
  patient_id: string;
  diagnosis?: Array<{
    risk_level: 'low' | 'medium' | 'high';
    confidence: number;
  }>;
}

export default function AdminReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    const { data, error } = await supabase
      .from('mri_reports')
      .select(`
        id,
        file_name,
        status,
        created_at,
        patient_id,
        diagnosis (
          risk_level,
          confidence
        )
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Map the data to match our interface
      const mappedReports: Report[] = data.map(item => {
        const diagnosisData = item.diagnosis as unknown;
        const diagnosisArray = Array.isArray(diagnosisData) ? diagnosisData : diagnosisData ? [diagnosisData] : undefined;
        return {
          id: item.id,
          file_name: item.file_name,
          status: item.status || 'pending',
          created_at: item.created_at,
          patient_id: item.patient_id,
          diagnosis: diagnosisArray as Report['diagnosis'],
        };
      });
      setReports(mappedReports);
    }
    setLoading(false);
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
    report.file_name.toLowerCase().includes(search.toLowerCase()) ||
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
                const diagnosis = report.diagnosis?.[0];
                return (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{report.file_name}</p>
                        <p className="text-sm text-muted-foreground">
                          ID: {report.id.slice(0, 8)}... • {new Date(report.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {getStatusBadge(report.status)}
                      {diagnosis && (
                        <RiskBadge level={diagnosis.risk_level} size="sm" />
                      )}
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