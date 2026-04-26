export type ReportRiskLevel = 'low' | 'medium' | 'high';

export interface BaseReportDiagnosis {
  id?: string;
  risk_level: ReportRiskLevel;
  confidence: number;
  details: string | null;
}

export interface BaseReportRecord {
  id: string;
  file_name: string;
  file_url: string;
  status: string;
  created_at: string;
  patient_id?: string;
  diagnosis?: BaseReportDiagnosis;
}