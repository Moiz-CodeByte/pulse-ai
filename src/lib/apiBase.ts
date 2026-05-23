const LOCAL_API_BASE = 'http://127.0.0.1:5000';
const PRODUCTION_API_BASE = 'https://pulse-ai-server.abdulmoiz.net';

function getDefaultApiBase(): string {
  if (typeof window === 'undefined') {
    return LOCAL_API_BASE;
  }

  const hostname = window.location.hostname;
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local');

  return isLocal ? LOCAL_API_BASE : PRODUCTION_API_BASE;
}

export function normalizeApiUrl(value?: string | null): string {
  const cleaned = (value || getDefaultApiBase())
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/^https:\/(?!\/)/i, 'https://')
    .replace(/^http:\/(?!\/)/i, 'http://');

  return cleaned.replace(/\/+$/, '');
}

export function getApiBaseUrl(value?: string | null): string {
  return normalizeApiUrl(value);
}

export function buildApiUrl(path: string, value?: string | null): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl(value)}${cleanPath}`;
}

export function createNetworkError(endpoint: string, error: unknown): Error {
  const detail = error instanceof Error ? error.message : 'Unknown network error';
  return new Error(
    `Could not reach the Pulse AI API at ${endpoint}. Check VITE_MRI_ANALYSIS_API_URL, backend deployment, and CORS. Details: ${detail}`,
  );
}
