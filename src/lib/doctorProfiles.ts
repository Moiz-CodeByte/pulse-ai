import { supabase } from '@/integrations/supabase/client';

export interface DoctorEducationEntry {
  degree: string;
  school: string;
  graduationYear?: number | null;
  certifications?: string;
}

export interface DoctorWorkEntry {
  hospital: string;
  department: string;
  position: string;
}

export interface DoctorAvailabilityEntry {
  day: string;
  startTime: string;
  endTime: string;
  notes?: string;
}

export interface DoctorDirectoryProfile {
  id: string;
  fullName: string;
  email: string;
  specializations: string[];
  yearsOfExperience?: number;
  medicalLicenseNumber?: string;
  phoneNumber?: string;
  officeAddress?: string;
  bio?: string;
  consultationFee?: number;
  averageRating?: number;
  totalReviews?: number;
  educationHistory: DoctorEducationEntry[];
  workHistory: DoctorWorkEntry[];
  certifications: string[];
  hospitalAffiliations: string[];
  availabilitySchedule: DoctorAvailabilityEntry[];
  profileCompleted: boolean;
}

interface DoctorProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface DoctorInfoRow {
  user_id: string;
  medical_license_number?: string | null;
  specialization?: string | null;
  years_of_experience?: number | null;
  education_history?: unknown;
  work_history?: unknown;
  phone_number?: string | null;
  office_address?: string | null;
  bio?: string | null;
  consultation_fee?: number | null;
  availability_schedule?: unknown;
  average_rating?: number | null;
  total_reviews?: number | null;
  profile_completed?: boolean | null;
}

function normalizeStringList(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeEducationHistory(value: unknown): DoctorEducationEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isObject)
    .map((entry) => ({
      degree: typeof entry.degree === 'string' ? entry.degree : '',
      school: typeof entry.school === 'string' ? entry.school : '',
      graduationYear:
        typeof entry.graduationYear === 'number' ? entry.graduationYear : null,
      certifications:
        typeof entry.certifications === 'string' ? entry.certifications : '',
    }))
    .filter((entry) => entry.degree || entry.school || entry.certifications);
}

function normalizeWorkHistory(value: unknown): DoctorWorkEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isObject)
    .map((entry) => ({
      hospital: typeof entry.hospital === 'string' ? entry.hospital : '',
      department: typeof entry.department === 'string' ? entry.department : '',
      position: typeof entry.position === 'string' ? entry.position : '',
    }))
    .filter((entry) => entry.hospital || entry.department || entry.position);
}

function normalizeAvailabilitySchedule(value: unknown): DoctorAvailabilityEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isObject)
    .map((entry) => ({
      day: typeof entry.day === 'string' ? entry.day : '',
      startTime: typeof entry.startTime === 'string' ? entry.startTime : '',
      endTime: typeof entry.endTime === 'string' ? entry.endTime : '',
      notes: typeof entry.notes === 'string' ? entry.notes : '',
    }))
    .filter((entry) => entry.day || entry.startTime || entry.endTime || entry.notes);
}

export function normalizeDoctorProfile(
  profile: DoctorProfileRow,
  info?: DoctorInfoRow,
): DoctorDirectoryProfile {
  const educationHistory = normalizeEducationHistory(info?.education_history);
  const workHistory = normalizeWorkHistory(info?.work_history);
  const specializations = normalizeStringList(info?.specialization);
  const certifications = educationHistory.flatMap((entry) =>
    normalizeStringList(entry.certifications),
  );
  const hospitalAffiliations = [
    ...new Set(workHistory.map((entry) => entry.hospital.trim()).filter(Boolean)),
  ];

  return {
    id: profile.id,
    fullName: profile.full_name?.trim() || 'Doctor',
    email: profile.email?.trim() || 'Email not available',
    specializations,
    yearsOfExperience: info?.years_of_experience ?? undefined,
    medicalLicenseNumber: info?.medical_license_number ?? undefined,
    phoneNumber: info?.phone_number ?? undefined,
    officeAddress: info?.office_address ?? undefined,
    bio: info?.bio ?? undefined,
    consultationFee: info?.consultation_fee ?? undefined,
    averageRating: info?.average_rating ?? undefined,
    totalReviews: info?.total_reviews ?? undefined,
    educationHistory,
    workHistory,
    certifications,
    hospitalAffiliations,
    availabilitySchedule: normalizeAvailabilitySchedule(info?.availability_schedule),
    profileCompleted: Boolean(info?.profile_completed),
  };
}

async function fetchDoctorInformationRows(
  doctorIds: string[],
): Promise<{ data: DoctorInfoRow[]; error: unknown | null }> {
  // Prefer the latest public-facing fields, but gracefully fall back when a
  // deployment is missing the newer rating columns.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doctorInformationTable = supabase.from('doctor_information') as any;

  const latestResult = await doctorInformationTable
    .select(`
      user_id,
      medical_license_number,
      specialization,
      years_of_experience,
      education_history,
      work_history,
      phone_number,
      office_address,
      bio,
      consultation_fee,
      availability_schedule,
      average_rating,
      total_reviews,
      profile_completed
    `)
    .in('user_id', doctorIds);

  if (!latestResult.error) {
    return {
      data: (latestResult.data ?? []) as DoctorInfoRow[],
      error: null,
    };
  }

  const fallbackResult = await doctorInformationTable
    .select(`
      user_id,
      medical_license_number,
      specialization,
      years_of_experience,
      education_history,
      work_history,
      phone_number,
      office_address,
      bio,
      consultation_fee,
      availability_schedule,
      profile_completed
    `)
    .in('user_id', doctorIds);

  return {
    data: (fallbackResult.data ?? []) as DoctorInfoRow[],
    error: fallbackResult.error ?? latestResult.error,
  };
}

export async function fetchAvailableDoctors(): Promise<DoctorDirectoryProfile[]> {
  const { data: doctorRoles, error: rolesError } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'doctor')
    .eq('verified', true);

  if (rolesError) {
    throw rolesError;
  }

  const doctorIds = (doctorRoles ?? []).map((role) => role.user_id);

  if (!doctorIds.length) {
    return [];
  }

  const [profilesResult, doctorInfoResult] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email').in('id', doctorIds),
    fetchDoctorInformationRows(doctorIds),
  ]);

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  let doctorInfoData: DoctorInfoRow[] = [];
  if (doctorInfoResult.error) {
    console.warn('Error fetching doctor information:', doctorInfoResult.error);
  } else {
    doctorInfoData = doctorInfoResult.data;
  }

  const doctorInfoMap = new Map<string, DoctorInfoRow>(
    doctorInfoData.map((entry) => [entry.user_id, entry]),
  );

  return ((profilesResult.data ?? []) as DoctorProfileRow[])
    .map((profile) => normalizeDoctorProfile(profile, doctorInfoMap.get(profile.id)))
    .sort((left, right) => left.fullName.localeCompare(right.fullName));
}

export function formatConsultationFee(fee?: number): string {
  if (typeof fee !== 'number') {
    return 'Not provided';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(fee);
}

export function formatRating(averageRating?: number, totalReviews?: number): string {
  if (typeof averageRating !== 'number' || typeof totalReviews !== 'number' || totalReviews <= 0) {
    return 'No ratings yet';
  }

  return `${averageRating.toFixed(1)} / 5 (${totalReviews} review${totalReviews === 1 ? '' : 's'})`;
}
