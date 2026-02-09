import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

type AppRole = 'patient' | 'doctor' | 'admin';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: AppRole[];
  requireVerified?: boolean;
}

export function ProtectedRoute({ children, allowedRoles, requireVerified = false }: ProtectedRouteProps) {
  const { user, userRole, isVerified, loading } = useAuth();
  const location = useLocation();

  if (loading) {
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

  if (requireVerified && !isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-warning/10 flex items-center justify-center">
            <span className="text-3xl">⏳</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Account Pending Verification</h2>
          <p className="text-muted-foreground">
            Your account is awaiting admin verification. You'll be notified once your account has been approved.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}