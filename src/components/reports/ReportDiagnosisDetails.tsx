import { RiskBadge } from '@/components/ui/RiskBadge';
import type { BaseReportDiagnosis } from '@/components/reports/types';
import { normalizeReportAnalysis } from '@/lib/reportAnalysis';

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
  if (!diagnosis) return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;

  const normalized = normalizeReportAnalysis(diagnosis);

  if (compact) {
    return (
      <>
        <div className="flex items-center justify-between"><span className="font-medium">Risk Assessment</span><RiskBadge level={diagnosis.risk_level} size={badgeSize} /></div>
        <div className="flex items-center justify-between"><span className="font-medium">{confidenceLabel}</span><span className="text-sm font-semibold">{diagnosis.confidence}%</span></div>
        {normalized?.summaryText?.length ? <p className="whitespace-pre-line text-sm text-muted-foreground">{normalized.summaryText.slice(0, 3).join('\n')}</p> : null}
      </>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-muted/30 p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Predicted Pattern</p><p className="mt-2 text-lg font-semibold">{normalized?.diseaseName || 'Analysis Available'}</p><p className="text-sm text-muted-foreground">Class: {normalized?.predictedLabel || 'N/A'}</p></div>
        <div className="rounded-xl border bg-muted/30 p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Risk Assessment</p><div className="mt-2"><RiskBadge level={diagnosis.risk_level} size={badgeSize} /></div><p className="mt-2 text-sm text-muted-foreground">{normalized?.threatLevel || 'Clinical screening result'}</p></div>
        <div className="rounded-xl border bg-muted/30 p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{confidenceLabel}</p><p className="mt-2 text-2xl font-semibold">{diagnosis.confidence}%</p><p className="mt-1 text-sm text-muted-foreground">{normalized?.confidenceNote || 'Clinical confirmation is still required.'}</p></div>
        <div className="rounded-xl border bg-muted/30 p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Clinical Priority</p><p className="mt-2 text-lg font-semibold">{normalized?.clinicalPriority || 'Routine follow-up'}</p><p className="mt-1 text-sm text-muted-foreground">{normalized?.priority || 'Follow the clinical priority guidance for next steps.'}</p></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border p-4"><p className="text-sm font-semibold">Disease Detail</p><p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">{normalized?.detail || 'Detailed disease interpretation is not available for this report yet.'}</p></div>
        <div className="rounded-xl border p-4"><p className="text-sm font-semibold">Patient Guidance</p><p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">{normalized?.patientGuidance || 'Review these findings with a clinician to confirm the result and discuss next steps.'}</p></div>
      </div>
    </div>
  );
}
