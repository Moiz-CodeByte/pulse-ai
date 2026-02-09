import { useEffect, useState } from 'react';
import { UserCheck, Check, X, Stethoscope } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PendingDoctor {
  user_id: string;
  profile?: {
    full_name: string;
    email: string;
    created_at: string;
  };
}

export default function AdminVerifyDoctors() {
  const { toast } = useToast();
  const [pendingDoctors, setPendingDoctors] = useState<PendingDoctor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingDoctors();
  }, []);

  const fetchPendingDoctors = async () => {
    const { data: roles, error } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'doctor')
      .eq('verified', false);

    if (!error && roles) {
      // Fetch profiles for pending doctors
      const doctorsWithProfiles: PendingDoctor[] = [];
      
      for (const role of roles) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email, created_at')
          .eq('id', role.user_id)
          .single();
        
        doctorsWithProfiles.push({
          user_id: role.user_id,
          profile: profile || undefined,
        });
      }
      
      setPendingDoctors(doctorsWithProfiles);
    }
    setLoading(false);
  };

  const verifyDoctor = async (userId: string) => {
    const { error } = await supabase
      .from('user_roles')
      .update({ verified: true })
      .eq('user_id', userId)
      .eq('role', 'doctor');

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to verify doctor.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Doctor Verified',
        description: 'The doctor account has been verified successfully.',
      });
      fetchPendingDoctors();
    }
  };

  const rejectDoctor = async (userId: string) => {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', 'doctor');

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to reject doctor.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Doctor Rejected',
        description: 'The doctor application has been rejected.',
      });
      fetchPendingDoctors();
    }
  };

  return (
    <DashboardLayout 
      title="Doctor Verification" 
      subtitle="Review and verify doctor account applications"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Pending Verifications
          </CardTitle>
          <CardDescription>
            Review doctor applications and verify their credentials before they can access the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading pending doctors...</p>
          ) : pendingDoctors.length === 0 ? (
            <div className="text-center py-12">
              <UserCheck className="h-16 w-16 mx-auto text-success mb-4" />
              <p className="text-lg font-medium">All caught up!</p>
              <p className="text-muted-foreground">
                No pending doctor verifications at this time.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingDoctors.map((doctor) => (
                <div
                  key={doctor.user_id}
                  className="flex items-center justify-between p-6 rounded-xl border bg-card"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-primary/10">
                      <Stethoscope className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-lg">
                        {doctor.profile?.full_name || 'Unknown'}
                      </p>
                      <p className="text-muted-foreground">
                        {doctor.profile?.email || 'No email'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Applied on {doctor.profile?.created_at 
                          ? new Date(doctor.profile.created_at).toLocaleDateString() 
                          : 'Unknown date'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-warning border-warning">
                      Pending Review
                    </Badge>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => rejectDoctor(doctor.user_id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => verifyDoctor(doctor.user_id)}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Verify
                    </Button>
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