import { Link, useLocation } from 'react-router-dom';
import { Heart, LayoutDashboard, Upload, FileText, Users, UserCheck, Settings, Stethoscope, ClipboardList } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
}

export function DashboardSidebar() {
  const { userRole } = useAuth();
  const location = useLocation();

  const getNavItems = (): NavItem[] => {
    switch (userRole) {
      case 'patient':
        return [
          { title: 'Dashboard', href: '/patient', icon: LayoutDashboard },
          { title: 'Upload MRI', href: '/patient/upload', icon: Upload },
          { title: 'My Reports', href: '/patient/reports', icon: FileText },
          { title: 'Prescriptions', href: '/patient/prescriptions', icon: ClipboardList },
        ];
      case 'doctor':
        return [
          { title: 'Dashboard', href: '/doctor', icon: LayoutDashboard },
          { title: 'Patient Cases', href: '/doctor/cases', icon: Users },
          { title: 'Prescriptions', href: '/doctor/prescriptions', icon: ClipboardList },
        ];
      case 'admin':
        return [
          { title: 'Dashboard', href: '/admin', icon: LayoutDashboard },
          { title: 'All Users', href: '/admin/users', icon: Users },
          { title: 'Doctor Verification', href: '/admin/verify-doctors', icon: UserCheck },
          { title: 'All Reports', href: '/admin/reports', icon: FileText },
          { title: 'Settings', href: '/admin/settings', icon: Settings },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border pt-16 hidden lg:block">
      <div className="p-4">
        {/* Role Badge */}
        <div className="mb-6 p-3 bg-sidebar-accent rounded-lg">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-sidebar-primary" />
            <span className="text-sm font-medium text-sidebar-foreground capitalize">
              {userRole} Account
            </span>
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
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 left-4 right-4">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <Heart className="h-4 w-4 text-primary" />
          <span className="text-sm">Pulse AI</span>
        </Link>
      </div>
    </aside>
  );
}