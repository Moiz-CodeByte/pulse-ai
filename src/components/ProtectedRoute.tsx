import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

type AppRole = 'patient' | 'doctor' | 'admin';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: AppRole[];
  requireVerified?: boolean;
}

export function ProtectedRoute({ children, allowedRoles, requireVerified = false }: ProtectedRouteProps) {
  const { user, userRole, isVerified, loading, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [checkingDoctorProfile, setCheckingDoctorProfile] = useState(false);
  const [doctorProfileComplete, setDoctorProfileComplete] = useState<boolean | null>(null);

  // Check if doctor has completed their profile
  useEffect(() => {
    const checkDoctorProfile = async () => {
      if (!user || userRole !== 'doctor' || location.pathname === '/doctor/complete-profile') {
        return;
      }

      setCheckingDoctorProfile(true);

      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - doctor_information table not yet in generated types
        const { data, error } = await supabase.from('doctor_information').select('profile_completed').eq('user_id', user.id).maybeSingle();

        if (error) {
          console.error('Error checking doctor profile:', error);
          setDoctorProfileComplete(null);
        } else if (data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setDoctorProfileComplete((data as any).profile_completed || false);
        } else {
          // No profile record exists
          setDoctorProfileComplete(false);
        }
      } finally {
        setCheckingDoctorProfile(false);
      }
    };

    checkDoctorProfile();
  }, [user, userRole, location.pathname]);

  if (loading || checkingDoctorProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    // Redirect to appropriate dashboard based on role
    const redirectPath = userRole === 'admin' ? '/admin' : userRole === 'doctor' ? '/doctor' : '/patient';
    return <Navigate to={redirectPath} replace />;
  }

  // Redirect doctors to complete profile if not completed (BEFORE verification check)
  if (
    userRole === 'doctor' && 
    doctorProfileComplete === false && 
    location.pathname !== '/doctor/complete-profile'
  ) {
    return <Navigate to="/doctor/complete-profile" replace />;
  }

  // Only check verification AFTER profile completion check
  if (requireVerified && !isVerified) {
    const handleSignOut = async () => {
      await signOut();
      navigate('/');
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-warning/10 flex items-center justify-center">
            <span className="text-3xl">⏳</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Account Pending Verification</h2>
          <p className="text-muted-foreground mb-6">
            Your account is awaiting admin verification. You'll be notified once your account has been approved.
          </p>
          <Button 
            variant="outline" 
            onClick={handleSignOut}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}