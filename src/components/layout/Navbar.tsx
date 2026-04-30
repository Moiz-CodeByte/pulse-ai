import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { AppLogo } from '@/components/ui/AppLogo';

export function Navbar() {
  const { user, userRole, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getRoleMenuItems = () => {
    switch (userRole) {
      case 'admin':
        return [
          { label: 'Dashboard', href: '/admin' },
          { label: 'All Users', href: '/admin/users' },
          { label: 'Verify Doctors', href: '/admin/verify-doctors' },
          { label: 'Reports', href: '/admin/reports' },
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
          { label: 'Reports', href: '/patient/reports' },
          { label: 'Prescriptions', href: '/patient/prescriptions' },
        ];
      default:
        return [];
    }
  };

  const roleMenuItems = getRoleMenuItems();
  const dashboardPath = roleMenuItems[0]?.href || '/';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group min-w-0">
            <div className="relative">
              <AppLogo className="h-7 w-7 sm:h-8 sm:w-8 animate-heartbeat" />
              <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="text-lg sm:text-xl font-display font-bold text-primary truncate">
              Pulse AI
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            <ThemeToggle />
            {!user ? (
              <>
                <Link to="/#features" className="text-muted-foreground hover:text-foreground transition-colors">
                  Features
                </Link>
                <Link to="/#about" className="text-muted-foreground hover:text-foreground transition-colors">
                  About
                </Link>
                <Link to="/auth">
                  <Button variant="outline" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/auth?mode=register">
                  <Button size="sm">
                    Get Started
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link to={dashboardPath}>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <User className="h-4 w-4" />
                    Dashboard
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </>
            )}
          </div>

          {/* Mobile Theme Toggle and Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <button
              className="p-2 rounded-md hover:bg-muted transition-colors"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-border animate-fade-in">
            <div className="flex flex-col gap-4">
              {!user ? (
                <>
                  <Link to="/#features" className="text-muted-foreground hover:text-foreground transition-colors py-1">
                    Features
                  </Link>
                  <Link to="/#about" className="text-muted-foreground hover:text-foreground transition-colors py-1">
                    About
                  </Link>
                  <Link to="/auth">
                    <Button variant="outline" className="w-full">
                      Sign In
                    </Button>
                  </Link>
                  <Link to="/auth?mode=register">
                    <Button className="w-full">
                      Get Started
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  {roleMenuItems.map((item) => (
                    <Link key={item.href} to={item.href}>
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-2"
                      >
                        <User className="h-4 w-4" />
                        {item.label}
                      </Button>
                    </Link>
                  ))}
                  <Button variant="ghost" onClick={handleSignOut} className="w-full justify-start gap-2">
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}