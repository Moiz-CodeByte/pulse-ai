import { useEffect, useState } from 'react';
import { Users, FileText, Activity, CheckCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/ui/StatCard';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';

interface AssignedCase {
  id: string;
  report_id: string;
  patient_id: string;
  assigned_at: string;
  mri_report?: {
    file_name: string;
    status: string;
    created_at: string;
    diagnosis?: {
      risk_level: 'low' | 'medium' | 'high';
      confidence: number;
    }[];
  };
  patient_profile?: {
    full_name: string;
    email: string;
  };
}

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [cases, setCases] = useState<AssignedCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchCases();
    }
  }, [user]);

  const fetchCases = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('doctor_assignments')
      .select(`
        id,
        report_id,
        patient_id,
        assigned_at
      `)
      .eq('doctor_id', user.id)
      .order('assigned_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setCases(data);
    }
    setLoading(false);
  };

  const totalCases = cases.length;
  const pendingCases = cases.filter(c => !c.mri_report?.diagnosis?.length).length;

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
        <CardHeader className="flex flex-row items-center justify-between">
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
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
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
                  <div className="flex items-center gap-4">
                    {caseItem.mri_report?.diagnosis?.[0] ? (
                      <RiskBadge level={caseItem.mri_report.diagnosis[0].risk_level} size="sm" />
                    ) : (
                      <span className="text-sm text-warning">Pending Analysis</span>
                    )}
                    <Button variant="outline" size="sm">Review</Button>
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