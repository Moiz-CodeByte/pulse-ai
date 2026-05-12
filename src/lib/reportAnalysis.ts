import type { BaseReportDiagnosis } from '@/components/reports/types';
import type { MRIAnalysisResult } from '@/lib/mriAnalysis';

export interface PersistedDiagnosisDetails {
  version?: number;
  headline?: {
    title?: string;
    label?: string;
    riskLevel?: string;
    confidence?: number;
  };
  metrics?: Array<{ label: string; value: string }>;
  sections?: Array<{ title: string; body: string }>;
  summaryText?: string[];
}

export interface NormalizedReportAnalysis {
  diseaseName?: string;
  predictedLabel?: string;
  riskLevel: string;
  threatLevel?: string;
  confidence: number;
  confidenceNote?: string;
  detail?: string;
  patientGuidance?: string;
  priority?: string;
  clinicalPriority?: string;
  summaryText?: string[];
}

function isLiveAnalysisResult(
  analysis: MRIAnalysisResult | BaseReportDiagnosis,
): analysis is MRIAnalysisResult {
  return 'diseaseName' in analysis;
}

export function parseDiagnosisDetails(
  details: string | null | undefined,
): PersistedDiagnosisDetails | null {
  if (!details) {
    return null;
  }

  try {
    const parsed = JSON.parse(details) as PersistedDiagnosisDetails;

    if (parsed && (parsed.sections || parsed.metrics || parsed.summaryText || parsed.headline)) {
      return parsed;
    }
  } catch {
    return { summaryText: details.split('\n').filter(Boolean) };
  }

  return { summaryText: details.split('\n').filter(Boolean) };
}

function getMetricValue(
  parsed: PersistedDiagnosisDetails | null,
  label: string,
): string | undefined {
  return parsed?.metrics?.find((metric) => metric.label === label)?.value;
}

function getSectionValue(
  parsed: PersistedDiagnosisDetails | null,
  titles: string[],
): string | undefined {
  const normalizedTitles = titles.map((title) => title.toLowerCase());

  return parsed?.sections?.find((section) =>
    normalizedTitles.includes(section.title.toLowerCase()),
  )?.body;
}

export function normalizeReportAnalysis(
  analysis: MRIAnalysisResult | BaseReportDiagnosis | null | undefined,
): NormalizedReportAnalysis | null {
  if (!analysis) {
    return null;
  }

  if (isLiveAnalysisResult(analysis)) {
    return {
      diseaseName: analysis.diseaseName,
      predictedLabel: analysis.predictedLabel,
      riskLevel: analysis.riskLevel,
      threatLevel: analysis.threatLevel,
      confidence: analysis.confidence,
      confidenceNote: analysis.confidenceNote,
      detail: analysis.detail,
      patientGuidance: analysis.patientGuidance,
      priority: analysis.recommendation,
      clinicalPriority: analysis.clinicalPriority,
      summaryText: [
        `Predicted disease: ${analysis.diseaseName} (${analysis.predictedLabel})`,
        `Threat level: ${analysis.threatLevel}`,
        `Clinical priority: ${analysis.clinicalPriority}`,
      ],
    };
  }

  const parsed = parseDiagnosisDetails(analysis.details);

  return {
    diseaseName: parsed?.headline?.title,
    predictedLabel: parsed?.headline?.label,
    riskLevel: analysis.risk_level,
    threatLevel: getMetricValue(parsed, 'Threat level'),
    confidence: analysis.confidence,
    confidenceNote: getMetricValue(parsed, 'Confidence note'),
    detail: getSectionValue(parsed, ['Disease detail']),
    patientGuidance: getSectionValue(parsed, ['Patient guidance']),
    priority: getSectionValue(parsed, ['Priority', 'Recommendation']),
    clinicalPriority: getMetricValue(parsed, 'Clinical priority'),
    summaryText: parsed?.summaryText,
  };
}
