import { useEffect, useState } from 'react';
import { Users, UserCheck, FileText, Shield } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

interface UserWithRole {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  user_role?: {
    role: string;
    verified: boolean;
  };
}

interface UserRoleRow {
  user_id: string;
  role: string;
  verified: boolean | null;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [pendingDoctors, setPendingDoctors] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDoctors: 0,
    totalPatients: 0,
    pendingVerifications: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    // Fetch user roles first so recent profile cards can show the real role.
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role, verified, user_id');

    if (roles) {
      const totalDoctors = roles.filter(r => r.role === 'doctor').length;
      const totalPatients = roles.filter(r => r.role === 'patient').length;
      const pendingVerifications = roles.filter(r => r.role === 'doctor' && !r.verified).length;

      setStats({
        totalUsers: roles.length,
        totalDoctors,
        totalPatients,
        pendingVerifications,
      });
    }

    // Fetch profiles
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && profiles) {
      const rolesMap = new Map(
        ((roles ?? []) as UserRoleRow[]).map((role) => [role.user_id, role]),
      );

      setUsers(
        profiles.map((profile) => {
          const role = rolesMap.get(profile.id);
          return {
            ...profile,
            user_role: role
              ? {
                  role: role.role,
                  verified: role.verified ?? false,
                }
              : undefined,
          };
        }),
      );
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
        title: 'Success',
        description: 'Doctor has been verified.',
      });
      fetchData();
    }
  };

  return (
    <DashboardLayout 
      title="Admin Dashboard" 
      subtitle="Manage users, verify doctors, and monitor system activity"
    >
      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          icon={Users}
          variant="default"
        />
        <StatCard
          title="Doctors"
          value={stats.totalDoctors}
          icon={UserCheck}
          variant="primary"
        />
        <StatCard
          title="Patients"
          value={stats.totalPatients}
          icon={Users}
          variant="success"
        />
        <StatCard
          title="Pending Verifications"
          value={stats.pendingVerifications}
          icon={Shield}
          variant={stats.pendingVerifications > 0 ? 'warning' : 'default'}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <Card>
          <CardHeader className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Recent Users</CardTitle>
            <Link to="/admin/users" className="w-full sm:w-auto">
              <Button variant="outline" size="sm" className="w-full sm:w-auto">View All</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <div className="space-y-3">
                {users.slice(0, 5).map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate" title={user.full_name}>{user.full_name}</p>
                      <p className="text-sm text-muted-foreground break-all">{user.email}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 self-start sm:self-auto sm:justify-end">
                      <Badge variant="outline">
                        {user.user_role?.role || 'No role'}
                      </Badge>
                      {user.user_role?.role === 'doctor' && (
                        <Badge variant={user.user_role.verified ? 'default' : 'outline'}>
                          {user.user_role.verified ? 'Verified' : 'Pending'}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Verifications */}
        <Card className={stats.pendingVerifications > 0 ? 'border-warning/30' : ''}>
          <CardHeader className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-warning" />
              Doctor Verifications
            </CardTitle>
            <Link to="/admin/verify-doctors" className="w-full sm:w-auto">
              <Button variant="outline" size="sm" className="w-full sm:w-auto">Manage</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {stats.pendingVerifications === 0 ? (
              <div className="text-center py-6">
                <UserCheck className="h-10 w-10 mx-auto text-success mb-2" />
                <p className="text-muted-foreground">All doctors are verified!</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {stats.pendingVerifications} doctor(s) awaiting verification
                </p>
                <Link to="/admin/verify-doctors">
                  <Button className="w-full">
                    Review Pending Doctors
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
