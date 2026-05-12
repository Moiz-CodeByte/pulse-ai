import type { ReactNode } from 'react';
import { Activity, ShieldAlert, Stethoscope } from 'lucide-react';
import type { BaseReportDiagnosis } from '@/components/reports/types';
import { RiskBadge } from '@/components/ui/RiskBadge';
import type { MRIAnalysisResult } from '@/lib/mriAnalysis';
import { normalizeReportAnalysis } from '@/lib/reportAnalysis';

interface ReportAnalysisPanelProps {
  analysis?: MRIAnalysisResult | BaseReportDiagnosis | null;
  preview: ReactNode;
  sidebarContent?: ReactNode;
  actionBar?: ReactNode;
  footerMessage?: string | null;
  footerActions?: ReactNode;
  emptyMessage?: string;
}

export function ReportAnalysisPanel({
  analysis,
  preview,
  sidebarContent,
  actionBar,
  footerMessage,
  footerActions,
  emptyMessage = 'Diagnosis details are not available for this report yet.',
}: ReportAnalysisPanelProps) {
  const normalized = normalizeReportAnalysis(analysis);
  const detailText =
    normalized?.detail ||
    normalized?.summaryText?.join('\n') ||
    'Detailed disease interpretation is not available for this report yet.';
  const patientGuidance =
    normalized?.patientGuidance ||
    'Review these findings with a clinician to confirm the result and discuss next steps.';
  const priorityText =
    normalized?.priority ||
    'Follow the reported clinical priority and arrange physician review based on symptoms.';
  const clinicalPriority = normalized?.clinicalPriority || 'Routine follow-up';
  const confidenceNote =
    normalized?.confidenceNote || 'Clinical confirmation is still required.';

  return (
    <div className="space-y-6 py-2">
      <div className="grid gap-6 lg:grid-cols-[220px,1fr]">
        <div className="space-y-4">
          {preview}

          {normalized && (
            <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Risk Assessment
                </p>
                <div className="mt-2">
                  <RiskBadge level={normalized.riskLevel as 'low' | 'medium' | 'high'} size="sm" />
                </div>
              </div>

              {normalized.threatLevel && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Threat Level
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {normalized.threatLevel}
                  </p>
                </div>
              )}
            </div>
            
          )}
          {normalized && (
            <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Clinical Priority
                </p>
                <div className="mt-2">
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {normalized.clinicalPriority}
                  </p>
                </div>
              </div>

            
            </div>
            
          )}
          {sidebarContent}
        </div>

        <div className="space-y-4">
          {actionBar ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {actionBar}
            </div>
          ) : null}

          {normalized ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Predicted Disease
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {normalized.diseaseName || 'Analysis Available'}
                  </p>
                  {/* <p className="text-sm text-muted-foreground">
                    Class: {normalized.predictedLabel || 'N/A'}
                  </p> */}
                </div>

                <div className="rounded-xl border p-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Activity className="h-4 w-4" />
                    <p className="text-xs font-medium uppercase tracking-wide">
                      Model Confidence
                    </p>
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {normalized.confidence.toFixed(2)}%
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{confidenceNote}</p>
                </div>

                {/* <div className="rounded-xl border p-4">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-foreground">Priority</h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {priorityText}
                  </p>
                </div> */}

                {/* <div className="rounded-xl border p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Clinical Priority
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {clinicalPriority}
                  </p>
                </div> */}
              </div>

              <div className="grid gap-4 lg:grid-cols-1">
                <div className="rounded-xl border p-4">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-foreground">Disease Detail</h3>
                  </div>
                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                    {detailText}
                  </p>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-foreground">Patient Guidance</h3>
                  </div>
                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                    {patientGuidance}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          )}
        </div>
      </div>

      {(footerMessage || footerActions) && (
        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {footerMessage || 'Result generated from the saved MRI model.'}
          </p>
          {footerActions ? <div className="flex flex-wrap gap-2">{footerActions}</div> : null}
        </div>
      )}
    </div>
  );
}
