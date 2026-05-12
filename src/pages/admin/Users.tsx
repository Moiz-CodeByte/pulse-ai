import { useEffect, useState } from 'react';
import { Users, Search, MoreVertical, UserPlus, Mail, Lock, User, Eye } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { adminCreateUser } from '@/lib/mriAnalysis';
import { formatConsultationFee, formatRating } from '@/lib/doctorProfiles';

type AppRole = 'patient' | 'doctor' | 'admin';

interface UserData {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
}

interface UserRole {
  user_id: string;
  role: AppRole;
  verified: boolean | null;
}

interface EditFormData {
  fullName: string;
  role: AppRole;
  verified: boolean;
}

interface CreateFormData {
  email: string;
  password: string;
  fullName: string;
  role: AppRole;
  verified: boolean;
}

interface DoctorInformation {
  medical_license_number: string | null;
  specialization: string | null;
  years_of_experience: number | null;
  phone_number: string | null;
  office_address: string | null;
  bio: string | null;
  profile_completed: boolean;
  consultation_fee?: number | null;
  average_rating?: number | null;
  total_reviews?: number | null;
  education_history?: Array<{
    degree: string;
    school: string;
    graduationYear: number | null;
    certifications: string;
  }>;
  work_history?: Array<{
    hospital: string;
    department: string;
    position: string;
  }>;
  availability_schedule?: Array<{
    day: string;
    startTime: string;
    endTime: string;
    notes?: string;
  }>;
  // Old fields (deprecated but still in database)
  medical_degree?: string | null;
  medical_school?: string | null;
  graduation_year?: number | null;
  additional_certifications?: string | null;
  current_hospital?: string | null;
  department?: string | null;
  position?: string | null;
}

interface UploadHistory {
  id: string;
  file_name: string;
  file_url: string;
  status: string | null;
  created_at: string;
}

interface PrescriptionHistory {
  id: string;
  medicine: string;
  dosage: string | null;
  instructions: string | null;
  notes: string | null;
  created_at: string;
  doctor_name: string | null;
  patient_name: string | null;
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [userRoles, setUserRoles] = useState<Map<string, UserRole>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserData | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const [editForm, setEditForm] = useState<EditFormData>({
    fullName: '',
    role: 'patient',
    verified: true,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormData>({
    email: '',
    password: '',
    fullName: '',
    role: 'patient',
    verified: true,
  });
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<UserData | null>(null);
  const [doctorInfo, setDoctorInfo] = useState<DoctorInformation | null>(null);
  const [loadingDoctorInfo, setLoadingDoctorInfo] = useState(false);
  const [uploadHistory, setUploadHistory] = useState<UploadHistory[]>([]);
  const [prescriptionHistory, setPrescriptionHistory] = useState<PrescriptionHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreateDialog = () => {
    setCreateForm({
      email: '',
      password: '',
      fullName: '',
      role: 'patient',
      verified: true,
    });
    setCreateOpen(true);
  };

  const handleCreateRoleChange = (role: AppRole) => {
    setCreateForm((current) => ({
      ...current,
      role,
      verified: role === 'doctor' ? current.verified : true,
    }));
  };

  const createUser = async () => {
    const { email, password, fullName, role, verified } = createForm;

    if (!email.trim() || !password.trim() || !fullName.trim()) {
      toast({
        title: 'Invalid input',
        description: 'All fields are required.',
        variant: 'destructive',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: 'Invalid password',
        description: 'Password must be at least 6 characters long.',
        variant: 'destructive',
      });
      return;
    }

    setCreatingUser(true);

    try {
      // Use backend service to create user with admin privileges
      await adminCreateUser({
        email,
        password,
        fullName,
        role,
        verified,
      });

      setCreatingUser(false);
      setCreateOpen(false);

      toast({
        title: 'User created',
        description: `${fullName} has been created successfully as a ${role}.`,
      });

      fetchUsers();
    } catch (error) {
      setCreatingUser(false);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create user.',
        variant: 'destructive',
      });
    }
  };

  const fetchUsers = async () => {
    setLoading(true);

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load users.',
        variant: 'destructive',
      });
    } else if (profiles) {
      setUsers(profiles);
    }

    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('*');

    if (rolesError) {
      toast({
        title: 'Error',
        description: 'Failed to load user roles.',
        variant: 'destructive',
      });
    } else if (roles) {
      const rolesMap = new Map<string, UserRole>();
      roles.forEach(r => rolesMap.set(r.user_id, r));
      setUserRoles(rolesMap);
    }

    setLoading(false);
  };

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(search.toLowerCase()) ||
    user.email.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'doctor': return 'default';
      default: return 'secondary';
    }
  };

  const openViewDetailsDialog = async (user: UserData) => {
    setViewingUser(user);
    setViewDetailsOpen(true);
    setDoctorInfo(null);
    setUploadHistory([]);
    setPrescriptionHistory([]);

    const currentRole = userRoles.get(user.id);
    
    // If user is a doctor, fetch their professional information
    if (currentRole?.role === 'doctor') {
      setLoadingDoctorInfo(true);
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - doctor_information table not yet in generated types
        const { data, error } = await supabase
          .from('doctor_information')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching doctor information:', error);
        } else if (data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setDoctorInfo(data as any);
        }
      } finally {
        setLoadingDoctorInfo(false);
      }

      // Fetch prescription history for doctors
      setLoadingHistory(true);
      try {
        const { data: prescriptions, error: prescError } = await supabase
          .from('prescriptions')
          .select(`
            id,
            medicine,
            dosage,
            instructions,
            notes,
            created_at,
            diagnosis:diagnosis_id (
              report:report_id (
                patient:patient_id (
                  full_name
                )
              )
            )
          `)
          .eq('doctor_id', user.id)
          .order('created_at', { ascending: false });

        if (prescError) {
          console.error('Error fetching prescription history:', prescError);
        } else if (prescriptions) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const formattedPrescriptions = prescriptions.map((p: any) => ({
            id: p.id,
            medicine: p.medicine,
            dosage: p.dosage,
            instructions: p.instructions,
            notes: p.notes,
            created_at: p.created_at,
            doctor_name: null,
            patient_name: p.diagnosis?.report?.patient?.full_name || 'Unknown',
          }));
          setPrescriptionHistory(formattedPrescriptions);
        }
      } finally {
        setLoadingHistory(false);
      }
    }

    // If user is a patient, fetch their upload history and prescription history
    if (currentRole?.role === 'patient') {
      setLoadingHistory(true);
      try {
        // Fetch upload history
        const { data: uploads, error: uploadError } = await supabase
          .from('mri_reports')
          .select('id, file_name, file_url, status, created_at')
          .eq('patient_id', user.id)
          .order('created_at', { ascending: false });

        if (uploadError) {
          console.error('Error fetching upload history:', uploadError);
        } else if (uploads) {
          setUploadHistory(uploads);
        }

        // Fetch prescription history for patient
        const { data: prescriptions, error: prescError } = await supabase
          .from('prescriptions')
          .select(`
            id,
            medicine,
            dosage,
            instructions,
            notes,
            created_at,
            doctor:doctor_id (
              full_name
            ),
            diagnosis:diagnosis_id (
              report:report_id (
                patient_id
              )
            )
          `)
          .order('created_at', { ascending: false });

        if (prescError) {
          console.error('Error fetching prescription history:', prescError);
        } else if (prescriptions) {
          // Filter prescriptions for this patient
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const patientPrescriptions = prescriptions.filter((p: any) => 
            p.diagnosis?.report?.patient_id === user.id
          );
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const formattedPrescriptions = patientPrescriptions.map((p: any) => ({
            id: p.id,
            medicine: p.medicine,
            dosage: p.dosage,
            instructions: p.instructions,
            notes: p.notes,
            created_at: p.created_at,
            doctor_name: p.doctor?.full_name || 'Unknown',
            patient_name: null,
          }));
          setPrescriptionHistory(formattedPrescriptions);
        }
      } finally {
        setLoadingHistory(false);
      }
    }
  };

  const openEditDialog = (userToEdit: UserData) => {
    const currentRole = userRoles.get(userToEdit.id);

    setEditingUser(userToEdit);
    setEditForm({
      fullName: userToEdit.full_name,
      role: currentRole?.role || 'patient',
      verified: currentRole?.verified ?? true,
    });
    setEditOpen(true);
  };

  const handleEditRoleChange = (role: AppRole) => {
    setEditForm((current) => ({
      ...current,
      role,
      verified: role === 'doctor' ? current.verified : true,
    }));
  };

  const saveUserChanges = async () => {
    if (!editingUser) {
      return;
    }

    const fullName = editForm.fullName.trim();

    if (fullName.length < 2) {
      toast({
        title: 'Invalid name',
        description: 'Full name must be at least 2 characters long.',
        variant: 'destructive',
      });
      return;
    }

    setSavingUser(true);

    const profileUpdate = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', editingUser.id);

    if (profileUpdate.error) {
      setSavingUser(false);
      toast({
        title: 'Error',
        description: profileUpdate.error.message || 'Failed to update user profile.',
        variant: 'destructive',
      });
      return;
    }

    const existingRole = userRoles.get(editingUser.id);
    const rolePayload = {
      role: editForm.role,
      verified: editForm.role === 'doctor' ? editForm.verified : true,
    };

    const roleMutation = existingRole
      ? await supabase
          .from('user_roles')
          .update(rolePayload)
          .eq('user_id', editingUser.id)
          .eq('role', existingRole.role)
      : await supabase
          .from('user_roles')
          .insert({
            user_id: editingUser.id,
            ...rolePayload,
          });

    if (roleMutation.error) {
      setSavingUser(false);
      toast({
        title: 'Error',
        description: roleMutation.error.message || 'Failed to update user role.',
        variant: 'destructive',
      });
      return;
    }

    setSavingUser(false);
    setEditOpen(false);
    setEditingUser(null);

    toast({
      title: 'User updated',
      description: 'The user details were updated successfully.',
    });

    fetchUsers();
  };

  const deleteUser = async () => {
    if (!deleteTarget) {
      return;
    }

    if (deleteTarget.id === currentUser?.id) {
      toast({
        title: 'Action blocked',
        description: 'You cannot delete your own admin account.',
        variant: 'destructive',
      });
      return;
    }

    setDeletingUser(true);

    const { error } = await supabase.rpc('admin_delete_user', {
      target_user_id: deleteTarget.id,
    });

    setDeletingUser(false);

    if (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete user.',
        variant: 'destructive',
      });
      return;
    }

    setDeleteTarget(null);

    toast({
      title: 'User deleted',
      description: 'The user account was deleted successfully.',
    });

    fetchUsers();
  };

  return (
    <DashboardLayout 
      title="User Management" 
      subtitle="View and manage all users in the system"
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Users</CardTitle>
          <div className="flex items-center gap-4">
            <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
            </div>
            <Button onClick={openCreateDialog}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading users...</p>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No users found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((user) => {
                const role = userRoles.get(user.id);
                const isCurrentUser = user.id === currentUser?.id;

                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {user.full_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{user.full_name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant={getRoleBadgeVariant(role?.role || 'patient')}>
                        {role?.role || 'patient'}
                      </Badge>
                      {role?.role === 'doctor' && (
                        <Badge variant={role.verified ? 'default' : 'outline'}>
                          {role.verified ? 'Verified' : 'Pending'}
                        </Badge>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => openViewDetailsDialog(user)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openEditDialog(user)}>
                            Edit User
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            disabled={isCurrentUser}
                            onSelect={() => setDeleteTarget(user)}
                          >
                            Delete User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update the user's profile information and access level.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full-name">Full Name</Label>
              <Input
                id="full-name"
                value={editForm.fullName}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, fullName: event.target.value }))
                }
                placeholder="Enter full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={editingUser?.email || ''}
                disabled
                readOnly
              />
              <p className="text-xs text-muted-foreground">
                Email is read-only here because authentication email changes require a separate auth update flow.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={editForm.role}
                onValueChange={(value) => handleEditRoleChange(value as AppRole)}
                disabled={editingUser?.id === currentUser?.id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="patient">Patient</SelectItem>
                  <SelectItem value="doctor">Doctor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              {editingUser?.id === currentUser?.id && (
                <p className="text-xs text-muted-foreground">
                  You cannot change your own admin role from this screen.
                </p>
              )}
            </div>

            {editForm.role === 'doctor' && (
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Checkbox
                  id="verified"
                  checked={editForm.verified}
                  onCheckedChange={(checked) =>
                    setEditForm((current) => ({ ...current, verified: checked === true }))
                  }
                />
                <div className="space-y-1">
                  <Label htmlFor="verified">Doctor verified</Label>
                  <p className="text-xs text-muted-foreground">
                    Unverified doctors cannot access protected doctor pages.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={savingUser}>
              Cancel
            </Button>
            <Button onClick={saveUserChanges} disabled={savingUser}>
              {savingUser ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user account?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `This will permanently delete ${deleteTarget.full_name}'s account and remove related records.`
                : 'This will permanently delete the selected user account.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingUser}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteUser}
              disabled={deletingUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingUser ? 'Deleting...' : 'Delete User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user to the system with a specific role.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-full-name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="create-full-name"
                  value={createForm.fullName}
                  onChange={(e) =>
                    setCreateForm((current) => ({ ...current, fullName: e.target.value }))
                  }
                  placeholder="Enter full name"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="create-email"
                  type="email"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm((current) => ({ ...current, email: e.target.value }))
                  }
                  placeholder="Enter email address"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="create-password"
                  type="password"
                  value={createForm.password}
                  onChange={(e) =>
                    setCreateForm((current) => ({ ...current, password: e.target.value }))
                  }
                  placeholder="Enter password (min 6 characters)"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={createForm.role}
                onValueChange={(value) => handleCreateRoleChange(value as AppRole)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="patient">Patient</SelectItem>
                  <SelectItem value="doctor">Doctor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {createForm.role === 'doctor' && (
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Checkbox
                  id="create-verified"
                  checked={createForm.verified}
                  onCheckedChange={(checked) =>
                    setCreateForm((current) => ({ ...current, verified: checked === true }))
                  }
                />
                <div className="space-y-1">
                  <Label htmlFor="create-verified">Doctor verified</Label>
                  <p className="text-xs text-muted-foreground">
                    Check this to allow immediate access to doctor features.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creatingUser}>
              Cancel
            </Button>
            <Button onClick={createUser} disabled={creatingUser}>
              {creatingUser ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              Complete information for {viewingUser?.full_name}
            </DialogDescription>
          </DialogHeader>

          {viewingUser && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">Basic Information</h3>
                <div className="grid gap-3">
                  <div className="flex justify-between items-start py-2 border-b">
                    <span className="text-sm font-medium text-muted-foreground">Full Name</span>
                    <span className="text-sm font-medium text-right">{viewingUser.full_name}</span>
                  </div>
                  <div className="flex justify-between items-start py-2 border-b">
                    <span className="text-sm font-medium text-muted-foreground">Email</span>
                    <span className="text-sm text-right">{viewingUser.email}</span>
                  </div>
                  <div className="flex justify-between items-start py-2 border-b">
                    <span className="text-sm font-medium text-muted-foreground">Role</span>
                    <Badge variant={getRoleBadgeVariant(userRoles.get(viewingUser.id)?.role || 'patient')}>
                      {userRoles.get(viewingUser.id)?.role || 'patient'}
                    </Badge>
                  </div>
                  {userRoles.get(viewingUser.id)?.role === 'doctor' && (
                    <div className="flex justify-between items-start py-2 border-b">
                      <span className="text-sm font-medium text-muted-foreground">Verification Status</span>
                      <Badge variant={userRoles.get(viewingUser.id)?.verified ? 'default' : 'outline'}>
                        {userRoles.get(viewingUser.id)?.verified ? 'Verified' : 'Pending Verification'}
                      </Badge>
                    </div>
                  )}
                  <div className="flex justify-between items-start py-2 border-b">
                    <span className="text-sm font-medium text-muted-foreground">Account Created</span>
                    <span className="text-sm">{new Date(viewingUser.created_at).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-start py-2 border-b">
                    <span className="text-sm font-medium text-muted-foreground">User ID</span>
                    <span className="text-xs font-mono text-muted-foreground">{viewingUser.id}</span>
                  </div>
                </div>
              </div>

              {/* Doctor Professional Information */}
              {userRoles.get(viewingUser.id)?.role === 'doctor' && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase">Professional Information</h3>
                  {loadingDoctorInfo ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : doctorInfo ? (
                    <div className="grid gap-3">
                      <div className="flex justify-between items-start py-2 border-b">
                        <span className="text-sm font-medium text-muted-foreground">Profile Status</span>
                        <Badge variant={doctorInfo.profile_completed ? 'default' : 'outline'}>
                          {doctorInfo.profile_completed ? 'Completed' : 'Incomplete'}
                        </Badge>
                      </div>
                      
                      {/* Licensing & Specialization */}
                      {doctorInfo.medical_license_number && (
                        <div className="flex justify-between items-start py-2 border-b">
                          <span className="text-sm font-medium text-muted-foreground">Medical License</span>
                          <span className="text-sm text-right">{doctorInfo.medical_license_number}</span>
                        </div>
                      )}
                      {doctorInfo.specialization && (
                        <div className="flex justify-between items-start py-2 border-b">
                          <span className="text-sm font-medium text-muted-foreground">Specialization</span>
                          <span className="text-sm text-right">{doctorInfo.specialization}</span>
                        </div>
                      )}
                      {doctorInfo.years_of_experience !== null && (
                        <div className="flex justify-between items-start py-2 border-b">
                          <span className="text-sm font-medium text-muted-foreground">Experience</span>
                          <span className="text-sm">{doctorInfo.years_of_experience} years</span>
                        </div>
                      )}
                      <div className="flex justify-between items-start py-2 border-b">
                        <span className="text-sm font-medium text-muted-foreground">Consultation Fee</span>
                        <span className="text-sm text-right">
                          {formatConsultationFee(doctorInfo.consultation_fee ?? undefined)}
                        </span>
                      </div>
                      <div className="flex justify-between items-start py-2 border-b">
                        <span className="text-sm font-medium text-muted-foreground">Reviews</span>
                        <span className="text-sm text-right">
                          {formatRating(
                            doctorInfo.average_rating ?? undefined,
                            doctorInfo.total_reviews ?? undefined,
                          )}
                        </span>
                      </div>

                      {/* Education History */}
                      {(doctorInfo.education_history && doctorInfo.education_history.length > 0) && (
                        <div className="py-2">
                          <h4 className="text-sm font-semibold text-muted-foreground mb-3">Education History</h4>
                          <div className="space-y-3">
                            {doctorInfo.education_history.map((edu, index) => (
                              <div key={index} className="p-3 rounded-lg border bg-muted/30">
                                {edu.degree && (
                                  <div className="font-medium text-sm mb-1">{edu.degree}</div>
                                )}
                                {edu.school && (
                                  <div className="text-sm text-muted-foreground mb-1">{edu.school}</div>
                                )}
                                {edu.graduationYear && (
                                  <div className="text-xs text-muted-foreground mb-1">Graduated: {edu.graduationYear}</div>
                                )}
                                {edu.certifications && (
                                  <div className="text-xs text-muted-foreground mt-2">
                                    <span className="font-medium">Certifications:</span> {edu.certifications}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Fallback to old education format if no education_history */}
                      {(!doctorInfo.education_history || doctorInfo.education_history.length === 0) && (
                        <>
                          {doctorInfo.medical_degree && (
                            <div className="flex justify-between items-start py-2 border-b">
                              <span className="text-sm font-medium text-muted-foreground">Medical Degree</span>
                              <span className="text-sm text-right">{doctorInfo.medical_degree}</span>
                            </div>
                          )}
                          {doctorInfo.medical_school && (
                            <div className="flex justify-between items-start py-2 border-b">
                              <span className="text-sm font-medium text-muted-foreground">Medical School</span>
                              <span className="text-sm text-right">{doctorInfo.medical_school}</span>
                            </div>
                          )}
                          {doctorInfo.graduation_year && (
                            <div className="flex justify-between items-start py-2 border-b">
                              <span className="text-sm font-medium text-muted-foreground">Graduation Year</span>
                              <span className="text-sm">{doctorInfo.graduation_year}</span>
                            </div>
                          )}
                          {doctorInfo.additional_certifications && (
                            <div className="flex justify-between items-start py-2 border-b">
                              <span className="text-sm font-medium text-muted-foreground">Certifications</span>
                              <span className="text-sm text-right whitespace-pre-wrap">{doctorInfo.additional_certifications}</span>
                            </div>
                          )}
                        </>
                      )}

                      {/* Work History */}
                      {(doctorInfo.work_history && doctorInfo.work_history.length > 0) && (
                        <div className="py-2">
                          <h4 className="text-sm font-semibold text-muted-foreground mb-3">Work History</h4>
                          <div className="space-y-3">
                            {doctorInfo.work_history.map((work, index) => (
                              <div key={index} className="p-3 rounded-lg border bg-muted/30">
                                {work.hospital && (
                                  <div className="font-medium text-sm mb-1">{work.hospital}</div>
                                )}
                                <div className="flex gap-2 text-sm text-muted-foreground">
                                  {work.position && <span>{work.position}</span>}
                                  {work.position && work.department && <span>•</span>}
                                  {work.department && <span>{work.department}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Fallback to old work format if no work_history */}
                      {(!doctorInfo.work_history || doctorInfo.work_history.length === 0) && (
                        <>
                          {doctorInfo.current_hospital && (
                            <div className="flex justify-between items-start py-2 border-b">
                              <span className="text-sm font-medium text-muted-foreground">Hospital</span>
                              <span className="text-sm text-right">{doctorInfo.current_hospital}</span>
                            </div>
                          )}
                          {doctorInfo.department && (
                            <div className="flex justify-between items-start py-2 border-b">
                              <span className="text-sm font-medium text-muted-foreground">Department</span>
                              <span className="text-sm text-right">{doctorInfo.department}</span>
                            </div>
                          )}
                          {doctorInfo.position && (
                            <div className="flex justify-between items-start py-2 border-b">
                              <span className="text-sm font-medium text-muted-foreground">Position</span>
                              <span className="text-sm text-right">{doctorInfo.position}</span>
                            </div>
                          )}
                        </>
                      )}

                      {/* Contact Information */}
                      {doctorInfo.phone_number && (
                        <div className="flex justify-between items-start py-2 border-b">
                          <span className="text-sm font-medium text-muted-foreground">Phone</span>
                          <span className="text-sm">{doctorInfo.phone_number}</span>
                        </div>
                      )}
                      {doctorInfo.office_address && (
                        <div className="flex justify-between items-start py-2 border-b">
                          <span className="text-sm font-medium text-muted-foreground">Office Address</span>
                          <span className="text-sm text-right whitespace-pre-wrap">{doctorInfo.office_address}</span>
                        </div>
                      )}
                      <div className="py-2 border-b">
                        <span className="text-sm font-medium text-muted-foreground block mb-2">
                          Availability Schedule
                        </span>
                        {doctorInfo.availability_schedule?.length ? (
                          <div className="space-y-2">
                            {doctorInfo.availability_schedule.map((slot, index) => (
                              <div key={`${slot.day}-${slot.startTime}-${index}`} className="rounded-md border bg-muted/30 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-sm font-medium">{slot.day || 'Day not set'}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {slot.startTime && slot.endTime
                                      ? `${slot.startTime} - ${slot.endTime}`
                                      : 'Time not provided'}
                                  </span>
                                </div>
                                {slot.notes ? (
                                  <p className="mt-2 text-xs text-muted-foreground">{slot.notes}</p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No availability schedule provided.</p>
                        )}
                      </div>

                      {/* Bio */}
                      {doctorInfo.bio && (
                        <div className="py-2 border-b">
                          <span className="text-sm font-medium text-muted-foreground block mb-2">Bio</span>
                          <p className="text-sm whitespace-pre-wrap">{doctorInfo.bio}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-4 text-center text-sm text-muted-foreground">
                      No professional information available. Doctor has not completed their profile yet.
                    </div>
                  )}
                </div>
              )}

              {/* Patient Upload History */}
              {userRoles.get(viewingUser.id)?.role === 'patient' && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase">Upload History</h3>
                  {loadingHistory ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : uploadHistory.length > 0 ? (
                    <div className="space-y-2">
                      {uploadHistory.map((upload) => (
                        <div key={upload.id} className="p-3 rounded-lg border bg-card">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-medium">{upload.file_name}</span>
                            <Badge variant={upload.status === 'completed' ? 'default' : 'outline'}>
                              {upload.status || 'pending'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Uploaded: {new Date(upload.created_at).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-4 text-center text-sm text-muted-foreground">
                      No MRI scans uploaded yet.
                    </div>
                  )}
                </div>
              )}

              {/* Prescription History - For Patients and Doctors */}
              {(userRoles.get(viewingUser.id)?.role === 'patient' || userRoles.get(viewingUser.id)?.role === 'doctor') && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase">
                    {userRoles.get(viewingUser.id)?.role === 'patient' ? 'Prescription History' : 'Prescriptions Written'}
                  </h3>
                  {loadingHistory ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : prescriptionHistory.length > 0 ? (
                    <div className="space-y-2">
                      {prescriptionHistory.map((prescription) => (
                        <div key={prescription.id} className="p-3 rounded-lg border bg-card">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-medium">{prescription.medicine}</span>
                            {prescription.dosage && (
                              <span className="text-xs text-muted-foreground">{prescription.dosage}</span>
                            )}
                          </div>
                          {prescription.instructions && (
                            <p className="text-xs text-muted-foreground mb-1">
                              <span className="font-medium">Instructions:</span> {prescription.instructions}
                            </p>
                          )}
                          {prescription.notes && (
                            <p className="text-xs text-muted-foreground mb-1">
                              <span className="font-medium">Notes:</span> {prescription.notes}
                            </p>
                          )}
                          <div className="flex justify-between items-center mt-2 pt-2 border-t">
                            {prescription.doctor_name && (
                              <span className="text-xs text-muted-foreground">
                                Dr. {prescription.doctor_name}
                              </span>
                            )}
                            {prescription.patient_name && (
                              <span className="text-xs text-muted-foreground">
                                Patient: {prescription.patient_name}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {new Date(prescription.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-4 text-center text-sm text-muted-foreground">
                      {userRoles.get(viewingUser.id)?.role === 'patient' 
                        ? 'No prescriptions received yet.'
                        : 'No prescriptions written yet.'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
