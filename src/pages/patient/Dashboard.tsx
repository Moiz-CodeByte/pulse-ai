import { useEffect, useState } from 'react';
import { FileText, Upload, Activity, AlertTriangle } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/ui/StatCard';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';

interface Report {
  id: string;
  file_name: string;
  status: string;
  created_at: string;
  diagnosis?: {
    risk_level: 'low' | 'medium' | 'high';
    confidence: number;
  };
}

export default function PatientDashboard() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

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
        status,
        created_at,
        diagnosis (
          risk_level,
          confidence
        )
      `)
      .eq('patient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!error && data) {
      setReports(data.map(r => ({
        ...r,
        diagnosis: r.diagnosis?.[0] || undefined
      })));
    }
    setLoading(false);
  };

  const totalReports = reports.length;
  const completedReports = reports.filter(r => r.status === 'completed').length;
  const highRiskCount = reports.filter(r => r.diagnosis?.risk_level === 'high').length;

  return (
    <DashboardLayout 
      title="Patient Dashboard" 
      subtitle="Monitor your cardiac health and view AI diagnosis results"
    >
      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Scans"
          value={totalReports}
          icon={FileText}
          variant="default"
        />
        <StatCard
          title="Completed Analysis"
          value={completedReports}
          icon={Activity}
          variant="success"
        />
        <StatCard
          title="Pending Review"
          value={totalReports - completedReports}
          icon={Upload}
          variant="warning"
        />
        <StatCard
          title="High Risk Alerts"
          value={highRiskCount}
          icon={AlertTriangle}
          variant={highRiskCount > 0 ? 'danger' : 'default'}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Upload New Scan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Upload your cardiac MRI scan for AI-powered analysis and risk assessment.
            </p>
            <Link to="/patient/upload">
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                Upload MRI Scan
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest Diagnosis</CardTitle>
          </CardHeader>
          <CardContent>
            {reports.length > 0 && reports[0].diagnosis ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Risk Level</span>
                  <RiskBadge level={reports[0].diagnosis.risk_level} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Confidence</span>
                  <span className="font-semibold">{reports[0].diagnosis.confidence}%</span>
                </div>
                <div className="pt-2">
                  <Link to="/patient/reports">
                    <Button variant="outline" className="w-full">View Full Report</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">
                No diagnosis available yet. Upload an MRI scan to get started.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading reports...</p>
          ) : reports.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No reports yet. Upload your first MRI scan.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
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
                        {new Date(report.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {report.diagnosis ? (
                      <RiskBadge level={report.diagnosis.risk_level} size="sm" />
                    ) : (
                      <span className="text-sm text-muted-foreground capitalize">{report.status}</span>
                    )}
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