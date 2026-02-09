import { useEffect, useState } from 'react';
import { ClipboardList, Pill } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Prescription {
  id: string;
  medicine: string;
  dosage: string;
  instructions: string;
  notes: string;
  created_at: string;
}

export default function DoctorPrescriptions() {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPrescriptions();
    }
  }, [user]);

  const fetchPrescriptions = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('doctor_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPrescriptions(data);
    }
    setLoading(false);
  };

  return (
    <DashboardLayout 
      title="My Prescriptions" 
      subtitle="View all prescriptions you've written"
    >
      <Card>
        <CardHeader>
          <CardTitle>Prescription History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading prescriptions...</p>
          ) : prescriptions.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No prescriptions written yet</p>
              <p className="text-muted-foreground">
                Your prescription history will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {prescriptions.map((prescription) => (
                <div
                  key={prescription.id}
                  className="p-6 rounded-xl border bg-card"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <Pill className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">{prescription.medicine}</h3>
                        <span className="text-sm text-muted-foreground">
                          {new Date(prescription.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {prescription.dosage && (
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium">Dosage:</span> {prescription.dosage}
                        </p>
                      )}
                      {prescription.instructions && (
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium">Instructions:</span> {prescription.instructions}
                        </p>
                      )}
                    </div>
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