import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppLogoProps {
  className?: string;
}

export function AppLogo({ className }: AppLogoProps) {
  return <Activity className={cn('h-8 w-8 text-primary', className)} aria-hidden="true" />;
}
