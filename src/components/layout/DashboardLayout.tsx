import { ReactNode, useState } from 'react';
import { Navbar } from './Navbar';
import { DashboardSidebar } from './DashboardSidebar';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />
      <DashboardSidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
      />
      
      <main className={`pt-16 transition-all duration-300 ${isSidebarCollapsed ? 'pl-20' : 'pl-64'}`}>
        <div className="p-4 sm:p-6 lg:p-8">
          {/* Page Header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-foreground leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm sm:text-base text-muted-foreground">
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