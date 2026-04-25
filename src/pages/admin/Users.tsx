import { useEffect, useState } from 'react';
import { Users, Search, MoreVertical } from 'lucide-react';
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

  useEffect(() => {
    fetchUsers();
  }, []);

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
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
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
                          <DropdownMenuItem onSelect={() => openEditDialog(user)}>
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
    </DashboardLayout>
  );
}