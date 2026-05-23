import { useEffect, useState } from 'react';
import { Award, BriefcaseBusiness, CalendarDays, Loader2, Phone, Stethoscope, UserRound } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { formatConsultationFee, formatRating } from '@/lib/doctorProfiles';

interface DoctorProfileSummary {
  id: string;
  full_name?: string | null;
  email?: string | null;
  created_at?: string | null;
}

interface DoctorInformation {
  medical_license_number: string | null;
  specialization: string | null;
  years_of_experience: number | null;
  phone_number: string | null;
  office_address: string | null;
  bio: string | null;
  profile_completed: boolean;
  consultation_fee?: number | null;
  average_rating?: number | null;
  total_reviews?: number | null;
  education_history?: Array<{
    degree?: string;
    school?: string;
    graduationYear?: number | null;
    certifications?: string;
  }>;
  work_history?: Array<{
    hospital?: string;
    department?: string;
    position?: string;
  }>;
  availability_schedule?: Array<{
    day?: string;
    startTime?: string;
    endTime?: string;
    notes?: string;
  }>;
  medical_degree?: string | null;
  medical_school?: string | null;
  graduation_year?: number | null;
  additional_certifications?: string | null;
  current_hospital?: string | null;
  department?: string | null;
  position?: string | null;
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-start sm:justify-between">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-medium sm:text-right">{value}</span>
    </div>
  );
}

export function DoctorProfileReviewDialog({
  doctor,
  open,
  onOpenChange,
}: {
  doctor: DoctorProfileSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [doctorInfo, setDoctorInfo] = useState<DoctorInformation | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !doctor?.id) {
      setDoctorInfo(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - doctor_information table not yet in generated types
    supabase
      .from('doctor_information')
      .select('*')
      .eq('user_id', doctor.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) {
          return;
        }

        if (error) {
          console.error('Error loading doctor information:', error);
          setDoctorInfo(null);
        } else {
          setDoctorInfo((data as DoctorInformation | null) ?? null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [doctor?.id, open]);

  const education = doctorInfo?.education_history ?? [];
  const work = doctorInfo?.work_history ?? [];
  const availability = doctorInfo?.availability_schedule ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Doctor Profile Review</DialogTitle>
          <DialogDescription>
            Review professional details, credentials, work history, availability, and contact information.
          </DialogDescription>
        </DialogHeader>

        {!doctor ? null : (
          <div className="space-y-4">
            <Card>
              <CardContent className="grid gap-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Stethoscope className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-semibold">{doctor.full_name || 'Unknown doctor'}</h3>
                  <p className="truncate text-sm text-muted-foreground">{doctor.email || 'No email'}</p>
                  {doctor.created_at && (
                    <p className="text-xs text-muted-foreground">
                      Registered {new Date(doctor.created_at).toLocaleString()}
                    </p>
                  )}
                </div>
                {doctorInfo && (
                  <Badge variant={doctorInfo.profile_completed ? 'default' : 'outline'} className="w-fit">
                    {doctorInfo.profile_completed ? 'Profile Completed' : 'Profile Incomplete'}
                  </Badge>
                )}
              </CardContent>
            </Card>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
            ) : !doctorInfo ? (
              <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                No professional profile has been submitted yet.
              </div>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Award className="h-4 w-4 text-primary" />
                      Credentials
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    <DetailRow label="Medical License" value={doctorInfo.medical_license_number} />
                    <DetailRow label="Specialization" value={doctorInfo.specialization} />
                    <DetailRow label="Experience" value={doctorInfo.years_of_experience !== null ? `${doctorInfo.years_of_experience} years` : null} />
                    <DetailRow label="Consultation Fee" value={formatConsultationFee(doctorInfo.consultation_fee ?? undefined)} />
                    <DetailRow label="Patient Rating" value={formatRating(doctorInfo.average_rating ?? undefined, doctorInfo.total_reviews ?? undefined)} />
                    {doctorInfo.bio && (
                      <div className="rounded-lg border bg-muted/30 p-3 md:col-span-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bio</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm">{doctorInfo.bio}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <UserRound className="h-4 w-4 text-primary" />
                      Education
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {education.length ? (
                      education.map((item, index) => (
                        <div key={`${item.degree}-${index}`} className="rounded-lg border bg-muted/30 p-3">
                          <p className="font-medium">{item.degree || 'Degree not provided'}</p>
                          <p className="text-sm text-muted-foreground">{item.school || 'School not provided'}</p>
                          {item.graduationYear && (
                            <p className="text-xs text-muted-foreground">Graduated: {item.graduationYear}</p>
                          )}
                          {item.certifications && (
                            <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                              <span className="font-medium">Certifications:</span> {item.certifications}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        <DetailRow label="Medical Degree" value={doctorInfo.medical_degree} />
                        <DetailRow label="Medical School" value={doctorInfo.medical_school} />
                        <DetailRow label="Graduation Year" value={doctorInfo.graduation_year} />
                        <DetailRow label="Certifications" value={doctorInfo.additional_certifications} />
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BriefcaseBusiness className="h-4 w-4 text-primary" />
                      Work History
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {work.length ? (
                      work.map((item, index) => (
                        <div key={`${item.hospital}-${index}`} className="rounded-lg border bg-muted/30 p-3">
                          <p className="font-medium">{item.hospital || 'Hospital not provided'}</p>
                          <p className="text-sm text-muted-foreground">
                            {[item.position, item.department].filter(Boolean).join(' - ') || 'Role not provided'}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="grid gap-3 md:grid-cols-3">
                        <DetailRow label="Hospital" value={doctorInfo.current_hospital} />
                        <DetailRow label="Department" value={doctorInfo.department} />
                        <DetailRow label="Position" value={doctorInfo.position} />
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Phone className="h-4 w-4 text-primary" />
                      Contact
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    <DetailRow label="Phone" value={doctorInfo.phone_number} />
                    <DetailRow label="Office Address" value={doctorInfo.office_address} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      Availability
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {availability.length ? (
                      availability.map((slot, index) => (
                        <div key={`${slot.day}-${slot.startTime}-${index}`} className="rounded-lg border bg-muted/30 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium">{slot.day || 'Day not set'}</p>
                            <p className="text-sm text-muted-foreground">
                              {slot.startTime && slot.endTime ? `${slot.startTime} - ${slot.endTime}` : 'Time not provided'}
                            </p>
                          </div>
                          {slot.notes && <p className="mt-2 text-xs text-muted-foreground">{slot.notes}</p>}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No availability schedule provided.</p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
