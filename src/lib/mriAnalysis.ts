export type RiskLevel = 'low' | 'medium' | 'high';

export interface RankedResult {
  label: string;
  probability: number;
}

export interface MRIAnalysisResult {
  predictedLabel: string;
  diseaseName: string;
  riskLevel: RiskLevel;
  threatLevel: string;
  confidence: number;
  detail: string;
  patientGuidance: string;
  clinicalPriority: string;
  confidenceNote: string;
  recommendation: string;
  rankedResults: RankedResult[];
  persisted: boolean;
  persistenceMessage: string | null;
}

const DEFAULT_MRI_ANALYSIS_API_URL = 'http://127.0.0.1:5000';
const MRI_ANALYSIS_API_URL = (import.meta.env.VITE_MRI_ANALYSIS_API_URL || DEFAULT_MRI_ANALYSIS_API_URL).trim().replace(/^["']+|["']+$/g, '');

export async function analyzeMRI(file: File, reportId: string): Promise<MRIAnalysisResult> {
  const formData = new FormData();
  formData.append('mri_image', file);
  formData.append('report_id', reportId);

  const response = await fetch(`${MRI_ANALYSIS_API_URL}/analyze`, {
    method: 'POST',
    body: formData,
  });

  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(responseBody?.error || 'The MRI analysis service did not return a valid result.');
  }

  return responseBody as MRIAnalysisResult;
}

export interface CreateUserData {
  email: string;
  password: string;
  fullName: string;
  role: 'patient' | 'doctor' | 'admin';
  verified: boolean;
}

export interface CreateUserResponse {
  success: boolean;
  user_id?: string;
  message?: string;
  error?: string;
}

export async function adminCreateUser(userData: CreateUserData): Promise<CreateUserResponse> {
  const response = await fetch(`${MRI_ANALYSIS_API_URL}/admin/create-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });

  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(responseBody?.error || 'Failed to create user');
  }

  return responseBody as CreateUserResponse;
}