export type AppRole = 'patient' | 'doctor' | 'admin' | null | undefined;

export interface RoleMenuItem {
  label: string;
  href: string;
}

export function getNavbarMenuItems(userRole: AppRole): RoleMenuItem[] {
  switch (userRole) {
    case 'admin':
      return [
        { label: 'Dashboard', href: '/admin' },
        { label: 'All Users', href: '/admin/users' },
        { label: 'Verify Doctors', href: '/admin/verify-doctors' },
        { label: 'Settings', href: '/admin/settings' },
      ];
    case 'doctor':
      return [
        { label: 'Dashboard', href: '/doctor' },
        { label: 'Cases', href: '/doctor/cases' },
        { label: 'Prescriptions', href: '/doctor/prescriptions' },
      ];
    case 'patient':
      return [
        { label: 'Dashboard', href: '/patient' },
        { label: 'Upload MRI', href: '/patient/upload' },
        { label: 'My Chats', href: '/patient/chat' },
        { label: 'Prescriptions', href: '/patient/prescriptions' },
      ];
    default:
      return [];
  }
}
