import { useEffect, useState } from 'react';
import { Users, Eye, FileText } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PrescriptionForm } from '@/components/doctor/PrescriptionForm';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Case {
  id: string;
  report_id: string;
  patient_id: string;
  assigned_at: string;
}

export default function DoctorCases() {
  const { user } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
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
      .select('*')
      .eq('doctor_id', user.id)
      .order('assigned_at', { ascending: false });

    if (!error && data) {
      setCases(data);
    }
    setLoading(false);
  };

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
            <div className="space-y-4">
              {cases.map((caseItem) => (
                <div
                  key={caseItem.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Case #{caseItem.id.slice(0, 8)}</p>
                      <p className="text-sm text-muted-foreground">
                        Assigned on {new Date(caseItem.assigned_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          Review
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Case Details</DialogTitle>
                        </DialogHeader>
                        <div className="py-4 space-y-6">
                          <p className="text-muted-foreground">
                            Review the MRI scan and provide your prescription below.
                          </p>
                          <PrescriptionForm 
                            diagnosisId={caseItem.report_id} 
                            onSuccess={() => fetchCases()}
                          />
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