import { RiskBadge } from '@/components/ui/RiskBadge';
import type { BaseReportDiagnosis } from '@/components/reports/types';

interface ReportDiagnosisDetailsProps {
  diagnosis?: BaseReportDiagnosis;
  emptyMessage?: string;
  badgeSize?: 'sm' | 'md' | 'lg';
  confidenceLabel?: string;
  compact?: boolean;
}

export function ReportDiagnosisDetails({
  diagnosis,
  emptyMessage = 'Diagnosis details are not available for this report yet.',
  badgeSize = 'lg',
  confidenceLabel = 'Confidence Level',
  compact = false,
}: ReportDiagnosisDetailsProps) {
  if (!diagnosis) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="font-medium">Risk Assessment</span>
        <RiskBadge level={diagnosis.risk_level} size={badgeSize} />
      </div>
      <div className="flex items-center justify-between">
        <span className="font-medium">{confidenceLabel}</span>
        <span className={compact ? 'text-sm font-semibold' : 'text-lg font-semibold'}>{diagnosis.confidence}%</span>
      </div>
      {diagnosis.details && (
        <div>
          <span className="font-medium">Analysis Details</span>
          <p className={compact ? 'mt-2 whitespace-pre-line text-sm text-muted-foreground' : 'mt-2 whitespace-pre-line text-muted-foreground'}>{diagnosis.details}</p>
        </div>
      )}
    </>
  );
}