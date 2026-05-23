import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Upload, FileText, Users, UserCheck, Settings, Stethoscope, ClipboardList, PanelLeftClose, PanelLeftOpen, MessageSquare } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { AppLogo } from '@/components/ui/AppLogo';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
}

interface DashboardSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function DashboardSidebar({ isCollapsed, onToggleCollapse }: DashboardSidebarProps) {
  const { userRole, isVerified } = useAuth();
  const location = useLocation();

  const getNavItems = (): NavItem[] => {
    switch (userRole) {
      case 'patient':
        return [
          { title: 'Dashboard', href: '/patient', icon: LayoutDashboard },
          { title: 'Upload MRI', href: '/patient/upload', icon: Upload },
          { title: 'My Reports', href: '/patient/reports', icon: FileText },
          { title: 'My Chats', href: '/patient/chat', icon: MessageSquare },
          { title: 'Prescriptions', href: '/patient/prescriptions', icon: ClipboardList },
        ];
      case 'doctor':
        if (!isVerified) {
          return [
            { title: 'Admin Chat', href: '/doctor/admin-chat', icon: MessageSquare },
            { title: 'My Profile', href: '/doctor/complete-profile', icon: Settings },
          ];
        }

        return [
          { title: 'Dashboard', href: '/doctor', icon: LayoutDashboard },
          { title: 'Patient Cases', href: '/doctor/cases', icon: Users },
          { title: 'Consultations', href: '/doctor/consultations', icon: ClipboardList },
          { title: 'Chat', href: '/doctor/chat', icon: MessageSquare },
          { title: 'Prescriptions', href: '/doctor/prescriptions', icon: FileText },
          { title: 'My Profile', href: '/doctor/complete-profile', icon: Settings },
        ];
      case 'admin':
        return [
          { title: 'Dashboard', href: '/admin', icon: LayoutDashboard },
          { title: 'All Users', href: '/admin/users', icon: Users },
          { title: 'Doctor Verification', href: '/admin/verify-doctors', icon: UserCheck },
          { title: 'Doctor Chats', href: '/admin/support-chat', icon: MessageSquare },
          { title: 'All Reports', href: '/admin/reports', icon: FileText },
          { title: 'Settings', href: '/admin/settings', icon: Settings },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 bottom-0 bg-sidebar border-r border-sidebar-border pt-24 z-40 transition-all duration-300',
        isCollapsed ? 'w-20' : 'w-64',
      )}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        className="absolute -right-3 top-20 inline-flex h-12 w-12 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm transition-colors hover:bg-sidebar-accent"
        aria-label={isCollapsed ? 'Open sidebar' : 'Close sidebar'}
        title={isCollapsed ? 'Open sidebar' : 'Close sidebar'}
      >
        {isCollapsed ? <PanelLeftOpen className="h-6 w-6" /> : <PanelLeftClose className="h-6 w-6" />}
      </button>

      <div className="p-4">
        <div className="mb-4" />

        {/* Role Badge */}
        <div className={cn('mb-6 p-3 bg-sidebar-accent rounded-lg', isCollapsed && 'px-0')}>
          <div className={cn('flex items-center gap-2', isCollapsed && 'justify-center')}>
            <Stethoscope className="h-5 w-5 text-sidebar-primary" />
            {!isCollapsed && (
              <span className="text-sm font-medium text-sidebar-foreground capitalize">
                {userRole} Account
              </span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                aria-label={item.title}
                className={cn(
                  'flex items-center rounded-lg text-sm font-medium transition-all duration-200',
                  isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!isCollapsed && <span className="truncate">{item.title}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className={cn('absolute bottom-4 left-4 right-4', isCollapsed && 'left-2 right-2')}>
        <Link
          to="/"
          className={cn(
            'flex items-center text-muted-foreground hover:text-foreground transition-colors',
            isCollapsed ? 'justify-center' : 'gap-2',
          )}
          aria-label="Pulse AI Home"
        >
          <AppLogo className="h-4 w-4" />
          {!isCollapsed && <span className="text-sm">Pulse AI</span>}
        </Link>
      </div>
    </aside>
  );
}
