import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { getNavbarMenuItems } from '@/lib/navigation';

const mockUseAuth = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('navigation configuration', () => {
  it('removes report links from patient and admin navbar menus', () => {
    expect(getNavbarMenuItems('patient').map((item) => item.href)).not.toContain('/patient/reports');
    expect(getNavbarMenuItems('admin').map((item) => item.href)).not.toContain('/admin/reports');
  });

  it('does not render patient report navigation in the dashboard sidebar', () => {
    mockUseAuth.mockReturnValue({ userRole: 'patient' });

    render(
      <MemoryRouter>
        <DashboardSidebar isCollapsed={false} onToggleCollapse={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.queryByText('My Reports')).not.toBeInTheDocument();
    expect(screen.getByText('Upload MRI')).toBeInTheDocument();
    expect(screen.getByText('My Chats')).toBeInTheDocument();
  });

  it('does not render admin report navigation in the dashboard sidebar', () => {
    mockUseAuth.mockReturnValue({ userRole: 'admin' });

    render(
      <MemoryRouter>
        <DashboardSidebar isCollapsed={false} onToggleCollapse={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.queryByText('All Reports')).not.toBeInTheDocument();
    expect(screen.getByText('Doctor Verification')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});
