import { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { DashboardSidebar } from './DashboardSidebar';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <DashboardSidebar />
      
      <main className="lg:pl-64 pt-16">
        <div className="p-6 lg:p-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>

          {/* Page Content */}
          <div className="animate-fade-in">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}