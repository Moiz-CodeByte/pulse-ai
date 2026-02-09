import { useEffect, useState } from 'react';
import { Pill, FileText } from 'lucide-react';
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
  doctor_profile?: {
    full_name: string;
  };
}

export default function PatientPrescriptions() {
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
    
    // Get prescriptions through diagnosis and mri_reports
    const { data, error } = await supabase
      .from('prescriptions')
      .select(`
        id,
        medicine,
        dosage,
        instructions,
        notes,
        created_at,
        doctor_id
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPrescriptions(data);
    }
    setLoading(false);
  };

  return (
    <DashboardLayout 
      title="My Prescriptions" 
      subtitle="View prescriptions from your doctors"
    >
      <Card>
        <CardHeader>
          <CardTitle>All Prescriptions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading prescriptions...</p>
          ) : prescriptions.length === 0 ? (
            <div className="text-center py-12">
              <Pill className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No prescriptions yet</p>
              <p className="text-muted-foreground">
                Prescriptions will appear here once a doctor reviews your diagnosis.
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
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">{prescription.medicine}</h3>
                        <span className="text-sm text-muted-foreground">
                          {new Date(prescription.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {prescription.dosage && (
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">Dosage:</span>
                          <p className="mt-1">{prescription.dosage}</p>
                        </div>
                      )}
                      {prescription.instructions && (
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">Instructions:</span>
                          <p className="mt-1">{prescription.instructions}</p>
                        </div>
                      )}
                      {prescription.notes && (
                        <div className="p-3 rounded-lg bg-muted">
                          <span className="text-sm font-medium">Doctor's Notes:</span>
                          <p className="mt-1 text-sm text-muted-foreground">{prescription.notes}</p>
                        </div>
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