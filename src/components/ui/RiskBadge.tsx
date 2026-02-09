import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';

type RiskLevel = 'low' | 'medium' | 'high';

interface RiskBadgeProps {
  level: RiskLevel;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function RiskBadge({ level, size = 'md', showIcon = true }: RiskBadgeProps) {
  const config = {
    low: {
      label: 'Low Risk',
      icon: CheckCircle,
      className: 'bg-success/10 text-success border-success/20',
    },
    medium: {
      label: 'Medium Risk',
      icon: AlertCircle,
      className: 'bg-warning/10 text-warning border-warning/20',
    },
    high: {
      label: 'High Risk',
      icon: AlertTriangle,
      className: 'bg-destructive/10 text-destructive border-destructive/20',
    },
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-3 py-1 gap-1.5',
    lg: 'text-base px-4 py-2 gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const { label, icon: Icon, className } = config[level];

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border',
        className,
        sizeClasses[size]
      )}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {label}
    </span>
  );
}